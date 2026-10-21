/*
 * Study plan (app/plan.html?set=<id>). Load after data.js and app.js.
 * Day-by-day tasks from today to the exam, with checkboxes that save.
 * No exam date → ask for one. Exam date changed → offer "Rebuild plan".
 */
(function () {
  "use strict";

  const main = document.querySelector("main");
  const { set: initialSet } = setFromUrl();
  const set = () => getSet(initialSet.id);
  let editingDate = false;

  // ---------------------------------------------------------------------------
  // Pieces
  // ---------------------------------------------------------------------------

  function taskHtml(task) {
    const params = task.topicId ? { topic: task.topicId } : {};
    return `
      <li class="plan-task${task.done ? " is-done" : ""}">
        <input type="checkbox" class="checkbox" data-task="${task.id}"${task.done ? " checked" : ""}
          aria-label="Mark “${escapeHtml(task.title)}” done">
        <a class="plan-task-link" href="${toolUrl(task.tool, initialSet.id, params)}">
          <span class="plan-task-tool">${icon(TOOLS[task.tool] ? TOOLS[task.tool].icon : "plan")}</span>
          <span>${escapeHtml(task.title)}</span>
        </a>
      </li>`;
  }

  function askForDateHtml(s, passed) {
    return `
      <section class="card plan-ask" aria-labelledby="ask-title">
        <span class="tool-icon">${icon("calendar")}</span>
        <h2 id="ask-title">${passed ? "Your exam date has passed" : "When is your exam?"}</h2>
        <p class="muted">${passed
          ? "Set your next exam date and we'll plan your study days again."
          : `Add the date and we'll plan every day from today until your ${escapeHtml(s.name)} exam.`}</p>
        <form class="plan-ask-form" data-date-form>
          <label class="visually-hidden" for="ask-date">Exam date</label>
          <input class="input" type="date" id="ask-date" name="examDate" min="${addDays(todayISO(), 1)}" required>
          <button type="submit" class="btn btn-primary">Build my plan</button>
        </form>
      </section>`;
  }

  function progressHtml(s) {
    const today = todayISO();
    const planned = s.studyPlan.filter((t) => t.date <= s.examDate);
    const done = planned.filter((t) => t.done).length;
    const start = planned.length ? planned[0].date : today;
    const span = Math.max(1, Math.round((parseDate(s.examDate) - parseDate(start)) / 86400000));
    const todayPos = Math.min(100, Math.max(0, Math.round(((parseDate(today) - parseDate(start)) / 86400000 / span) * 100)));
    const taskPct = planned.length ? Math.round((done / planned.length) * 100) : 0;
    const days = daysUntil(s.examDate);

    return `
      <section class="card plan-overview" aria-label="Progress toward the exam">
        <div class="plan-overview-head">
          <div>
            <p class="plan-exam">${examLabel(s.examDate)}</p>
            <p class="muted">${formatDate(s.examDate)}${days > 0 ? ` · ${days} ${days === 1 ? "day" : "days"} to go` : ""}</p>
          </div>
          ${editingDate ? `
            <form class="plan-date-form" data-date-form>
              <label class="visually-hidden" for="change-date">New exam date</label>
              <input class="input" type="date" id="change-date" name="examDate" value="${s.examDate}" min="${addDays(today, 1)}" required>
              <button type="submit" class="btn btn-primary btn-sm">Save</button>
              <button type="button" class="btn btn-ghost btn-sm" data-cancel-date>Cancel</button>
            </form>` : '<button type="button" class="btn btn-secondary btn-sm" data-edit-date>Change exam date</button>'}
        </div>

        <div class="journey" aria-hidden="true">
          <div class="journey-track"><div class="journey-fill" style="width: ${todayPos}%"></div></div>
          <span class="journey-marker" style="left: ${todayPos}%"><span>Today</span></span>
          <span class="journey-end">${icon("test")}</span>
        </div>
        <div class="journey-labels muted">
          <span>${formatDate(start)}</span>
          <span>Exam</span>
        </div>

        <p class="plan-done-line"><strong>${done} of ${planned.length}</strong> tasks done (${taskPct}%)</p>
      </section>`;
  }

  function rebuildBannerHtml() {
    return `
      <div class="plan-banner" role="status">
        <span>${icon("calendar")}Your exam date changed. Rebuild the plan to fit the new date.</span>
        <button type="button" class="btn btn-primary btn-sm" data-rebuild>Rebuild plan</button>
      </div>`;
  }

  function daysHtml(s) {
    const today = todayISO();
    const total = daysUntil(s.examDate);
    const overdue = s.studyPlan.filter((t) => t.date < today && !t.done);

    const catchUp = overdue.length ? `
      <section class="card plan-day is-overdue" aria-labelledby="catchup-title">
        <h2 class="plan-day-title" id="catchup-title">Catch up <span class="muted">${overdue.length} from earlier</span></h2>
        <ul class="plan-tasks">${overdue.map(taskHtml).join("")}</ul>
      </section>` : "";

    const days = [];
    for (let i = 0; i <= total; i++) {
      const iso = addDays(today, i);
      const tasks = s.studyPlan.filter((t) => t.date === iso);
      const isExam = iso === s.examDate;
      const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : parseDate(iso).toLocaleDateString("en-IN", { weekday: "long" });
      const doneCount = tasks.filter((t) => t.done).length;

      let body;
      if (isExam) body = `<p class="plan-exam-day">${icon("test")}Exam day. You've got this.</p>`;
      else if (tasks.length) body = `<ul class="plan-tasks">${tasks.map(taskHtml).join("")}</ul>`;
      else body = '<p class="muted plan-rest">No tasks planned.</p>';

      days.push(`
        <section class="card plan-day${i === 0 ? " is-today" : ""}${isExam ? " is-exam" : ""}" aria-label="${label}, ${formatDate(iso)}">
          <h2 class="plan-day-title">
            ${label} <span class="muted">${formatDate(iso)}</span>
            ${tasks.length && !isExam ? `<span class="plan-day-count${doneCount === tasks.length ? " is-complete" : ""}">${doneCount}/${tasks.length}</span>` : ""}
          </h2>
          ${body}
        </section>`);
    }
    return `${catchUp}${days.join("")}`;
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
    document.title = `Study plan · ${s.name} · SkipXam`;

    let body;
    if (!s.examDate) body = askForDateHtml(s, false);
    else if (daysUntil(s.examDate) < 0) body = askForDateHtml(s, true);
    else {
      body = `
        ${progressHtml(s)}
        ${s.planExamDate !== s.examDate ? rebuildBannerHtml() : ""}
        <div class="plan-days">${daysHtml(s)}</div>`;
    }
    main.innerHTML = `${toolHeaderHtml(s, "Study plan")}<div class="plan-body">${body}</div>`;
  }

  main.addEventListener("change", (event) => {
    const box = event.target.closest("[data-task]");
    if (!box) return;
    setTaskDone(initialSet.id, box.dataset.task, box.checked);
    const scrollY = window.scrollY;
    render();
    window.scrollTo(0, scrollY);
    const same = main.querySelector(`[data-task="${box.dataset.task}"]`);
    if (same) same.focus({ preventScroll: true });
  });

  main.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-date-form]");
    if (!form) return;
    event.preventDefault();
    const value = form.elements.examDate.value;
    if (!value) return;
    const s = set();
    const isFirstPlan = !s.examDate || daysUntil(s.examDate) < 0;
    setExamDate(s.id, value);
    editingDate = false;
    if (isFirstPlan) {
      buildStudyPlan(s.id);
      showToast("Your study plan is ready");
    } else {
      showToast("Exam date updated");
    }
    render();
  });

  main.addEventListener("click", (event) => {
    if (event.target.closest("[data-edit-date]")) {
      editingDate = true;
      render();
      main.querySelector("#change-date").focus();
    } else if (event.target.closest("[data-cancel-date]")) {
      editingDate = false;
      render();
    } else if (event.target.closest("[data-rebuild]")) {
      buildStudyPlan(initialSet.id);
      render();
      showToast("Plan rebuilt for your new exam date");
    }
  });

  render();
})();
