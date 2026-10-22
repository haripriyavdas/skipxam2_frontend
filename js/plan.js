/*
 * Study plan (app/plan.html?set=<id>). Load after data.js and app.js.
 * A learning path: units of round topic nodes on a zig-zag line, each unit
 * ending in a checkpoint. A node unlocks when the one before it is done.
 * Clicking a node opens a popover; "Start lesson" runs notes → flashcards →
 * a 5-question quiz → a done screen in a full-screen dialog. Mode (Cram /
 * Standard / Comprehensive) decides which topics are on the path, Sort orders
 * the unfinished ones inside each unit, and Filter highlights by status.
 */
(function () {
  "use strict";

  const main = document.querySelector("main");
  const { set: initialSet } = setFromUrl();
  const set = () => getSet(initialSet.id);

  const STATUS_LABELS = { "not-started": "Not started", "in-progress": "In progress", done: "Covered" };
  const QUIZ_LENGTH = 5;
  const CHECKPOINT_PASS = 3; // correct answers out of QUIZ_LENGTH
  const ZIG = [0, -0.6, -1, -0.6, 0, 0.6, 1, 0.6]; // node offsets along the whole path, × --amp
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const STAR = '<svg class="icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';
  const TROPHY = '<svg class="icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 21h7M10 17h4l.5 4h-5z"/></svg>';

  const state = {
    statuses: new Set(Object.keys(STATUS_LABELS)), // highlighted statuses
    filterOpen: false,
    popStep: null,  // index of the step whose popover is open
    justDone: null, // step index to animate after a lesson
  };

  let steps = []; // the current path, rebuilt on every render

  // ---------------------------------------------------------------------------
  // Path model
  // ---------------------------------------------------------------------------

  const nodeStatus = (topic) => (isLessonDone(topic) ? "done" : topicStatus(topic));

  function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Up to 5 questions: the topic's (or unit's) own first, topped up from the unit, then the set.
  function pickQuestions(s, topicIds, unitTopicIds) {
    const picked = [];
    const add = (pool) => {
      for (const q of shuffle(pool)) {
        if (picked.length >= QUIZ_LENGTH) return;
        if (!picked.includes(q)) picked.push(q);
      }
    };
    add(s.quiz.filter((q) => topicIds.includes(q.topicId)));
    add(s.quiz.filter((q) => unitTopicIds.includes(q.topicId)));
    add(s.quiz);
    return picked;
  }

  function lessonMinutes(s, topic) {
    const note = s.notes.find((n) => n.topicId === topic.id);
    const cards = s.flashcards.filter((c) => c.topicId === topic.id).length;
    const questions = Math.min(QUIZ_LENGTH, s.quiz.length);
    return Math.max(3, Math.round((note ? 2 + note.points.length * 0.5 : 0) + cards * 0.5 + questions * 0.75));
  }

  // Flat list of steps: { kind: "topic" | "checkpoint", unit, unitIndex, topic?, state }.
  // state: done | current | available | locked. Done topics come first in each unit,
  // so the path fills from the top; the plan's sort orders the rest.
  function buildSteps(s) {
    const groups = getPlanGroups(s);
    const hasQuiz = s.quiz.length > 0;
    const checkpoints = s.checkpoints || {};
    const list = [];
    let prevDone = true;
    let currentSet = false;

    const place = (step, done, unlocked) => {
      if (done) step.state = "done";
      else if (!unlocked) step.state = "locked";
      else if (!currentSet) { step.state = "current"; currentSet = true; }
      else step.state = "available";
      list.push(step);
      prevDone = done;
    };

    groups.forEach(({ unit, topics }, unitIndex) => {
      const ordered = [...topics.filter(isLessonDone), ...topics.filter((t) => !isLessonDone(t))];
      for (const topic of ordered) place({ kind: "topic", unit, unitIndex, topic, unitTopics: topics }, isLessonDone(topic), prevDone);
      if (hasQuiz) {
        const unitDone = topics.every(isLessonDone);
        place({ kind: "checkpoint", unit, unitIndex, unitTopics: topics }, Boolean(checkpoints[unit.id]), unitDone);
      }
    });
    return list;
  }

  // ---------------------------------------------------------------------------
  // Pieces
  // ---------------------------------------------------------------------------

  function headerHtml(s) {
    const showHint = !(getUser().dismissed || {}).planHowItWorks;
    return `
      <header class="set-head" style="--set-colour: ${s.colour}">
        <span class="set-tile set-tile-lg" aria-hidden="true">${s.emoji}</span>
        <div class="set-head-text">
          <h1>${escapeHtml(s.name)}: Study plan</h1>
          ${showHint ? `
            <p class="how-it-works">
              <button type="button" class="link-btn" data-how>How it works</button>
              <button type="button" class="icon-btn how-dismiss" data-dismiss-how aria-label="Dismiss How it works">${icon("close")}</button>
            </p>` : ""}
        </div>
      </header>`;
  }

  function customizeHtml(s) {
    const modeMenu = menuSelectHtml({
      name: "mode", prefix: "Mode:", label: "Plan mode", value: s.planMode,
      options: Object.entries(PLAN_MODES).map(([value, m]) => ({ value, label: m.label, hint: m.hint })),
    });
    const sortMenu = menuSelectHtml({
      name: "sort", prefix: "Sort by:", label: "Sort topics by", value: s.planSort,
      options: Object.entries(PLAN_SORTS).map(([value, x]) => ({ value, label: x.label, icon: value === "recommended" ? "sparkle" : "" })),
    });
    const filtered = state.statuses.size < Object.keys(STATUS_LABELS).length;

    return `
      <section class="card customize" aria-label="Customize your plan">
        <span class="customize-title">Customize</span>
        ${modeMenu}
        ${sortMenu}
        <div class="customize-icons">
          <div class="filter-wrap">
            <button type="button" class="icon-btn${filtered ? " is-active" : ""}" data-filter aria-label="Highlight topics by status"
              aria-expanded="${state.filterOpen}" aria-controls="status-filter">${icon("filter")}</button>
            <div class="filter-pop glass" id="status-filter"${state.filterOpen ? "" : " hidden"}>
              <p class="field-label">Highlight topics</p>
              ${Object.entries(STATUS_LABELS).map(([value, label]) => `
                <label class="filter-option">
                  <input type="checkbox" class="checkbox" data-status="${value}"${state.statuses.has(value) ? " checked" : ""}>
                  <span>${label}</span>
                </label>`).join("")}
            </div>
          </div>
          <button type="button" class="icon-btn" data-plan-settings aria-label="Plan settings">${icon("settings")}</button>
        </div>
      </section>`;
  }

  const STATE_LABELS = { done: "done", current: "start here", available: "unlocked", locked: "locked" };

  function stepHtml(step, index, zig) {
    const isCheckpoint = step.kind === "checkpoint";
    const name = isCheckpoint ? `Unit ${step.unitIndex + 1} checkpoint` : step.topic.name;
    const dimmed = !isCheckpoint && !state.statuses.has(nodeStatus(step.topic));
    const glyph = step.state === "done" ? icon("check")
      : step.state === "locked" ? (isCheckpoint ? TROPHY : icon("lock"))
      : isCheckpoint ? TROPHY : STAR;
    const classes = [
      "path-step", `is-${step.state}`, isCheckpoint ? "is-checkpoint" : "",
      dimmed ? "is-dimmed" : "", state.justDone === index ? "is-new" : "",
    ].filter(Boolean).join(" ");

    return `
      <li class="${classes}" style="--x: ${zig}">
        ${step.state === "current" ? '<span class="node-start" aria-hidden="true">Start</span>' : ""}
        <button type="button" class="path-node" data-step="${index}" aria-haspopup="dialog"
          aria-expanded="${state.popStep === index}" aria-label="${escapeHtml(name)}, ${STATE_LABELS[step.state]}">
          ${glyph}
        </button>
        <span class="node-caption" aria-hidden="true">${escapeHtml(name)}</span>
      </li>`;
  }

  function unitHtml(s, unitIndex) {
    const unitSteps = steps.map((step, i) => ({ step, i })).filter(({ step }) => step.unitIndex === unitIndex);
    const { unit, unitTopics } = unitSteps[0].step;
    const done = unitTopics.filter(isLessonDone).length;
    const pct = Math.round((done / unitTopics.length) * 100);

    return `
      <section class="path-unit" aria-labelledby="unit-${unit.id}">
        <header class="unit-banner">
          <span class="unit-label">Unit ${unitIndex + 1}</span>
          <h2 class="unit-name" id="unit-${unit.id}">${escapeHtml(unit.name)}</h2>
          <div class="unit-meta">
            <span>${done} of ${unitTopics.length} lessons done</span>
            <span class="unit-bar" aria-hidden="true"><span style="width: ${pct}%"></span></span>
          </div>
        </header>
        <div class="path-track">
          <svg class="path-line" aria-hidden="true"></svg>
          <ol class="path-nodes">
            ${unitSteps.map(({ step, i }) => stepHtml(step, i, ZIG[i % ZIG.length])).join("")}
          </ol>
        </div>
      </section>`;
  }

  function pathHtml(s) {
    steps = buildSteps(s);
    const topicSteps = steps.filter((x) => x.kind === "topic");
    const done = topicSteps.filter((x) => x.state === "done").length;
    const unitCount = steps.length ? steps[steps.length - 1].unitIndex + 1 : 0;
    const units = Array.from({ length: unitCount }, (_, i) => unitHtml(s, i)).join("");
    const mode = PLAN_MODES[s.planMode];

    return `
      <p class="plan-summary muted" aria-live="polite">
        ${done} of ${topicSteps.length} lessons done · ${topicSteps.length} of ${s.topics.length} topics in ${mode.label} mode
      </p>
      <div class="path">
        ${units}
        ${s.examDate && daysUntil(s.examDate) >= 0 ? `
          <div class="path-end">
            <span class="path-end-icon" aria-hidden="true">${icon("test")}</span>
            <div><strong>Exam day</strong><span class="muted">${formatDate(s.examDate)} · ${examLabel(s.examDate)}</span></div>
          </div>` : ""}
      </div>`;
  }

  // ---------------------------------------------------------------------------
  // Curved line: a cubic curve between each pair of node centres, measured from
  // the layout so it follows the zig-zag at every width. Amber up to the current node.
  // ---------------------------------------------------------------------------

  function drawLines() {
    main.querySelectorAll(".path-track").forEach((track) => {
      const svg = track.querySelector(".path-line");
      const box = track.getBoundingClientRect();
      const points = [...track.querySelectorAll(".path-step")].map((li) => {
        const r = li.querySelector(".path-node").getBoundingClientRect();
        return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2, state: li.className };
      });
      let grey = "";
      let amber = "";
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const dy = (b.y - a.y) / 2;
        const d = `M${a.x} ${a.y}C${a.x} ${a.y + dy} ${b.x} ${b.y - dy} ${b.x} ${b.y}`;
        if (a.state.includes("is-done") && /is-(done|current)/.test(b.state)) amber += d; else grey += d;
      }
      svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
      svg.setAttribute("width", box.width);
      svg.setAttribute("height", box.height);
      svg.innerHTML = `<path class="line-todo" d="${grey}"/><path class="line-done" d="${amber}"/>`;
    });
  }

  let drawQueued = false;
  const queueDraw = () => {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => {
      drawQueued = false;
      drawLines();
      if (state.popStep !== null) positionPopover();
    });
  };
  new ResizeObserver(queueDraw).observe(main);
  if (document.fonts) document.fonts.ready.then(queueDraw);

  // ---------------------------------------------------------------------------
  // Node popover
  // ---------------------------------------------------------------------------

  function popoverHtml(s, step) {
    const isCheckpoint = step.kind === "checkpoint";
    const index = steps.indexOf(step);
    const prev = steps[index - 1];
    const prevName = prev && (prev.kind === "checkpoint" ? `the Unit ${prev.unitIndex + 1} checkpoint` : prev.topic.name);
    const title = isCheckpoint ? `Unit ${step.unitIndex + 1} checkpoint` : step.topic.name;
    const meta = isCheckpoint
      ? `${Math.min(QUIZ_LENGTH, s.quiz.length)} questions on this unit · about 4 min`
      : `Unit ${step.unitIndex + 1} · about ${lessonMinutes(s, step.topic)} min`;

    let hint = "";
    let action = "";
    if (step.state === "locked") {
      hint = isCheckpoint ? "Finish every lesson in this unit to unlock it." : `Finish ${escapeHtml(prevName)} to unlock this.`;
      action = `<button type="button" class="btn btn-secondary btn-block" disabled>${icon("lock")}Locked</button>`;
    } else if (step.state === "done") {
      hint = isCheckpoint ? "Passed. Take it again any time." : `Done. Mastery ${step.topic.mastery}%.`;
      action = `<button type="button" class="btn btn-secondary btn-block" data-start="${index}">Practice again</button>`;
    } else {
      hint = isCheckpoint
        ? `Get ${CHECKPOINT_PASS} of ${QUIZ_LENGTH} right to pass${steps[index + 1] ? ` and unlock Unit ${step.unitIndex + 2}` : ""}.`
        : "Notes, flashcards, then a 5-question quiz.";
      action = `<button type="button" class="btn btn-primary btn-block" data-start="${index}">${isCheckpoint ? "Start checkpoint" : "Start lesson"}</button>`;
    }

    return `
      <div class="node-pop is-${step.state}" role="dialog" aria-labelledby="node-pop-title">
        <span class="node-pop-arrow" aria-hidden="true"></span>
        <h3 id="node-pop-title" tabindex="-1">${escapeHtml(title)}</h3>
        <p class="node-pop-meta">${icon("clock")}${meta}</p>
        <p class="node-pop-hint muted">${hint}</p>
        ${action}
      </div>`;
  }

  function positionPopover() {
    const pop = main.querySelector(".node-pop");
    const node = main.querySelector(`[data-step="${state.popStep}"]`);
    if (!pop || !node) return;
    const path = main.querySelector(".path").getBoundingClientRect();
    const r = node.getBoundingClientRect();
    const centre = r.left - path.left + r.width / 2;
    const left = Math.max(0, Math.min(path.width - pop.offsetWidth, centre - pop.offsetWidth / 2));
    pop.style.left = `${left}px`;
    pop.style.top = `${r.bottom - path.top + 14}px`;
    pop.style.setProperty("--arrow-x", `${centre - left}px`);
  }

  function openPopover(index) {
    closePopover();
    state.popStep = index;
    const path = main.querySelector(".path");
    path.insertAdjacentHTML("beforeend", popoverHtml(set(), steps[index]));
    main.querySelector(`[data-step="${index}"]`).setAttribute("aria-expanded", "true");
    positionPopover();
    const pop = main.querySelector(".node-pop");
    pop.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
    (pop.querySelector("[data-start]") || pop.querySelector("h3")).focus({ preventScroll: true });
  }

  function closePopover({ returnFocus = false } = {}) {
    const pop = main.querySelector(".node-pop");
    if (pop) pop.remove();
    if (state.popStep === null) return;
    const node = main.querySelector(`[data-step="${state.popStep}"]`);
    if (node) {
      node.setAttribute("aria-expanded", "false");
      if (returnFocus) node.focus();
    }
    state.popStep = null;
  }

  // ---------------------------------------------------------------------------
  // Lesson: notes → flashcards → quiz → done, in a full-screen dialog
  // ---------------------------------------------------------------------------

  let lesson = null;

  function startLesson(index) {
    const s = set();
    const step = steps[index];
    const isCheckpoint = step.kind === "checkpoint";
    const unitTopicIds = step.unitTopics.map((t) => t.id);
    const stages = [];
    if (!isCheckpoint) {
      const note = s.notes.find((n) => n.topicId === step.topic.id);
      if (note) stages.push({ type: "notes", note });
      s.flashcards.filter((c) => c.topicId === step.topic.id).forEach((card) => stages.push({ type: "card", card }));
    }
    const questions = pickQuestions(s, isCheckpoint ? unitTopicIds : [step.topic.id], unitTopicIds);
    questions.forEach((q, n) => stages.push({ type: "question", q, n }));

    lesson = {
      step, index, stages, questions: questions.length,
      at: 0, flipped: false, answer: null,
      correct: 0, cards: 0, results: {}, changes: [], passed: true, finished: false,
      picks: [], startedAt: Date.now(), // quiz answers, saved to the set's quiz history
    };

    closePopover();
    const title = isCheckpoint ? `Unit ${step.unitIndex + 1} checkpoint` : step.topic.name;
    const dialog = document.createElement("dialog");
    dialog.className = "lesson";
    dialog.setAttribute("aria-labelledby", "lesson-title");
    dialog.innerHTML = `
      <div class="lesson-top">
        <button type="button" class="icon-btn" data-lesson-quit aria-label="Quit lesson">${icon("close")}</button>
        <div class="progress lesson-progress" role="progressbar" aria-label="Lesson progress" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-fill"></div>
        </div>
        <span class="lesson-count muted"></span>
      </div>
      <h2 class="visually-hidden" id="lesson-title">${isCheckpoint ? "" : "Lesson: "}${escapeHtml(title)}</h2>
      <div class="lesson-body"><div class="lesson-inner"></div></div>
      <div class="lesson-foot"><div class="lesson-foot-inner"></div></div>`;
    document.body.appendChild(dialog);
    lesson.dialog = dialog;

    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      quitLesson();
    });
    dialog.addEventListener("click", onLessonClick);
    dialog.showModal();

    if (!stages.length) finishLesson(); else renderStage();
  }

  async function quitLesson() {
    if (!lesson.finished && lesson.at > 0) {
      const quit = await confirmDialog({
        title: "Quit this lesson?",
        message: "You'll start from the beginning next time. Flashcard reviews you've done are kept.",
        confirmLabel: "Quit lesson",
      });
      if (!quit) return;
    }
    closeLesson();
  }

  function closeLesson() {
    const { dialog, finished, index } = lesson;
    dialog.close();
    dialog.remove();
    lesson = null;
    render();
    if (finished) {
      const current = steps.findIndex((x) => x.state === "current");
      const target = main.querySelector(`[data-step="${current === -1 ? index : current}"]`);
      if (target) {
        target.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
        target.focus({ preventScroll: true });
      }
    } else {
      const node = main.querySelector(`[data-step="${index}"]`);
      if (node) node.focus();
    }
  }

  function setProgress() {
    const { dialog, stages, at, finished } = lesson;
    const pct = finished ? 100 : Math.round((at / stages.length) * 100);
    dialog.querySelector(".lesson-progress .progress-fill").style.width = `${pct}%`;
    dialog.querySelector(".lesson-progress").setAttribute("aria-valuenow", String(pct));
    dialog.querySelector(".lesson-count").textContent = finished ? "" : `${at + 1}/${stages.length}`;
  }

  function stageHtml(stage) {
    const s = set();
    if (stage.type === "notes") {
      const { note } = stage;
      const formulas = note.formulas.map((f) => `
        <div class="formula"><span class="formula-label">${escapeHtml(f.label)}</span><span class="formula-expr">${escapeHtml(f.expr)}</span></div>`).join("");
      return {
        body: `
          <p class="stage-kicker">${icon("notes")}Smart notes</p>
          <h3 class="stage-title" tabindex="-1">${escapeHtml(lesson.step.topic.name)}</h3>
          <p class="lesson-intro">${richText(note.intro)}</p>
          ${note.points.length ? `<ul class="lesson-points">${note.points.map((p) => `<li>${richText(p)}</li>`).join("")}</ul>` : ""}
          ${formulas ? `<div class="formulas">${formulas}</div>` : ""}
          ${note.remember ? `
            <aside class="remember">
              <span class="remember-label">${icon("sparkle")}Remember this</span>
              <p>${richText(note.remember)}</p>
            </aside>` : ""}`,
        foot: `<span></span><button type="button" class="btn btn-primary" data-next>Continue</button>`,
      };
    }

    if (stage.type === "card") {
      const total = lesson.stages.filter((x) => x.type === "card").length;
      const n = lesson.stages.filter((x, i) => x.type === "card" && i <= lesson.at).length;
      const { card } = stage;
      return {
        body: `
          <p class="stage-kicker">${icon("cards")}Flashcard ${n} of ${total}</p>
          <button type="button" class="lesson-card${lesson.flipped ? " is-flipped" : ""}" data-flip
            aria-label="${lesson.flipped ? "Answer shown" : "Show the answer"}">
            <span class="lesson-card-inner">
              <span class="lesson-card-face is-front"><span class="face-label">Question</span><span class="face-text">${richText(card.front)}</span></span>
              <span class="lesson-card-face is-back"><span class="face-label">Answer</span><span class="face-text">${richText(card.back)}</span></span>
            </span>
          </button>
          <p class="stage-help muted">${lesson.flipped ? "Did you remember it?" : "Think of the answer, then flip the card."}</p>`,
        foot: lesson.flipped
          ? `<button type="button" class="btn btn-secondary" data-card="again">Again</button>
             <button type="button" class="btn btn-primary" data-card="got">Got it</button>`
          : `<span></span><button type="button" class="btn btn-primary" data-flip>Show answer</button>`,
      };
    }

    // question
    const { q, n } = stage;
    const answered = lesson.answer !== null;
    const right = answered && lesson.answer === q.answer;
    const topic = s.topics.find((t) => t.id === q.topicId);
    return {
      body: `
        <p class="stage-kicker">${icon("quiz")}Question ${n + 1} of ${lesson.questions}${topic && lesson.step.kind === "checkpoint" ? ` · ${escapeHtml(topic.name)}` : ""}</p>
        <h3 class="stage-title" tabindex="-1">${richText(q.question)}</h3>
        <div class="lesson-options" role="group" aria-label="Answers">
          ${q.options.map((opt, i) => {
            let cls = "";
            if (answered && i === q.answer) cls = " is-correct";
            else if (answered && i === lesson.answer) cls = " is-wrong";
            return `<button type="button" class="lesson-option${cls}" data-option="${i}"${answered ? " disabled" : ""}>
              <span class="option-key" aria-hidden="true">${String.fromCharCode(65 + i)}</span><span>${richText(opt)}</span>
            </button>`;
          }).join("")}
        </div>`,
      foot: answered
        ? `<div class="feedback ${right ? "is-right" : "is-wrong"}" role="status">
             <strong>${right ? "Correct!" : `Answer: ${richText(q.options[q.answer])}`}</strong>
             <span>${richText(q.explanation)}</span>
           </div>
           <button type="button" class="btn btn-primary" data-next>Continue</button>`
        : `<span class="muted stage-help">Pick an answer.</span>`,
      footClass: answered ? (right ? "is-right" : "is-wrong") : "",
    };
  }

  function renderStage({ focus = "auto" } = {}) {
    const { dialog } = lesson;
    const { body, foot, footClass = "" } = stageHtml(lesson.stages[lesson.at]);
    dialog.querySelector(".lesson-inner").innerHTML = body;
    const footEl = dialog.querySelector(".lesson-foot");
    footEl.className = `lesson-foot ${footClass}`.trim();
    footEl.querySelector(".lesson-foot-inner").innerHTML = foot;
    setProgress();

    const target = focus === "foot"
      ? footEl.querySelector(".btn-primary") || footEl.querySelector(".btn")
      : dialog.querySelector(".lesson-option:not([disabled])") || footEl.querySelector(".btn-primary") || dialog.querySelector(".stage-title");
    if (target) target.focus();
    if (focus !== "foot") dialog.querySelector(".lesson-body").scrollTop = 0;
  }

  function nextStage() {
    lesson.at += 1;
    lesson.flipped = false;
    lesson.answer = null;
    if (lesson.at >= lesson.stages.length) finishLesson(); else renderStage();
  }

  function onLessonClick(event) {
    const t = event.target;
    if (t.closest("[data-lesson-quit]")) return quitLesson();
    if (t.closest("[data-lesson-close]")) return closeLesson();
    if (t.closest("[data-lesson-retry]")) {
      const { dialog, index } = lesson;
      dialog.close();
      dialog.remove();
      return startLesson(index);
    }
    if (t.closest("[data-next]")) return nextStage();

    if (t.closest("[data-flip]") && !lesson.flipped) {
      lesson.flipped = true;
      return renderStage({ focus: "foot" });
    }
    const cardBtn = t.closest("[data-card]");
    if (cardBtn) {
      const { card } = lesson.stages[lesson.at];
      reviewFlashcard(set().id, card.id, cardBtn.dataset.card === "got");
      lesson.cards += 1;
      return nextStage();
    }
    const option = t.closest("[data-option]");
    if (option && lesson.answer === null) {
      const { q } = lesson.stages[lesson.at];
      lesson.answer = Number(option.dataset.option);
      lesson.picks.push({ questionId: q.id, chosen: lesson.answer });
      const right = lesson.answer === q.answer;
      if (right) lesson.correct += 1;
      const r = lesson.results[q.topicId] || (lesson.results[q.topicId] = { correct: 0, total: 0 });
      r.total += 1;
      if (right) r.correct += 1;
      renderStage({ focus: "foot" });
    }
  }

  function finishLesson() {
    const s = set();
    const { step, questions, correct } = lesson;
    const isCheckpoint = step.kind === "checkpoint";
    const name = isCheckpoint ? `Unit ${step.unitIndex + 1} checkpoint` : step.topic.name;
    lesson.finished = true;

    if (questions) {
      lesson.changes = applyTopicResults(s.id, lesson.results);
      recordQuizScore(Math.round((correct / questions) * 100));
      saveQuizAttempt(s.id, {
        source: "lesson",
        answers: lesson.picks,
        correct,
        total: questions,
        seconds: Math.round((Date.now() - lesson.startedAt) / 1000),
      });
    }
    if (isCheckpoint) {
      lesson.passed = correct >= Math.min(CHECKPOINT_PASS, questions);
      if (lesson.passed) completeCheckpoint(s.id, step.unit.id);
    } else {
      completeLesson(s.id, step.topic.id);
    }
    if (lesson.passed) {
      logActivity(s.id, "quiz", `Finished ${isCheckpoint ? "the" : "the lesson"} ${name} in ${s.name}${questions ? `, ${correct}/${questions}` : ""}`);
      // Keep the set home's "current topic" in step with the path.
      const next = buildSteps(set()).find((x) => x.state === "current" && x.kind === "topic");
      if (next) setCurrentTopic(s.id, next.topic.id);
      state.justDone = lesson.index;
    }

    const own = !isCheckpoint && lesson.changes.find((c) => c.topicId === step.topic.id);
    const stats = [
      questions ? `<div class="done-stat"><strong>${correct}/${questions}</strong><span>correct</span></div>` : "",
      lesson.cards ? `<div class="done-stat"><strong>${lesson.cards}</strong><span>${lesson.cards === 1 ? "card" : "cards"} reviewed</span></div>` : "",
      own ? `<div class="done-stat"><strong>${own.before}% → ${own.after}%</strong><span>mastery</span></div>` : "",
    ].join("");

    const heading = !lesson.passed ? "Not quite yet" : isCheckpoint ? "Checkpoint passed!" : "Lesson complete!";
    const text = !lesson.passed
      ? `You need ${CHECKPOINT_PASS} of ${questions} to pass. Review this unit's lessons, then try again.`
      : isCheckpoint ? `You've finished Unit ${step.unitIndex + 1}: ${escapeHtml(step.unit.name)}.` : `${escapeHtml(name)} is done. The next lesson is unlocked.`;

    const { dialog } = lesson;
    dialog.querySelector(".lesson-inner").innerHTML = `
      <div class="lesson-done${lesson.passed ? "" : " is-failed"}">
        <span class="done-emblem" aria-hidden="true">${lesson.passed ? (isCheckpoint ? TROPHY : icon("check")) : icon("quiz")}</span>
        <h3 class="stage-title" tabindex="-1">${heading}</h3>
        <p class="muted">${text}</p>
        ${stats ? `<div class="done-stats">${stats}</div>` : ""}
      </div>`;
    const footEl = dialog.querySelector(".lesson-foot");
    footEl.className = "lesson-foot";
    footEl.querySelector(".lesson-foot-inner").innerHTML = lesson.passed
      ? `<span></span><button type="button" class="btn btn-primary" data-lesson-close>Continue</button>`
      : `<button type="button" class="btn btn-secondary" data-lesson-close>Back to path</button>
         <button type="button" class="btn btn-primary" data-lesson-retry>Try again</button>`;
    setProgress();
    footEl.querySelector(".btn-primary").focus();
  }

  // ---------------------------------------------------------------------------
  // Sheets
  // ---------------------------------------------------------------------------

  function openHowItWorks() {
    openModal({
      title: "How your study plan works",
      body: `
        <ul class="how-list">
          <li><strong>Your path</strong> runs through each unit one lesson at a time. Finish a lesson to unlock the next one.</li>
          <li><strong>A lesson</strong> is the topic's smart notes, its flashcards, then a 5-question quiz.</li>
          <li><strong>Checkpoints</strong> end each unit: 5 questions on the whole unit. Get 3 right to unlock the next unit.</li>
          <li><strong>Mode</strong> sets how much to cover. Cram keeps only the highest-priority topics; Comprehensive covers everything.</li>
          <li><strong>Sort</strong> orders the lessons you haven't done yet inside each unit. Recommended puts what you've started first, then your weakest topics.</li>
        </ul>
        <div class="modal-actions"><button type="button" class="btn btn-primary" data-modal-close autofocus>Got it</button></div>`,
    });
  }

  function openPlanSettings(s) {
    const modal = openModal({
      title: "Plan settings",
      body: `
        <form>
          <div class="field">
            <label class="field-label" for="plan-exam">Exam date</label>
            <input class="input" id="plan-exam" name="examDate" type="date" value="${s.examDate || ""}" min="${addDays(todayISO(), 1)}" aria-describedby="plan-exam-hint">
            <p class="field-hint" id="plan-exam-hint">Your daily goals on Home are planned from today up to this date.</p>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
            <button type="submit" class="btn btn-primary">Save and rebuild</button>
          </div>
        </form>`,
    });
    const form = modal.dialog.querySelector("form");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      setExamDate(s.id, form.elements.examDate.value || null);
      buildStudyPlan(s.id);
      modal.close();
      render();
      showToast("Plan rebuilt for your exam date");
    });
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
    state.popStep = null;
    document.title = `Study plan · ${s.name} · SkipXam`;
    const body = s.topics.length
      ? `${customizeHtml(s)}<div class="path-wrap">${pathHtml(s)}</div>`
      : emptyStateHtml({
          title: "No study plan yet",
          text: "Your plan is built from the topics in your notes. Upload notes to this set first.",
          action: { label: "Upload notes", href: `set.html?set=${encodeURIComponent(s.id)}&upload=1` },
        });
    main.innerHTML = `${headerHtml(s)}<div class="plan-body">${body}</div>`;
    state.justDone = null;
    drawLines();
  }

  function renderPath() {
    state.popStep = null;
    main.querySelector(".path-wrap").innerHTML = pathHtml(set());
    drawLines();
  }

  function closeFilter({ returnFocus = false } = {}) {
    state.filterOpen = false;
    const btn = main.querySelector("[data-filter]");
    btn.setAttribute("aria-expanded", "false");
    main.querySelector("#status-filter").hidden = true;
    if (returnFocus) btn.focus();
  }

  main.addEventListener("menuselect", (event) => {
    const { name, value } = event.detail;
    setPlanOptions(initialSet.id, name === "mode" ? { mode: value } : { sort: value });
    render();
    main.querySelector(`[data-menu-select="${name}"] .menu-select-btn`).focus();
  });

  main.addEventListener("click", (event) => {
    const t = event.target;

    const node = t.closest("[data-step]");
    if (node) {
      const index = Number(node.dataset.step);
      if (state.popStep === index) closePopover(); else openPopover(index);
      return;
    }
    const start = t.closest("[data-start]");
    if (start) return startLesson(Number(start.dataset.start));
    if (state.popStep !== null && !t.closest(".node-pop")) closePopover();

    if (t.closest("[data-filter]")) {
      state.filterOpen = !state.filterOpen;
      if (!state.filterOpen) return closeFilter();
      t.closest("[data-filter]").setAttribute("aria-expanded", "true");
      main.querySelector("#status-filter").hidden = false;
      main.querySelector("#status-filter input").focus();
      return;
    }
    if (t.closest("[data-plan-settings]")) return openPlanSettings(set());
    if (t.closest("[data-how]")) return openHowItWorks();
    if (t.closest("[data-dismiss-how]")) {
      dismissHint("planHowItWorks");
      main.querySelector(".how-it-works").remove();
      return;
    }
    // Click outside the filter popover closes it.
    if (state.filterOpen && !t.closest(".filter-wrap")) closeFilter();
  });

  main.addEventListener("change", (event) => {
    const box = event.target.closest("[data-status]");
    if (!box) return;
    if (box.checked) state.statuses.add(box.dataset.status);
    else state.statuses.delete(box.dataset.status);
    main.querySelector("[data-filter]").classList.toggle("is-active", state.statuses.size < 3);
    renderPath();
  });

  main.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (state.popStep !== null) closePopover({ returnFocus: true });
    else if (state.filterOpen) closeFilter({ returnFocus: true });
  });

  // Keys 1–4 / A–D pick an answer during a quiz question.
  document.addEventListener("keydown", (event) => {
    if (!lesson || lesson.finished || lesson.answer !== null || event.ctrlKey || event.metaKey || event.altKey) return;
    const stage = lesson.stages[lesson.at];
    if (!stage || stage.type !== "question") return;
    const key = event.key.toLowerCase();
    const i = "1234".includes(key) && key.length === 1 ? Number(key) - 1 : "abcd".indexOf(key);
    const option = i >= 0 && lesson.dialog.querySelector(`[data-option="${i}"]`);
    if (option) option.click();
  });

  render();
})();
