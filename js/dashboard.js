/*
 * Home page (app/dashboard.html). Load after data.js and app.js.
 * Main column: a bento grid of tiles (see dashboard.css for the layout):
 * goals, greeting, streak, next exam, study sets, weak spots, upgrade (free
 * users), recent materials, recent activities. Right column: Upcoming.
 */
(function () {
  "use strict";

  const main = document.querySelector("main");

  const state = {
    materialsSet: "",     // "" = all study sets
    activityType: "",     // "" = all activities
    upcomingTab: "today", // "today" | "exams"
  };

  const ACTIVITY_TYPES = [
    { value: "", label: "All activities" },
    { value: "quiz", label: "Quizzes", icon: "quiz" },
    { value: "flashcards", label: "Flashcards", icon: "cards" },
    { value: "notes", label: "Notes", icon: "notes" },
    { value: "test", label: "Practice tests", icon: "test" },
    { value: "upload", label: "Uploads", icon: "upload" },
    { value: "record", label: "Recordings", icon: "mic" },
  ];
  const ACTIVITY_ICON = Object.fromEntries(ACTIVITY_TYPES.filter((t) => t.value).map((t) => [t.value, t.icon]));
  const MATERIAL_CARDS = 5;
  const ACTIVITY_ROWS = 6;

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------

  function todaysTasks(sets) {
    const today = todayISO();
    return sets.flatMap((set) => set.studyPlan.filter((t) => t.date === today).map((task) => ({ ...task, set })));
  }

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }

  const byRecent = (a, b) => (b.lastOpened || "").localeCompare(a.lastOpened || "");

  // ---------------------------------------------------------------------------
  // Main column
  // ---------------------------------------------------------------------------

  function helloTileHtml(sets, user) {
    const last = [...sets].sort(byRecent)[0];
    const current = last && getCurrentTopic(last);
    const setLink = `<a class="text-link" href="set.html?set=${encodeURIComponent(last.id)}">${escapeHtml(last.name)}</a>`;
    const continueHref = current
      ? `set.html?set=${encodeURIComponent(last.id)}&topic=${encodeURIComponent(current.topic.id)}`
      : `set.html?set=${encodeURIComponent(last.id)}`;
    return `
      <section class="card tile tile-hello" aria-labelledby="dash-hello">
        ${mascotHtml(64)}
        <div class="tile-hello-text">
          <h1 id="dash-hello">${greeting()}, ${escapeHtml(user.name)}</h1>
          <p class="muted">Your last topic was from ${setLink}${current ? ` (${escapeHtml(current.topic.name)})` : ""}.</p>
          <a class="btn btn-primary btn-sm" href="${continueHref}">Continue learning${icon("chevronRight")}</a>
        </div>
      </section>`;
  }

  function streakTileHtml() {
    const { current, longest } = getStreaks();
    return `
      <section class="card tile tile-stat tile-streak" aria-labelledby="streak-label">
        <span class="tile-stat-icon">${icon("fire")}</span>
        <p class="tile-big">${current}</p>
        <p class="tile-stat-label" id="streak-label">day streak</p>
        <p class="tile-stat-sub muted">Longest: ${longest} days</p>
      </section>`;
  }

  function examTileHtml(sets) {
    const next = sets
      .filter((s) => s.examDate && daysUntil(s.examDate) >= 0)
      .sort((a, b) => a.examDate.localeCompare(b.examDate))[0];
    if (!next) {
      return `
        <section class="card tile tile-stat tile-exam" aria-labelledby="exam-label">
          <span class="tile-stat-icon">${icon("calendar")}</span>
          <p class="tile-big">–</p>
          <p class="tile-stat-label" id="exam-label">No exam dates</p>
          <a class="tile-stat-sub text-link" href="sets.html">Add one to a set</a>
        </section>`;
    }
    const days = daysUntil(next.examDate);
    return `
      <a class="card tile tile-stat tile-exam" href="set.html?set=${encodeURIComponent(next.id)}" style="--set-colour: ${next.colour}">
        <span class="tile-stat-icon">${icon("calendar")}</span>
        <p class="tile-big">${days === 0 ? "Today" : days}</p>
        <p class="tile-stat-label" id="exam-label">${days === 0 ? "" : days === 1 ? "day to " : "days to "}${next.emoji} ${escapeHtml(next.name)}</p>
        <p class="tile-stat-sub muted">${formatDate(next.examDate)}</p>
      </a>`;
  }

  // The three weakest topics across all sets.
  function weakTileHtml(sets, wide) {
    const topics = sets
      .flatMap((set) => set.topics.map((topic) => ({ set, topic })))
      .sort((a, b) => a.topic.mastery - b.topic.mastery)
      .slice(0, 3);
    return `
      <section class="card tile tile-weak${wide ? " is-wide" : ""}" aria-labelledby="weak-heading">
        <h2 class="tile-title" id="weak-heading">Weak spots</h2>
        ${topics.length ? `
          <ul class="weak-list">
            ${topics.map(({ set, topic }) => `
              <li><a class="weak-item" href="quiz.html?set=${encodeURIComponent(set.id)}&topic=${encodeURIComponent(topic.id)}" title="Quiz: ${escapeHtml(topic.name)}">
                <span class="weak-name"><span aria-hidden="true">${set.emoji}</span> ${escapeHtml(topic.name)}</span>
                <span class="weak-pct">${topic.mastery}%</span>
              </a></li>`).join("")}
          </ul>` : '<p class="muted">Take a quiz to find your weak spots.</p>'}
      </section>`;
  }

  function upgradeTileHtml() {
    return `
      <section class="card tile tile-upgrade gradient-border" aria-labelledby="upgrade-heading">
        <span class="tile-stat-icon">${icon("sparkle")}</span>
        <h2 class="tile-title" id="upgrade-heading">Study smarter with Pro</h2>
        <p class="muted">Tutor, practice tests, visual memory and unlimited sets.</p>
        <button type="button" class="btn btn-primary btn-sm btn-block" data-action="upgrade">Upgrade now</button>
      </section>`;
  }

  function goalsInnerHtml(sets) {
    const tasks = todaysTasks(sets);
    const done = tasks.filter((t) => t.done).length;
    const allDone = tasks.length > 0 && done === tasks.length;
    const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

    if (tasks.length === 0) {
      return `
        <div class="section-head"><h2 class="tile-title" id="goals-title">Today's goals</h2></div>
        <p class="muted">Nothing planned for today. <a class="text-link" href="sets.html">Pick a set to study</a></p>`;
    }

    const rows = tasks.map((task) => `
      <li class="goal${task.done ? " is-done" : ""}">
        <input type="checkbox" class="checkbox" ${task.done ? "checked" : ""}
          data-set="${task.set.id}" data-task="${task.id}"
          aria-label="Mark “${escapeHtml(task.title)}” done">
        <a class="goal-link" href="${toolUrl(task.tool, task.set.id, task.topicId ? { topic: task.topicId } : {})}">
          <span class="goal-set">${task.set.emoji} ${escapeHtml(task.set.name)}</span>
          <span class="goal-title">${escapeHtml(task.title)}</span>
        </a>
      </li>`).join("");

    return `
      <div class="section-head">
        <h2 class="tile-title" id="goals-title">${allDone ? "All done for today" : "Today's goals"}</h2>
        <span class="muted" aria-live="polite">${done} of ${tasks.length} done</span>
      </div>
      <div class="progress" role="progressbar" aria-labelledby="goals-title"
        aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
        <div class="progress-fill" style="width: ${pct}%"></div>
      </div>
      <ul class="goal-list">${rows}</ul>`;
  }

  // A mock page preview: a coloured header strip and grey text lines.
  function thumbHtml(set, file) {
    const lines = Array.from({ length: 7 }, (_, i) => `<span style="width: ${[92, 78, 85, 60, 88, 70, 45][i]}%"></span>`).join("");
    return `
      <span class="thumb" style="--set-colour: ${set.colour}" aria-hidden="true">
        <span class="thumb-page">
          <span class="thumb-strip"></span>
          ${file.type === "image" ? '<span class="thumb-image"></span>' : ""}
          <span class="thumb-lines">${lines}</span>
        </span>
      </span>`;
  }

  function materialsInnerHtml(sets) {
    const items = allMaterials(state.materialsSet || undefined).slice(0, MATERIAL_CARDS);
    const cards = items.map(({ file, set }) => `
      <li class="material-card">
        ${thumbHtml(set, file)}
        <span class="material-card-foot">
          ${fileBadgeHtml(file.type)}
          <span class="material-card-text">
            <span class="material-card-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
            <span class="muted">${escapeHtml(set.name)}</span>
          </span>
        </span>
      </li>`).join("");
    return `
      <ul class="materials-row">
        ${cards || '<li class="muted materials-none">No materials in this set yet.</li>'}
        <li>
          <button type="button" class="material-card view-all-card" data-view-all-materials>
            <span class="view-all-icon">${icon("chevronRight")}</span>
            View all materials
          </button>
        </li>
      </ul>`;
  }

  function materialsHtml(sets) {
    const filter = menuSelectHtml({
      name: "materials-set",
      label: "Show materials from",
      value: state.materialsSet,
      options: [{ value: "", label: "All study sets" }, ...sets.map((s) => ({ value: s.id, label: s.name }))],
    });
    return `
      <section class="card tile tile-materials dash-materials" aria-labelledby="materials-heading">
        <div class="section-head">
          <h2 class="tile-title" id="materials-heading">Recent Materials</h2>
          ${filter}
        </div>
        <div class="materials-body">${materialsInnerHtml(sets)}</div>
      </section>`;
  }

  function setsHtml(sets) {
    const cards = [...sets].sort(byRecent).map((set) => {
      const pct = getSetProgress(set);
      return `
        <li>
          <a class="dash-set" href="set.html?set=${encodeURIComponent(set.id)}" style="--set-colour: ${set.colour}">
            <span class="dash-set-top">
              <span class="set-tile" aria-hidden="true">${set.emoji}</span>
              <span class="dash-set-text">
                <span class="dash-set-name">${escapeHtml(set.name)}</span>
                <span class="muted">${relativeTime(set.lastOpened)}</span>
              </span>
            </span>
            <span class="dash-set-progress">
              <span class="progress progress-thin" aria-hidden="true"><span class="progress-fill" style="width: ${pct}%"></span></span>
              <span class="dash-set-pct">${pct}%</span>
            </span>
          </a>
        </li>`;
    }).join("");
    return `
      <section class="card tile tile-sets" aria-labelledby="sets-heading">
        <div class="section-head">
          <h2 class="tile-title" id="sets-heading">Your Study Sets</h2>
          <span class="section-links">
            <a class="text-link" href="sets.html">View all</a>
            <button type="button" class="link-btn" data-action="create-set">Create new</button>
          </span>
        </div>
        <ul class="dash-set-row">${cards}</ul>
      </section>`;
  }

  function activitiesInnerHtml(sets) {
    const items = getActivities().filter((a) => !state.activityType || a.type === state.activityType).slice(0, ACTIVITY_ROWS);
    if (!items.length) return '<p class="muted">No activities of this kind yet.</p>';
    return `
      <ul class="activity-list">
        ${items.map((a) => {
          const set = sets.find((s) => s.id === a.setId);
          return `
            <li class="activity">
              <span class="activity-icon">${icon(ACTIVITY_ICON[a.type] || "sparkle")}</span>
              <span class="activity-text">
                <span>${escapeHtml(a.text)}</span>
                ${set ? `<span class="muted">${set.emoji} ${escapeHtml(set.name)}</span>` : ""}
              </span>
              <span class="activity-time muted">${relativeTime(a.at)}</span>
            </li>`;
        }).join("")}
      </ul>`;
  }

  function activitiesHtml(sets) {
    const filter = menuSelectHtml({ name: "activity-type", label: "Filter activities", value: state.activityType, options: ACTIVITY_TYPES });
    return `
      <section class="card tile tile-activities dash-activities" aria-labelledby="activities-heading">
        <div class="section-head">
          <h2 class="tile-title" id="activities-heading">Recent Activities</h2>
          ${filter}
        </div>
        <div class="activities-body">${activitiesInnerHtml(sets)}</div>
      </section>`;
  }

  // ---------------------------------------------------------------------------
  // Right column
  // ---------------------------------------------------------------------------

  function upcomingInnerHtml(sets) {
    const today = todayISO();
    const sessions = sets
      .map((set) => ({ set, tasks: set.studyPlan.filter((t) => t.date === today) }))
      .filter((x) => x.tasks.length);
    const exams = sets.filter((s) => s.examDate && daysUntil(s.examDate) >= 0).sort((a, b) => a.examDate.localeCompare(b.examDate));

    const tab = (id, label, count) => `
      <button type="button" role="tab" id="up-tab-${id}" aria-controls="up-panel" aria-selected="${state.upcomingTab === id}"
        tabindex="${state.upcomingTab === id ? 0 : -1}" data-up-tab="${id}">${label} (${count})</button>`;

    let panel;
    if (state.upcomingTab === "today") {
      panel = sessions.length ? `
        <ul class="upcoming-list">
          ${sessions.map(({ set, tasks }) => {
            const done = tasks.filter((t) => t.done).length;
            return `
              <li><a class="upcoming-item" href="plan.html?set=${encodeURIComponent(set.id)}" style="--set-colour: ${set.colour}">
                <span class="upcoming-bar" aria-hidden="true"></span>
                <span class="upcoming-text"><span>${set.emoji} ${escapeHtml(set.name)} study session</span>
                <span class="muted">${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} · ${done} done</span></span>
              </a></li>`;
          }).join("")}
        </ul>` : `
        <div class="upcoming-empty">
          <p class="upcoming-empty-title">Nothing on today</p>
          <p class="muted">Your calendar is clear. Want to add a study session?</p>
          <a class="text-link" href="calendar.html">Add study session</a>
        </div>`;
    } else {
      panel = exams.length ? `
        <ul class="upcoming-list">
          ${exams.map((s) => `
            <li><a class="upcoming-item" href="set.html?set=${encodeURIComponent(s.id)}" style="--set-colour: ${s.colour}">
              <span class="upcoming-bar" aria-hidden="true"></span>
              <span class="upcoming-text"><span>${s.emoji} ${escapeHtml(s.name)} exam</span>
              <span class="muted">${formatDate(s.examDate)} · ${formatCountdown(s.examDate)}</span></span>
            </a></li>`).join("")}
        </ul>` : `
        <div class="upcoming-empty">
          <p class="upcoming-empty-title">No exams coming up</p>
          <p class="muted">Add an exam date to a study set and it will show here.</p>
        </div>`;
    }

    return `
      <div class="upcoming-head">
        <h2 id="upcoming-heading">Upcoming</h2>
        <span class="muted">${formatDate(today)}</span>
      </div>
      <div class="upcoming-tabs" role="tablist" aria-label="Upcoming">
        ${tab("today", "Today", sessions.length)}
        ${tab("exams", "Exams", exams.length)}
      </div>
      <div id="up-panel" role="tabpanel" aria-labelledby="up-tab-${state.upcomingTab}">${panel}</div>`;
  }

  // ---------------------------------------------------------------------------
  // Empty dashboard (no sets)
  // ---------------------------------------------------------------------------

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
      const dy = Math.sin(angle) * distance - 60;
      const spin = (Math.random() - 0.5) * 720;
      piece.animate([
        { transform: "translate(-50%, -50%) rotate(0deg)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx * 1.2}px, ${dy + 140}px) rotate(${spin}deg)`, opacity: 0 },
      ], { duration: 1000 + Math.random() * 600, easing: "cubic-bezier(0.2, 0.6, 0.4, 1)" }).onfinish = () => piece.remove();
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
      main.innerHTML = orbsHtml("diagonal") + welcomeHtml();
      return;
    }

    main.classList.remove("is-empty");
    const free = user.plan === "free";
    main.innerHTML = `
      ${orbsHtml("diagonal")}
      <div class="dash-main">
        <div class="bento${free ? "" : " is-paid"}">
          <section class="card tile tile-goals dash-goals" aria-labelledby="goals-title">${goalsInnerHtml(sets)}</section>
          ${helloTileHtml(sets, user)}
          ${streakTileHtml()}
          ${examTileHtml(sets)}
          ${setsHtml(sets)}
          ${weakTileHtml(sets, !free)}
          ${free ? upgradeTileHtml() : ""}
          ${materialsHtml(sets)}
          ${activitiesHtml(sets)}
        </div>
      </div>
      <aside class="dash-side" aria-label="Upcoming">
        <section class="card dash-upcoming" aria-labelledby="upcoming-heading">${upcomingInnerHtml(sets)}</section>
      </aside>`;
  }

  main.addEventListener("change", (event) => {
    const box = event.target.closest(".goal .checkbox");
    if (!box) return;
    setTaskDone(box.dataset.set, box.dataset.task, box.checked);
    const rect = box.getBoundingClientRect();
    const allDone = todaysTasks(getSets()).every((t) => t.done);
    const section = main.querySelector(".dash-goals");
    section.innerHTML = goalsInnerHtml(getSets());
    const same = section.querySelector(`[data-task="${box.dataset.task}"]`);
    if (same) same.focus();
    // Upcoming shows today's done counts too.
    main.querySelector(".dash-upcoming").innerHTML = upcomingInnerHtml(getSets());
    if (box.checked && allDone) confetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
  });

  main.addEventListener("menuselect", (event) => {
    const { name, value } = event.detail;
    if (name === "materials-set") {
      state.materialsSet = value;
      main.querySelector(".dash-materials").outerHTML = materialsHtml(getSets());
      main.querySelector(".dash-materials .menu-select-btn").focus();
    } else if (name === "activity-type") {
      state.activityType = value;
      main.querySelector(".dash-activities").outerHTML = activitiesHtml(getSets());
      main.querySelector(".dash-activities .menu-select-btn").focus();
    }
  });

  main.addEventListener("click", (event) => {
    if (event.target.closest("[data-view-all-materials]")) {
      openMaterials(state.materialsSet || undefined);
      return;
    }
    const tab = event.target.closest("[data-up-tab]");
    if (tab) {
      state.upcomingTab = tab.dataset.upTab;
      main.querySelector(".dash-upcoming").innerHTML = upcomingInnerHtml(getSets());
      main.querySelector(`[data-up-tab="${state.upcomingTab}"]`).focus();
    }
  });

  main.addEventListener("keydown", (event) => {
    const tab = event.target.closest("[data-up-tab]");
    if (!tab || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    state.upcomingTab = state.upcomingTab === "today" ? "exams" : "today";
    main.querySelector(".dash-upcoming").innerHTML = upcomingInnerHtml(getSets());
    main.querySelector(`[data-up-tab="${state.upcomingTab}"]`).focus();
  });

  render();
})();
