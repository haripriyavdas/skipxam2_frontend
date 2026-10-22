/*
 * Profile (app/profile.html). Load after data.js and app.js.
 * Load college-picker.js and badges.js first.
 * A bento grid: identity (with Edit profile and Settings), study heatmap
 * (hero), stats, mastery by set, badges, plan and billing, invite friends,
 * account. Settings open in a modal from the gear on the identity tile.
 */
(function () {
  "use strict";

  const main = document.querySelector("main");
  const WEEKS = 16;
  const INVITE_BASE = "https://skipxam.app/invite/";

  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------

  function planBadgeHtml(plan) {
    return plan === "free"
      ? '<span class="badge plan-badge">Free</span>'
      : `<span class="badge badge-pro plan-badge">${planLabel(plan)}</span>`;
  }

  // Courses by degree level. `names` lets B.E./B.Tech students pick what
  // their degree is called; `branches` shows the branch dropdown.
  const COURSES = {
    ug: [
      { id: "be-btech", label: "B.E./B.Tech", names: ["B.E.", "B.Tech"], branches: true },
      { id: "bsc", label: "B.Sc" }, { id: "bcom", label: "B.Com" }, { id: "ba", label: "B.A." },
      { id: "bba", label: "BBA" }, { id: "bca", label: "BCA" }, { id: "mbbs", label: "MBBS" },
      { id: "bds", label: "BDS" }, { id: "bpharm", label: "B.Pharm" }, { id: "barch", label: "B.Arch" },
      { id: "llb5", label: "LLB (5-year)" }, { id: "bdes", label: "B.Des" }, { id: "other", label: "Other" },
    ],
    pg: [
      { id: "me-mtech", label: "M.E./M.Tech", names: ["M.E.", "M.Tech"], branches: true },
      { id: "msc", label: "M.Sc" }, { id: "mcom", label: "M.Com" }, { id: "ma", label: "M.A." },
      { id: "mba", label: "MBA" }, { id: "mca", label: "MCA" }, { id: "md", label: "MD" },
      { id: "ms-med", label: "MS (Medical)" }, { id: "mpharm", label: "M.Pharm" }, { id: "march", label: "M.Arch" },
      { id: "llm", label: "LLM" }, { id: "mdes", label: "M.Des" }, { id: "other", label: "Other" },
    ],
    diploma: [
      { id: "dip-eng", label: "Diploma in Engineering", names: ["Diploma"], branches: true },
      { id: "dpharm", label: "D.Pharm" }, { id: "gnm", label: "GNM (Nursing)" }, { id: "other", label: "Other" },
    ],
  };
  const LEVELS = [
    { value: "ug", label: "Undergraduate" },
    { value: "pg", label: "Postgraduate" },
    { value: "diploma", label: "Diploma" },
  ];
  // value is what the profile shows ("B.E. Mechanical").
  const BRANCHES = [
    { value: "Mechanical", label: "Mechanical" },
    { value: "Computer Science", label: "Computer Science" },
    { value: "ECE", label: "ECE (Electronics and Communication)" },
    { value: "EEE", label: "EEE (Electrical and Electronics)" },
    { value: "Civil", label: "Civil" },
    { value: "ISE", label: "ISE (Information Science)" },
    { value: "AI & ML", label: "AI & ML" },
    { value: "Data Science", label: "Data Science" },
    { value: "Chemical", label: "Chemical" },
    { value: "Aerospace", label: "Aerospace" },
    { value: "Biotechnology", label: "Biotechnology" },
    { value: "Electronics and Instrumentation", label: "Electronics and Instrumentation" },
    { value: "Industrial Engineering", label: "Industrial Engineering" },
    { value: "Automobile", label: "Automobile" },
    { value: "Other", label: "Other" },
  ];
  const ordinal = (n) => `${n}${["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || "th"}`;

  function findCourse(level, id) {
    return (COURSES[level] || COURSES.ug).find((c) => c.id === id) || null;
  }

  // "B.E. Mechanical, 2nd year"
  function courseLine(edu) {
    if (!edu) return "";
    const course = findCourse(edu.level, edu.course);
    let name = "";
    if (course && course.id === "other") name = edu.otherCourse || "";
    else if (course && course.branches) {
      const degree = course.names.includes(edu.degreeName) ? edu.degreeName : course.names[0];
      name = edu.branch && edu.branch !== "Other" ? `${degree} ${edu.branch}` : degree;
    } else if (course) name = course.label;
    return [name, edu.year ? `${ordinal(edu.year)} year` : ""].filter(Boolean).join(", ");
  }

  function identityHtml(user) {
    const edu = user.education || {};
    const details = [collegeLabel(edu.college), courseLine(edu)].filter(Boolean).map(escapeHtml);
    return `
      <section class="card tile p-identity" aria-labelledby="p-name">
        <button type="button" class="icon-btn p-gear" data-open-settings aria-label="Settings" title="Settings">${icon("settings")}</button>
        <label class="p-avatar" title="Change picture">
          <span class="avatar p-avatar-img">${avatarInnerHtml(user)}</span>
          <span class="p-avatar-edit" aria-hidden="true">${icon("edit")}</span>
          <input type="file" accept="image/*" class="visually-hidden" data-avatar-input aria-label="Upload a profile picture">
        </label>
        <div class="p-identity-text">
          <div class="p-name-row">
            <h1 id="p-name">${escapeHtml(user.name)}</h1>
            ${planBadgeHtml(user.plan)}
          </div>
          ${details.length ? details.map((d) => `<p class="muted">${d}</p>`).join("") : '<p class="muted">Add your college and course</p>'}
          <button type="button" class="btn btn-secondary btn-sm" data-edit-profile>${icon("edit")}Edit profile</button>
        </div>
      </section>`;
  }

  // Shrinks the picture to 160px so it fits comfortably in localStorage.
  function readAvatar(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const size = 160;
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = size;
          const side = Math.min(img.width, img.height);
          canvas.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function optionsHtml(items, selected) {
    return items.map((o) => `<option value="${escapeHtml(o.value)}"${o.value === selected ? " selected" : ""}>${escapeHtml(o.label)}</option>`).join("");
  }

  function openEditProfile() {
    const user = getUser();
    const edu = { level: "ug", course: "", degreeName: "", branch: "", otherCourse: "", year: 1, ...(user.education || {}) };
    const years = [1, 2, 3, 4, 5].map((y) => ({ value: String(y), label: `${ordinal(y)} year` }));
    const modal = openModal({
      title: "Edit profile",
      className: "edit-profile-modal",
      body: `
        <form novalidate>
          <div class="field">
            <label class="field-label" for="pf-name">Name</label>
            <input class="input" id="pf-name" name="name" maxlength="60" value="${escapeHtml(user.name)}" required>
          </div>
          <div class="field" data-college-picker></div>
          <div class="pf-row">
            <div class="field">
              <label class="field-label" for="pf-level">Degree level</label>
              <select class="input" id="pf-level" name="level">${optionsHtml(LEVELS, edu.level)}</select>
            </div>
            <div class="field">
              <label class="field-label" for="pf-course">Course</label>
              <select class="input" id="pf-course" name="course"></select>
            </div>
          </div>
          <div class="field" data-show="other" hidden>
            <label class="field-label" for="pf-other">Course name</label>
            <input class="input" id="pf-other" name="otherCourse" maxlength="80" value="${escapeHtml(edu.otherCourse || "")}">
          </div>
          <div class="field" data-show="names" hidden>
            <span class="field-label" id="pf-degree-label">Your degree is called</span>
            <fieldset class="segmented" aria-labelledby="pf-degree-label" data-degree-names></fieldset>
          </div>
          <div class="pf-row">
            <div class="field" data-show="branches" hidden>
              <label class="field-label" for="pf-branch">Branch or specialisation</label>
              <select class="input" id="pf-branch" name="branch">${optionsHtml(BRANCHES, edu.branch)}</select>
            </div>
            <div class="field">
              <label class="field-label" for="pf-year">Year</label>
              <select class="input" id="pf-year" name="year">${optionsHtml(years, String(edu.year || 1))}</select>
            </div>
          </div>
          <p class="field-hint p-error" data-form-error hidden></p>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
            <button type="submit" class="btn btn-primary">Save</button>
          </div>
        </form>`,
    });

    const form = modal.dialog.querySelector("form");
    const picker = collegePicker(form.querySelector("[data-college-picker]"), { value: edu.college || null });
    const levelSelect = form.elements.level;
    const courseSelect = form.elements.course;

    // Course options follow the degree level; the extra fields follow the course.
    function syncCourse(keepId) {
      const courses = COURSES[levelSelect.value];
      const id = courses.some((c) => c.id === keepId) ? keepId : courses[0].id;
      courseSelect.innerHTML = optionsHtml(courses.map((c) => ({ value: c.id, label: c.label })), id);
      syncExtras();
    }
    function syncExtras() {
      const course = findCourse(levelSelect.value, courseSelect.value);
      const show = (key, on) => { form.querySelector(`[data-show="${key}"]`).hidden = !on; };
      show("other", course.id === "other");
      show("branches", Boolean(course.branches));
      show("names", Boolean(course.names && course.names.length > 1));
      if (course.names) {
        const current = course.names.includes(edu.degreeName) ? edu.degreeName : course.names[0];
        form.querySelector("[data-degree-names]").innerHTML = course.names.map((n) => `
          <label><input type="radio" name="degreeName" value="${n}"${n === current ? " checked" : ""}><span>${n}</span></label>`).join("");
      }
    }
    levelSelect.addEventListener("change", () => syncCourse(""));
    courseSelect.addEventListener("change", syncExtras);
    syncCourse(edu.course);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const error = form.querySelector("[data-form-error]");
      const name = form.elements.name.value.trim();
      const course = findCourse(levelSelect.value, courseSelect.value);
      const otherCourse = form.elements.otherCourse.value.trim();
      let message = "";
      if (!name) message = "Enter your name.";
      else if (course.id === "other" && !otherCourse) message = "Enter your course name.";
      error.textContent = message;
      error.hidden = !message;
      if (message) return;
      const checkedName = form.querySelector("[name='degreeName']:checked");
      updateProfile({
        name,
        education: {
          college: picker.value,
          level: levelSelect.value,
          course: course.id,
          degreeName: course.names ? (checkedName ? checkedName.value : course.names[0]) : "",
          branch: course.branches ? form.elements.branch.value : "",
          otherCourse: course.id === "other" ? otherCourse : "",
          year: Number(form.elements.year.value),
        },
      });
      queueToast("Profile saved");
      location.reload(); // the top bar shows the name too
    });
  }

  // ---------------------------------------------------------------------------
  // Study heatmap
  // ---------------------------------------------------------------------------

  // Darker amber for more minutes. 0 = no study.
  function heatLevel(minutes) {
    if (!minutes) return 0;
    if (minutes <= 20) return 1;
    if (minutes <= 40) return 2;
    if (minutes <= 60) return 3;
    return 4;
  }

  function heatCells() {
    // Columns are weeks (Monday first); the last column holds today.
    const today = parseDate(todayISO());
    const mondayOffset = (today.getDay() + 6) % 7; // days since Monday
    const total = (WEEKS - 1) * 7 + mondayOffset + 1;
    const history = getStudyHistory(total);
    return history;
  }

  function heatmapHtml() {
    const { current, longest } = getStreaks();
    const days = heatCells();
    const cells = days.map((d, i) => {
      const date = parseDate(d.date);
      const label = `${date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · ${d.minutes ? `${d.minutes} min` : "No study"}`;
      return `<span class="heat-cell" data-level="${heatLevel(d.minutes)}" data-i="${i}" data-label="${label}" style="grid-column: ${Math.floor(i / 7) + 1}; grid-row: ${(i % 7) + 2}"></span>`;
    }).join("");
    // Month labels above the first week of each month.
    const months = [];
    for (let w = 0; w < WEEKS; w++) {
      const first = days[w * 7];
      if (!first) continue;
      const date = parseDate(first.date);
      const prev = w > 0 ? parseDate(days[(w - 1) * 7].date) : null;
      if (!prev || prev.getMonth() !== date.getMonth()) {
        months.push(`<span class="heat-month" style="grid-column: ${w + 1} / span 3">${date.toLocaleDateString("en-IN", { month: "short" })}</span>`);
      }
    }
    const studied = days.filter((d) => d.minutes > 0).length;

    return `
      <section class="card tile p-heat" aria-labelledby="heat-title">
        <div class="p-heat-head">
          <h2 class="tile-title" id="heat-title">Study activity</h2>
          <span class="muted">Last ${WEEKS} weeks</span>
        </div>
        <div class="p-streaks">
          <p class="p-streak"><span class="p-big">${current}</span><span class="p-label">${icon("fire")}Current streak</span></p>
          <p class="p-streak"><span class="p-big">${longest}</span><span class="p-label">Longest streak</span></p>
          <p class="p-streak"><span class="p-big">${studied}</span><span class="p-label">Days studied</span></p>
        </div>
        <div class="heat-wrap">
          <div class="heat-days" aria-hidden="true"><span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span><span></span></div>
          <div class="heatmap" tabindex="0" role="group" data-heatmap
            aria-label="Minutes studied per day for the last ${WEEKS} weeks. Use the arrow keys to read each day."
            aria-describedby="heat-readout">
            ${months.join("")}
            ${cells}
          </div>
        </div>
        <div class="heat-legend" aria-hidden="true">
          <span class="muted">Less</span>
          ${[0, 1, 2, 3, 4].map((l) => `<span class="heat-cell" data-level="${l}"></span>`).join("")}
          <span class="muted">More</span>
        </div>
        <p class="heat-tip" role="status" id="heat-readout" hidden></p>
      </section>`;
  }

  let activeCell = -1;

  function showHeatTip(cell) {
    const tile = main.querySelector(".p-heat");
    const tip = tile.querySelector(".heat-tip");
    main.querySelectorAll(".heat-cell.is-active").forEach((c) => c.classList.remove("is-active"));
    if (!cell) {
      tip.hidden = true;
      return;
    }
    cell.classList.add("is-active");
    activeCell = Number(cell.dataset.i);
    tip.textContent = cell.dataset.label;
    tip.hidden = false;
    const t = tile.getBoundingClientRect();
    const c = cell.getBoundingClientRect();
    const left = Math.min(Math.max(c.left - t.left + c.width / 2, 70), t.width - 70);
    tip.style.left = `${left}px`;
    tip.style.top = `${c.top - t.top - 8}px`;
  }

  // ---------------------------------------------------------------------------
  // Stats, mastery, badges
  // ---------------------------------------------------------------------------

  function statsHtml() {
    const s = getUserStats();
    const stat = (n, label) => `<li class="p-stat"><span class="p-big">${n}</span><span class="p-label">${label}</span></li>`;
    return `
      <section class="card tile p-stats" aria-labelledby="stats-title">
        <h2 class="tile-title" id="stats-title">Your numbers</h2>
        <ul class="p-stat-grid">
          ${stat(s.hours, "hours studied")}
          ${stat(s.flashcards.toLocaleString("en-IN"), "flashcards reviewed")}
          ${stat(s.quizzes, "quizzes taken")}
          ${stat(`${s.avgScore}%`, "average quiz score")}
        </ul>
      </section>`;
  }

  function masteryHtml() {
    const sets = getSets().map((set) => ({ set, pct: getSetMastery(set) })).sort((a, b) => a.pct - b.pct);
    return `
      <section class="card tile p-mastery" aria-labelledby="mastery-title">
        <div class="p-heat-head">
          <h2 class="tile-title" id="mastery-title">Mastery by set</h2>
          <span class="muted">Weakest first</span>
        </div>
        ${sets.length ? `
          <ul class="p-mastery-list">
            ${sets.map(({ set, pct }) => `
              <li><a class="p-mastery-row" href="set.html?set=${encodeURIComponent(set.id)}">
                <span class="set-tile" style="--set-colour: ${set.colour}" aria-hidden="true">${set.emoji}</span>
                <span class="p-mastery-main">
                  <span class="p-mastery-name"><span>${escapeHtml(set.name)}</span><strong>${pct}%</strong></span>
                  <span class="progress progress-thin" role="progressbar" aria-label="${escapeHtml(set.name)} mastery" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span class="progress-fill" style="width: ${pct}%"></span></span>
                </span>
              </a></li>`).join("")}
          </ul>` : '<p class="muted">Create a study set to see your mastery here.</p>'}
      </section>`;
  }

  // ---------------------------------------------------------------------------
  // Plan, invite
  // ---------------------------------------------------------------------------

  function planHtml(user) {
    const paid = user.plan !== "free";
    const price = paid ? PLANS[user.plan][user.billing === "yearly" ? "yearly" : "monthly"] : 0;
    return `
      <section class="card tile p-plan" aria-labelledby="plan-title">
        <h2 class="tile-title" id="plan-title">Plan and billing</h2>
        <p class="p-plan-name">${planBadgeHtml(user.plan)}
          <span class="muted">${paid ? `₹${price.toLocaleString("en-IN")} ${user.billing === "yearly" ? "a year" : "a month"}` : "₹0, free forever"}</span></p>
        <p class="muted p-plan-renew">${paid && user.planRenews ? `Renews on ${formatDate(user.planRenews)}` : "Upgrade for the Tutor, practice tests and more."}</p>
        <div class="p-plan-actions">
          <button type="button" class="btn ${paid ? "btn-secondary" : "btn-primary"} btn-sm btn-block" data-action="upgrade">${paid ? "Manage plan" : "See plans"}</button>
          ${paid ? '<button type="button" class="link-btn p-cancel" data-cancel-plan>Cancel plan</button>' : ""}
        </div>
      </section>`;
  }

  function inviteHtml(user) {
    const ref = user.referral || { code: "", joined: 0, daysEarned: 0 };
    const link = INVITE_BASE + ref.code;
    const message = `I'm using SkipXam to study for my exams. Join with my link and we both get 7 days of Pro: ${link}`;
    return `
      <section class="card tile p-invite" aria-labelledby="invite-title">
        <h2 class="tile-title" id="invite-title">Study with your friends</h2>
        <p class="muted">Share your link. When a friend joins SkipXam, you both get 7 days of Pro.</p>
        <input class="input p-invite-link" id="invite-link" value="${link}" readonly aria-label="Your invite link">
        <div class="p-invite-row">
          <button type="button" class="btn btn-secondary btn-sm" data-copy-invite>${icon("copy")}<span data-copy-label>Copy</span></button>
          <a class="btn btn-sm btn-whatsapp" href="https://wa.me/?text=${encodeURIComponent(message)}" target="_blank" rel="noopener">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2.5a9.4 9.4 0 0 0-8.1 14.2L2.6 21.4l4.8-1.3A9.4 9.4 0 1 0 12 2.5Zm0 17.1a7.7 7.7 0 0 1-3.9-1.1l-.3-.2-2.8.8.8-2.7-.2-.3A7.7 7.7 0 1 1 12 19.6Zm4.3-5.8c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.3 6.3 0 0 1-3.1-2.7c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.2-.2-.4-.3Z"/></svg>
            Share on WhatsApp<span class="visually-hidden"> (opens in a new tab)</span>
          </a>
        </div>
        <div class="p-invite-stats">
          <p><strong>${ref.joined}</strong> ${ref.joined === 1 ? "friend" : "friends"} joined</p>
          <p><strong>${ref.daysEarned}</strong> days of Pro earned</p>
        </div>
      </section>`;
  }

  let copyTimer;
  async function copyInvite(button) {
    const input = main.querySelector("#invite-link");
    try {
      await navigator.clipboard.writeText(input.value);
    } catch (err) {
      input.select();
      document.execCommand("copy"); // file:// pages may not get the async clipboard
    }
    const label = button.querySelector("[data-copy-label]");
    label.textContent = "Copied";
    button.classList.add("is-copied");
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      label.textContent = "Copy";
      button.classList.remove("is-copied");
    }, 2000);
  }

  // ---------------------------------------------------------------------------
  // Settings (saved as you change them)
  // ---------------------------------------------------------------------------

  function settingsBodyHtml(user) {
    const s = user.settings || {};
    const r = user.reminders || {};
    return `
      <div class="p-settings-list">
        <div class="p-setting">
          <label class="field-label" for="set-goal">Daily study goal</label>
          <div class="p-range-row">
            <input type="range" id="set-goal" name="dailyGoal" min="15" max="120" step="5" value="${s.dailyGoal || 60}" aria-describedby="set-goal-out">
            <output id="set-goal-out" for="set-goal">${s.dailyGoal || 60} min</output>
          </div>
        </div>
        <div class="p-setting">
          <label class="field-label" for="set-reminder">Reminder time</label>
          <input class="input" type="time" id="set-reminder" name="reminderTime" value="${r.time || "18:00"}">
        </div>
        <div class="p-setting">
          <span class="field-label" id="cal-label">Google Calendar</span>
          <div class="p-switch-row">
            <span class="muted">${user.calendarConnected ? "Connected" : "Not connected"}</span>
            <button type="button" class="btn btn-secondary btn-sm" data-calendar aria-describedby="cal-label">${user.calendarConnected ? "Disconnect" : "Connect"}</button>
          </div>
        </div>
        <div class="p-setting">
          <span class="field-label" id="notif-label">Notifications</span>
          <div class="p-switch-row">
            <span class="muted">Study reminders and streak alerts</span>
            <input type="checkbox" class="toggle-switch" role="switch" name="notifications" aria-labelledby="notif-label"${s.notifications ? " checked" : ""}>
          </div>
        </div>
        <div class="p-setting">
          <span class="field-label" id="theme-label">Theme</span>
          <fieldset class="segmented" aria-labelledby="theme-label">
            <label><input type="radio" name="theme" value="dark"${s.theme !== "light" ? " checked" : ""}><span>Dark</span></label>
            <label><input type="radio" name="theme" value="light"${s.theme === "light" ? " checked" : ""}><span>Light</span></label>
          </fieldset>
        </div>
      </div>
      <p class="p-saved" role="status" data-saved></p>
      <div class="modal-actions"><button type="button" class="btn btn-primary" data-modal-close>Done</button></div>`;
  }

  // Changes save as you make them; the modal shows "Saved".
  function openSettings() {
    const modal = openModal({ title: "Settings", className: "settings-modal", body: settingsBodyHtml(getUser()) });
    const body = modal.dialog.querySelector(".modal-body");
    let savedTimer;
    const flashSaved = () => {
      const el = body.querySelector("[data-saved]");
      el.textContent = "Saved";
      clearTimeout(savedTimer);
      savedTimer = setTimeout(() => { el.textContent = ""; }, 1800);
    };

    body.addEventListener("click", (event) => {
      if (!event.target.closest("[data-calendar]")) return;
      setCalendarConnected(!getUser().calendarConnected);
      body.innerHTML = settingsBodyHtml(getUser());
      body.querySelector("[data-calendar]").focus();
      flashSaved();
    });
    body.addEventListener("input", (event) => {
      if (event.target.name === "dailyGoal") body.querySelector("#set-goal-out").textContent = `${event.target.value} min`;
    });
    body.addEventListener("change", (event) => {
      const t = event.target;
      if (t.name === "dailyGoal") saveSettings({ dailyGoal: Number(t.value) });
      else if (t.name === "notifications") saveSettings({ notifications: t.checked });
      else if (t.name === "theme") saveSettings({ theme: t.value });
      else if (t.name === "reminderTime" && t.value) saveReminders({ time: t.value });
      else return;
      flashSaved();
    });
  }

  // ---------------------------------------------------------------------------
  // Account
  // ---------------------------------------------------------------------------

  function accountHtml(user) {
    return `
      <section class="tile p-account" aria-labelledby="account-title">
        <h2 class="tile-title" id="account-title">Account</h2>
        <ul class="p-account-list">
          <li><span class="muted">Email</span><span>${escapeHtml(user.email || "")}</span></li>
          <li><span class="muted">Password</span><button type="button" class="link-btn" data-change-password>Change password</button></li>
          <li><span class="muted">Your data</span><button type="button" class="link-btn" data-download>Download my data</button></li>
          <li><span class="muted">Session</span><button type="button" class="link-btn" data-logout>Log out</button></li>
          <li><span class="muted">Danger zone</span><button type="button" class="link-btn p-danger" data-delete-account>Delete account</button></li>
        </ul>
      </section>`;
  }

  function openChangePassword() {
    const modal = openModal({
      title: "Change password",
      body: `
        <form>
          <div class="field">
            <label class="field-label" for="pw-current">Current password</label>
            <input class="input" id="pw-current" type="password" autocomplete="current-password" required>
          </div>
          <div class="field">
            <label class="field-label" for="pw-new">New password</label>
            <input class="input" id="pw-new" type="password" autocomplete="new-password" minlength="8" required aria-describedby="pw-hint">
            <p class="field-hint" id="pw-hint">At least 8 characters.</p>
          </div>
          <div class="field">
            <label class="field-label" for="pw-confirm">Confirm new password</label>
            <input class="input" id="pw-confirm" type="password" autocomplete="new-password" required>
            <p class="field-hint p-error" data-pw-error hidden>The passwords don't match.</p>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
            <button type="submit" class="btn btn-primary">Change password</button>
          </div>
        </form>`,
    });
    const form = modal.dialog.querySelector("form");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const error = form.querySelector("[data-pw-error]");
      const match = form.querySelector("#pw-new").value === form.querySelector("#pw-confirm").value;
      error.hidden = match;
      if (!match) return form.querySelector("#pw-confirm").focus();
      modal.close();
      showToast("Password changed");
    });
  }

  function downloadData() {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `skipxam-data-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Your data is downloading");
  }

  function openDeleteAccount() {
    const modal = openModal({
      title: "Delete account?",
      body: `
        <form>
          <p class="muted">This deletes your study sets, notes, progress and badges. It can't be undone.</p>
          <div class="field">
            <label class="field-label" for="del-confirm">Type <strong>DELETE</strong> to confirm</label>
            <input class="input" id="del-confirm" autocomplete="off" spellcheck="false" autofocus>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
            <button type="submit" class="btn btn-danger" disabled>Delete account</button>
          </div>
        </form>`,
    });
    const form = modal.dialog.querySelector("form");
    const input = form.querySelector("#del-confirm");
    const submit = form.querySelector("[type='submit']");
    input.addEventListener("input", () => { submit.disabled = input.value.trim() !== "DELETE"; });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (input.value.trim() !== "DELETE") return;
      resetData(); // mock: restores the demo data
      location.href = "../index.html";
    });
  }

  // ---------------------------------------------------------------------------
  // Render + events
  // ---------------------------------------------------------------------------

  function render() {
    const user = getUser();
    main.innerHTML = `
      <div class="p-bento">
        ${identityHtml(user)}
        ${heatmapHtml()}
        ${statsHtml()}
        ${masteryHtml()}
        ${badgesTileHtml()}
        ${planHtml(user)}
        ${inviteHtml(user)}
        ${accountHtml(user)}
      </div>`;
  }

  main.addEventListener("click", async (event) => {
    const t = event.target;
    if (t.closest("[data-edit-profile]")) return openEditProfile();
    if (t.closest("[data-open-settings]")) return openSettings();
    if (t.closest("[data-copy-invite]")) return copyInvite(t.closest("[data-copy-invite]"));
    if (t.closest("[data-change-password]")) return openChangePassword();
    if (t.closest("[data-download]")) return downloadData();
    if (t.closest("[data-delete-account]")) return openDeleteAccount();
    if (t.closest("[data-logout]")) {
      location.href = "../index.html"; // mock: no real session
      return;
    }
    if (t.closest("[data-cancel-plan]")) {
      const user = getUser();
      const ok = await confirmDialog({
        title: `Cancel ${planLabel(user.plan)}?`,
        message: `You'll move to the Free plan${user.planRenews ? ` (in a real account, at the end of your billing period on ${formatDate(user.planRenews)})` : ""}. Your study sets stay, but Pro tools lock again.`,
        confirmLabel: "Cancel plan",
        danger: true,
      });
      if (!ok) return;
      setPlan("free");
      queueToast("Your plan is cancelled. You're on Free now.");
      location.reload();
    }
  });

  main.addEventListener("change", async (event) => {
    const t = event.target;
    if (t.matches("[data-avatar-input]")) {
      const file = t.files && t.files[0];
      if (!file) return;
      try {
        updateProfile({ avatar: await readAvatar(file) });
        queueToast("Picture updated");
        location.reload();
      } catch (err) {
        showToast("Couldn't read that image. Try a JPG or PNG.");
      }
    }
  });

  // Heatmap: hover, or arrow keys when the grid has focus.
  main.addEventListener("mouseover", (event) => {
    const cell = event.target.closest("[data-heatmap] .heat-cell");
    if (cell) showHeatTip(cell);
  });
  main.addEventListener("mouseout", (event) => {
    if (event.target.closest("[data-heatmap]") && !event.relatedTarget?.closest?.("[data-heatmap]")
      && document.activeElement !== main.querySelector("[data-heatmap]")) showHeatTip(null);
  });
  main.addEventListener("focusin", (event) => {
    if (!event.target.matches("[data-heatmap]")) return;
    const cells = event.target.querySelectorAll(".heat-cell");
    showHeatTip(cells[activeCell >= 0 ? activeCell : cells.length - 1]);
  });
  main.addEventListener("focusout", (event) => {
    if (event.target.matches("[data-heatmap]")) showHeatTip(null);
  });
  main.addEventListener("keydown", (event) => {
    const grid = event.target.closest("[data-heatmap]");
    if (!grid) return;
    const step = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1, Home: -Infinity, End: Infinity }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const cells = grid.querySelectorAll(".heat-cell");
    const next = Math.min(Math.max(activeCell + step, 0), cells.length - 1);
    showHeatTip(cells[Number.isFinite(next) ? next : (step < 0 ? 0 : cells.length - 1)]);
  });

  render();
  bindBadges(main);
})();
