/*
 * Tutor chat component, shared by the tutor page (app/tutor.html) and the side
 * tutor panel (openTutorPanel, opened from "Ask Tutor" on the set page).
 * Load after data.js and app.js.
 *
 *   createTutorChat({ mount, setId, topicId, variant, onMastery, onClose })
 *     Renders the chat into `mount`. variant "page" | "panel" (the panel adds a
 *     topic picker, an "open full page" link and a close button to the header).
 *     Returns { setTopic(id), focus(), destroy() }.
 *
 * Replies are mocked from the set's notes, quiz questions and mnemonics. Three
 * models: Fast (short, quick), Smart (default) and Deep (thinks longer, adds an
 * exam angle); each reply shows the model that wrote it.
 * Voice: the mic uses the Web Speech API (en-IN) to type what you say into the
 * box as you speak; the speaker on each reply reads it aloud (speechSynthesis)
 * with play/pause and speed; Call opens a full-screen voice call with the
 * mascot, a pulsing orb, live captions, mute, switch to chat and end call.
 */
(function () {
  "use strict";

  const LETTERS = ["A", "B", "C", "D"];
  const MODEL_KEY = "skipxam.tutorModel";
  const RATE_KEY = "skipxam.tutorRate";
  const RATES = [0.75, 1, 1.25, 1.5, 2];
  const MODELS = {
    fast: { label: "Fast", hint: "Quick, short answers", delay: [250, 450] },
    smart: { label: "Smart", hint: "Clear explanations with a check-in", delay: [700, 1300] },
    deep: { label: "Deep", hint: "Thinks longer and adds the exam angle", delay: [1700, 2500] },
  };

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const canListen = Boolean(SpeechRecognition);
  const canSpeak = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const tier = (m) => (m >= 70 ? "strong" : m >= 40 ? "mid" : "weak");

  const svg = (body, filled) => `<svg class="icon" viewBox="0 0 24 24" width="24" height="24" ${filled ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'} aria-hidden="true">${body}</svg>`;
  const ICON = {
    phone: svg('<path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'),
    micOff: svg('<path d="M9 9v2a3 3 0 0 0 5.1 2.1M15 9.3V6a3 3 0 0 0-5.9-.7M5 11a7 7 0 0 0 11.9 5M19 11a7 7 0 0 1-.5 2.6M12 18v3M3 3l18 18"/>'),
    chat: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'),
    speaker: svg('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
    expand: svg('<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>'),
    model: svg('<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3z"/>'),
  };

  function readPref(key, fallback) {
    try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
  }

  function writePref(key, value) {
    try { localStorage.setItem(key, value); } catch { /* not remembered */ }
  }

  // Plain text for speech and captions: no markdown marks.
  const plain = (text) => String(text).replace(/\*\*|`/g, "");

  function pickVoice() {
    if (!canSpeak) return null;
    const voices = speechSynthesis.getVoices();
    return voices.find((v) => v.lang === "en-IN")
      || voices.find((v) => /^en[-_]IN/i.test(v.lang))
      || voices.find((v) => /^en[-_]GB/i.test(v.lang))
      || voices.find((v) => /^en/i.test(v.lang))
      || null;
  }
  if (canSpeak) speechSynthesis.getVoices(); // starts loading the voice list

  // ---------------------------------------------------------------------------
  // Speaking. One utterance at a time across the page. Resolves when it ends,
  // is cancelled, or (if the browser never reports the end) after a safe delay.
  // onWord(charIndex) fires as words are spoken, for captions and the orb.
  // ---------------------------------------------------------------------------

  let current = null; // { utterance, resolve, owner }

  function stopSpeaking() {
    if (!current) return;
    const { resolve } = current;
    current = null;
    if (canSpeak) speechSynthesis.cancel();
    resolve("stopped");
  }

  // Without a speech engine (or when it fails), `paceOnly` callers still get
  // onWord at a speaking pace so captions move; others get "error".
  function paceWords(text, from, rate, onWord, owner, resolve) {
    const words = [...text.slice(from).matchAll(/\S+/g)];
    let i = 0;
    const timer = setInterval(() => {
      if (!current || current.timer !== timer) { clearInterval(timer); return; }
      if (i >= words.length) { clearInterval(timer); current = null; resolve("done"); return; }
      if (onWord) onWord(from + words[i].index);
      i += 1;
    }, 260 / rate);
    current = { timer, resolve, owner };
  }

  function speak(text, { rate = 1, from = 0, onWord, owner, paceOnly = false } = {}) {
    stopSpeaking();
    return new Promise((resolve) => {
      const rest = text.slice(from);
      if (!rest.trim()) { resolve("done"); return; }
      if (!canSpeak) {
        if (paceOnly) paceWords(text, from, rate, onWord, owner, resolve);
        else resolve("error");
        return;
      }
      speechSynthesis.cancel();
      speechSynthesis.resume(); // a paused queue would hold the new utterance
      const utterance = new SpeechSynthesisUtterance(rest);
      utterance.lang = "en-IN";
      utterance.rate = rate;
      const voice = pickVoice();
      if (voice) utterance.voice = voice;
      const estimate = (rest.length * 70) / rate + 1500;
      let reached = from;
      const finish = (why) => {
        if (!current || current.utterance !== utterance) return;
        clearTimeout(current.safety);
        current = null;
        resolve(why);
      };
      utterance.onboundary = (e) => {
        reached = from + e.charIndex;
        if (onWord && e.name !== "sentence") onWord(reached);
        if (current && current.utterance === utterance) {
          clearTimeout(current.safety);
          current.safety = setTimeout(() => finish("done"), estimate);
        }
      };
      utterance.onend = () => finish("done");
      utterance.onerror = (e) => {
        if (!current || current.utterance !== utterance) return;
        if (e.error === "interrupted" || e.error === "canceled") return finish("stopped");
        clearTimeout(current.safety);
        current = null;
        if (paceOnly) paceWords(text, reached, rate, onWord, owner, resolve);
        else resolve("error");
        return undefined;
      };
      current = { utterance, resolve, owner, safety: setTimeout(() => finish("done"), estimate) };
      speechSynthesis.speak(utterance);
    });
  }

  // ---------------------------------------------------------------------------
  // Listening (Web Speech API, en-IN)
  // ---------------------------------------------------------------------------

  function listen({ continuous = false, onInterim, onFinal, onEnd, onError }) {
    const rec = new SpeechRecognition();
    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.continuous = continuous;
    let finalText = "";
    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (onInterim) onInterim(finalText, interim);
      if (!continuous && finalText && onFinal) onFinal(finalText.trim());
    };
    rec.onerror = (event) => { if (onError) onError(event.error); };
    rec.onend = () => { if (onEnd) onEnd(finalText.trim()); };
    try {
      rec.start();
    } catch (err) {
      if (onError) onError("start-failed");
    }
    return rec;
  }

  function micErrorMessage(code) {
    if (code === "not-allowed" || code === "service-not-allowed") return "Microphone access is blocked. Allow it in your browser's site settings, then try again.";
    if (code === "audio-capture") return "No microphone found.";
    if (code === "network") return "Voice typing needs an internet connection.";
    return "";
  }

  // ---------------------------------------------------------------------------
  // The chat
  // ---------------------------------------------------------------------------

  function createTutorChat({ mount, setId, topicId, variant = "page", onMastery, onClose }) {
    const set = () => getSet(setId);
    const state = {
      topicId,
      model: MODELS[readPref(MODEL_KEY, "smart")] ? readPref(MODEL_KEY, "smart") : "smart",
      rate: Number(readPref(RATE_KEY, "1")) || 1,
      messages: [],        // { id, from: "tutor" | "user" | "note", html, model?, quiz?: { qid, chosen } }
      asked: new Set(),
      typing: false,
      suggestions: [],
      reading: null,       // { id, paused, charIndex } for the reply being read aloud
      dictation: null,     // live mic recognition for the input box
      modelMenu: false,
      call: null,
    };
    let nextId = 1;
    const topic = () => set().topics.find((t) => t.id === state.topicId);

    // ----- Mock tutor brain -------------------------------------------------

    const section = () => set().notes.find((n) => n.topicId === state.topicId);

    function starters(t) {
      return [`Explain ${t.name} simply`, `Quiz me on ${t.name}`, "Give me a memory trick", "What's a common exam mistake?"];
    }

    function explainReply(model) {
      const s = section();
      if (!s) return { html: `<p>I don't have notes for ${escapeHtml(topic().name)} yet. Upload some and I'll explain it.</p>` };
      if (model === "fast") {
        return { html: `<p>${richText(s.intro)}</p><ul>${s.points.slice(0, 2).map((p) => `<li>${richText(p)}</li>`).join("")}</ul>`, suggestions: ["Quiz me", "Tell me more"] };
      }
      if (model === "deep") {
        return {
          html: `
            <p>${richText(s.intro)}</p>
            <ul>${s.points.map((p) => `<li>${richText(p)}</li>`).join("")}</ul>
            ${s.remember ? `<p><strong>Exam angle:</strong> ${richText(s.remember)}</p>` : ""}
            <p>Try saying it back to me in one sentence. That's the quickest way to find a gap.</p>`,
          suggestions: ["Quiz me", "What's a common exam mistake?"],
        };
      }
      return {
        html: `<p>${richText(s.intro)}</p><ul>${s.points.slice(0, 3).map((p) => `<li>${richText(p)}</li>`).join("")}</ul><p>Want me to check you've got it?</p>`,
        suggestions: ["Quiz me", "Give me a memory trick"],
      };
    }

    function quizReply() {
      const pool = set().quiz.filter((q) => q.topicId === state.topicId);
      if (pool.length === 0) return { html: "<p>I don't have questions for this topic yet.</p>" };
      let q = pool.find((x) => !state.asked.has(x.id));
      if (!q) {
        state.asked.clear();
        q = pool[0];
      }
      state.asked.add(q.id);
      return { html: `<p>Here's one for you:</p><p class="tutor-q">${richText(q.question)}</p>`, quiz: { qid: q.id, chosen: null } };
    }

    function trickReply() {
      const m = set().mnemonics.find((x) => x.topicId === state.topicId);
      if (!m) return { html: "<p>I don't have a memory trick for this one yet. Try explaining it out loud in your own words; that helps it stick.</p>" };
      return {
        html: `<p>Try this: <strong>${escapeHtml(m.title)}</strong></p><blockquote>${escapeHtml(m.trick)}</blockquote><p>${richText(m.explain)}</p>`,
        suggestions: ["Quiz me", "Explain it again"],
      };
    }

    function mistakeReply(model) {
      const s = section();
      if (!s || !s.remember) return explainReply(model);
      return { html: `<p>A common trap in exams:</p><p>${richText(s.remember)}</p>`, suggestions: ["Quiz me", "Give me a memory trick"] };
    }

    function formulaReply() {
      const s = section();
      if (!s || s.formulas.length === 0) {
        return { html: `<p>${escapeHtml(topic().name)} doesn't have formulas to learn. It's more about the ideas.</p>`, suggestions: ["Explain it simply", "Quiz me"] };
      }
      return {
        html: `<p>The formulas to know:</p><ul>${s.formulas.map((f) => `<li><strong>${escapeHtml(f.label)}:</strong> <code>${escapeHtml(f.expr)}</code></li>`).join("")}</ul>`,
        suggestions: ["Quiz me", "Give me a memory trick"],
      };
    }

    function replyTo(text, model) {
      const t = text.toLowerCase();
      if (/\b(quiz|question|test me|ask me|another)\b/.test(t)) return quizReply();
      if (/(trick|mnemonic|remember|memori)/.test(t)) return trickReply();
      if (/(mistake|trap|careful|wrong)/.test(t)) return mistakeReply(model);
      if (/(formula|equation)/.test(t)) return formulaReply();
      if (/^(hi|hello|hey)\b/.test(t)) return { html: `<p>Hi! Ready when you are. Shall we start with a quick question on ${escapeHtml(topic().name)}?</p>`, suggestions: ["Quiz me", "Explain it simply"] };
      return explainReply(model);
    }

    // ----- Flow --------------------------------------------------------------

    function greet() {
      const t = topic();
      state.messages = [{
        id: nextId++,
        from: "tutor",
        model: state.model,
        html: `<p>Hi ${escapeHtml(getUser().name)}! Let's work on <strong>${escapeHtml(t.name)}</strong>. You're at ${t.mastery}% mastery right now.</p><p>Ask me anything, pick a starter below, or tap Call to talk it through.</p>`,
      }];
      state.suggestions = starters(t);
      state.asked = new Set();
    }

    // Shows the typing indicator for the model's thinking time, then the reply.
    // Resolves to the new message.
    async function tutorSays(reply) {
      const model = state.model;
      const [min, max] = MODELS[model].delay;
      state.typing = true;
      state.suggestions = [];
      renderLog();
      await sleep(min + Math.random() * (max - min));
      state.typing = false;
      const msg = { id: nextId++, from: "tutor", model, html: reply.html, quiz: reply.quiz };
      state.messages.push(msg);
      state.suggestions = reply.suggestions || [];
      renderLog();
      return msg;
    }

    function send(text) {
      const clean = text.trim();
      if (!clean || state.typing) return null;
      state.messages.push({ id: nextId++, from: "user", html: `<p>${escapeHtml(clean)}</p>` });
      return tutorSays(replyTo(clean, state.model));
    }

    function answerQuiz(msg, choice) {
      if (!msg || !msg.quiz || msg.quiz.chosen !== null || state.typing) return null;
      const q = set().quiz.find((x) => x.id === msg.quiz.qid);
      msg.quiz.chosen = choice;
      const correct = choice === q.answer;
      const before = topic().mastery;
      const after = adjustTopicMastery(setId, state.topicId, correct ? 5 : -2);
      state.messages.push({ id: nextId++, from: "user", html: `<p>${LETTERS[choice]}. ${richText(q.options[choice])}</p>` });
      if (onMastery) onMastery(before, after, state.topicId);
      renderTopicSelect();
      return tutorSays({
        html: correct
          ? `<p><strong>Correct!</strong> ${richText(q.explanation)}</p>`
          : `<p><strong>Not quite.</strong> The answer is ${LETTERS[q.answer]}: ${richText(q.options[q.answer])}.</p><p>${richText(q.explanation)}</p>`,
        suggestions: correct ? ["Another question", "Give me a memory trick"] : ["Explain it again", "Another question"],
      });
    }

    // What a reply sounds like: its text, plus the options for a quiz question.
    function spokenText(msg) {
      const div = document.createElement("div");
      div.innerHTML = msg.html.replace(/<\/(p|li|blockquote)>/g, "$& "); // keep a gap between blocks
      let text = div.textContent.replace(/\s+/g, " ").trim();
      if (msg.quiz) {
        const q = set().quiz.find((x) => x.id === msg.quiz.qid);
        text += " " + q.options.map((o, i) => `${LETTERS[i]}: ${plain(o)}.`).join(" ");
      }
      return text;
    }

    // ----- Rendering ---------------------------------------------------------

    const avatar = `<span class="tutor-avatar" aria-hidden="true">${icon("sparkle")}</span>`;

    function quizOptionsHtml(msg) {
      const q = set().quiz.find((x) => x.id === msg.quiz.qid);
      const answered = msg.quiz.chosen !== null;
      return `
        <div class="tutor-options" role="group" aria-label="Answer options">
          ${q.options.map((opt, o) => {
            let cls = "tutor-option";
            if (answered && o === q.answer) cls += " is-correct";
            else if (answered && o === msg.quiz.chosen) cls += " is-wrong";
            return `<button type="button" class="${cls}" data-answer="${msg.id}:${o}"${answered ? " disabled" : ""}>
              <span class="option-letter">${LETTERS[o]}</span>${richText(opt)}</button>`;
          }).join("")}
        </div>`;
    }

    function readControlsHtml(msg) {
      const r = state.reading && state.reading.id === msg.id ? state.reading : null;
      const playing = r && !r.paused;
      return `
        <span class="read-aloud${r ? " is-active" : ""}">
          <button type="button" class="msg-btn" data-read="${msg.id}" aria-pressed="${Boolean(playing)}"
            aria-label="${playing ? "Pause reading" : r ? "Resume reading" : "Read aloud"}" title="${playing ? "Pause" : r ? "Resume" : "Read aloud"}">
            ${playing ? icon("pause") : r ? icon("play") : ICON.speaker}
          </button>
          ${r ? `<button type="button" class="msg-btn msg-rate" data-rate aria-label="Reading speed ${state.rate} times. Change speed" title="Speed">${state.rate}×</button>
                 <button type="button" class="msg-btn" data-read-stop aria-label="Stop reading" title="Stop">${icon("stop")}</button>` : ""}
        </span>`;
    }

    function messageHtml(m) {
      if (m.from === "note") return `<li class="msg-note"><span>${m.html}</span></li>`;
      const tutor = m.from === "tutor";
      return `
        <li class="msg is-${m.from}" data-msg="${m.id}">
          ${tutor ? avatar : ""}
          <div class="msg-body">
            <div class="bubble">
              <span class="visually-hidden">${tutor ? "Tutor:" : "You:"}</span>
              ${m.html}
              ${m.quiz ? quizOptionsHtml(m) : ""}
            </div>
            ${tutor ? `
              <div class="msg-meta">
                <span class="msg-model" title="Answered by the ${MODELS[m.model].label} model">${ICON.model}${MODELS[m.model].label}</span>
                ${readControlsHtml(m)}
              </div>` : ""}
          </div>
        </li>`;
    }

    function typingHtml() {
      if (!state.typing) return "";
      const label = state.model === "deep" ? "Thinking it through…" : "";
      return `
        <li class="msg is-tutor is-typing">${avatar}
          <div class="msg-body"><div class="bubble"><span class="visually-hidden">Tutor is typing</span>
            <span class="dots" aria-hidden="true"><span></span><span></span><span></span></span>
            ${label ? `<span class="thinking-label">${label}</span>` : ""}</div></div>
        </li>`;
    }

    function topicSelectHtml() {
      return `
        <label class="field-label" for="panel-topic-${setId}">Topic</label>
        <select class="input panel-topic" id="panel-topic-${setId}" data-topic-select>
          ${set().topics.map((x) => `<option value="${x.id}"${x.id === state.topicId ? " selected" : ""}>${escapeHtml(x.name)} (${x.mastery}%)</option>`).join("")}
        </select>`;
    }

    function modelMenuHtml() {
      return `
        <div class="model-picker">
          <button type="button" class="model-btn" data-model-toggle aria-haspopup="listbox" aria-expanded="${state.modelMenu}"
            aria-label="Model: ${MODELS[state.model].label}. Change model" title="Choose a model">
            ${ICON.model}<span>${MODELS[state.model].label}</span>${icon("chevronDown")}
          </button>
          <ul class="model-menu" role="listbox" aria-label="Model"${state.modelMenu ? "" : " hidden"}>
            ${Object.entries(MODELS).map(([key, m]) => `
              <li role="option" tabindex="-1" data-model="${key}" aria-selected="${key === state.model}">
                <span class="model-name">${m.label}${key === "smart" ? ' <span class="model-default">Default</span>' : ""}</span>
                <span class="model-hint">${m.hint}</span>
                ${key === state.model ? `<span class="model-check">${icon("check")}</span>` : ""}
              </li>`).join("")}
          </ul>
        </div>`;
    }

    function shellHtml() {
      const s = set();
      const panel = variant === "panel";
      return `
        <section class="chat${panel ? " is-panel" : " card"}" aria-label="Chat with your tutor">
          <header class="chat-head">
            ${avatar}
            <div class="chat-title">
              <p class="chat-name" ${panel ? 'id="tutor-panel-title"' : ""}>SkipXam Tutor</p>
              <p class="muted chat-status">Knows your ${escapeHtml(s.name)} notes</p>
            </div>
            <div class="chat-head-actions">
              <button type="button" class="btn btn-secondary btn-sm call-btn" data-call>${ICON.phone}<span>Call</span></button>
              ${panel ? `
                <a class="icon-btn" href="${toolUrl("tutor", setId, { topic: state.topicId })}" data-full-page aria-label="Open the tutor full page" title="Open full page">${ICON.expand}</a>
                <button type="button" class="icon-btn" data-panel-close aria-label="Close tutor">${icon("close")}</button>` : ""}
            </div>
          </header>
          ${panel ? `<div class="panel-topic-row">${topicSelectHtml()}</div>` : ""}
          <div class="chat-scroll">
            <ol class="chat-log" role="log" aria-live="polite" aria-label="Conversation"></ol>
          </div>
          <div class="chat-suggestions"></div>
          <form class="chat-form">
            ${modelMenuHtml()}
            <div class="chat-input-wrap">
              <label class="visually-hidden" for="chat-input-${variant}">Message the tutor</label>
              <input class="input chat-input" id="chat-input-${variant}" type="text" autocomplete="off" placeholder="Ask about ${escapeHtml(topic().name)}…">
              <button type="button" class="chat-mic" data-mic aria-pressed="false" aria-label="Voice typing" title="${canListen ? "Speak your question" : "Voice typing isn't supported in this browser"}">${icon("mic")}</button>
            </div>
            <button type="submit" class="btn btn-primary chat-send" aria-label="Send">${icon("send")}</button>
          </form>
          <p class="visually-hidden" aria-live="assertive" data-chat-status></p>
        </section>`;
    }

    const $ = (sel) => mount.querySelector(sel);

    function renderLog() {
      const log = $(".chat-log");
      if (!log) return;
      log.innerHTML = state.messages.map(messageHtml).join("") + typingHtml();
      $(".chat-suggestions").innerHTML = state.typing ? "" : state.suggestions
        .map((s) => `<button type="button" class="chip suggestion" data-suggest="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("");
      $(".chat-send").disabled = state.typing;
      const scroller = $(".chat-scroll");
      scroller.scrollTop = scroller.scrollHeight;
    }

    function renderTopicSelect() {
      const select = $("[data-topic-select]");
      if (select) {
        const t = topic();
        const option = select.querySelector(`option[value="${state.topicId}"]`);
        if (option) option.textContent = `${t.name} (${t.mastery}%)`;
      }
    }

    function renderReadControls(id) {
      const meta = $(`[data-msg="${id}"] .read-aloud`);
      const msg = state.messages.find((m) => m.id === id);
      if (meta && msg) meta.outerHTML = readControlsHtml(msg);
    }

    function announce(text) {
      const el = $("[data-chat-status]");
      if (el) el.textContent = text;
    }

    function render() {
      mount.innerHTML = shellHtml();
      renderLog();
    }

    // ----- Model picker ------------------------------------------------------

    function setModelMenu(open, { focus = true } = {}) {
      state.modelMenu = open;
      const btn = $("[data-model-toggle]");
      const menu = $(".model-menu");
      btn.setAttribute("aria-expanded", String(open));
      menu.hidden = !open;
      if (open && focus) (menu.querySelector("[aria-selected='true']") || menu.firstElementChild).focus();
    }

    function chooseModel(key) {
      state.model = key;
      writePref(MODEL_KEY, key);
      $(".model-picker").outerHTML = modelMenuHtml();
      $("[data-model-toggle]").focus();
      announce(`${MODELS[key].label} model selected`);
    }

    // ----- Voice typing --------------------------------------------------------

    function stopDictation() {
      if (!state.dictation) return;
      const { rec } = state.dictation;
      state.dictation = null;
      try { rec.stop(); } catch { /* already stopped */ }
      const mic = $("[data-mic]");
      if (mic) {
        mic.classList.remove("is-listening");
        mic.setAttribute("aria-pressed", "false");
        mic.setAttribute("aria-label", "Voice typing");
      }
    }

    function toggleDictation() {
      if (state.dictation) return stopDictation();
      if (!canListen) {
        showToast("Voice typing isn't supported in this browser. Try Chrome or Edge.");
        return undefined;
      }
      stopSpeaking();
      const input = $(".chat-input");
      const base = input.value.trim();
      const mic = $("[data-mic]");
      mic.classList.add("is-listening");
      mic.setAttribute("aria-pressed", "true");
      mic.setAttribute("aria-label", "Stop voice typing");
      announce("Listening. Speak now.");
      const rec = listen({
        continuous: true,
        onInterim: (finalText, interim) => {
          input.value = [base, finalText.trim(), interim.trim()].filter(Boolean).join(" ");
        },
        onError: (code) => {
          const message = micErrorMessage(code);
          if (message) showToast(message);
        },
        onEnd: () => {
          if (state.dictation && state.dictation.rec === rec) stopDictation();
          input.focus();
        },
      });
      state.dictation = { rec };
      input.focus();
      return undefined;
    }

    // ----- Read aloud ----------------------------------------------------------

    function readAloud(id, { from = 0 } = {}) {
      const msg = state.messages.find((m) => m.id === id);
      if (!msg) return;
      if (!canSpeak) {
        showToast("Reading aloud isn't supported in this browser.");
        return;
      }
      const previous = state.reading && state.reading.id !== id ? state.reading.id : null;
      const text = spokenText(msg);
      state.reading = { id, paused: false, charIndex: from, text };
      if (previous) renderReadControls(previous);
      renderReadControls(id);
      const reading = state.reading;
      speak(text, {
        rate: state.rate,
        from,
        owner: "read",
        onWord: (i) => { reading.charIndex = i; },
      }).then((why) => {
        if (state.reading !== reading || reading.paused || why === "stopped") return;
        state.reading = null;
        renderReadControls(id);
        if (why === "error") showToast("Couldn't play audio. Check your device's sound output and try again.");
      });
    }

    // Pause stops the speech but remembers the word it reached; play carries on from there.
    function toggleRead(id) {
      const r = state.reading;
      if (!r || r.id !== id) return readAloud(id);
      if (r.paused) {
        readAloud(id, { from: r.charIndex });
      } else {
        r.paused = true;
        stopSpeaking();
        renderReadControls(id);
      }
      $(`[data-read="${id}"]`).focus();
      return undefined;
    }

    function stopReading() {
      const r = state.reading;
      if (!r) return;
      state.reading = null;
      stopSpeaking();
      renderReadControls(r.id);
    }

    // Speed: the next rate in the list. An utterance can't change speed while it
    // plays, so restart it from the current word.
    function cycleRate() {
      const i = RATES.indexOf(state.rate);
      state.rate = RATES[(i + 1) % RATES.length];
      writePref(RATE_KEY, String(state.rate));
      const r = state.reading;
      if (!r) return;
      if (r.paused) {
        renderReadControls(r.id);
      } else {
        readAloud(r.id, { from: r.charIndex });
      }
      const rate = $("[data-rate]");
      if (rate) rate.focus();
      announce(`Speed ${state.rate} times`);
    }

    // ----- Voice call ----------------------------------------------------------

    function callHtml() {
      const t = topic();
      return `
        <div class="call-top">
          <p class="call-title"><span class="call-live" aria-hidden="true"></span>Voice call · ${escapeHtml(set().name)}</p>
          <p class="call-sub">${escapeHtml(t.name)} · <span data-call-time>0:00</span> · ${MODELS[state.model].label} model</p>
        </div>
        <div class="call-stage">
          <div class="call-orb" aria-hidden="true"><span></span><span></span><span></span></div>
          <div class="call-mascot">${mascotHtml(132)}</div>
        </div>
        <p class="call-status" data-call-status aria-live="polite">Connecting…</p>
        <div class="call-captions" aria-label="Live captions">
          <p class="cap cap-tutor" data-cap-tutor></p>
          <p class="cap cap-user" data-cap-user></p>
        </div>
        <form class="call-type"${canListen ? " hidden" : ""}>
          <label class="visually-hidden" for="call-type-input">Say something to the tutor</label>
          <input class="input" id="call-type-input" autocomplete="off" placeholder="${canListen ? "Type instead…" : "Voice input isn't supported here. Type instead…"}">
          <button type="submit" class="btn btn-primary" aria-label="Send">${icon("send")}</button>
        </form>
        <div class="call-controls">
          <button type="button" class="call-ctl" data-call-mute aria-pressed="false">
            <span class="call-ctl-icon">${icon("mic")}</span><span class="call-ctl-label">Mute</span>
          </button>
          <button type="button" class="call-ctl" data-call-chat>
            <span class="call-ctl-icon">${ICON.chat}</span><span class="call-ctl-label">Switch to chat</span>
          </button>
          <button type="button" class="call-ctl is-end" data-call-end>
            <span class="call-ctl-icon is-hangup">${ICON.phone}</span><span class="call-ctl-label">End call</span>
          </button>
        </div>`;
    }

    function setCallState(status) {
      const call = state.call;
      if (!call) return;
      call.status = status;
      call.dialog.dataset.state = status;
      const label = {
        connecting: "Connecting…",
        speaking: "Tutor is speaking",
        listening: canListen && !call.blocked ? "Listening… go ahead" : "Type your reply below",
        thinking: "Thinking…",
        muted: "You're muted",
      }[status];
      call.dialog.querySelector("[data-call-status]").textContent = label;
    }

    // Caption the tutor's line word by word while it's spoken.
    function captionTutor(text) {
      const el = state.call.dialog.querySelector("[data-cap-tutor]");
      const words = [...text.matchAll(/\S+/g)];
      el.innerHTML = words.map((w) => `<span data-at="${w.index}">${escapeHtml(w[0])}</span>`).join(" ");
      return (charIndex) => {
        if (!state.call) return;
        el.querySelectorAll("span:not(.is-said)").forEach((s) => {
          if (Number(s.dataset.at) <= charIndex) s.classList.add("is-said");
        });
        // Each word gives the orb a little kick.
        state.call.dialog.style.setProperty("--kick", String(1 + Math.random() * 0.12));
        clearTimeout(state.call.kickTimer);
        state.call.kickTimer = setTimeout(() => state.call && state.call.dialog.style.setProperty("--kick", "1"), 160);
      };
    }

    async function callSay(text) {
      const call = state.call;
      if (!call) return;
      stopCallListening();
      setCallState("speaking");
      call.dialog.querySelector("[data-cap-user]").textContent = "";
      const onWord = captionTutor(text);
      await speak(text, { rate: state.rate, owner: "call", onWord, paceOnly: true });
      if (state.call !== call) return;
      call.dialog.querySelectorAll("[data-cap-tutor] span").forEach((s) => s.classList.add("is-said"));
      callListen();
    }

    function stopCallListening() {
      const call = state.call;
      if (call && call.rec) {
        const { rec } = call;
        call.rec = null;
        try { rec.abort(); } catch { /* not running */ }
      }
    }

    function callListen() {
      const call = state.call;
      if (!call) return;
      if (call.muted) return setCallState("muted");
      setCallState("listening");
      if (!canListen || call.blocked) {
        call.dialog.querySelector(".call-type").hidden = false;
        return undefined;
      }
      const userCap = call.dialog.querySelector("[data-cap-user]");
      let heard = false;
      const rec = listen({
        onInterim: (finalText, interim) => { userCap.textContent = `${finalText}${interim}`; },
        onFinal: (text) => {
          heard = true;
          if (state.call === call && call.rec === rec) {
            call.rec = null;
            try { rec.stop(); } catch { /* done */ }
            handleUtterance(text);
          }
        },
        onError: (code) => {
          const message = micErrorMessage(code);
          if (message && state.call === call) {
            call.blocked = true;
            call.dialog.querySelector(".call-type").hidden = false;
            call.dialog.querySelector("[data-cap-user]").textContent = message;
            setCallState("listening");
          }
        },
        onEnd: () => {
          // Silence: keep listening while the call is open and it's our turn.
          if (!heard && state.call === call && call.rec === rec && call.status === "listening" && !call.blocked) {
            call.rec = null;
            setTimeout(() => { if (state.call === call && call.status === "listening") callListen(); }, 250);
          }
        },
      });
      call.rec = rec;
      return undefined;
    }

    // Matches "A", "option b", or the words of an option, to a quiz choice.
    function matchChoice(text, msg) {
      const q = set().quiz.find((x) => x.id === msg.quiz.qid);
      const t = text.toLowerCase().trim();
      const letter = t.match(/^(?:option\s+|answer\s+(?:is\s+)?)?([abcd])\b/) || t.match(/\b(?:option|answer)\s+([abcd])\b/);
      if (letter) return LETTERS.indexOf(letter[1].toUpperCase());
      const i = q.options.findIndex((o) => t.includes(plain(o).toLowerCase()));
      return i;
    }

    async function handleUtterance(text) {
      const call = state.call;
      if (!call || !text.trim()) return;
      call.dialog.querySelector("[data-cap-user]").textContent = text;
      setCallState("thinking");
      const pending = [...state.messages].reverse().find((m) => m.from === "tutor" && m.quiz && m.quiz.chosen === null);
      let reply;
      const choice = pending ? matchChoice(text, pending) : -1;
      if (pending && choice >= 0) reply = await answerQuiz(pending, choice);
      else reply = await send(text);
      if (state.call !== call || !reply) return;
      await callSay(spokenText(reply));
    }

    function formatCallTime(ms) {
      const s = Math.floor(ms / 1000);
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    }

    function openCall() {
      if (state.call) return;
      stopDictation();
      stopReading();
      const dialog = document.createElement("dialog");
      dialog.className = "tutor-call";
      dialog.setAttribute("aria-label", "Voice call with your tutor");
      dialog.innerHTML = callHtml();
      document.body.appendChild(dialog);
      const call = { dialog, muted: false, blocked: false, rec: null, startedAt: Date.now(), status: "connecting", returnFocus: document.activeElement };
      state.call = call;
      call.clock = setInterval(() => {
        dialog.querySelector("[data-call-time]").textContent = formatCallTime(Date.now() - call.startedAt);
      }, 1000);

      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        endCall("end");
      });
      dialog.addEventListener("click", (event) => {
        if (event.target.closest("[data-call-end]")) endCall("end");
        else if (event.target.closest("[data-call-chat]")) endCall("chat");
        else if (event.target.closest("[data-call-mute]")) toggleMute();
      });
      dialog.querySelector(".call-type").addEventListener("submit", (event) => {
        event.preventDefault();
        const input = dialog.querySelector("#call-type-input");
        const text = input.value;
        input.value = "";
        if (call.status === "listening" || call.status === "muted") handleUtterance(text);
      });
      dialog.showModal();
      dialog.querySelector("[data-call-mute]").focus();
      setCallState("connecting");

      state.messages.push({ id: nextId++, from: "note", html: `${ICON.phone}Voice call started` });
      renderLog();
      const t = topic();
      const hello = `Hi ${getUser().name}! It's your tutor. We're on ${t.name}. You can ask me anything, or say "quiz me" and I'll ask you a question.`;
      const msg = { id: nextId++, from: "tutor", model: state.model, html: `<p>${escapeHtml(hello)}</p>` };
      state.messages.push(msg);
      state.suggestions = [];
      renderLog();
      setTimeout(() => { if (state.call === call) callSay(hello); }, reducedMotion() ? 0 : 700);
    }

    function toggleMute() {
      const call = state.call;
      call.muted = !call.muted;
      const btn = call.dialog.querySelector("[data-call-mute]");
      btn.setAttribute("aria-pressed", String(call.muted));
      btn.querySelector(".call-ctl-icon").innerHTML = call.muted ? ICON.micOff : icon("mic");
      btn.querySelector(".call-ctl-label").textContent = call.muted ? "Unmute" : "Mute";
      if (call.muted) {
        stopCallListening();
        if (call.status === "listening") setCallState("muted");
      } else if (call.status === "muted") {
        callListen();
      }
    }

    function endCall(how) {
      const call = state.call;
      if (!call) return;
      state.call = null;
      clearInterval(call.clock);
      clearTimeout(call.kickTimer);
      if (call.rec) { try { call.rec.abort(); } catch { /* stopped */ } }
      stopSpeaking();
      const length = formatCallTime(Date.now() - call.startedAt);
      call.dialog.close();
      call.dialog.remove();
      state.messages.push({ id: nextId++, from: "note", html: `${ICON.phone}${how === "chat" ? "Switched to chat" : "Call ended"} · ${length}` });
      const last = [...state.messages].reverse().find((m) => m.from === "tutor");
      state.suggestions = last && last.quiz && last.quiz.chosen === null ? [] : ["Quiz me", "Give me a memory trick"];
      renderLog();
      if (how === "chat") $(".chat-input").focus();
      else (call.returnFocus && document.contains(call.returnFocus) ? call.returnFocus : $("[data-call]")).focus();
    }

    // ----- Events --------------------------------------------------------------

    function onSubmit(event) {
      if (!event.target.closest(".chat-form")) return;
      event.preventDefault();
      stopDictation();
      const input = $(".chat-input");
      send(input.value);
      input.value = "";
    }

    function onClick(event) {
      const t = event.target;
      if (state.modelMenu && !t.closest(".model-picker")) setModelMenu(false, { focus: false });

      const suggestion = t.closest("[data-suggest]");
      if (suggestion) {
        send(suggestion.dataset.suggest);
        $(".chat-input").focus();
        return;
      }
      const answer = t.closest("[data-answer]");
      if (answer) {
        const [id, choice] = answer.dataset.answer.split(":").map(Number);
        answerQuiz(state.messages.find((m) => m.id === id), choice);
        return;
      }
      if (t.closest("[data-model-toggle]")) return setModelMenu(!state.modelMenu);
      const model = t.closest("[data-model]");
      if (model) return chooseModel(model.dataset.model);
      if (t.closest("[data-mic]")) return toggleDictation();
      const read = t.closest("[data-read]");
      if (read) return toggleRead(Number(read.dataset.read));
      if (t.closest("[data-rate]")) return cycleRate();
      if (t.closest("[data-read-stop]")) {
        const id = state.reading && state.reading.id;
        stopReading();
        const btn = $(`[data-read="${id}"]`);
        if (btn) btn.focus();
        return undefined;
      }
      if (t.closest("[data-call]")) return openCall();
      if (t.closest("[data-panel-close]") && onClose) return onClose();
      return undefined;
    }

    function onKeydown(event) {
      const option = event.target.closest && event.target.closest(".model-menu [role='option']");
      if (option) {
        const items = [...option.parentElement.children];
        const i = items.indexOf(option);
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          items[(i + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          chooseModel(option.dataset.model);
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setModelMenu(false, { focus: false });
          $("[data-model-toggle]").focus();
        } else if (event.key === "Tab") {
          setModelMenu(false, { focus: false });
        }
      }
    }

    function onChange(event) {
      if (!event.target.matches("[data-topic-select]")) return;
      api.setTopic(event.target.value);
      $("[data-topic-select]").focus();
    }

    mount.addEventListener("submit", onSubmit);
    mount.addEventListener("click", onClick);
    mount.addEventListener("keydown", onKeydown);
    mount.addEventListener("change", onChange);

    const api = {
      setTopic(id) {
        stopReading();
        stopDictation();
        state.topicId = id;
        greet();
        render();
      },
      focus() {
        $(".chat-input").focus();
      },
      stopAudio() {
        stopReading();
        stopDictation();
      },
      destroy() {
        endCall("end");
        api.stopAudio();
        mount.removeEventListener("submit", onSubmit);
        mount.removeEventListener("click", onClick);
        mount.removeEventListener("keydown", onKeydown);
        mount.removeEventListener("change", onChange);
        mount.innerHTML = "";
      },
    };

    greet();
    render();
    return api;
  }

  // ---------------------------------------------------------------------------
  // Side tutor panel
  // ---------------------------------------------------------------------------

  let panel = null; // { el, chat, setId, opener }

  function closeTutorPanel() {
    if (!panel || panel.el.hidden) return;
    panel.chat.stopAudio();
    panel.el.hidden = true;
    document.body.classList.remove("has-tutor-panel");
    if (panel.opener && document.contains(panel.opener)) panel.opener.focus();
  }

  function openTutorPanel(setId, { topicId, opener } = {}) {
    const s = getSet(setId);
    if (!s || !s.topics.length) {
      showToast("The tutor works from your notes. Upload notes to this set first.");
      return;
    }
    if (getUser().plan === "free") {
      openUpgrade("AI Tutor");
      return;
    }
    if (panel && panel.setId !== setId) {
      panel.chat.destroy();
      panel.el.remove();
      panel = null;
    }
    if (!panel) {
      const el = document.createElement("aside");
      el.className = "tutor-panel glass glass-dark"; // darker tint: it floats over busy content
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "false");
      el.setAttribute("aria-labelledby", "tutor-panel-title");
      document.body.appendChild(el);
      const weakest = [...s.topics].sort((a, b) => a.mastery - b.mastery)[0];
      const chat = createTutorChat({
        mount: el,
        setId,
        topicId: topicId || (getCurrentTopic(s) || {}).topic?.id || weakest.id,
        variant: "panel",
        onClose: closeTutorPanel,
      });
      el.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !event.defaultPrevented && !document.querySelector("dialog[open]")) closeTutorPanel();
      });
      panel = { el, chat, setId };
    } else if (topicId) {
      panel.chat.setTopic(topicId);
    }
    panel.opener = opener || document.activeElement;
    panel.el.hidden = false;
    document.body.classList.add("has-tutor-panel");
    panel.chat.focus();
  }

  Object.assign(window, { createTutorChat, openTutorPanel, closeTutorPanel });
})();
