/*
 * Practice tests (app/practice-test.html?set=<id>). Pro feature: the setup is
 * wrapped in proGate() for free users. Load after data.js and app.js.
 *
 * Setup → exam mode (timer, question palette, mark for review) → results.
 * MCQs are marked exactly. Written answers are mock-marked by how many of the
 * question's key points they mention (a stand-in for AI marking).
 */
(function () {
  "use strict";

  const main = document.querySelector("main");
  const { set: initialSet } = setFromUrl();
  const set = () => getSet(initialSet.id);

  // Paper blueprints. University papers: Part A MCQs, Part B short answers, Part C long answers.
  const FORMATS = {
    university: {
      label: "University paper",
      description: "Part A MCQs, Part B short answers, Part C long answers",
      marks: {
        25: { parts: [{ part: "A", type: "mcq", count: 5, marks: 1 }, { part: "B", type: "short", count: 2, marks: 5 }, { part: "C", type: "long", count: 1, marks: 10 }], minutes: 45 },
        50: { parts: [{ part: "A", type: "mcq", count: 10, marks: 1 }, { part: "B", type: "short", count: 4, marks: 5 }, { part: "C", type: "long", count: 2, marks: 10 }], minutes: 90 },
      },
    },
    mcq: {
      label: "MCQ test",
      description: "Multiple choice only, 1 mark each, marked instantly",
      marks: {
        10: { parts: [{ part: "A", type: "mcq", count: 10, marks: 1 }], minutes: 15 },
        20: { parts: [{ part: "A", type: "mcq", count: 20, marks: 1 }], minutes: 30 },
      },
    },
  };
  const DURATIONS = [15, 30, 45, 60, 90, 180];
  const PART_NAMES = { mcq: "Multiple choice", short: "Short answer", long: "Long answer" };

  const state = {
    screen: "setup",       // "setup" | "exam" | "results"
    format: "university",
    marks: 25,
    minutes: 45,
    questions: [],         // { part, type, marks, item, answer, visited, marked }
    current: 0,
    endsAt: 0,
    startedAt: 0,
    timer: null,
    warned: new Set(),
    result: null,
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function blueprint() {
    return FORMATS[state.format].marks[state.marks];
  }

  function isAnswered(q) {
    return q.type === "mcq" ? q.answer !== null : q.answer.trim().length > 0;
  }

  function formatClock(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function wordCount(text) {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------

  function setupHtml(s) {
    const formatCards = Object.entries(FORMATS).map(([key, f]) => `
      <label class="format-card">
        <input type="radio" name="format" value="${key}"${state.format === key ? " checked" : ""}>
        <span class="format-card-body">
          <span class="format-title">${f.label}</span>
          <span class="format-desc">${f.description}</span>
        </span>
      </label>`).join("");

    const marksOptions = Object.keys(FORMATS[state.format].marks).map((m) => `
      <label><input type="radio" name="marks" value="${m}"${Number(m) === state.marks ? " checked" : ""}><span>${m} marks</span></label>`).join("");

    const durationOptions = DURATIONS.map((d) => `
      <label><input type="radio" name="minutes" value="${d}"${d === state.minutes ? " checked" : ""}><span>${d < 60 ? `${d} min` : `${d / 60} hr`}</span></label>`).join("");

    const summary = blueprint().parts.map((p) =>
      `<li><strong>Part ${p.part}</strong> · ${PART_NAMES[p.type]} · ${p.count} × ${p.marks} ${p.marks === 1 ? "mark" : "marks"}</li>`).join("");

    return `
      <div class="test-setup">
        <section class="card test-intro">
          <span class="tool-icon">${icon("test")}</span>
          <div>
            <h2>Sit a timed paper for ${escapeHtml(s.name)}</h2>
            <p class="muted">Practise under exam conditions with a timer and question palette, then get marks for each section and see which topics need work.</p>
          </div>
        </section>

        <fieldset class="card field">
          <legend class="field-label">Format</legend>
          <div class="format-cards">${formatCards}</div>
        </fieldset>

        <div class="card setup-row">
          <fieldset class="field">
            <legend class="field-label">Total marks</legend>
            <div class="segmented">${marksOptions}</div>
          </fieldset>
          <fieldset class="field">
            <legend class="field-label">Duration</legend>
            <div class="segmented">${durationOptions}</div>
          </fieldset>
          <ul class="paper-summary">${summary}</ul>
        </div>

        <button type="button" class="btn btn-primary btn-block start-test" data-start>Start test</button>
      </div>`;
  }

  function buildPaper() {
    const s = set();
    const pools = {
      mcq: shuffle(s.quiz),
      short: shuffle(s.written.filter((w) => w.marks === 5)),
      long: shuffle(s.written.filter((w) => w.marks === 10)),
    };
    const questions = [];
    for (const p of blueprint().parts) {
      pools[p.type].slice(0, p.count).forEach((item) => {
        questions.push({ part: p.part, type: p.type, marks: p.marks, item, answer: p.type === "mcq" ? null : "", visited: false, marked: false });
      });
    }
    return questions;
  }

  function startTest() {
    if (getUser().plan !== "pro") {
      openUpgrade("Practice tests");
      return;
    }
    const questions = buildPaper();
    const needed = blueprint().parts.reduce((n, p) => n + p.count, 0);
    if (questions.length < needed) {
      showToast("This set doesn't have enough questions for that paper yet.");
      return;
    }
    Object.assign(state, {
      screen: "exam",
      questions,
      current: 0,
      startedAt: Date.now(),
      endsAt: Date.now() + state.minutes * 60000,
      warned: new Set(),
      result: null,
    });
    questions[0].visited = true;
    document.body.classList.add("exam-mode");
    window.addEventListener("beforeunload", warnBeforeLeaving);
    render();
    state.timer = setInterval(tick, 1000);
  }

  // ---------------------------------------------------------------------------
  // Exam mode
  // ---------------------------------------------------------------------------

  function warnBeforeLeaving(event) {
    event.preventDefault();
    event.returnValue = "";
  }

  function tick() {
    const left = state.endsAt - Date.now();
    const timer = main.querySelector(".exam-timer");
    if (timer) {
      timer.querySelector(".exam-timer-value").textContent = formatClock(left);
      timer.classList.toggle("is-warning", left <= 5 * 60000 && left > 60000);
      timer.classList.toggle("is-danger", left <= 60000);
    }
    for (const mins of [5, 1]) {
      if (left <= mins * 60000 && !state.warned.has(mins) && state.minutes > mins) {
        state.warned.add(mins);
        const msg = `${mins} minute${mins === 1 ? "" : "s"} left`;
        showToast(msg);
        const status = main.querySelector("#exam-status");
        if (status) status.textContent = msg;
      }
    }
    if (left <= 0) {
      showToast("Time's up. Your test has been submitted.");
      submit();
    }
  }

  function paletteHtml() {
    const parts = [...new Set(state.questions.map((q) => q.part))];
    const answered = state.questions.filter(isAnswered).length;
    const groups = parts.map((part) => `
      <div class="palette-part">
        ${parts.length > 1 ? `<p class="palette-part-title">Part ${part}</p>` : ""}
        <div class="palette-grid">
          ${state.questions.map((q, i) => {
            if (q.part !== part) return "";
            let status = "not-visited";
            let label = "not visited";
            if (q.marked) { status = "marked"; label = isAnswered(q) ? "answered, marked for review" : "marked for review"; }
            else if (isAnswered(q)) { status = "answered"; label = "answered"; }
            else if (q.visited) { status = "not-answered"; label = "not answered"; }
            return `
              <button type="button" class="palette-btn is-${status}${isAnswered(q) && q.marked ? " has-answer" : ""}"
                data-goto="${i}"${i === state.current ? ' aria-current="true"' : ""}
                aria-label="Question ${i + 1}, ${label}">${i + 1}</button>`;
          }).join("")}
        </div>
      </div>`).join("");

    return `
      <aside class="exam-palette card" aria-label="Question palette">
        <p class="palette-count"><strong>${answered}</strong> of ${state.questions.length} answered</p>
        ${groups}
        <ul class="palette-legend">
          <li><span class="palette-swatch is-answered"></span>Answered</li>
          <li><span class="palette-swatch is-not-answered"></span>Not answered</li>
          <li><span class="palette-swatch is-marked"></span>Marked for review</li>
          <li><span class="palette-swatch is-not-visited"></span>Not visited</li>
        </ul>
      </aside>`;
  }

  function answerAreaHtml(q, i) {
    if (q.type === "mcq") {
      return `
        <fieldset class="exam-options">
          <legend class="visually-hidden">Choose one answer</legend>
          ${q.item.options.map((opt, o) => `
            <label class="exam-option">
              <input type="radio" name="answer-${i}" value="${o}"${q.answer === o ? " checked" : ""}>
              <span class="exam-option-letter">${"ABCD"[o]}</span>
              <span>${richText(opt)}</span>
            </label>`).join("")}
        </fieldset>
        ${q.answer !== null ? '<button type="button" class="btn btn-ghost btn-sm" data-clear>Clear answer</button>' : ""}`;
    }
    const words = wordCount(q.answer);
    const target = q.type === "short" ? "about 80–120 words" : "about 200–300 words";
    return `
      <label class="visually-hidden" for="written-${i}">Your answer</label>
      <textarea class="input exam-textarea" id="written-${i}" rows="${q.type === "short" ? 7 : 12}"
        placeholder="Write your answer here (${target})">${escapeHtml(q.answer)}</textarea>
      <p class="word-count muted"><span data-words>${words}</span> words · aim for ${target}</p>`;
  }

  function examHtml(s) {
    const q = state.questions[state.current];
    const i = state.current;
    const last = i === state.questions.length - 1;
    const left = state.endsAt - Date.now();

    return `
      <div class="exam">
        <header class="exam-bar">
          <div class="exam-title">
            <span class="exam-set">${s.emoji} ${escapeHtml(s.name)}</span>
            <span class="muted">${FORMATS[state.format].label} · ${state.marks} marks</span>
          </div>
          <div class="exam-timer" role="timer" aria-label="Time left">
            ${icon("calendar")}<span class="exam-timer-value">${formatClock(left)}</span>
          </div>
          <button type="button" class="btn btn-primary btn-sm" data-submit>Submit</button>
        </header>

        <div class="exam-layout">
          <section class="exam-question card" aria-labelledby="exam-q">
            <div class="exam-q-meta">
              <span>Part ${q.part} · Question ${i + 1} of ${state.questions.length}</span>
              <span class="exam-marks">${q.marks} ${q.marks === 1 ? "mark" : "marks"}</span>
            </div>
            <h2 class="exam-q-text" id="exam-q" tabindex="-1">${richText(q.item.question)}</h2>
            ${answerAreaHtml(q, i)}
            <div class="exam-nav">
              <button type="button" class="btn btn-secondary" data-prev${i === 0 ? " disabled" : ""}>← Previous</button>
              <button type="button" class="btn btn-ghost mark-btn" data-mark aria-pressed="${q.marked}">
                ${q.marked ? "Marked for review" : "Mark for review"}
              </button>
              <button type="button" class="btn btn-primary" data-next${last ? " disabled" : ""}>Next →</button>
            </div>
          </section>
          ${paletteHtml()}
        </div>
        <p class="visually-hidden" aria-live="assertive" id="exam-status"></p>
      </div>`;
  }

  function goTo(index) {
    state.current = Math.max(0, Math.min(state.questions.length - 1, index));
    state.questions[state.current].visited = true;
    render();
    main.querySelector(".exam-q-text").focus({ preventScroll: true });
    main.querySelector(".exam-question").scrollIntoView({ block: "nearest" });
  }

  function refreshPalette() {
    const palette = main.querySelector(".exam-palette");
    if (palette) palette.outerHTML = paletteHtml();
  }

  async function confirmSubmit() {
    const total = state.questions.length;
    const answered = state.questions.filter(isAnswered).length;
    const marked = state.questions.filter((q) => q.marked).length;
    const unanswered = total - answered;
    const parts = [`You've answered ${answered} of ${total} questions.`];
    if (unanswered) parts.push(`${unanswered} ${unanswered === 1 ? "is" : "are"} unanswered.`);
    if (marked) parts.push(`${marked} ${marked === 1 ? "is" : "are"} marked for review.`);
    parts.push("You can't change your answers after submitting.");

    const ok = await confirmDialog({ title: "Submit test?", message: parts.join(" "), confirmLabel: "Submit test" });
    if (ok && state.screen === "exam") submit();
  }

  // ---------------------------------------------------------------------------
  // Marking + results
  // ---------------------------------------------------------------------------

  function markQuestion(q) {
    if (q.type === "mcq") {
      return { earned: q.answer === q.item.answer ? q.marks : 0, covered: [], missed: [] };
    }
    const text = q.answer.toLowerCase();
    const covered = q.item.keyPoints.filter((k) => text.includes(k.toLowerCase()));
    const missed = q.item.keyPoints.filter((k) => !covered.includes(k));
    // Very short answers get no credit even if they name a key term.
    if (wordCount(q.answer) < 8) return { earned: 0, covered, missed };
    const raw = (q.marks * covered.length) / q.item.keyPoints.length;
    return { earned: Math.round(raw * 2) / 2, covered, missed }; // nearest half mark
  }

  function submit() {
    clearInterval(state.timer);
    window.removeEventListener("beforeunload", warnBeforeLeaving);
    document.body.classList.remove("exam-mode");

    const marked = state.questions.map((q) => ({ ...q, ...markQuestion(q) }));
    const sections = [...new Set(marked.map((q) => q.part))].map((part) => {
      const qs = marked.filter((q) => q.part === part);
      return {
        part,
        type: qs[0].type,
        count: qs.length,
        attempted: qs.filter(isAnswered).length,
        earned: qs.reduce((n, q) => n + q.earned, 0),
        possible: qs.reduce((n, q) => n + q.marks, 0),
      };
    });

    const byTopic = {};
    for (const q of marked) {
      const t = (byTopic[q.item.topicId] = byTopic[q.item.topicId] || { correct: 0, total: 0 });
      t.correct += q.earned;
      t.total += q.marks;
    }
    const changes = applyTopicResults(initialSet.id, byTopic);

    state.result = {
      questions: marked,
      sections,
      changes,
      earned: sections.reduce((n, s) => n + s.earned, 0),
      possible: sections.reduce((n, s) => n + s.possible, 0),
      minutesUsed: Math.max(1, Math.round((Date.now() - state.startedAt) / 60000)),
    };
    state.screen = "results";
    render();
    window.scrollTo(0, 0);
    main.querySelector(".score-big").focus();
  }

  const fmtMarks = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  function resultsHtml(s) {
    const r = state.result;
    const pct = Math.round((r.earned / r.possible) * 100);
    const strong = r.changes.filter((c) => c.score >= 70);
    const weak = r.changes.filter((c) => c.score < 50);
    const hasWritten = r.questions.some((q) => q.type !== "mcq");

    const sectionRows = r.sections.map((sec) => `
      <tr>
        <th scope="row">Part ${sec.part} <span class="muted">${PART_NAMES[sec.type]}</span></th>
        <td>${sec.attempted} / ${sec.count}</td>
        <td><strong>${fmtMarks(sec.earned)}</strong> / ${sec.possible}</td>
      </tr>`).join("");

    const topicRow = (c) => {
      const tier = c.score >= 70 ? "is-strong" : c.score < 50 ? "is-weak" : "";
      return `
        <li class="bar-row">
          <span>${escapeHtml(c.name)}</span>
          <span class="bar-row-value">${c.score}%</span>
          <div class="progress progress-thin" aria-hidden="true"><div class="progress-fill ${tier}" style="width: ${c.score}%"></div></div>
        </li>`;
    };
    const sorted = [...r.changes].sort((a, b) => b.score - a.score);

    const review = r.questions.map((q, i) => {
      let detail;
      if (q.type === "mcq") {
        const yours = q.answer === null ? "Not answered" : richText(q.item.options[q.answer]);
        detail = `
          <p class="${q.earned ? "review-right" : "review-yours"}">Your answer: ${yours}</p>
          ${q.earned ? "" : `<p class="review-right">Correct: ${richText(q.item.options[q.item.answer])}</p>`}
          <p class="muted">${richText(q.item.explanation)}</p>`;
      } else {
        detail = `
          <p class="muted">${q.answer.trim() ? `Your answer: ${escapeHtml(q.answer.trim().slice(0, 240))}${q.answer.trim().length > 240 ? "…" : ""}` : "Not answered"}</p>
          <div class="key-points">
            ${q.covered.map((k) => `<span class="kp is-covered">${icon("check")}${escapeHtml(k)}</span>`).join("")}
            ${q.missed.map((k) => `<span class="kp is-missed">${escapeHtml(k)}</span>`).join("")}
          </div>
          <p class="model-answer"><strong>Model answer:</strong> ${escapeHtml(q.item.modelAnswer)}</p>`;
      }
      return `
        <details class="review-item">
          <summary>
            <span class="review-num">${i + 1}</span>
            <span class="review-q-text">${richText(q.item.question)}</span>
            <span class="review-score ${q.earned === q.marks ? "is-full" : q.earned === 0 ? "is-zero" : ""}">${fmtMarks(q.earned)}/${q.marks}</span>
          </summary>
          <div class="review-detail">${detail}</div>
        </details>`;
    }).join("");

    return `
      <div class="test-results">
        <section class="card">
          <div class="score-hero">
            ${masteryRing(pct, { size: 96 })}
            <div>
              <h2 class="score-big" tabindex="-1">${fmtMarks(r.earned)} / ${r.possible}</h2>
              <p class="muted">${FORMATS[state.format].label} · finished in ${r.minutesUsed} of ${state.minutes} min</p>
            </div>
          </div>
        </section>

        <section class="card" aria-labelledby="sections-title">
          <h3 class="results-h" id="sections-title">Section-wise marks</h3>
          <table class="section-table">
            <thead><tr><th scope="col">Section</th><th scope="col">Attempted</th><th scope="col">Marks</th></tr></thead>
            <tbody>${sectionRows}</tbody>
            <tfoot><tr><th scope="row">Total</th><td></td><td><strong>${fmtMarks(r.earned)}</strong> / ${r.possible}</td></tr></tfoot>
          </table>
          ${hasWritten ? '<p class="marking-note muted">Written answers are marked by checking which key points they cover. This previews AI marking.</p>' : ""}
        </section>

        <div class="topic-summary">
          <section class="card" aria-labelledby="strong-title">
            <h3 class="results-h" id="strong-title">Strengths</h3>
            ${strong.length ? `<ul class="topic-tags">${strong.map((c) => `<li class="topic-tag is-strong">${escapeHtml(c.name)} · ${c.score}%</li>`).join("")}</ul>` : '<p class="muted">No topic above 70% yet.</p>'}
          </section>
          <section class="card" aria-labelledby="weak-title">
            <h3 class="results-h" id="weak-title">Needs work</h3>
            ${weak.length ? `<ul class="topic-tags">${weak.map((c) => `<li><a class="topic-tag is-weak" href="${toolUrl("notes", s.id, { topic: c.topicId })}">${escapeHtml(c.name)} · ${c.score}%</a></li>`).join("")}</ul>` : '<p class="muted">No topic below 50%. Well done.</p>'}
          </section>
        </div>

        <section class="card" aria-labelledby="by-topic-title">
          <h3 class="results-h" id="by-topic-title">Score by topic</h3>
          <ul class="topic-results">${sorted.map(topicRow).join("")}</ul>
        </section>

        <section class="card" aria-labelledby="answers-title">
          <h3 class="results-h" id="answers-title">Review answers</h3>
          <div class="review-items">${review}</div>
        </section>

        <div class="results-actions">
          <button type="button" class="btn btn-primary" data-new>New test</button>
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
    document.title = `Practice test · ${s.name} · SkipXam`;

    if (state.screen === "exam") {
      main.innerHTML = examHtml(s);
      return;
    }
    const proBadge = getUser().plan === "free" ? '<span class="badge">Pro</span>' : "";
    if (state.screen === "setup" && s.quiz.length === 0) {
      main.innerHTML = `${toolHeaderHtml(s, `Practice test ${proBadge}`)}${emptyStateHtml({
        title: "No questions yet", text: "Practice tests are built from your notes. Upload notes to this set first.",
        action: { label: "Go to set", href: `set.html?set=${encodeURIComponent(s.id)}` } })}`;
      return;
    }
    main.innerHTML = `
      ${toolHeaderHtml(s, `Practice test ${proBadge}`)}
      ${state.screen === "setup" ? setupHtml(s) : resultsHtml(s)}`;
    if (state.screen === "setup") proGate(main.querySelector(".test-setup"), "Practice tests");
  }

  main.addEventListener("change", (event) => {
    const { name, value } = event.target;
    if (name === "format") {
      state.format = value;
      state.marks = Number(Object.keys(FORMATS[value].marks)[0]);
      state.minutes = blueprint().minutes;
      render();
    } else if (name === "marks") {
      state.marks = Number(value);
      state.minutes = blueprint().minutes;
      render();
    } else if (name === "minutes") {
      state.minutes = Number(value);
    } else if (name && name.startsWith("answer-")) {
      state.questions[state.current].answer = Number(value);
      refreshPalette();
      // Show the "Clear answer" button now that there is an answer.
      if (!main.querySelector("[data-clear]")) {
        main.querySelector(".exam-options").insertAdjacentHTML("afterend",
          '<button type="button" class="btn btn-ghost btn-sm" data-clear>Clear answer</button>');
      }
    }
  });

  main.addEventListener("input", (event) => {
    if (!event.target.classList.contains("exam-textarea")) return;
    const q = state.questions[state.current];
    const wasAnswered = isAnswered(q);
    q.answer = event.target.value;
    main.querySelector("[data-words]").textContent = wordCount(q.answer);
    if (wasAnswered !== isAnswered(q)) refreshPalette();
  });

  main.addEventListener("click", (event) => {
    const t = event.target;
    if (t.closest("[data-start]")) startTest();
    else if (t.closest("[data-goto]")) goTo(Number(t.closest("[data-goto]").dataset.goto));
    else if (t.closest("[data-prev]")) goTo(state.current - 1);
    else if (t.closest("[data-next]")) goTo(state.current + 1);
    else if (t.closest("[data-mark]")) {
      const q = state.questions[state.current];
      q.marked = !q.marked;
      const btn = t.closest("[data-mark]");
      btn.setAttribute("aria-pressed", String(q.marked));
      btn.textContent = q.marked ? "Marked for review" : "Mark for review";
      refreshPalette();
    } else if (t.closest("[data-clear]")) {
      state.questions[state.current].answer = null;
      render();
    } else if (t.closest("[data-submit]")) confirmSubmit();
    else if (t.closest("[data-new]")) {
      state.screen = "setup";
      render();
    }
  });

  render();
})();
