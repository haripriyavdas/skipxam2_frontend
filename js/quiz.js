/*
 * Quiz (app/quiz.html?set=<id>[&topic=<topicId>]). Load after data.js and app.js.
 * Setup → one MCQ per screen with instant feedback → results (updates topic mastery).
 * With ?topic= the quiz starts straight away on that topic.
 */
(function () {
  "use strict";

  const main = document.querySelector("main");
  const { set: initialSet, topic: startTopic } = setFromUrl();
  const LETTERS = ["A", "B", "C", "D"];
  const COUNTS = [5, 10, 15];

  const state = {
    screen: "setup",                 // "setup" | "question" | "results"
    topics: new Set(),               // selected topic ids
    count: 10,                       // number of questions, or "all"
    questions: [],                   // question objects for this run
    index: 0,
    answers: [],                     // chosen option index per question
    changes: [],                     // mastery changes from applyTopicResults
  };

  const set = () => getSet(initialSet.id);

  function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function availableQuestions() {
    return set().quiz.filter((q) => state.topics.has(q.topicId));
  }

  function start(questionList) {
    state.questions = questionList;
    state.index = 0;
    state.answers = [];
    state.changes = [];
    state.screen = "question";
    render();
  }

  function startFromSetup() {
    const pool = shuffle(availableQuestions());
    const n = state.count === "all" ? pool.length : Math.min(state.count, pool.length);
    if (n > 0) start(pool.slice(0, n));
  }

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------

  function setupHtml(s) {
    const available = availableQuestions().length;
    const chips = s.topics.map((t) => {
      const count = s.quiz.filter((q) => q.topicId === t.id).length;
      return `
        <button type="button" class="chip" data-topic="${t.id}" aria-pressed="${state.topics.has(t.id)}"${count ? "" : " disabled"}>
          ${escapeHtml(t.name)} <span class="muted">${count}</span>
        </button>`;
    }).join("");

    const countOption = (value, label) => {
      const disabled = value !== "all" && value > available;
      return `<label><input type="radio" name="count" value="${value}"${state.count === value ? " checked" : ""}${disabled ? " disabled" : ""}><span>${label}</span></label>`;
    };

    return `
      <section class="card quiz-setup" aria-labelledby="setup-title">
        <h2 id="setup-title" class="visually-hidden">Set up your quiz</h2>
        <div class="field">
          <div class="setup-label-row">
            <span class="field-label" id="topics-label">Topics</span>
            <button type="button" class="btn btn-ghost btn-sm" data-select-all>
              ${state.topics.size === s.topics.length ? "Clear all" : "Select all"}
            </button>
          </div>
          <div class="chips" role="group" aria-labelledby="topics-label">${chips}</div>
        </div>
        <fieldset class="field">
          <legend class="field-label">Number of questions</legend>
          <div class="segmented">
            ${COUNTS.map((n) => countOption(n, n)).join("")}
            ${countOption("all", `All (${available})`)}
          </div>
        </fieldset>
        <button type="button" class="btn btn-primary btn-block" data-start${available ? "" : " disabled"}>
          Start quiz
        </button>
      </section>`;
  }

  // ---------------------------------------------------------------------------
  // Question
  // ---------------------------------------------------------------------------

  function questionHtml(s) {
    const q = state.questions[state.index];
    const chosen = state.answers[state.index];
    const answered = chosen !== undefined;
    const total = state.questions.length;
    const pct = Math.round((state.index / total) * 100);

    const options = q.options.map((text, i) => {
      let cls = "option";
      if (answered && i === q.answer) cls += " is-correct";
      else if (answered && i === chosen) cls += " is-wrong";
      return `
        <li>
          <button type="button" class="${cls}" data-option="${i}"${answered ? " disabled" : ""}
            aria-describedby="${answered && (i === q.answer || i === chosen) ? "feedback" : ""}">
            <span class="option-letter" aria-hidden="true">${LETTERS[i]}</span>
            <span class="option-text">${richText(text)}</span>
            ${answered && i === q.answer ? `<span class="option-mark">${icon("check")}<span class="visually-hidden">Correct answer</span></span>` : ""}
            ${answered && i === chosen && i !== q.answer ? `<span class="option-mark">${icon("close")}<span class="visually-hidden">Your answer</span></span>` : ""}
          </button>
        </li>`;
    }).join("");

    const correct = chosen === q.answer;
    const feedback = answered ? `
      <div class="feedback ${correct ? "is-correct" : "is-wrong"}" id="feedback">
        <p class="feedback-title">${correct ? "Correct!" : `Not quite. The answer is ${LETTERS[q.answer]}.`}</p>
        <p>${richText(q.explanation)}</p>
      </div>
      <button type="button" class="btn btn-primary btn-block" data-next>
        ${state.index + 1 === total ? "See results" : "Next question"}
      </button>` : "";

    return `
      <section class="quiz-question" aria-labelledby="q-text">
        <div class="quiz-progress-row">
          <span>Question ${state.index + 1} of ${total}</span>
          <span class="muted">${escapeHtml(topicName(s, q.topicId))}</span>
        </div>
        <div class="progress" role="progressbar" aria-label="Quiz progress"
          aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
          <div class="progress-fill" style="width: ${pct}%"></div>
        </div>
        <h2 class="q-text" id="q-text">${richText(q.question)}</h2>
        <ol class="options">${options}</ol>
        <div aria-live="polite">${feedback}</div>
        <p class="quiz-help muted">Press 1–4 to answer, Enter for next</p>
      </section>`;
  }

  function choose(i) {
    if (state.answers[state.index] !== undefined) return;
    state.answers[state.index] = i;
    recordActivity(initialSet.id, "quiz", state.index + 1, state.questions.length);
    render();
    main.querySelector("[data-next]").focus();
  }

  function next() {
    if (state.index + 1 < state.questions.length) {
      state.index += 1;
      render();
      main.querySelector(".option").focus();
    } else {
      finish();
    }
  }

  // ---------------------------------------------------------------------------
  // Results
  // ---------------------------------------------------------------------------

  function finish() {
    const results = {};
    state.questions.forEach((q, i) => {
      results[q.topicId] = results[q.topicId] || { correct: 0, total: 0 };
      results[q.topicId].total += 1;
      if (state.answers[i] === q.answer) results[q.topicId].correct += 1;
    });
    state.changes = applyTopicResults(initialSet.id, results);
    const correct = state.questions.filter((q, i) => state.answers[i] === q.answer).length;
    logActivity(initialSet.id, "quiz", `Took a quiz in ${initialSet.name}, ${correct}/${state.questions.length}`);
    recordQuizScore(Math.round((correct / state.questions.length) * 100));
    state.screen = "results";
    render();
    main.querySelector(".quiz-results h2").focus();
  }

  function resultsHtml(s) {
    const total = state.questions.length;
    const correct = state.questions.filter((q, i) => state.answers[i] === q.answer).length;
    const pct = Math.round((correct / total) * 100);
    const mistakes = state.questions
      .map((q, i) => ({ q, chosen: state.answers[i] }))
      .filter(({ q, chosen }) => chosen !== q.answer);

    const message = pct >= 80 ? "Excellent work." : pct >= 60 ? "Good effort. A little more practice and you've got it." : "Keep going. Review the weak topics below.";
    const weak = state.changes.filter((c) => c.score < 60);
    const free = getUser().plan === "free";

    const topicRows = state.changes.map((c) => {
      const tier = c.score >= 70 ? "is-strong" : c.score < 50 ? "is-weak" : "";
      const delta = c.after - c.before;
      return `
        <li class="bar-row">
          <span>${escapeHtml(c.name)}
            <span class="mastery-change ${delta >= 0 ? "is-up" : "is-down"}">
              Mastery ${c.before}% → ${c.after}%
            </span>
          </span>
          <span class="bar-row-value">${c.score}%</span>
          <div class="progress progress-thin" aria-hidden="true"><div class="progress-fill ${tier}" style="width: ${c.score}%"></div></div>
        </li>`;
    }).join("");

    const weakHtml = weak.length ? `
      <section class="card" aria-labelledby="weak-title">
        <h3 id="weak-title" class="results-h">Weak topics</h3>
        <ul class="weak-list">
          ${weak.map((c) => `
            <li>
              <span class="weak-name">${escapeHtml(c.name)}</span>
              <span class="weak-links">
                <a class="text-link" href="${toolUrl("notes", s.id, { topic: c.topicId })}">Read notes</a>
                <a class="text-link" href="${toolUrl("flashcards", s.id, { topic: c.topicId })}">Flashcards</a>
              </span>
            </li>`).join("")}
        </ul>
      </section>` : "";

    const mistakesHtml = mistakes.length ? `
      <section class="card review" aria-labelledby="review-title">
        <div class="section-head">
          <h3 id="review-title" class="results-h">Review mistakes</h3>
          <button type="button" class="btn btn-secondary btn-sm" data-toggle-review aria-expanded="false" aria-controls="review-list">
            Show ${mistakes.length}
          </button>
        </div>
        <ol class="review-list" id="review-list" hidden>
          ${mistakes.map(({ q, chosen }) => `
            <li>
              <p class="review-q">${richText(q.question)}</p>
              <p class="review-yours">Your answer: ${richText(q.options[chosen])}</p>
              <p class="review-right">Correct: ${richText(q.options[q.answer])}</p>
              <p class="muted">${richText(q.explanation)}</p>
            </li>`).join("")}
        </ol>
      </section>` : "";

    return `
      <div class="quiz-results">
        <section class="card">
          <div class="score-hero">
            ${masteryRing(pct, { size: 96 })}
            <div>
              <h2 tabindex="-1" class="score-big">${correct} / ${total}</h2>
              <p class="muted">${message}</p>
            </div>
          </div>
        </section>

        <section class="card" aria-labelledby="topics-title">
          <h3 id="topics-title" class="results-h">By topic</h3>
          <ul class="topic-results">${topicRows}</ul>
        </section>

        ${weakHtml}
        ${mistakesHtml}

        <a class="pro-nudge" href="${toolUrl("test", s.id)}">
          <span class="tool-icon">${icon("test")}</span>
          <span class="pro-nudge-text">
            <span class="pro-nudge-title">Try a timed Practice test ${free ? '<span class="badge badge-pro">Pro</span>' : ""}</span>
            <span class="muted">University-style paper with Part A, B and C, marked section by section.</span>
          </span>
        </a>

        <div class="results-actions">
          ${mistakes.length ? '<button type="button" class="btn btn-primary" data-retry>Retry mistakes</button>' : ""}
          <button type="button" class="btn btn-secondary" data-new>New quiz</button>
          <a class="btn btn-ghost" href="set.html?set=${encodeURIComponent(s.id)}">Back to set</a>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------------------------
  // Render + events
  // ---------------------------------------------------------------------------

  function render() {
    if (!initialSet) {
      main.innerHTML = setNotFoundHtml();
      return;
    }
    const s = set();
    document.title = `Quiz · ${s.name} · SkipXam`;
    const changeLink = state.screen === "question"
      ? '<button type="button" class="btn btn-ghost btn-sm" data-new>Change topics</button>' : "";

    let body;
    if (s.quiz.length === 0) {
      body = emptyStateHtml({ title: "No quiz questions yet", text: "Quiz questions appear here once your notes are processed.",
        action: { label: "Go to set", href: `set.html?set=${encodeURIComponent(s.id)}` } });
    }
    else if (state.screen === "setup") body = setupHtml(s);
    else if (state.screen === "question") body = questionHtml(s);
    else body = resultsHtml(s);

    main.innerHTML = `${toolHeaderHtml(s, "Quiz", changeLink)}<div class="quiz-body">${body}</div>`;
  }

  main.addEventListener("click", (event) => {
    const t = event.target;
    const topicChip = t.closest("[data-topic]");
    if (topicChip) {
      const id = topicChip.dataset.topic;
      if (state.topics.has(id)) state.topics.delete(id);
      else state.topics.add(id);
      render();
      return;
    }
    if (t.closest("[data-select-all]")) {
      const s = set();
      state.topics = state.topics.size === s.topics.length ? new Set() : new Set(s.topics.map((x) => x.id));
      render();
    } else if (t.closest("[data-start]")) {
      startFromSetup();
      main.querySelector(".option")?.focus();
    } else if (t.closest("[data-option]")) {
      choose(Number(t.closest("[data-option]").dataset.option));
    } else if (t.closest("[data-next]")) {
      next();
    } else if (t.closest("[data-retry]")) {
      const wrong = state.questions.filter((q, i) => state.answers[i] !== q.answer);
      start(shuffle(wrong));
    } else if (t.closest("[data-new]")) {
      state.screen = "setup";
      render();
    } else if (t.closest("[data-toggle-review]")) {
      const btn = t.closest("[data-toggle-review]");
      const list = main.querySelector("#review-list");
      list.hidden = !list.hidden;
      btn.setAttribute("aria-expanded", String(!list.hidden));
      btn.textContent = list.hidden ? `Show ${list.children.length}` : "Hide";
    }
  });

  main.addEventListener("change", (event) => {
    if (event.target.name === "count") {
      state.count = event.target.value === "all" ? "all" : Number(event.target.value);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (state.screen !== "question" || document.querySelector("dialog[open]")) return;
    if (/^[1-4]$/.test(event.key)) {
      const i = Number(event.key) - 1;
      if (i < state.questions[state.index].options.length) choose(i);
    } else if (event.key === "Enter" && state.answers[state.index] !== undefined && !event.target.closest("button, a")) {
      next();
    }
  });

  // Initial state: ?topic= starts straight away on that topic; ?unit= runs a
  // 5-question knowledge check on the unit's topics.
  const KNOWLEDGE_CHECK_QUESTIONS = 5;
  const unitId = new URLSearchParams(location.search).get("unit");
  if (initialSet) {
    const s = set();
    const unit = unitId && s.units.find((u) => u.id === unitId);
    if (unit && s.quiz.some((q) => unit.topicIds.includes(q.topicId))) {
      state.topics = new Set(unit.topicIds);
      state.count = KNOWLEDGE_CHECK_QUESTIONS;
      startFromSetup();
    } else if (startTopic && s.quiz.some((q) => q.topicId === startTopic.id)) {
      state.topics = new Set([startTopic.id]);
      state.count = "all";
      startFromSetup();
    } else {
      state.topics = new Set(s.topics.map((t) => t.id));
      render();
    }
  } else {
    render();
  }
})();
