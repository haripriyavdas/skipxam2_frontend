/*
 * AI Tutor (app/tutor.html[?set=<id>&topic=<topicId>]). Pro feature, wrapped in proGate().
 * Without ?set= it shows a set picker. Replies are mocked from the set's notes,
 * quiz questions and mnemonics, after a short typing delay. Correct answers
 * raise the topic's mastery (+5), wrong ones lower it a little (−2).
 * Load after data.js and app.js.
 */
(function () {
  "use strict";

  const main = document.querySelector("main");
  const { set: initialSet, topic: startTopic } = setFromUrl();
  const set = () => getSet(initialSet.id);
  const LETTERS = ["A", "B", "C", "D"];

  const state = {
    topicId: null,
    messages: [],        // { from: "tutor" | "user", html, quiz?: { qid, chosen } }
    asked: new Set(),    // quiz question ids already used this session
    typing: false,
    suggestions: [],     // quick replies under the last tutor message
  };

  const topic = () => set().topics.find((t) => t.id === state.topicId);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const tier = (m) => (m >= 70 ? "strong" : m >= 40 ? "mid" : "weak");

  // ---------------------------------------------------------------------------
  // Mock tutor brain
  // ---------------------------------------------------------------------------

  function starters(t) {
    return [`Explain ${t.name} simply`, `Quiz me on ${t.name}`, "Give me a memory trick", "What's a common exam mistake?"];
  }

  function section() {
    return set().notes.find((n) => n.topicId === state.topicId);
  }

  function explainReply() {
    const s = section();
    if (!s) return { html: `<p>I don't have notes for ${escapeHtml(topic().name)} yet. Upload some and I'll explain it.</p>` };
    return {
      html: `
        <p>${richText(s.intro)}</p>
        <ul>${s.points.slice(0, 3).map((p) => `<li>${richText(p)}</li>`).join("")}</ul>
        <p>Want me to check you've got it?</p>`,
      suggestions: ["Quiz me", "Give me a memory trick"],
    };
  }

  function quizReply() {
    const pool = set().quiz.filter((q) => q.topicId === state.topicId);
    if (pool.length === 0) return { html: "<p>I don't have questions for this topic yet.</p>" };
    let q = pool.find((x) => !state.asked.has(x.id));
    if (!q) {
      state.asked.clear(); // went through them all, start over
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

  function mistakeReply() {
    const s = section();
    if (!s || !s.remember) return explainReply();
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

  function replyTo(text) {
    const t = text.toLowerCase();
    if (/\b(quiz|question|test me|ask me|another)\b/.test(t)) return quizReply();
    if (/(trick|mnemonic|remember|memori)/.test(t)) return trickReply();
    if (/(mistake|trap|careful|wrong)/.test(t)) return mistakeReply();
    if (/(formula|equation)/.test(t)) return formulaReply();
    if (/^(hi|hello|hey)\b/.test(t)) return { html: `<p>Hi! Ready when you are. Shall we start with a quick question on ${escapeHtml(topic().name)}?</p>`, suggestions: ["Quiz me", "Explain it simply"] };
    return explainReply();
  }

  // ---------------------------------------------------------------------------
  // Chat flow
  // ---------------------------------------------------------------------------

  function greet() {
    const t = topic();
    const user = getUser();
    state.messages = [{
      from: "tutor",
      html: `<p>Hi ${escapeHtml(user.name)}! Let's work on <strong>${escapeHtml(t.name)}</strong>. You're at ${t.mastery}% mastery right now.</p><p>Ask me anything, or pick a starter below.</p>`,
    }];
    state.suggestions = starters(t);
    state.asked = new Set();
  }

  async function tutorSays(reply) {
    state.typing = true;
    state.suggestions = [];
    renderChat();
    await sleep(700 + Math.random() * 600);
    state.typing = false;
    state.messages.push({ from: "tutor", html: reply.html, quiz: reply.quiz });
    state.suggestions = reply.suggestions || [];
    renderChat();
  }

  function send(text) {
    const clean = text.trim();
    if (!clean || state.typing) return;
    state.messages.push({ from: "user", html: `<p>${escapeHtml(clean)}</p>` });
    tutorSays(replyTo(clean));
  }

  function answerQuiz(messageIndex, choice) {
    const msg = state.messages[messageIndex];
    if (!msg || !msg.quiz || msg.quiz.chosen !== null || state.typing) return;
    const q = set().quiz.find((x) => x.id === msg.quiz.qid);
    msg.quiz.chosen = choice;
    const correct = choice === q.answer;
    const before = topic().mastery;
    const after = adjustTopicMastery(initialSet.id, state.topicId, correct ? 5 : -2);

    state.messages.push({ from: "user", html: `<p>${LETTERS[choice]}. ${richText(q.options[choice])}</p>` });
    renderMeter(before, after);
    tutorSays({
      html: correct
        ? `<p><strong>Correct!</strong> ${richText(q.explanation)}</p>`
        : `<p><strong>Not quite.</strong> The answer is ${LETTERS[q.answer]}: ${richText(q.options[q.answer])}.</p><p>${richText(q.explanation)}</p>`,
      suggestions: correct ? ["Another question", "Give me a memory trick"] : ["Explain it again", "Another question"],
    });
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  const avatar = `<span class="tutor-avatar" aria-hidden="true">${icon("sparkle")}</span>`;

  function quizOptionsHtml(msg, index) {
    const q = set().quiz.find((x) => x.id === msg.quiz.qid);
    const answered = msg.quiz.chosen !== null;
    return `
      <div class="tutor-options" role="group" aria-label="Answer options">
        ${q.options.map((opt, o) => {
          let cls = "tutor-option";
          if (answered && o === q.answer) cls += " is-correct";
          else if (answered && o === msg.quiz.chosen) cls += " is-wrong";
          return `<button type="button" class="${cls}" data-answer="${index}:${o}"${answered ? " disabled" : ""}>
            <span class="option-letter">${LETTERS[o]}</span>${richText(opt)}</button>`;
        }).join("")}
      </div>`;
  }

  function messagesHtml() {
    const items = state.messages.map((m, i) => `
      <li class="msg is-${m.from}">
        ${m.from === "tutor" ? avatar : ""}
        <div class="bubble">
          ${m.from === "tutor" ? '<span class="visually-hidden">Tutor:</span>' : '<span class="visually-hidden">You:</span>'}
          ${m.html}
          ${m.quiz ? quizOptionsHtml(m, i) : ""}
        </div>
      </li>`).join("");
    const typing = state.typing ? `
      <li class="msg is-tutor is-typing">${avatar}<div class="bubble"><span class="visually-hidden">Tutor is typing</span><span class="dots" aria-hidden="true"><span></span><span></span><span></span></span></div></li>` : "";
    return items + typing;
  }

  function suggestionsHtml() {
    if (!state.suggestions.length || state.typing) return "";
    return state.suggestions.map((s) => `<button type="button" class="chip suggestion" data-suggest="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("");
  }

  function meterHtml(t) {
    return `
      <div class="meter" aria-label="Topic mastery">
        <div class="meter-head">
          <span class="field-label">Mastery meter</span>
          <span class="meter-value tier-${tier(t.mastery)}" data-meter-value>${t.mastery}%</span>
        </div>
        <div class="meter-track" role="progressbar" aria-label="${escapeHtml(t.name)} mastery"
          aria-valuemin="0" aria-valuemax="100" aria-valuenow="${t.mastery}">
          <div class="meter-fill tier-${tier(t.mastery)}" style="width: ${t.mastery}%"></div>
        </div>
        <p class="meter-hint muted" data-meter-hint>Answer questions correctly to fill it up.</p>
      </div>`;
  }

  function renderMeter(before, after) {
    const fill = main.querySelector(".meter-fill");
    if (!fill) return;
    const cls = `tier-${tier(after)}`;
    fill.style.width = `${after}%`;
    fill.className = `meter-fill ${cls}`;
    const value = main.querySelector("[data-meter-value]");
    value.textContent = `${after}%`;
    value.className = `meter-value ${cls}`;
    main.querySelector(".meter-track").setAttribute("aria-valuenow", String(after));
    const option = main.querySelector(`#tutor-topic option[value="${state.topicId}"]`);
    if (option) option.textContent = `${topic().name} (${after}%)`;
    const diff = after - before;
    main.querySelector("[data-meter-hint]").textContent = diff > 0 ? `+${diff}% from that answer. Keep going!` : diff < 0 ? `${diff}% this time. Try another one.` : "Answer questions correctly to fill it up.";
  }

  function renderChat() {
    const log = main.querySelector(".chat-log");
    if (!log) return;
    log.innerHTML = messagesHtml();
    main.querySelector(".chat-suggestions").innerHTML = suggestionsHtml();
    main.querySelector(".chat-send").disabled = state.typing;
    const scroller = main.querySelector(".chat-scroll");
    scroller.scrollTop = scroller.scrollHeight;
  }

  function pickerHtml() {
    const sets = getSets();
    return `
      <header class="tool-header"><div class="tool-header-row"><h1>Tutor${getUser().plan === "free" ? ' <span class="badge badge-pro">Pro</span>' : ""}</h1></div></header>
      <p class="muted tutor-picker-intro">Choose a study set to start a session.</p>
      ${sets.length ? `
        <ul class="tutor-picker">
          ${sets.map((s) => `
            <li><a class="card tutor-set" href="tutor.html?set=${encodeURIComponent(s.id)}" style="--set-colour: ${s.colour}">
              <span class="tutor-set-emoji" aria-hidden="true">${s.emoji}</span>
              <span><span class="tutor-set-name">${escapeHtml(s.name)}</span><span class="muted">${s.topics.length} topics</span></span>
            </a></li>`).join("")}
        </ul>` : emptyStateHtml({ text: "Create a study set to start a tutor session.", action: { label: `${icon("plus")}New study set`, attrs: 'data-action="create-set"' } })}`;
  }

  function render() {
    if (!initialSet) {
      document.title = "Tutor · SkipXam";
      main.innerHTML = pickerHtml();
      return;
    }
    const s = set();
    document.title = `Tutor · ${s.name} · SkipXam`;
    const proBadge = getUser().plan === "free" ? ' <span class="badge badge-pro">Pro</span>' : "";

    if (s.topics.length === 0) {
      main.innerHTML = `${toolHeaderHtml(s, `Tutor${proBadge}`)}${emptyStateHtml({
        title: "Nothing to tutor yet", text: "The tutor works from the topics in your notes. Upload notes to this set first.",
        action: { label: "Go to set", href: `set.html?set=${encodeURIComponent(s.id)}` } })}`;
      return;
    }

    const t = topic();
    main.innerHTML = `
      ${toolHeaderHtml(s, `Tutor${proBadge}`)}
      <div class="tutor-layout">
        <aside class="card tutor-side">
          <div class="field">
            <label class="field-label" for="tutor-topic">Topic</label>
            <select class="input" id="tutor-topic">
              ${s.topics.map((x) => `<option value="${x.id}"${x.id === state.topicId ? " selected" : ""}>${escapeHtml(x.name)} (${x.mastery}%)</option>`).join("")}
            </select>
          </div>
          ${meterHtml(t)}
        </aside>

        <section class="card chat" aria-label="Chat with your tutor">
          <header class="chat-head">
            ${avatar}
            <div><p class="chat-name">SkipXam Tutor</p><p class="muted chat-status">Knows your ${escapeHtml(s.name)} notes</p></div>
          </header>
          <div class="chat-scroll">
            <ol class="chat-log" role="log" aria-live="polite" aria-label="Conversation"></ol>
          </div>
          <div class="chat-suggestions"></div>
          <form class="chat-form">
            <label class="visually-hidden" for="chat-input">Message the tutor</label>
            <input class="input" id="chat-input" type="text" placeholder="Ask about ${escapeHtml(t.name)}…" autocomplete="off">
            <button type="submit" class="btn btn-primary chat-send" aria-label="Send">${icon("send")}</button>
          </form>
        </section>
      </div>`;
    renderChat();
    proGate(main.querySelector(".tutor-layout"), "AI Tutor");
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  main.addEventListener("submit", (event) => {
    if (!event.target.closest(".chat-form")) return;
    event.preventDefault();
    const input = main.querySelector("#chat-input");
    send(input.value);
    input.value = "";
  });

  main.addEventListener("click", (event) => {
    const suggestion = event.target.closest("[data-suggest]");
    if (suggestion) {
      send(suggestion.dataset.suggest);
      main.querySelector("#chat-input").focus();
      return;
    }
    const answer = event.target.closest("[data-answer]");
    if (answer) {
      const [msg, choice] = answer.dataset.answer.split(":").map(Number);
      answerQuiz(msg, choice);
    }
  });

  main.addEventListener("change", (event) => {
    if (event.target.id !== "tutor-topic") return;
    state.topicId = event.target.value;
    greet();
    render();
    main.querySelector("#tutor-topic").focus();
  });

  if (initialSet) {
    const s = set();
    const weakest = [...s.topics].sort((a, b) => a.mastery - b.mastery)[0];
    state.topicId = startTopic ? startTopic.id : weakest ? weakest.id : null;
    if (state.topicId) greet();
  }
  render();
})();
