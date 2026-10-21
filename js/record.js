/*
 * Record lecture (app/record.html?set=<id>). Pro feature, wrapped in proGate().
 * Mock recorder: no audio is captured. Timer + animated waveform, pause/resume,
 * stop → "Processing your lecture" → transcript and notes built from the topic's
 * notes, saved to the set's recordings and sources. Load after data.js and app.js.
 */
(function () {
  "use strict";

  const main = document.querySelector("main");
  const { set: initialSet } = setFromUrl();
  const set = () => getSet(initialSet.id);
  const BARS = 40;
  const PROCESS_STEPS = ["Uploading audio", "Transcribing", "Writing notes", "Adding to sources"];

  const state = {
    screen: "idle",     // "idle" | "recording" | "paused" | "processing" | "done"
    topicId: "",
    elapsedMs: 0,
    startedAt: 0,       // when the current recording stretch started
    timer: null,
    wave: null,
    latest: null,       // the recording just made
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  function recorderHtml(s) {
    const recording = state.screen === "recording";
    const paused = state.screen === "paused";
    const active = recording || paused;

    const topicOptions = s.topics.map((t) =>
      `<option value="${t.id}"${state.topicId === t.id ? " selected" : ""}>${escapeHtml(t.name)}</option>`).join("");

    return `
      <section class="card recorder${recording ? " is-recording" : ""}${paused ? " is-paused" : ""}" aria-label="Recorder">
        <div class="field recorder-topic">
          <label class="field-label" for="rec-topic">What's this lecture about?</label>
          <select class="input" id="rec-topic"${active ? " disabled" : ""}>
            <option value="">Let SkipXam work it out</option>
            ${topicOptions}
          </select>
        </div>

        <div class="waveform" aria-hidden="true">
          ${Array.from({ length: BARS }, () => '<span class="bar"></span>').join("")}
        </div>

        <p class="rec-timer" role="timer" aria-label="Recording time">${clock(elapsed())}</p>
        <p class="rec-status" aria-live="polite">${recording ? "Recording…" : paused ? "Paused" : "Ready when you are"}</p>

        <div class="rec-controls">
          ${active ? `
            <button type="button" class="rec-side-btn" data-pause aria-label="${paused ? "Resume" : "Pause"}">
              ${icon(paused ? "play" : "pause")}<span>${paused ? "Resume" : "Pause"}</span>
            </button>` : ""}
          <button type="button" class="rec-main-btn" data-${active ? "stop" : "record"}
            aria-label="${active ? "Stop and save recording" : "Start recording"}">
            ${icon(active ? "stop" : "mic")}
          </button>
          ${active ? '<span class="rec-side-spacer"></span>' : ""}
        </div>
        <p class="rec-note muted">Demo: no audio is actually recorded.</p>
      </section>`;
  }

  function processingHtml() {
    return `
      <section class="card processing" aria-labelledby="proc-title">
        <h2 id="proc-title">Processing your lecture</h2>
        <p class="muted">${clock(state.elapsedMs)} recorded</p>
        <ol class="process-steps">
          ${PROCESS_STEPS.map((label) => `
            <li class="process-step is-pending"><span class="process-icon" aria-hidden="true"></span><span>${label}</span></li>`).join("")}
        </ol>
        <p class="visually-hidden" aria-live="polite" id="proc-status"></p>
      </section>`;
  }

  function lectureBodyHtml(rec) {
    return `
      <div class="lecture-cols">
        <div>
          <h3 class="lecture-h">Notes</h3>
          <ul class="lecture-notes">${rec.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>
        </div>
        <div>
          <h3 class="lecture-h">Transcript</h3>
          <ol class="transcript">
            ${rec.transcript.map((line) => `<li><span class="ts">${clock(line.at * 1000)}</span><span>${escapeHtml(line.text)}</span></li>`).join("")}
          </ol>
        </div>
      </div>`;
  }

  function doneHtml(s) {
    const rec = state.latest;
    return `
      <section class="card lecture-result" aria-labelledby="result-title">
        <div class="lecture-result-head">
          <span class="tool-icon">${icon("check")}</span>
          <div>
            <h2 id="result-title" tabindex="-1">${escapeHtml(rec.title)}</h2>
            <p class="muted">${durationLabel(rec.durationSec)} · Saved to ${escapeHtml(s.name)} sources</p>
          </div>
        </div>
        ${lectureBodyHtml(rec)}
        <div class="lecture-actions">
          <button type="button" class="btn btn-primary" data-again>${icon("mic")}Record another</button>
          <a class="btn btn-ghost" href="set.html?set=${encodeURIComponent(s.id)}">Back to set</a>
        </div>
      </section>`;
  }

  function historyHtml(s) {
    const recs = s.recordings.filter((r) => !state.latest || r.id !== state.latest.id);
    return `
      <section class="rec-history" aria-labelledby="history-title">
        <h2 id="history-title" class="history-title">Past recordings</h2>
        ${recs.length ? `
          <ul class="history-list">
            ${recs.map((r) => `
              <li>
                <details class="card history-item">
                  <summary>
                    <span class="history-icon">${icon("mic")}</span>
                    <span class="history-text">
                      <span class="history-name">${escapeHtml(r.title)}</span>
                      <span class="muted">${formatDate(r.date)} · ${durationLabel(r.durationSec)}</span>
                    </span>
                    <span class="history-chevron" aria-hidden="true"></span>
                  </summary>
                  ${lectureBodyHtml(r)}
                </details>
              </li>`).join("")}
          </ul>` : '<p class="muted">No recordings yet.</p>'}
      </section>`;
  }

  function mainAreaHtml(s) {
    if (state.screen === "processing") return processingHtml();
    if (state.screen === "done") return doneHtml(s);
    return recorderHtml(s);
  }

  function render() {
    if (!initialSet) {
      main.innerHTML = setNotFoundHtml();
      return;
    }
    const s = set();
    document.title = `Record lecture · ${s.name} · SkipXam`;
    const proBadge = getUser().plan === "free" ? ' <span class="badge">Pro</span>' : "";

    main.innerHTML = `
      ${toolHeaderHtml(s, `Record lecture${proBadge}`)}
      <div class="record-area">
        <p class="record-intro muted">Record a class and get a transcript and notes added to this set.</p>
        <div class="record-main">${mainAreaHtml(s)}</div>
        ${historyHtml(s)}
      </div>`;
    proGate(main.querySelector(".record-area"), "Record lecture");
  }

  function renderMain() {
    main.querySelector(".record-main").innerHTML = mainAreaHtml(set());
  }

  // ---------------------------------------------------------------------------
  // Recorder actions
  // ---------------------------------------------------------------------------

  function animateWave() {
    const bars = main.querySelectorAll(".waveform .bar");
    bars.forEach((bar, i) => {
      // Mock "voice": a slow swell across the bars plus some randomness.
      const swell = 0.5 + 0.5 * Math.sin(Date.now() / 300 + i / 3);
      const h = 10 + Math.round((swell * 0.6 + Math.random() * 0.4) * 90);
      bar.style.height = `${h}%`;
    });
  }

  function tickTimer() {
    const el = main.querySelector(".rec-timer");
    if (el) el.textContent = clock(elapsed());
  }

  function startLoops() {
    state.timer = setInterval(tickTimer, 250);
    if (!reducedMotion()) state.wave = setInterval(animateWave, 120);
  }

  function stopLoops() {
    clearInterval(state.timer);
    clearInterval(state.wave);
  }

  function warnBeforeLeaving(event) {
    event.preventDefault();
    event.returnValue = "";
  }

  function record() {
    if (getUser().plan !== "pro") {
      openUpgrade("Record lecture");
      return;
    }
    state.topicId = main.querySelector("#rec-topic").value;
    Object.assign(state, { screen: "recording", elapsedMs: 0, startedAt: Date.now() });
    window.addEventListener("beforeunload", warnBeforeLeaving);
    renderMain();
    startLoops();
    main.querySelector("[data-stop]").focus();
  }

  function togglePause() {
    if (state.screen === "recording") {
      state.elapsedMs += Date.now() - state.startedAt;
      state.screen = "paused";
      stopLoops();
    } else {
      state.startedAt = Date.now();
      state.screen = "recording";
      startLoops();
    }
    renderMain();
    main.querySelector("[data-pause]").focus();
  }

  // "Let SkipXam work it out" picks the weakest topic.
  function chosenTopic(s) {
    if (state.topicId) return state.topicId;
    const weakest = [...s.topics].sort((a, b) => a.mastery - b.mastery)[0];
    return weakest ? weakest.id : null;
  }

  async function stop() {
    if (state.screen === "recording") state.elapsedMs += Date.now() - state.startedAt;
    stopLoops();
    window.removeEventListener("beforeunload", warnBeforeLeaving);
    state.screen = "processing";
    renderMain();

    const rows = [...main.querySelectorAll(".process-step")];
    const status = main.querySelector("#proc-status");
    for (let i = 0; i < rows.length; i++) {
      rows[i].className = "process-step is-active";
      await sleep(700 + Math.random() * 500);
      rows[i].className = "process-step is-done";
      rows[i].querySelector(".process-icon").innerHTML = icon("check");
      status.textContent = `${PROCESS_STEPS[i]} done`;
    }
    await sleep(400);

    const s = set();
    // Mock lectures are at least a minute long so the transcript has room to breathe.
    const durationSec = Math.max(60, Math.round(state.elapsedMs / 1000));
    state.latest = createRecording(s.id, { topicId: chosenTopic(s), durationSec });
    state.screen = "done";
    render();
    main.querySelector("#result-title").focus();
    showToast("Lecture added to your sources");
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  main.addEventListener("click", (event) => {
    const t = event.target;
    if (t.closest("[data-record]")) record();
    else if (t.closest("[data-pause]")) togglePause();
    else if (t.closest("[data-stop]")) stop();
    else if (t.closest("[data-again]")) {
      state.screen = "idle";
      state.latest = null;
      state.elapsedMs = 0;
      render();
    }
  });

  main.addEventListener("change", (event) => {
    if (event.target.id === "rec-topic") state.topicId = event.target.value;
  });

  render();
})();
