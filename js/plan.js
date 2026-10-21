/*
 * Study plan (app/plan.html?set=<id>). Load after data.js and app.js.
 * A topic timeline grouped by unit. Mode (Cram / Standard / Comprehensive)
 * decides how many topics are in the plan; Sort orders them; Filter hides
 * topics by status. Clicking a topic opens the set home with it selected.
 */
(function () {
  "use strict";

  const main = document.querySelector("main");
  const { set: initialSet } = setFromUrl();
  const set = () => getSet(initialSet.id);

  const STATUS_LABELS = { "not-started": "Not started", "in-progress": "In progress", done: "Covered" };

  const state = {
    statuses: new Set(Object.keys(STATUS_LABELS)), // shown statuses
    collapsed: new Set(),                          // collapsed unit ids
    filterOpen: false,
  };

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
            <button type="button" class="icon-btn${filtered ? " is-active" : ""}" data-filter aria-label="Filter topics by status"
              aria-expanded="${state.filterOpen}" aria-controls="status-filter">${icon("filter")}</button>
            <div class="filter-pop glass" id="status-filter"${state.filterOpen ? "" : " hidden"}>
              <p class="field-label">Show topics</p>
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

  function statusCircle(status) {
    const label = STATUS_LABELS[status];
    return `<span class="status-circle is-${status}" role="img" aria-label="${label}">${status === "done" ? icon("check") : ""}</span>`;
  }

  function unitHtml(s, group) {
    const { unit, topics } = group;
    const shown = topics.filter((t) => state.statuses.has(topicStatus(t)));
    if (!shown.length) return "";
    const covered = topics.filter((t) => topicStatus(t) === "done").length;
    const open = !state.collapsed.has(unit.id);

    return `
      <li class="tl-item tl-unit">
        <span class="tl-node" aria-hidden="true"></span>
        <div class="unit">
          <button type="button" class="unit-head" data-unit="${unit.id}" aria-expanded="${open}" aria-controls="unit-${unit.id}">
            <span class="unit-name">${escapeHtml(unit.name)}</span>
            <span class="unit-count muted">${covered}/${topics.length} covered</span>
            <span class="unit-chevron">${icon("chevronDown")}</span>
          </button>
          <div class="unit-body" id="unit-${unit.id}"${open ? "" : " hidden"}>
            <div class="knowledge-check">
              <span class="kc-icon">${icon("quiz")}</span>
              <span class="kc-text"><strong>Knowledge check</strong><span class="muted">3 min</span></span>
              <a class="btn btn-primary btn-sm" href="quiz.html?set=${encodeURIComponent(s.id)}&unit=${encodeURIComponent(unit.id)}">Continue</a>
            </div>
            <ul class="topic-rows">
              ${shown.map((t) => `
                <li>
                  <a class="topic-row" href="set.html?set=${encodeURIComponent(s.id)}&topic=${encodeURIComponent(t.id)}">
                    ${statusCircle(topicStatus(t))}
                    <span class="topic-row-name">${escapeHtml(t.name)}</span>
                    <span class="topic-row-pct muted">${t.mastery}%</span>
                    ${icon("chevronRight")}
                  </a>
                </li>`).join("")}
            </ul>
          </div>
        </div>
      </li>`;
  }

  function timelineHtml(s) {
    const groups = getPlanGroups(s);
    const inPlan = groups.reduce((n, g) => n + g.topics.length, 0);
    const units = groups.map((g) => unitHtml(s, g)).join("");
    const mode = PLAN_MODES[s.planMode];

    return `
      <p class="plan-summary muted" aria-live="polite">
        ${inPlan} of ${s.topics.length} topics in your plan · ${mode.label} mode
      </p>
      <ol class="timeline">
        <li class="tl-item tl-start">
          <span class="tl-node is-start" aria-hidden="true">${icon("send")}</span>
          <div class="tl-start-text"><strong>Start</strong><span class="muted">${s.examDate ? examLabel(s.examDate) : "Work through the units in order"}</span></div>
        </li>
        ${units || '<li class="tl-item"><span class="tl-node" aria-hidden="true"></span><p class="muted tl-none">No topics match this filter.</p></li>'}
        ${s.examDate && daysUntil(s.examDate) >= 0 ? `
          <li class="tl-item tl-end">
            <span class="tl-node is-end" aria-hidden="true">${icon("test")}</span>
            <div class="tl-start-text"><strong>Exam day</strong><span class="muted">${formatDate(s.examDate)}</span></div>
          </li>` : ""}
      </ol>`;
  }

  // ---------------------------------------------------------------------------
  // Sheets
  // ---------------------------------------------------------------------------

  function openHowItWorks() {
    openModal({
      title: "How your study plan works",
      body: `
        <ul class="how-list">
          <li><strong>Mode</strong> sets how much to cover. Cram keeps only the highest-priority topics; Comprehensive covers everything.</li>
          <li><strong>Sort</strong> orders topics inside each unit. Recommended puts what you've started first, then your weakest topics.</li>
          <li><strong>Knowledge checks</strong> are short quizzes on a whole unit. Take one to see what you already know.</li>
          <li>Each topic's circle fills as you go: empty when not started, half when in progress, a tick when covered (75% mastery).</li>
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
    document.title = `Study plan · ${s.name} · SkipXam`;
    const body = s.topics.length
      ? `${customizeHtml(s)}<div class="timeline-wrap">${timelineHtml(s)}</div>`
      : emptyStateHtml({
          title: "No study plan yet",
          text: "Your plan is built from the topics in your notes. Upload notes to this set first.",
          action: { label: "Upload notes", href: `set.html?set=${encodeURIComponent(s.id)}&upload=1` },
        });
    main.innerHTML = `${headerHtml(s)}<div class="plan-body">${body}</div>`;
  }

  function renderTimeline() {
    main.querySelector(".timeline-wrap").innerHTML = timelineHtml(set());
  }

  main.addEventListener("menuselect", (event) => {
    const { name, value } = event.detail;
    setPlanOptions(initialSet.id, name === "mode" ? { mode: value } : { sort: value });
    render();
    main.querySelector(`[data-menu-select="${name}"] .menu-select-btn`).focus();
  });

  main.addEventListener("click", (event) => {
    const t = event.target;
    const unitBtn = t.closest("[data-unit]");
    if (unitBtn) {
      const id = unitBtn.dataset.unit;
      if (state.collapsed.has(id)) state.collapsed.delete(id); else state.collapsed.add(id);
      const open = !state.collapsed.has(id);
      unitBtn.setAttribute("aria-expanded", String(open));
      document.getElementById(`unit-${id}`).hidden = !open;
      return;
    }
    if (t.closest("[data-filter]")) {
      state.filterOpen = !state.filterOpen;
      const btn = t.closest("[data-filter]");
      btn.setAttribute("aria-expanded", String(state.filterOpen));
      main.querySelector("#status-filter").hidden = !state.filterOpen;
      if (state.filterOpen) main.querySelector("#status-filter input").focus();
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
    if (state.filterOpen && !t.closest(".filter-wrap")) {
      state.filterOpen = false;
      main.querySelector("[data-filter]").setAttribute("aria-expanded", "false");
      main.querySelector("#status-filter").hidden = true;
    }
  });

  main.addEventListener("change", (event) => {
    const box = event.target.closest("[data-status]");
    if (!box) return;
    if (box.checked) state.statuses.add(box.dataset.status);
    else state.statuses.delete(box.dataset.status);
    main.querySelector("[data-filter]").classList.toggle("is-active", state.statuses.size < 3);
    renderTimeline();
  });

  main.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.filterOpen) {
      state.filterOpen = false;
      main.querySelector("#status-filter").hidden = true;
      const btn = main.querySelector("[data-filter]");
      btn.setAttribute("aria-expanded", "false");
      btn.focus();
    }
  });

  render();
})();
