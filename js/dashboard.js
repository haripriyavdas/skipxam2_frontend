/*
 * Home page (app/dashboard.html). Load after data.js and app.js.
 */
(function () {
  "use strict";

  const main = document.querySelector("main");

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------

  function todaysTasks(sets) {
    const today = todayISO();
    return sets.flatMap((set) =>
      set.studyPlan
        .filter((task) => task.date === today)
        .map((task) => ({ ...task, set })));
  }

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }

  // ---------------------------------------------------------------------------
  // Sections
  // ---------------------------------------------------------------------------

  function greetingHtml(user) {
    return `
      <section class="dash-greeting">
        <h1>${greeting()}, ${escapeHtml(user.name)}</h1>
        <span class="streak-pill">${icon("fire")}${user.streak} day streak</span>
      </section>`;
  }

  function goalsInnerHtml(sets) {
    const tasks = todaysTasks(sets);
    const done = tasks.filter((t) => t.done).length;
    const allDone = tasks.length > 0 && done === tasks.length;
    const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

    if (tasks.length === 0) {
      return `
        <div class="section-head"><h2 id="goals-title">Today's goals</h2></div>
        <p class="muted">Nothing planned for today. <a class="text-link" href="sets.html">Pick a set to study</a></p>`;
    }

    const rows = tasks.map((task) => `
      <li class="goal${task.done ? " is-done" : ""}">
        <input type="checkbox" class="checkbox" ${task.done ? "checked" : ""}
          data-set="${task.set.id}" data-task="${task.id}"
          aria-label="Mark “${escapeHtml(task.title)}” done">
        <a class="goal-link" href="${toolUrl(task.tool, task.set.id)}">
          <span class="goal-set">${task.set.emoji} ${escapeHtml(task.set.name)}</span>
          <span class="goal-title">${escapeHtml(task.title)}</span>
        </a>
      </li>`).join("");

    return `
      <div class="section-head">
        <h2 id="goals-title">${allDone ? "All done for today" : "Today's goals"}</h2>
        <span class="muted" aria-live="polite">${done} of ${tasks.length} done</span>
      </div>
      <div class="progress" role="progressbar" aria-labelledby="goals-title"
        aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
        <div class="progress-fill" style="width: ${pct}%"></div>
      </div>
      <ul class="goal-list">${rows}</ul>`;
  }

  function goalsHtml(sets) {
    return `<section class="card dash-goals" aria-labelledby="goals-title">${goalsInnerHtml(sets)}</section>`;
  }

  function continueHtml(sets) {
    const recent = [...sets]
      .sort((a, b) => (b.lastOpened || "").localeCompare(a.lastOpened || ""))
      .slice(0, 3);

    const cards = recent.map((set) => {
      const activity = set.lastActivity;
      const pct = activity ? Math.round((activity.position / activity.total) * 100) : 0;
      return `
        <article class="continue-card" style="--set-colour: ${set.colour}">
          <span class="continue-emoji" aria-hidden="true">${set.emoji}</span>
          <h3>${escapeHtml(set.name)}</h3>
          <p class="muted">${activity
            ? `${toolLabel(activity.tool)}, ${activity.position} of ${activity.total}`
            : "Not started yet"}</p>
          <div class="progress progress-thin" aria-hidden="true">
            <div class="progress-fill" style="width: ${pct}%"></div>
          </div>
          <a class="btn btn-secondary" href="${activity ? toolUrl(activity.tool, set.id) : `set.html?set=${set.id}`}"
            aria-label="${activity ? "Resume" : "Open"} ${escapeHtml(set.name)}">${activity ? "Resume" : "Open"}</a>
        </article>`;
    }).join("");

    return `
      <section class="dash-continue" aria-labelledby="continue-title">
        <div class="section-head"><h2 id="continue-title">Continue learning</h2></div>
        <div class="continue-scroll">${cards}</div>
      </section>`;
  }

  function examsHtml(sets) {
    const upcoming = sets
      .filter((s) => s.examDate && daysUntil(s.examDate) >= 0)
      .sort((a, b) => a.examDate.localeCompare(b.examDate));

    const rows = upcoming.map((set) => {
      const mastery = getSetMastery(set);
      const urgent = daysUntil(set.examDate) <= 3 && mastery < 50;
      return `
        <li class="exam-row${urgent ? " is-urgent" : ""}">
          ${masteryRing(mastery, { urgent })}
          <div class="exam-info">
            <a class="exam-name" href="set.html?set=${set.id}">${set.emoji} ${escapeHtml(set.name)}</a>
            <span class="muted">${formatDate(set.examDate)}${urgent ? " · Low mastery" : ""}</span>
          </div>
          <span class="exam-countdown">${formatCountdown(set.examDate)}</span>
        </li>`;
    }).join("");

    return `
      <section class="card dash-exams" aria-labelledby="exams-title">
        <div class="section-head"><h2 id="exams-title">Upcoming exams</h2></div>
        ${upcoming.length ? `<ul class="exam-list">${rows}</ul>` : '<p class="muted">No exams scheduled.</p>'}
      </section>`;
  }

  function weekHtml(sets, user) {
    const today = todayISO();
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

    const cells = days.map((iso, i) => {
      const date = parseDate(iso);
      const tasks = sets.reduce((n, s) => n + s.studyPlan.filter((t) => t.date === iso).length, 0);
      const exams = sets.filter((s) => s.examDate === iso);
      const longDay = date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
      const summary = [
        tasks ? `${tasks} study ${tasks === 1 ? "task" : "tasks"}` : "",
        ...exams.map((s) => `${s.name} exam`),
      ].filter(Boolean).join(", ") || "nothing planned";

      return `
        <li class="day${i === 0 ? " is-today" : ""}" aria-label="${longDay}: ${escapeHtml(summary)}">
          <span class="day-name">${i === 0 ? "Today" : date.toLocaleDateString("en-IN", { weekday: "short" })}</span>
          <span class="day-num">${date.getDate()}</span>
          <span class="day-dots" aria-hidden="true">
            ${tasks ? '<span class="dot dot-study"></span>' : ""}
            ${exams.length ? '<span class="dot dot-exam"></span>' : ""}
          </span>
        </li>`;
    }).join("");

    const banner = user.calendarConnected ? "" : `
      <div class="calendar-banner">
        ${icon("calendar")}
        <span>Get reminders in Google Calendar</span>
        <a class="btn btn-secondary btn-sm" href="calendar.html">Connect</a>
      </div>`;

    return `
      <section class="card dash-week" aria-labelledby="week-title">
        <div class="section-head">
          <h2 id="week-title">This week</h2>
          <span class="week-legend">
            <span><span class="dot dot-study"></span>Study</span>
            <span><span class="dot dot-exam"></span>Exam</span>
          </span>
        </div>
        <ol class="week">${cells}</ol>
        ${banner}
      </section>`;
  }

  function weakSpotsHtml(sets, user) {
    const weakest = sets
      .flatMap((set) => set.topics.map((topic) => ({ topic, set })))
      .sort((a, b) => a.topic.mastery - b.topic.mastery)
      .slice(0, 3);

    if (weakest.length === 0) return "";

    const chips = weakest.map(({ topic, set }) => `
      <a class="chip" href="${toolUrl("quiz", set.id, { topic: topic.id })}"
        aria-label="Quiz on ${escapeHtml(topic.name)}, ${escapeHtml(set.name)}, ${topic.mastery}% mastery">
        <span class="chip-topic">${escapeHtml(topic.name)}</span>
        <span class="chip-set">${escapeHtml(set.name)}</span>
        <span class="chip-pct">${topic.mastery}%</span>
      </a>`).join("");

    const nudge = user.plan === "free" ? `
      <p class="tutor-nudge">
        Want these explained until they click? <a class="text-link" href="tutor.html">Try the Tutor</a>
        <span class="badge">Pro</span>
      </p>` : "";

    return `
      <section class="card dash-weak" aria-labelledby="weak-title">
        <div class="section-head">
          <h2 id="weak-title">Weak spots</h2>
          <span class="muted">Tap one for a quick quiz</span>
        </div>
        <div class="chips">${chips}</div>
        ${nudge}
      </section>`;
  }

  function welcomeHtml() {
    const steps = [
      { icon: "plus", label: "Create a set" },
      { icon: "upload", label: "Upload your notes" },
      { icon: "sparkle", label: "Start studying" },
    ];
    return `
      <section class="card welcome">
        <h1>Create your first study set</h1>
        <p class="muted">A study set holds the notes for one subject. SkipXam turns them into flashcards, quizzes and a study plan.</p>
        <ol class="steps">
          ${steps.map((s, i) => `
            <li class="step">
              <span class="step-icon">${icon(s.icon)}</span>
              <span class="step-label"><span class="step-num">${i + 1}.</span> ${s.label}</span>
            </li>`).join("")}
        </ol>
        <button type="button" class="btn btn-primary" data-action="create-set">${icon("plus")}Create study set</button>
      </section>`;
  }

  // ---------------------------------------------------------------------------
  // Confetti (no libraries; skipped for reduced motion)
  // ---------------------------------------------------------------------------

  function confetti(x, y) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colours = ["#E08A38", "#F0EAE0", "#5DB075", "#E0673A", "#4FA3D9", "#A78BFA"];

    for (let i = 0; i < 48; i++) {
      const piece = document.createElement("span");
      piece.className = "confetti";
      piece.style.left = `${x}px`;
      piece.style.top = `${y}px`;
      piece.style.background = colours[i % colours.length];
      document.body.appendChild(piece);

      const angle = Math.random() * Math.PI * 2;
      const distance = 60 + Math.random() * 120;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance - 60; // bias upwards
      const spin = (Math.random() - 0.5) * 720;

      piece.animate([
        { transform: "translate(-50%, -50%) rotate(0deg)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx * 1.2}px, ${dy + 140}px) rotate(${spin}deg)`, opacity: 0 },
      ], {
        duration: 1000 + Math.random() * 600,
        easing: "cubic-bezier(0.2, 0.6, 0.4, 1)",
      }).onfinish = () => piece.remove();
    }
  }

  // ---------------------------------------------------------------------------
  // Render + events
  // ---------------------------------------------------------------------------

  function render() {
    const sets = getSets();
    const user = getUser();

    if (sets.length === 0) {
      main.classList.add("is-empty");
      main.innerHTML = welcomeHtml();
      return;
    }

    main.classList.remove("is-empty");
    main.innerHTML = [
      greetingHtml(user),
      goalsHtml(sets),
      continueHtml(sets),
      examsHtml(sets),
      weekHtml(sets, user),
      weakSpotsHtml(sets, user),
    ].join("");
  }

  main.addEventListener("change", (event) => {
    const box = event.target.closest(".goal .checkbox");
    if (!box) return;

    setTaskDone(box.dataset.set, box.dataset.task, box.checked);

    const rect = box.getBoundingClientRect();
    const tasks = todaysTasks(getSets());
    const allDone = tasks.every((t) => t.done);

    // Only re-render the goals card so focus and scroll position elsewhere are kept.
    const section = main.querySelector(".dash-goals");
    section.innerHTML = goalsInnerHtml(getSets());
    const sameBox = section.querySelector(`[data-task="${box.dataset.task}"]`);
    if (sameBox) sameBox.focus();

    if (box.checked && allDone) confetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
  });

  render();
})();
