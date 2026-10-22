/*
 * Record lecture (app/record.html?set=<id>). Pro feature, wrapped in proGate().
 * Load after data.js and app.js.
 *
 * Two columns (stacked on mobile):
 *   Left: title, record button, timer, a live waveform from the microphone
 *         (Web Audio API AnalyserNode), Pause / Resume / Stop. MediaRecorder
 *         keeps the audio.
 *   Right: the live transcript (Web Speech API, en-IN), one line per phrase
 *         with a [mm:ss] timestamp, auto-scrolling.
 * After Stop: "Generate notes from this lecture?" → the right panel switches
 * between Transcript and Notes tabs → "Save to study set" saves the recording
 * (audio in IndexedDB), transcript and notes in one go.
 *
 * Without a microphone or speech recognition it runs a clearly labelled demo:
 * a simulated waveform and a transcript read from the set's notes.
 */
(function () {
  "use strict";

  const main = document.querySelector("main");
  const { set: initialSet } = setFromUrl();
  const set = () => getSet(initialSet.id);

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const canRecordAudio = Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.AudioContext);
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const WAVE_BAR = 4;   // px per bar, including the gap
  const DEMO_LINE_MS = 3600;

  const state = {
    screen: "idle",     // "idle" | "recording" | "paused" | "review" | "saved"
    title: "",
    elapsedMs: 0,
    startedAt: 0,       // when the current recording stretch started
    lines: [],          // [{ at: seconds, text }]
    interim: "",        // words still being recognised
    demo: null,         // why we're in demo mode: "mic" | "speech" | null
    tab: "transcript",
    notes: null,        // drafted notes, or "drafting"
    saved: null,        // the saved recording
    follow: true,       // auto-scroll the transcript
  };

  // Live capture objects (not part of the rendered state).
  const live = {
    stream: null, ctx: null, analyser: null, data: null, recorder: null, chunks: [], blob: null, audioUrl: null,
    rec: null, timer: null, frame: null, levels: [], demoTimer: null, demoQueue: [],
  };

  function clock(ms) {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return h ? `${h}:${m}:${s}` : `${m}:${s}`;
  }

  function durationLabel(sec) {
    const m = Math.round(sec / 60);
    return m < 1 ? `${sec} sec` : `${m} min`;
  }

  const elapsed = () => state.elapsedMs + (state.screen === "recording" ? Date.now() - state.startedAt : 0);
  const defaultTitle = () => `${set().name} lecture, ${formatDate(todayISO())}`;
  const plain = (text) => String(text).replace(/\*\*|`/g, "");

  // ---------------------------------------------------------------------------
  // Audio storage (IndexedDB): recording id → audio Blob
  // ---------------------------------------------------------------------------

  function openAudioDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("skipxam-audio", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("recordings");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function putAudio(id, blob) {
    const db = await openAudioDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("recordings", "readwrite");
      tx.objectStore("recordings").put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getAudio(id) {
    const db = await openAudioDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction("recordings").objectStore("recordings").get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  // ---------------------------------------------------------------------------
  // Notes, drafted from the transcript (a stand-in for AI note-writing)
  // ---------------------------------------------------------------------------

  function draftNotes(s, lines) {
    const text = lines.map((l) => l.text).join(" ").toLowerCase();
    const words = (str) => plain(str).toLowerCase().match(/[a-z][a-z0-9+#]{3,}/g) || [];

    // The topic whose name and key terms come up most.
    let best = null;
    for (const t of s.topics) {
      const section = s.notes.find((n) => n.topicId === t.id);
      const terms = [...new Set([...words(t.name), ...(section ? [...section.intro.matchAll(/\*\*(.+?)\*\*/g), ...section.points.join(" ").matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1].toLowerCase()) : [])])];
      const score = terms.reduce((n, term) => n + (text.includes(term) ? 1 : 0), 0);
      if (score > 0 && (!best || score > best.score)) best = { topic: t, section, score, terms };
    }

    const sentences = lines.map((l) => ({ at: l.at, text: l.text.trim() })).filter((l) => l.text.split(/\s+/).length >= 5);
    const generic = new Set(["concepts", "basics", "introduction", "part", "unit", "with", "from", "that"]);
    const keyTerms = best ? best.terms.filter((term) => text.includes(term) && !generic.has(term)) : [];
    const ranked = [...sentences].sort((a, b) =>
      keyTerms.filter((k) => b.text.toLowerCase().includes(k)).length - keyTerms.filter((k) => a.text.toLowerCase().includes(k)).length);
    const tidy = (str) => {
      const t = str.charAt(0).toUpperCase() + str.slice(1);
      return /[.?!]$/.test(t) ? t : `${t}.`;
    };
    const summaryLines = sentences.slice(0, 2);
    const summary = summaryLines.map((l) => tidy(l.text)).join(" ");
    const keyPoints = ranked.filter((l) => !summaryLines.includes(l) || sentences.length <= 3)
      .slice(0, 6).sort((a, b) => a.at - b.at).map((l) => tidy(l.text));
    const step = Math.max(1, Math.ceil(lines.length / 5));
    const outline = lines.filter((_, i) => i % step === 0).map((l) => ({ at: l.at, text: tidy(l.text).slice(0, 90) }));

    return {
      topicId: best ? best.topic.id : null,
      topicName: best ? best.topic.name : "",
      summary: summary || (lines[0] ? tidy(lines[0].text) : ""),
      keyPoints: keyPoints.length ? keyPoints : lines.slice(0, 4).map((l) => tidy(l.text)),
      terms: keyTerms.slice(0, 8),
      remember: best && best.section && best.section.remember ? plain(best.section.remember) : "",
      outline,
    };
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  function demoNoticeHtml() {
    if (!state.demo) return "";
    const why = state.demo === "mic"
      ? "Microphone not available, so this is a demo recording: the waveform is simulated and the transcript is read from your notes."
      : "Live transcription isn't available in this browser, so the transcript below is a demo read from your notes. Your audio is still recorded.";
    return `<p class="rec-demo">${icon("sparkle")}<span>${why}</span></p>`;
  }

  function recorderHtml() {
    const recording = state.screen === "recording";
    const paused = state.screen === "paused";
    const active = recording || paused;
    const after = state.screen === "review" || state.screen === "saved";
    const status = recording ? "Recording" : paused ? "Paused" : after ? `Recorded ${clock(state.elapsedMs)}` : "Ready when you are";

    return `
      <section class="card recorder${recording ? " is-recording" : ""}${paused ? " is-paused" : ""}" aria-label="Recorder">
        <div class="field rec-title-field">
          <label class="field-label" for="rec-title">Lecture title</label>
          <input class="input" id="rec-title" value="${escapeHtml(state.title)}" placeholder="${escapeHtml(defaultTitle())}" maxlength="80"${state.screen === "saved" ? " disabled" : ""}>
        </div>

        <div class="rec-stage">
          ${active || after ? "" : `
            <button type="button" class="rec-main-btn" data-record aria-label="Start recording">${icon("mic")}</button>`}
          <p class="rec-timer" role="timer" aria-label="Recording time">${clock(elapsed())}</p>
          <p class="rec-status" aria-live="polite">
            ${recording ? '<span class="rec-dot" aria-hidden="true"></span>' : ""}${status}
          </p>
          <canvas class="waveform" height="96" aria-hidden="true"></canvas>
        </div>

        ${active ? `
          <div class="rec-controls">
            <button type="button" class="btn btn-secondary" data-pause>
              ${icon(paused ? "play" : "pause")}${paused ? "Resume" : "Pause"}
            </button>
            <button type="button" class="btn btn-danger" data-stop>${icon("stop")}Stop</button>
          </div>` : ""}

        ${after && live.audioUrl ? `
          <div class="rec-playback">
            <p class="field-label">Listen back</p>
            <audio controls src="${live.audioUrl}" class="rec-audio"></audio>
          </div>` : ""}

        ${state.screen === "review" ? `
          <div class="rec-controls">
            <button type="button" class="btn btn-ghost" data-discard>${icon("trash")}Discard</button>
          </div>` : ""}

        ${state.screen === "saved" ? `
          <div class="rec-saved">
            <p>${icon("check")}Saved to ${escapeHtml(set().name)}</p>
            <button type="button" class="btn btn-primary" data-again>${icon("mic")}Record another</button>
          </div>` : ""}

        ${state.screen === "idle" ? `<p class="rec-hint muted">Recording uses your microphone. The transcript is written live in English (India).</p>` : ""}
        ${active ? demoNoticeHtml() : ""}
      </section>`;
  }

  function transcriptLinesHtml() {
    return `
      ${state.lines.map((l, i) => `
        <li class="t-line">
          <button type="button" class="t-time" data-seek="${l.at}"${live.audioUrl && (state.screen === "review" || state.screen === "saved") ? "" : " disabled"}
            aria-label="${clock(l.at * 1000)}">[${clock(l.at * 1000)}]</button>
          <span class="t-text">${escapeHtml(l.text)}</span>
        </li>`).join("")}
      ${state.interim ? `<li class="t-line is-interim"><span class="t-time">[${clock(elapsed())}]</span><span class="t-text">${escapeHtml(state.interim)}</span></li>` : ""}`;
  }

  function notesHtml() {
    const n = state.notes;
    if (n === "drafting") {
      return `<div class="notes-drafting" role="status"><span class="spinner" aria-hidden="true"></span>Writing notes from your lecture…</div>`;
    }
    if (!n) {
      return `
        <div class="panel-empty">
          <p>No notes yet.</p>
          <button type="button" class="btn btn-primary btn-sm" data-generate>${icon("sparkle")}Generate notes</button>
        </div>`;
    }
    return `
      <article class="lecture-notes-doc">
        ${n.topicName ? `<p class="notes-topic">${icon("notes")}Matched to <strong>${escapeHtml(n.topicName)}</strong></p>` : ""}
        <h3>Summary</h3>
        <p>${escapeHtml(n.summary)}</p>
        <h3>Key points</h3>
        <ul>${n.keyPoints.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
        ${n.terms.length ? `<h3>Key terms</h3><p class="notes-terms">${n.terms.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("")}</p>` : ""}
        ${n.remember ? `<aside class="notes-remember"><strong>Remember:</strong> ${escapeHtml(n.remember)}</aside>` : ""}
        ${n.outline.length > 1 ? `
          <h3>Outline</h3>
          <ol class="notes-outline">${n.outline.map((o) => `<li><span class="t-time-static">[${clock(o.at * 1000)}]</span>${escapeHtml(o.text)}</li>`).join("")}</ol>` : ""}
      </article>`;
  }

  function panelHtml() {
    const after = state.screen === "review" || state.screen === "saved";
    const empty = !state.lines.length && !state.interim;
    const tabs = after ? `
      <div class="panel-tabs" role="tablist" aria-label="Lecture">
        <button type="button" role="tab" id="tab-transcript" aria-controls="panel-body" aria-selected="${state.tab === "transcript"}" data-tab="transcript"${state.tab === "transcript" ? "" : ' tabindex="-1"'}>Transcript</button>
        <button type="button" role="tab" id="tab-notes" aria-controls="panel-body" aria-selected="${state.tab === "notes"}" data-tab="notes"${state.tab === "notes" ? "" : ' tabindex="-1"'}>Notes</button>
      </div>` : `<h2 class="panel-title">Live transcript <span class="panel-lang">English (India)</span></h2>`;

    let body;
    if (after && state.tab === "notes") body = notesHtml();
    else if (empty) {
      body = `<div class="panel-empty">${icon("mic")}<p>${state.screen === "idle" ? "Start recording and the transcript appears here as you speak." : "Listening… start speaking."}</p></div>`;
    } else body = `<ol class="transcript-lines">${transcriptLinesHtml()}</ol>`;

    return `
      <section class="card transcript-panel" aria-label="${after ? "Transcript and notes" : "Live transcript"}">
        <header class="panel-head">
          ${tabs}
          ${after ? `
            <button type="button" class="btn btn-primary btn-sm" data-save${state.screen === "saved" ? " disabled" : ""}>
              ${icon(state.screen === "saved" ? "check" : "upload")}${state.screen === "saved" ? "Saved" : "Save to study set"}
            </button>` : ""}
        </header>
        <div class="panel-body" id="panel-body"${after ? ` role="tabpanel" aria-labelledby="tab-${state.tab}"` : ' aria-live="polite"'} tabindex="0">${body}</div>
        ${!after && !state.follow && state.lines.length ? '<button type="button" class="btn btn-secondary btn-sm jump-latest" data-follow>Jump to latest</button>' : ""}
      </section>`;
  }

  function lectureBodyHtml(rec) {
    return `
      ${rec.hasAudio ? `<audio controls class="rec-audio" data-audio-for="${rec.id}" preload="none"></audio>` : ""}
      <div class="lecture-cols">
        <div>
          <h3 class="lecture-h">Notes</h3>
          ${rec.summary ? `<p class="lecture-summary">${escapeHtml(rec.summary)}</p>` : ""}
          ${rec.notes.length ? `<ul class="lecture-notes">${rec.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>` : '<p class="muted">No notes were generated for this recording.</p>'}
        </div>
        <div>
          <h3 class="lecture-h">Transcript</h3>
          <ol class="transcript">
            ${rec.transcript.map((line) => `<li><span class="ts">[${clock(line.at * 1000)}]</span><span>${escapeHtml(line.text)}</span></li>`).join("")}
          </ol>
        </div>
      </div>`;
  }

  function historyHtml(s) {
    const recs = s.recordings;
    return `
      <section class="rec-history" aria-labelledby="history-title">
        <h2 id="history-title" class="history-title">Past recordings for ${escapeHtml(s.name)}</h2>
        ${recs.length ? `
          <ul class="history-list">
            ${recs.map((r) => `
              <li>
                <details class="card history-item" data-rec="${r.id}">
                  <summary>
                    <span class="history-icon">${icon("mic")}</span>
                    <span class="history-text">
                      <span class="history-name">${escapeHtml(r.title)}</span>
                      <span class="muted">${formatDate(r.date)} · ${durationLabel(r.durationSec)} · ${r.transcript.length} lines${r.notes.length ? " · notes" : ""}${r.hasAudio ? " · audio" : ""}</span>
                    </span>
                    <span class="history-chevron" aria-hidden="true"></span>
                  </summary>
                  ${lectureBodyHtml(r)}
                </details>
              </li>`).join("")}
          </ul>` : '<p class="muted">No recordings yet. Lectures you save appear here.</p>'}
      </section>`;
  }

  function render() {
    if (!initialSet) {
      main.innerHTML = setNotFoundHtml();
      return;
    }
    const s = set();
    document.title = `Record lecture · ${s.name} · SkipXam`;
    const proBadge = getUser().plan === "free" ? ' <span class="badge badge-pro">Pro</span>' : "";

    main.innerHTML = `
      ${toolHeaderHtml(s, `Record lecture${proBadge}`)}
      <div class="record-area">
        <p class="record-intro muted">Record a class, watch the transcript appear live, then turn it into notes for this set.</p>
        <div class="record-layout">
          <div class="record-left">${recorderHtml()}</div>
          <div class="record-right">${panelHtml()}</div>
        </div>
        ${historyHtml(s)}
      </div>`;
    proGate(main.querySelector(".record-area"), "Record lecture");
    drawWave();
  }

  function renderLeft() {
    main.querySelector(".record-left").innerHTML = recorderHtml();
    drawWave();
  }

  function renderPanel() {
    const body = main.querySelector(".panel-body");
    const keep = body && !state.follow ? body.scrollTop : null;
    main.querySelector(".record-right").innerHTML = panelHtml();
    const next = main.querySelector(".panel-body");
    if (keep !== null) next.scrollTop = keep;
    else if (state.screen === "recording" || state.screen === "paused") next.scrollTop = next.scrollHeight;
  }

  // Live updates only touch the transcript list, so scrolling and focus stay put.
  function renderLines() {
    const list = main.querySelector(".transcript-lines");
    if (!list) return renderPanel();
    list.innerHTML = transcriptLinesHtml();
    if (state.follow) {
      const body = main.querySelector(".panel-body");
      body.scrollTop = body.scrollHeight;
    }
    return undefined;
  }

  // ---------------------------------------------------------------------------
  // Waveform: a scrolling strip of bars, one per animation frame's loudness.
  // ---------------------------------------------------------------------------

  function drawWave() {
    const canvas = main.querySelector(".waveform");
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width) return;
    if (canvas.width !== Math.round(width * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    const g = canvas.getContext("2d");
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, width, height);
    const styles = getComputedStyle(canvas);
    const accent = styles.getPropertyValue("--wave-colour").trim() || "#e08a38";
    const muted = styles.getPropertyValue("--wave-idle").trim() || "#3d3832";
    const count = Math.floor(width / WAVE_BAR);
    const levels = live.levels.slice(-count);
    const mid = height / 2;
    for (let i = 0; i < count; i++) {
      const level = levels[i - (count - levels.length)];
      const has = level !== undefined;
      const h = has ? Math.max(3, level * (height - 8)) : 3;
      g.fillStyle = has && state.screen === "recording" ? accent : muted;
      g.fillRect(i * WAVE_BAR, mid - h / 2, WAVE_BAR - 1.5, h);
    }
  }

  function loudness() {
    if (live.analyser) {
      live.analyser.getByteTimeDomainData(live.data);
      let sum = 0;
      for (let i = 0; i < live.data.length; i++) {
        const v = (live.data[i] - 128) / 128;
        sum += v * v;
      }
      return Math.min(1, Math.sqrt(sum / live.data.length) * 4.5);
    }
    // Demo: a voice-like swell with pauses between "sentences".
    const t = Date.now() / 1000;
    const phrase = Math.max(0, Math.sin(t * 1.3)) ** 0.6;
    return Math.min(1, phrase * (0.35 + 0.45 * Math.abs(Math.sin(t * 9.1) * Math.cos(t * 5.3))) + Math.random() * 0.06);
  }

  let lastSample = 0;
  function waveLoop(now) {
    if (state.screen !== "recording") return;
    if (now - lastSample > 45) { // about 22 bars a second
      lastSample = now;
      live.levels.push(loudness());
      if (live.levels.length > 1200) live.levels.splice(0, 600);
      if (!reducedMotion() || live.levels.length % 6 === 0) drawWave();
    }
    live.frame = requestAnimationFrame(waveLoop);
  }

  // ---------------------------------------------------------------------------
  // Transcription
  // ---------------------------------------------------------------------------

  function addLine(text, at) {
    const clean = text.trim();
    if (!clean) return;
    state.lines.push({ at, text: clean.charAt(0).toUpperCase() + clean.slice(1) });
  }

  function startRecognition() {
    if (!SpeechRecognition || state.demo) return;
    const rec = new SpeechRecognition();
    rec.lang = "en-IN";
    rec.continuous = true;
    rec.interimResults = true;
    let phraseStart = null;
    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (phraseStart === null) phraseStart = Math.floor(elapsed() / 1000);
        if (r.isFinal) {
          addLine(r[0].transcript, phraseStart);
          phraseStart = null;
        } else {
          interim += r[0].transcript;
        }
      }
      state.interim = interim.trim();
      renderLines();
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "network") {
        // Speech service unavailable: keep recording audio, demo the transcript.
        live.rec = null;
        state.demo = "speech";
        renderLeft();
        startDemoTranscript();
      }
    };
    rec.onend = () => {
      // The service stops after a pause in speech; carry on while recording.
      if (live.rec === rec && state.screen === "recording") {
        try { rec.start(); } catch { /* already restarting */ }
      }
    };
    live.rec = rec;
    try { rec.start(); } catch { /* started */ }
  }

  function stopRecognition() {
    const rec = live.rec;
    live.rec = null;
    if (rec) { try { rec.stop(); } catch { /* stopped */ } }
    if (state.interim) {
      addLine(state.interim, Math.floor(elapsed() / 1000));
      state.interim = "";
    }
  }

  // Demo transcript: the set's notes, read out a few words at a time.
  function demoSentences() {
    const s = set();
    const out = [];
    for (const n of s.notes) {
      out.push(`Okay, let's look at ${topicName(s, n.topicId)}.`, plain(n.intro), ...n.points.map(plain));
      if (n.remember) out.push(`Remember this one for the exam: ${plain(n.remember)}`);
    }
    return out.length ? out : [`Today we're starting ${s.name}.`, "Please take notes as we go."];
  }

  function startDemoTranscript() {
    clearInterval(live.demoTimer);
    if (!live.demoQueue.length) live.demoQueue = demoSentences();
    let words = [];
    let at = 0;
    live.demoTimer = setInterval(() => {
      if (state.screen !== "recording") return;
      if (!words.length) {
        const next = live.demoQueue.shift();
        if (!next) return;
        words = next.split(" ");
        at = Math.floor(elapsed() / 1000);
        state.interim = "";
      }
      const take = words.splice(0, 3).join(" ");
      state.interim = `${state.interim} ${take}`.trim();
      if (!words.length) {
        addLine(state.interim, at);
        state.interim = "";
      }
      renderLines();
    }, DEMO_LINE_MS / 8);
  }

  // ---------------------------------------------------------------------------
  // Recorder actions
  // ---------------------------------------------------------------------------

  function warnBeforeLeaving(event) {
    event.preventDefault();
    event.returnValue = "";
  }

  async function startCapture() {
    if (!canRecordAudio) return false;
    // Created during the click, before any await: otherwise the browser's
    // autoplay policy can leave it suspended and the waveform reads silence.
    live.ctx = new AudioContext();
    live.ctx.resume();
    try {
      live.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      console.warn("SkipXam: microphone unavailable, using a demo recording.", err);
      live.ctx.close();
      live.ctx = null;
      return false;
    }
    live.ctx.resume(); // not awaited: it can stay pending until the page may play audio
    const source = live.ctx.createMediaStreamSource(live.stream);
    live.analyser = live.ctx.createAnalyser();
    live.analyser.fftSize = 1024;
    live.data = new Uint8Array(live.analyser.fftSize);
    source.connect(live.analyser);
    if (window.MediaRecorder) {
      live.chunks = [];
      live.recorder = new MediaRecorder(live.stream);
      live.recorder.ondataavailable = (e) => { if (e.data.size) live.chunks.push(e.data); };
      live.recorder.start(1000);
    }
    return true;
  }

  function releaseCapture() {
    return new Promise((resolve) => {
      const finish = () => {
        if (live.stream) live.stream.getTracks().forEach((t) => t.stop());
        if (live.ctx) live.ctx.close();
        Object.assign(live, { stream: null, ctx: null, analyser: null, data: null, recorder: null });
        resolve();
      };
      if (live.recorder && live.recorder.state !== "inactive") {
        live.recorder.onstop = () => {
          if (live.chunks.length) {
            live.blob = new Blob(live.chunks, { type: live.recorder.mimeType || "audio/webm" });
            live.audioUrl = URL.createObjectURL(live.blob);
          }
          finish();
        };
        live.recorder.stop();
      } else {
        finish();
      }
    });
  }

  function startLoops() {
    clearInterval(live.timer);
    live.timer = setInterval(() => {
      const el = main.querySelector(".rec-timer");
      if (el) el.textContent = clock(elapsed());
    }, 250);
    cancelAnimationFrame(live.frame);
    live.frame = requestAnimationFrame(waveLoop);
  }

  function stopLoops() {
    clearInterval(live.timer);
    cancelAnimationFrame(live.frame);
  }

  async function record() {
    if (getUser().plan === "free") {
      openUpgrade("Record lecture");
      return;
    }
    state.title = main.querySelector("#rec-title").value.trim();
    const btn = main.querySelector("[data-record]");
    btn.disabled = true;
    const hasMic = await startCapture();
    Object.assign(state, {
      screen: "recording", elapsedMs: 0, startedAt: Date.now(), lines: [], interim: "",
      demo: !hasMic ? "mic" : !SpeechRecognition ? "speech" : null,
      tab: "transcript", notes: null, saved: null, follow: true,
    });
    live.levels = [];
    live.demoQueue = [];
    window.addEventListener("beforeunload", warnBeforeLeaving);
    renderLeft();
    renderPanel();
    startLoops();
    if (state.demo) startDemoTranscript(); else startRecognition();
    main.querySelector("[data-stop]").focus();
  }

  function togglePause() {
    if (state.screen === "recording") {
      state.elapsedMs += Date.now() - state.startedAt;
      state.screen = "paused";
      stopLoops();
      stopRecognition();
      if (live.recorder && live.recorder.state === "recording") live.recorder.pause();
      if (live.ctx) live.ctx.suspend();
    } else {
      state.startedAt = Date.now();
      state.screen = "recording";
      if (live.recorder && live.recorder.state === "paused") live.recorder.resume();
      if (live.ctx) live.ctx.resume();
      startLoops();
      if (!state.demo) startRecognition();
    }
    renderLeft();
    renderLines();
    main.querySelector("[data-pause]").focus();
  }

  async function stop() {
    if (state.screen === "recording") state.elapsedMs += Date.now() - state.startedAt;
    stopLoops();
    stopRecognition();
    clearInterval(live.demoTimer);
    if (state.interim) { addLine(state.interim, Math.floor(state.elapsedMs / 1000)); state.interim = ""; }
    await releaseCapture();
    state.screen = "review";
    state.title = main.querySelector("#rec-title").value.trim();
    renderLeft();
    renderPanel();

    if (!state.lines.length) {
      showToast("Nothing was transcribed. You can still save the audio.");
      return;
    }
    const generate = await confirmDialog({
      title: "Generate notes from this lecture?",
      message: `SkipXam will turn the ${state.lines.length}-line transcript into a summary, key points and an outline. You can check them before saving.`,
      confirmLabel: "Generate notes",
    });
    if (generate) generateNotes();
    else main.querySelector("[data-save]").focus();
  }

  async function generateNotes() {
    state.notes = "drafting";
    state.tab = "notes";
    renderPanel();
    await sleep(reducedMotion() ? 300 : 1400);
    state.notes = draftNotes(set(), state.lines);
    renderPanel();
    main.querySelector("#tab-notes").focus();
  }

  async function saveLectureNow() {
    const btn = main.querySelector("[data-save]");
    btn.disabled = true;
    const n = state.notes && state.notes !== "drafting" ? state.notes : null;
    const title = (main.querySelector("#rec-title").value.trim() || defaultTitle()).slice(0, 80);
    const recording = saveLecture(set().id, {
      title,
      durationSec: Math.max(1, Math.round(state.elapsedMs / 1000)),
      transcript: state.lines,
      notes: n ? n.keyPoints : [],
      summary: n ? n.summary : "",
      terms: n ? n.terms : [],
      remember: n ? n.remember : "",
      topicId: n ? n.topicId : null,
      hasAudio: Boolean(live.blob),
    });
    let audioSaved = false;
    if (live.blob) {
      try {
        await putAudio(recording.id, live.blob);
        audioSaved = true;
      } catch (err) {
        console.warn("SkipXam: could not store the audio.", err);
        const s = set();
        s.recordings.find((r) => r.id === recording.id).hasAudio = false;
        saveSet(s);
      }
    }
    logActivity(set().id, "record", `Recorded a lecture: ${title}`);
    window.removeEventListener("beforeunload", warnBeforeLeaving);
    state.saved = recording;
    state.screen = "saved";
    state.title = title;
    render();
    showToast(live.blob && !audioSaved ? "Saved the transcript and notes. The audio couldn't be stored in this browser." : `Saved to ${set().name}`);
    main.querySelector("[data-again]").focus();
  }

  async function discard() {
    const ok = await confirmDialog({ title: "Discard this recording?", message: "The audio, transcript and any notes will be lost.", confirmLabel: "Discard", danger: true });
    if (ok) reset();
  }

  function reset() {
    window.removeEventListener("beforeunload", warnBeforeLeaving);
    if (live.audioUrl) URL.revokeObjectURL(live.audioUrl);
    Object.assign(live, { blob: null, audioUrl: null, levels: [], chunks: [] });
    Object.assign(state, { screen: "idle", title: "", elapsedMs: 0, lines: [], interim: "", demo: null, notes: null, saved: null, tab: "transcript", follow: true });
    render();
    main.querySelector("[data-record]").focus();
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  main.addEventListener("click", (event) => {
    const t = event.target;
    if (t.closest("[data-record]")) record();
    else if (t.closest("[data-pause]")) togglePause();
    else if (t.closest("[data-stop]")) stop();
    else if (t.closest("[data-generate]")) generateNotes();
    else if (t.closest("[data-save]")) saveLectureNow();
    else if (t.closest("[data-discard]")) discard();
    else if (t.closest("[data-again]")) reset();
    else if (t.closest("[data-follow]")) {
      state.follow = true;
      renderPanel();
    } else if (t.closest("[data-tab]")) {
      state.tab = t.closest("[data-tab]").dataset.tab;
      renderPanel();
      main.querySelector(`#tab-${state.tab}`).focus();
    } else if (t.closest("[data-seek]")) {
      const audio = main.querySelector(".record-left .rec-audio");
      if (audio) {
        audio.currentTime = Number(t.closest("[data-seek]").dataset.seek);
        audio.play();
      }
    }
  });

  // Tabs: arrow keys move between Transcript and Notes.
  main.addEventListener("keydown", (event) => {
    const tab = event.target.closest("[role='tab']");
    if (!tab || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    state.tab = state.tab === "transcript" ? "notes" : "transcript";
    renderPanel();
    main.querySelector(`#tab-${state.tab}`).focus();
  });

  // Auto-scroll follows new lines until you scroll up to read; "Jump to latest" brings it back.
  main.addEventListener("scroll", (event) => {
    const body = event.target;
    if (!body.classList || !body.classList.contains("panel-body") || !(state.screen === "recording" || state.screen === "paused")) return;
    const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 40;
    if (atBottom !== state.follow) {
      state.follow = atBottom;
      const jump = main.querySelector(".jump-latest");
      if (!atBottom && !jump) body.insertAdjacentHTML("afterend", '<button type="button" class="btn btn-secondary btn-sm jump-latest" data-follow>Jump to latest</button>');
      if (atBottom && jump) jump.remove();
    }
  }, true);

  // Past recordings: load saved audio when one is opened.
  main.addEventListener("toggle", async (event) => {
    const item = event.target;
    if (!item.matches || !item.matches("details[data-rec]") || !item.open) return;
    const audio = item.querySelector("[data-audio-for]");
    if (!audio || audio.src) return;
    try {
      const blob = await getAudio(audio.dataset.audioFor);
      if (blob) audio.src = URL.createObjectURL(blob);
      else audio.replaceWith(Object.assign(document.createElement("p"), { className: "muted", textContent: "The audio for this recording isn't on this device." }));
    } catch {
      audio.remove();
    }
  }, true);

  window.addEventListener("resize", drawWave);

  render();
})();
