/*
 * Calendar (app/calendar.html). Load after data.js and app.js.
 * Month and week views of study sessions and exams for every set, colour-coded
 * by set; a mock Google Calendar connection; and reminder settings.
 */
(function () {
  "use strict";

  const main = document.querySelector("main");
  const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // reminder day chips, Monday first (0 = Sunday)

  const state = {
    view: "month",          // "month" | "week"
    cursor: todayISO(),     // any date inside the visible month/week
    selected: todayISO(),
    connecting: false,
  };

  // ---------------------------------------------------------------------------
  // Dates + events
  // ---------------------------------------------------------------------------

  function weekStart(iso) {
    const d = parseDate(iso);
    return addDays(iso, -((d.getDay() + 6) % 7)); // back to Monday
  }

  function monthStart(iso) {
    return `${iso.slice(0, 7)}-01`;
  }

  // { "2026-10-22": { sessions: [{ set, tasks }], exams: [set] } }
  function buildEvents() {
    const events = {};
    const day = (iso) => (events[iso] = events[iso] || { sessions: [], exams: [] });
    for (const set of getSets()) {
      const byDate = {};
      for (const t of set.studyPlan) (byDate[t.date] = byDate[t.date] || []).push(t);
      for (const [iso, tasks] of Object.entries(byDate)) day(iso).sessions.push({ set, tasks });
      if (set.examDate) day(set.examDate).exams.push(set);
    }
    return events;
  }

  // ---------------------------------------------------------------------------
  // Calendar views
  // ---------------------------------------------------------------------------

  function titleText() {
    if (state.view === "month") {
      return parseDate(state.cursor).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    }
    const start = weekStart(state.cursor);
    const end = addDays(start, 6);
    const fmt = (iso, opts) => parseDate(iso).toLocaleDateString("en-IN", opts);
    return `${fmt(start, { day: "numeric", month: "short" })} – ${fmt(end, { day: "numeric", month: "short", year: "numeric" })}`;
  }

  function cellEventsHtml(e) {
    if (!e) return "";
    const exams = e.exams.map((s) => `
      <span class="cal-pill is-exam" style="--set-colour: ${s.colour}">${s.emoji} ${escapeHtml(s.name)} exam</span>`);
    const sessions = e.sessions.map(({ set, tasks }) => `
      <span class="cal-pill" style="--set-colour: ${set.colour}">${set.emoji} ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}</span>`);
    const all = [...exams, ...sessions];
    const shown = all.slice(0, 2).join("");
    const more = all.length > 2 ? `<span class="cal-more">+${all.length - 2} more</span>` : "";
    // Mobile shows coloured dots instead of pills.
    const dots = [
      ...e.exams.map((s) => `<span class="cal-dot is-exam" style="--set-colour: ${s.colour}"></span>`),
      ...e.sessions.map(({ set }) => `<span class="cal-dot" style="--set-colour: ${set.colour}"></span>`),
    ].join("");
    return `<span class="cal-pills">${shown}${more}</span><span class="cal-dots">${dots}</span>`;
  }

  function dayLabel(iso, e) {
    const parts = [parseDate(iso).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })];
    if (e) {
      e.exams.forEach((s) => parts.push(`${s.name} exam`));
      e.sessions.forEach(({ set, tasks }) => parts.push(`${set.name}: ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`));
    }
    return parts.join(", ");
  }

  function monthHtml(events) {
    const first = monthStart(state.cursor);
    const gridStart = weekStart(first);
    const month = first.slice(0, 7);
    const today = todayISO();
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const iso = addDays(gridStart, i);
      if (i >= 35 && iso.slice(0, 7) !== month) break; // drop an all-next-month last row
      const e = events[iso];
      const cls = [
        "cal-cell",
        iso.slice(0, 7) !== month ? "is-outside" : "",
        iso === today ? "is-today" : "",
        iso === state.selected ? "is-selected" : "",
        e && e.exams.length ? "has-exam" : "",
      ].filter(Boolean).join(" ");
      cells.push(`
        <button type="button" class="${cls}" data-day="${iso}" aria-pressed="${iso === state.selected}"
          aria-label="${escapeHtml(dayLabel(iso, e))}">
          <span class="cal-date">${parseDate(iso).getDate()}</span>
          ${cellEventsHtml(e)}
        </button>`);
    }
    return `
      <div class="cal-month">
        ${WEEKDAYS.map((d) => `<span class="cal-weekday" aria-hidden="true">${d}</span>`).join("")}
        ${cells.join("")}
      </div>`;
  }

  function sessionCardHtml(set, tasks) {
    return `
      <li class="cal-event" style="--set-colour: ${set.colour}">
        <a class="cal-event-head" href="plan.html?set=${encodeURIComponent(set.id)}">${set.emoji} ${escapeHtml(set.name)}</a>
        <ul class="cal-event-tasks">
          ${tasks.map((t) => `<li class="${t.done ? "is-done" : ""}">${t.done ? icon("check") : ""}${escapeHtml(t.title)}</li>`).join("")}
        </ul>
      </li>`;
  }

  function examCardHtml(set) {
    return `
      <li class="cal-event is-exam" style="--set-colour: ${set.colour}">
        <a class="cal-event-head" href="set.html?set=${encodeURIComponent(set.id)}">${icon("test")}${set.emoji} ${escapeHtml(set.name)} exam</a>
      </li>`;
  }

  function weekHtml(events) {
    const start = weekStart(state.cursor);
    const today = todayISO();
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((iso, i) => {
      const e = events[iso];
      const items = e ? [...e.exams.map(examCardHtml), ...e.sessions.map((x) => sessionCardHtml(x.set, x.tasks))].join("") : "";
      return `
        <section class="cal-week-day${iso === today ? " is-today" : ""}" aria-label="${escapeHtml(dayLabel(iso, null))}">
          <h3 class="cal-week-head"><span>${WEEKDAYS[i]}</span><span class="cal-week-num">${parseDate(iso).getDate()}</span></h3>
          ${items ? `<ul class="cal-events">${items}</ul>` : '<p class="cal-empty">Free</p>'}
        </section>`;
    }).join("");
    return `<div class="cal-week">${days}</div>`;
  }

  function selectedDayHtml(events) {
    const e = events[state.selected];
    const items = e ? [...e.exams.map(examCardHtml), ...e.sessions.map((x) => sessionCardHtml(x.set, x.tasks))].join("") : "";
    return `
      <section class="card cal-day-detail" aria-live="polite" aria-labelledby="day-title">
        <h2 id="day-title" class="cal-side-title">${parseDate(state.selected).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</h2>
        ${items ? `<ul class="cal-events">${items}</ul>` : '<p class="muted">Nothing planned.</p>'}
      </section>`;
  }

  function legendHtml() {
    return `
      <ul class="cal-legend">
        ${getSets().map((s) => `<li><span class="cal-dot" style="--set-colour: ${s.colour}"></span>${escapeHtml(s.name)}</li>`).join("")}
        <li><span class="cal-dot is-exam legend-exam"></span>Exam day</li>
      </ul>`;
  }

  // ---------------------------------------------------------------------------
  // Google Calendar + reminders
  // ---------------------------------------------------------------------------

  function googleHtml(user) {
    if (user.calendarConnected) {
      return `
        <section class="card cal-google is-connected" aria-labelledby="google-title">
          <h2 id="google-title" class="cal-side-title">${icon("check")}Google Calendar connected</h2>
          <p class="muted">Your study sessions and exam days are added to your Google Calendar.</p>
          <button type="button" class="btn btn-ghost btn-sm" data-disconnect>Disconnect</button>
        </section>`;
    }
    return `
      <section class="card cal-google" aria-labelledby="google-title">
        <h2 id="google-title" class="cal-side-title">${icon("calendar")}Google Calendar</h2>
        <p class="muted">Add study sessions and exam days to your Google Calendar so reminders reach your phone.</p>
        <button type="button" class="btn btn-primary btn-block" data-connect${state.connecting ? " disabled" : ""}>
          ${state.connecting ? '<span class="spinner" aria-hidden="true"></span>Connecting…' : "Connect Google Calendar"}
        </button>
      </section>`;
  }

  function reminderSummary(r) {
    if (!r.enabled) return "Reminders are off.";
    if (r.days.length === 0) return "Pick at least one day.";
    const [h, m] = r.time.split(":").map(Number);
    const time = new Date(2000, 0, 1, h, m).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
    const sorted = [...r.days].sort().join(",");
    const days = sorted === "0,1,2,3,4,5,6" ? "every day"
      : sorted === "1,2,3,4,5" ? "on weekdays"
      : sorted === "0,6" ? "at weekends"
      : `on ${DAY_ORDER.filter((d) => r.days.includes(d)).map((d) => WEEKDAYS[(d + 6) % 7]).join(", ")}`;
    return `We'll remind you at ${time} ${days}.`;
  }

  function remindersHtml(user) {
    const r = user.reminders;
    return `
      <section class="card cal-reminders" aria-labelledby="rem-title">
        <div class="rem-head">
          <h2 id="rem-title" class="cal-side-title">${icon("bell")}Study reminders</h2>
          <button type="button" class="switch" role="switch" aria-checked="${r.enabled}" aria-labelledby="rem-title" data-rem-toggle>
            <span class="switch-thumb"></span>
          </button>
        </div>
        <fieldset class="rem-fields"${r.enabled ? "" : " disabled"}>
          <div class="field">
            <label class="field-label" for="rem-time">Time of day</label>
            <input class="input" type="time" id="rem-time" value="${r.time}">
          </div>
          <div class="field">
            <span class="field-label" id="rem-days-label">Days</span>
            <div class="rem-days" role="group" aria-labelledby="rem-days-label">
              ${DAY_ORDER.map((d) => `
                <button type="button" class="chip rem-day" data-rem-day="${d}" aria-pressed="${r.days.includes(d)}"
                  aria-label="${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d]}">
                  ${WEEKDAYS[(d + 6) % 7].charAt(0)}
                </button>`).join("")}
            </div>
          </div>
        </fieldset>
        <p class="rem-summary muted" aria-live="polite">${reminderSummary(r)}</p>
      </section>`;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  function render() {
    const events = buildEvents();
    const user = getUser();
    main.innerHTML = `
      <header class="tool-header"><div class="tool-header-row"><h1>Calendar</h1></div></header>
      <div class="cal-layout">
        <div class="cal-main">
          <div class="cal-toolbar">
            <div class="cal-nav">
              <button type="button" class="icon-btn" data-nav="-1" aria-label="Previous ${state.view}">${icon("chevronLeft")}</button>
              <h2 class="cal-title" aria-live="polite">${titleText()}</h2>
              <button type="button" class="icon-btn" data-nav="1" aria-label="Next ${state.view}">${icon("chevronRight")}</button>
              <button type="button" class="btn btn-ghost btn-sm" data-today>Today</button>
            </div>
            <div class="segmented" role="radiogroup" aria-label="Calendar view">
              <label><input type="radio" name="cal-view" value="month"${state.view === "month" ? " checked" : ""}><span>Month</span></label>
              <label><input type="radio" name="cal-view" value="week"${state.view === "week" ? " checked" : ""}><span>Week</span></label>
            </div>
          </div>
          ${legendHtml()}
          <div class="card cal-surface">${state.view === "month" ? monthHtml(events) : weekHtml(events)}</div>
          ${state.view === "month" ? selectedDayHtml(events) : ""}
        </div>
        <aside class="cal-side">
          ${googleHtml(user)}
          ${remindersHtml(user)}
        </aside>
      </div>`;
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  function saveAndSummarise(changes) {
    const r = saveReminders(changes);
    main.querySelector(".rem-summary").textContent = reminderSummary(r);
  }

  main.addEventListener("click", async (event) => {
    const t = event.target;
    const dayBtn = t.closest("[data-day]");
    if (dayBtn) {
      state.selected = dayBtn.dataset.day;
      if (state.selected.slice(0, 7) !== state.cursor.slice(0, 7)) state.cursor = state.selected;
      render();
      main.querySelector(`[data-day="${state.selected}"]`).focus();
      return;
    }
    const nav = t.closest("[data-nav]");
    if (nav) {
      const dir = Number(nav.dataset.nav);
      if (state.view === "week") state.cursor = addDays(state.cursor, dir * 7);
      else {
        const d = parseDate(monthStart(state.cursor));
        d.setMonth(d.getMonth() + dir);
        state.cursor = toISODate(d);
      }
      render();
      main.querySelector(`[data-nav="${dir}"]`).focus();
      return;
    }
    if (t.closest("[data-today]")) {
      state.cursor = state.selected = todayISO();
      render();
    } else if (t.closest("[data-connect]")) {
      state.connecting = true;
      render();
      await new Promise((r) => setTimeout(r, 1200)); // mock OAuth round trip
      state.connecting = false;
      setCalendarConnected(true);
      render();
      showToast("Google Calendar connected");
    } else if (t.closest("[data-disconnect]")) {
      const ok = await confirmDialog({
        title: "Disconnect Google Calendar?",
        message: "Study sessions and exams will stop syncing to your Google Calendar.",
        confirmLabel: "Disconnect",
        danger: true,
      });
      if (!ok) return;
      setCalendarConnected(false);
      render();
      showToast("Google Calendar disconnected");
    } else if (t.closest("[data-rem-toggle]")) {
      const enabled = !getUser().reminders.enabled;
      saveReminders({ enabled });
      render();
      main.querySelector("[data-rem-toggle]").focus();
      showToast(enabled ? "Reminders on" : "Reminders off");
    } else if (t.closest("[data-rem-day]")) {
      const btn = t.closest("[data-rem-day]");
      const d = Number(btn.dataset.remDay);
      const days = getUser().reminders.days;
      const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
      btn.setAttribute("aria-pressed", String(next.includes(d)));
      saveAndSummarise({ days: next });
    }
  });

  main.addEventListener("change", (event) => {
    if (event.target.name === "cal-view") {
      state.view = event.target.value;
      state.cursor = state.selected;
      render();
    } else if (event.target.id === "rem-time" && event.target.value) {
      saveAndSummarise({ time: event.target.value });
      showToast("Reminder time saved");
    }
  });

  render();
})();
