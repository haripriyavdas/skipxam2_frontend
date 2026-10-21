/*
 * Shared code for every page in /app/. Load after data.js.
 * Each page only needs a <main> element; the navigation is injected here.
 */
(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Icons (inline SVG, inherit colour from currentColor)
  // ---------------------------------------------------------------------------

  const svg = (body, attrs = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"') =>
    `<svg class="icon" viewBox="0 0 24 24" width="24" height="24" ${attrs} aria-hidden="true">${body}</svg>`;

  const ICONS = {
    home: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>'),
    sets: svg('<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>'),
    calendar: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    tutor: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>'),
    profile: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>', 'fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"'),
    upload: svg('<path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>'),
    sparkle: svg('<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3z"/>'),
    close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    more: svg('<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>', 'fill="currentColor"'),
    folder: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>'),
    edit: svg('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/>'),
    trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    file: svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z"/><path d="M14 3v6h6"/>'),
    lock: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 'fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"'),
    notes: svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>'),
    plan: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15.5l2 2 4-4"/>'),
    mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
    visual: svg('<circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="20" r="2"/><path d="M6.5 7.3 9.6 10M17.5 7.3 14.4 10M12 15v3"/>'),
    cards: svg('<rect x="7" y="3" width="13" height="16" rx="2"/><path d="M4 7v12a2 2 0 0 0 2 2h10"/>'),
    quiz: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>'),
    test: svg('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>'),
    image: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>'),
    slides: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/>'),
    play: svg('<path d="M7 4.5v15l12-7.5z"/>', 'fill="currentColor"'),
    pause: svg('<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>', 'fill="currentColor"'),
    stop: svg('<rect x="6" y="6" width="12" height="12" rx="2"/>', 'fill="currentColor"'),
    send: svg('<path d="M4 12 20 4l-6 16-3-7-7-1z"/>'),
    bulb: svg('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'),
    chevronLeft: svg('<path d="m15 18-6-6 6-6"/>'),
    chevronRight: svg('<path d="m9 18 6-6-6-6"/>'),
    bell: svg('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2zM10 21h4"/>'),
    fire: svg('<path d="M12 22a7 7 0 0 0 7-7c0-4-3-6.5-4-10-1.5 1.5-2.5 3.5-2.5 5.5C11 9 10 8 9.5 6.5 7 9 5 11.5 5 15a7 7 0 0 0 7 7z"/>', 'fill="currentColor"'),
  };

  const NAV_ITEMS = [
    { page: "dashboard", href: "dashboard.html", label: "Home", icon: "home" },
    { page: "sets", href: "sets.html", label: "My Study Sets", short: "Study Sets", icon: "sets" },
    { page: "calendar", href: "calendar.html", label: "Calendar", icon: "calendar" },
    { page: "tutor", href: "tutor.html", label: "Tutor", icon: "tutor", pro: true },
    { page: "profile", href: "profile.html", label: "Profile", icon: "profile" },
  ];

  // Pages that aren't in the nav but belong under one of its items.
  const PAGE_PARENT = {
    set: "sets", notes: "sets", plan: "sets", record: "sets",
    "visual-memory": "sets", flashcards: "sets", quiz: "sets", "practice-test": "sets",
  };

  // Study tools: each has its own page, opened with ?set=<id>. `pro` tools are gated for free users.
  const TOOLS = {
    notes: { label: "Smart notes", href: "notes.html", icon: "notes" },
    plan: { label: "Study plan", href: "plan.html", icon: "plan" },
    record: { label: "Record lecture", href: "record.html", icon: "mic", pro: true },
    tutor: { label: "Tutor", href: "tutor.html", icon: "tutor", pro: true },
    visual: { label: "Visual memory", href: "visual-memory.html", icon: "visual", pro: true },
    flashcards: { label: "Flashcards", href: "flashcards.html", icon: "cards" },
    quiz: { label: "Quiz", href: "quiz.html", icon: "quiz" },
    test: { label: "Practice tests", href: "practice-test.html", icon: "test", pro: true },
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  function icon(name) {
    return ICONS[name] || "";
  }

  // Link to a study tool for a set, with optional extra query params (e.g. { topic }).
  function toolUrl(tool, setId, params = {}) {
    const query = new URLSearchParams({ set: setId, ...params });
    return `${TOOLS[tool] ? TOOLS[tool].href : "set.html"}?${query}`;
  }

  function toolLabel(tool) {
    return TOOLS[tool] ? TOOLS[tool].label : tool;
  }

  // "2026-10-24" -> "Sat, 24 Oct"
  function formatDate(iso) {
    return parseDate(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  }

  // "today", "tomorrow", "in 3 days", "2 days ago"
  function formatCountdown(iso) {
    const days = daysUntil(iso);
    if (days === 0) return "today";
    if (days === 1) return "tomorrow";
    if (days === -1) return "yesterday";
    return days > 0 ? `in ${days} days` : `${-days} days ago`;
  }

  // "Exam in 3 days", "Exam today", "No exam date", ...
  function examLabel(examDate) {
    if (!examDate) return "No exam date";
    const days = daysUntil(examDate);
    if (days < 0) return "Exam date passed";
    if (days === 0) return "Exam today";
    if (days === 1) return "Exam tomorrow";
    return `Exam in ${days} days`;
  }

  // Circular mastery % ring. `urgent` turns it red.
  function masteryRing(pct, { size = 44, urgent = false } = {}) {
    const stroke = size >= 60 ? 5 : 4;
    const r = size / 2 - stroke;
    const c = 2 * Math.PI * r;
    return `
      <span class="ring${urgent ? " is-urgent" : ""}" role="img" aria-label="Mastery ${pct}%"
        style="--ring-size: ${size}px">
        <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
          <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
          <circle class="ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"
            stroke-dasharray="${(c * pct) / 100} ${c}"/>
        </svg>
        <span class="ring-label">${pct}%</span>
      </span>`;
  }

  // Escapes text, then turns **term** into a highlighted key term and `code` into <code>.
  function richText(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<mark class="key-term">$1</mark>')
      .replace(/`(.+?)`/g, "<code>$1</code>");
  }

  // For tool pages: reads ?set= (and ?topic=) from the URL.
  function setFromUrl() {
    const params = new URLSearchParams(location.search);
    const set = params.get("set") ? getSet(params.get("set")) : null;
    const topicId = params.get("topic");
    const topic = set && topicId ? set.topics.find((t) => t.id === topicId) || null : null;
    return { set, topic };
  }

  function topicName(set, topicId) {
    const topic = set.topics.find((t) => t.id === topicId);
    return topic ? topic.name : "General";
  }

  function setNotFoundHtml() {
    return `
      <div class="set-missing">
        <h1>Study set not found</h1>
        <p class="muted">Open a tool from one of your study sets.</p>
        <a class="btn btn-secondary" href="sets.html">Go to My Study Sets</a>
      </div>`;
  }

  // Page-level empty state: one card style everywhere.
  // action: { label, href } for a link, or { label, attrs } for a button (e.g. data-action="create-set").
  function emptyStateHtml({ title, text, action }) {
    let button = "";
    if (action && action.href) button = `<a class="btn btn-primary" href="${action.href}">${action.label}</a>`;
    else if (action) button = `<button type="button" class="btn btn-primary" ${action.attrs || ""}>${action.label}</button>`;
    return `
      <div class="card empty-state">
        ${title ? `<h2>${title}</h2>` : ""}
        <p class="muted">${text}</p>
        ${button}
      </div>`;
  }

  // Shared header for tool pages: a back link to the set, then the tool title.
  function toolHeaderHtml(set, title, actions = "") {
    return `
      <header class="tool-header">
        <a class="back-link" href="set.html?set=${encodeURIComponent(set.id)}">
          <span aria-hidden="true">←</span> ${set.emoji} ${escapeHtml(set.name)}
        </a>
        <div class="tool-header-row">
          <h1>${title}</h1>
          ${actions}
        </div>
      </header>`;
  }

  function currentPage() {
    const file = location.pathname.split("/").pop() || "dashboard.html";
    const page = file.replace(/\.html$/, "");
    return PAGE_PARENT[page] || page;
  }

  let toastTimer = null;

  function showToast(message) {
    let toast = document.querySelector(".toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 2500);
  }

  // ---------------------------------------------------------------------------
  // Modal: a centred dialog on desktop, a bottom sheet on mobile (see app.css).
  // Built on <dialog>, so focus is trapped and the page behind is inert.
  // Closes with Escape, the X button or a click on the backdrop.
  //
  // `title` and `body` are HTML strings: escape any user text before passing it.
  //
  //   const modal = openModal({ title, body, onClose });
  //   modal.dialog  -> the <dialog>, to query and wire up the body
  //   modal.close() -> animate out and remove
  // ---------------------------------------------------------------------------

  let modalCount = 0;

  function openModal({ title, body, className = "", onClose }) {
    const titleId = `modal-title-${++modalCount}`;
    const dialog = document.createElement("dialog");
    dialog.className = `modal ${className}`.trim();
    dialog.setAttribute("aria-labelledby", titleId);
    dialog.innerHTML = `
      <div class="modal-head">
        <h2 id="${titleId}">${title}</h2>
        <button type="button" class="icon-btn" data-modal-close aria-label="Close">${icon("close")}</button>
      </div>
      <div class="modal-body">${body}</div>`;
    document.body.appendChild(dialog);

    let closing = false;
    function close() {
      if (closing) return;
      closing = true;
      const finish = () => {
        dialog.close();
        dialog.remove();
        if (onClose) onClose();
      };
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return finish();
      dialog.classList.add("is-closing");
      dialog.addEventListener("animationend", finish, { once: true });
      setTimeout(finish, 400); // in case animationend never fires
    }

    // Escape: run our close so it animates, instead of the instant native close.
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });

    // Backdrop click: the dialog box fills its own area, so a click whose
    // press and release both land outside its rectangle is on the backdrop.
    let pressedOutside = false;
    const isOutside = (event) => {
      const r = dialog.getBoundingClientRect();
      return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
    };
    dialog.addEventListener("pointerdown", (event) => { pressedOutside = event.target === dialog && isOutside(event); });
    dialog.addEventListener("click", (event) => {
      if (event.target.closest("[data-modal-close]")) return close();
      if (pressedOutside && event.target === dialog && isOutside(event)) close();
      pressedOutside = false;
    });

    dialog.showModal();
    return { dialog, close };
  }

  // Confirmation dialog. Resolves true if the user confirms.
  function confirmDialog({ title, message, confirmLabel = "Confirm", danger = false }) {
    return new Promise((resolve) => {
      let confirmed = false;
      const modal = openModal({
        title,
        body: `
          <p class="muted">${message}</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-modal-close autofocus>Cancel</button>
            <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-confirm>${confirmLabel}</button>
          </div>`,
        onClose: () => resolve(confirmed),
      });
      modal.dialog.querySelector("[data-confirm]").addEventListener("click", () => {
        confirmed = true;
        modal.close();
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Upgrade sheet. The one place every upgrade offer leads to.
  // `feature` (optional) names what the user was trying to use.
  // ---------------------------------------------------------------------------

  const PRO_PRICE = "₹99"; // per month (placeholder price)
  const FLASH_KEY = "skipxam.flash"; // toast to show after the page reloads

  const PLAN_ROWS = [
    { label: "Study sets", free: "3", pro: "Unlimited" },
    { label: "Smart notes, flashcards &amp; quizzes", free: true, pro: true },
    { label: "Study plan &amp; reminders", free: true, pro: true },
    { label: "Practice tests", free: false, pro: true },
    { label: "AI Tutor", free: false, pro: true },
    { label: "Visual memory", free: false, pro: true },
    { label: "Record lectures", free: false, pro: true },
  ];

  function planCell(value) {
    if (value === true) return `<span class="plan-yes" role="img" aria-label="Included">${icon("check")}</span>`;
    if (value === false) return '<span class="plan-no" role="img" aria-label="Not included">–</span>';
    return escapeHtml(value);
  }

  function openUpgrade(feature) {
    if (getUser().plan === "pro") {
      showToast("You're already on Pro.");
      return;
    }

    const rows = PLAN_ROWS.map((row) => `
      <tr>
        <th scope="row">${row.label}</th>
        <td>${planCell(row.free)}</td>
        <td>${planCell(row.pro)}</td>
      </tr>`).join("");

    const modal = openModal({
      title: "Upgrade to Pro",
      className: "upgrade-sheet",
      body: `
        <p class="upgrade-lead">${feature
          ? `<strong>${escapeHtml(feature)}</strong> is part of SkipXam Pro.`
          : "Get more out of every study set."}</p>
        <table class="plan-table">
          <thead><tr><th scope="col"><span class="visually-hidden">Feature</span></th><th scope="col">Free</th><th scope="col">Pro</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="price"><span class="price-amount">${PRO_PRICE}</span> / month</p>
        <p class="price-note">Cancel anytime</p>
        <button type="button" class="btn btn-primary btn-block" data-go-pro autofocus>Upgrade to Pro</button>`,
    });

    modal.dialog.querySelector("[data-go-pro]").addEventListener("click", () => {
      setPlan("pro");
      try { sessionStorage.setItem(FLASH_KEY, "You're on Pro now. Everything is unlocked."); } catch (err) { /* toast is optional */ }
      location.reload();
    });
  }

  // ---------------------------------------------------------------------------
  // Pro gate. For free users: keeps the element's first child readable, blurs
  // the rest, and overlays a lock with an "Unlock with Pro" button.
  // Pro users see the element unchanged.
  //
  //   proGate(document.querySelector(".question-list"), "Practice tests");
  // ---------------------------------------------------------------------------

  const GATE_MIN_HEIGHT = 220; // room for the overlay's lock, title and button

  function proGate(element, featureName) {
    if (!element || getUser().plan === "pro" || element.classList.contains("pro-gate")) return;

    const children = [...element.children];
    const first = children.length > 1 ? children[0] : null; // a lone child is blurred too
    const locked = first ? children.slice(1) : children;

    element.classList.add("pro-gate");
    locked.forEach((child) => {
      child.classList.add("pro-gate-blur");
      child.inert = true; // not focusable or read out while hidden
      child.setAttribute("aria-hidden", "true");
    });

    const overlay = document.createElement("div");
    overlay.className = "pro-gate-overlay";
    overlay.innerHTML = `
      <span class="pro-gate-lock">${icon("lock")}</span>
      <p class="pro-gate-title">${escapeHtml(featureName)}</p>
      <p class="pro-gate-text">Available on Pro</p>
      <button type="button" class="btn btn-primary">Unlock with Pro</button>`;
    overlay.querySelector("button").addEventListener("click", () => openUpgrade(featureName));
    element.appendChild(overlay);

    // Keep the overlay covering everything below the first child.
    const position = () => {
      const top = first ? first.offsetTop + first.offsetHeight : 0;
      overlay.style.top = `${top}px`;
      element.style.minHeight = `${top + GATE_MIN_HEIGHT}px`;
    };
    position();
    if ("ResizeObserver" in window) new ResizeObserver(position).observe(element);
  }

  // ---------------------------------------------------------------------------
  // Create study set sheet
  // ---------------------------------------------------------------------------

  const FREE_SET_LIMIT = 3;
  const SET_EMOJIS = ["📘", "📝", "💻", "🧪", "🧮", "📐", "⚙️", "🧬", "🔬", "📊", "🌍", "⚡"];
  const SET_COLOURS = [
    { value: "#E08A38", name: "Amber" },
    { value: "#E0673A", name: "Orange" },
    { value: "#4FA3D9", name: "Blue" },
    { value: "#A78BFA", name: "Violet" },
    { value: "#3FB8AF", name: "Teal" },
    { value: "#E06C9F", name: "Pink" },
  ];

  function createLimitHtml() {
    return `
      <div class="limit-message">
        <span class="limit-icon">${icon("lock")}</span>
        <h3>Free plan includes ${FREE_SET_LIMIT} study sets</h3>
        <p class="muted">You've used all ${FREE_SET_LIMIT}. Upgrade to Pro to create as many sets as you need.</p>
        <button type="button" class="btn btn-primary" data-upgrade autofocus>Upgrade to Pro</button>
      </div>`;
  }

  function createFormHtml() {
    const emojis = SET_EMOJIS.map((emoji, i) => `
      <label class="emoji-option">
        <input type="radio" name="emoji" value="${emoji}"${i === 0 ? " checked" : ""}>
        <span>${emoji}</span>
      </label>`).join("");

    const colours = SET_COLOURS.map((c, i) => `
      <label class="swatch" title="${c.name}">
        <input type="radio" name="colour" value="${c.value}" aria-label="${c.name}"${i === 0 ? " checked" : ""}>
        <span style="--swatch: ${c.value}"></span>
      </label>`).join("");

    return `
      <form class="create-form" novalidate>
        <div class="field">
          <label class="field-label" for="set-name">Name</label>
          <input class="input" id="set-name" name="name" type="text" placeholder="e.g. Java"
            maxlength="60" autocomplete="off" required>
        </div>
        <div class="field">
          <label class="field-label" for="set-subject">Subject or exam <span class="muted">(optional)</span></label>
          <input class="input" id="set-subject" name="subject" type="text"
            placeholder="e.g. CIE-1, OOP with Java" maxlength="80" autocomplete="off">
        </div>
        <div class="field">
          <label class="field-label" for="set-exam">Exam date <span class="muted">(optional)</span></label>
          <input class="input" id="set-exam" name="examDate" type="date" min="${todayISO()}"
            aria-describedby="set-exam-hint">
          <p class="field-hint" id="set-exam-hint">Add a date and we'll plan your study days</p>
        </div>
        <fieldset class="field">
          <legend class="field-label">Emoji</legend>
          <div class="emoji-grid">${emojis}</div>
        </fieldset>
        <fieldset class="field">
          <legend class="field-label">Colour</legend>
          <div class="swatches">${colours}</div>
        </fieldset>
        <div class="modal-actions">
          <button type="submit" class="btn btn-primary" disabled>Create set</button>
        </div>
      </form>`;
  }

  function openCreateSet() {
    const user = getUser();
    const atLimit = user.plan === "free" && getSets().length >= FREE_SET_LIMIT;

    const modal = openModal({
      title: "New study set",
      className: "create-sheet",
      body: atLimit ? createLimitHtml() : createFormHtml(),
    });
    const { dialog } = modal;

    if (atLimit) {
      dialog.querySelector("[data-upgrade]").addEventListener("click", () => {
        modal.close();
        openUpgrade("Unlimited study sets");
      });
      return;
    }

    const form = dialog.querySelector(".create-form");
    const nameInput = form.elements.name;
    const submit = form.querySelector('[type="submit"]');

    nameInput.addEventListener("input", () => {
      submit.disabled = nameInput.value.trim() === "";
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();
      if (!name) return;
      const set = createSet({
        name,
        subject: form.elements.subject.value.trim(),
        examDate: form.elements.examDate.value || null,
        emoji: form.elements.emoji.value,
        colour: form.elements.colour.value,
      });
      modal.close();
      location.href = `set.html?set=${encodeURIComponent(set.id)}`;
    });

    nameInput.focus();
  }

  // ---------------------------------------------------------------------------
  // Shell
  // ---------------------------------------------------------------------------

  const logoHtml = '<a href="dashboard.html" class="app-logo">Skip<span>Xam</span></a>';

  function sidebarHtml(active, user) {
    const links = NAV_ITEMS.map((item) => `
      <li>
        <a href="${item.href}" class="sidebar-link"${item.page === active ? ' aria-current="page"' : ""}>
          ${ICONS[item.icon]}
          <span>${item.label}</span>
          ${item.pro ? '<span class="badge">Pro</span>' : ""}
        </a>
      </li>`).join("");

    const footer = user.plan === "pro"
      ? `<div class="sidebar-plan">
           <span class="badge">Pro</span>
           <span>${escapeHtml(user.name)} · Pro plan</span>
         </div>`
      : `<div class="upgrade-card">
           <p class="upgrade-card-title">Upgrade to Pro</p>
           <p class="upgrade-card-text">Unlock the AI Tutor and unlimited study sets.</p>
           <button type="button" class="btn btn-secondary" data-action="upgrade">Upgrade</button>
         </div>`;

    return `
      <aside class="app-sidebar">
        ${logoHtml}
        <button type="button" class="btn btn-primary sidebar-create" data-action="create-set">
          ${ICONS.plus}<span>Create study set</span>
        </button>
        <nav aria-label="Main">
          <ul class="sidebar-nav">${links}</ul>
        </nav>
        ${footer}
      </aside>`;
  }

  function topbarHtml(user) {
    const days = user.streak === 1 ? "day" : "days";
    return `
      <header class="app-topbar">
        ${logoHtml}
        <span class="streak" aria-label="${user.streak} ${days} streak">
          ${ICONS.fire}<span>${user.streak}</span>
        </span>
      </header>`;
  }

  function tabbarHtml(active) {
    const tab = (page) => {
      const item = NAV_ITEMS.find((i) => i.page === page);
      return `
        <a href="${item.href}" class="tab"${page === active ? ' aria-current="page"' : ""}>
          ${ICONS[item.icon]}
          <span>${item.short || item.label}</span>
        </a>`;
    };

    return `
      <nav class="app-tabbar" aria-label="Main">
        ${tab("dashboard")}
        ${tab("sets")}
        <button type="button" class="tab-create" data-action="create-set" aria-label="Create study set">
          ${ICONS.plus}
        </button>
        ${tab("calendar")}
        ${tab("profile")}
      </nav>`;
  }

  function renderShell() {
    const user = getUser();
    const active = currentPage();

    document.body.classList.add("has-app-shell");
    document.body.insertAdjacentHTML("afterbegin",
      sidebarHtml(active, user) + topbarHtml(user) + tabbarHtml(active));

    document.body.addEventListener("click", (event) => {
      const target = event.target.closest("[data-action]");
      if (!target) return;
      if (target.dataset.action === "create-set") openCreateSet();
      if (target.dataset.action === "upgrade") openUpgrade(target.dataset.feature);
    });
  }

  // Dev-only plan switcher, fixed to the bottom-left corner. Remove before launch.
  function renderDevToggle() {
    const { plan } = getUser();
    const toggle = document.createElement("div");
    toggle.className = "dev-toggle";
    toggle.setAttribute("role", "group");
    toggle.setAttribute("aria-label", "Dev: switch plan");
    toggle.innerHTML = `
      <span class="dev-toggle-label">Dev</span>
      <button type="button" data-plan="free" aria-pressed="${plan === "free"}">Free</button>
      <button type="button" data-plan="pro" aria-pressed="${plan === "pro"}">Pro</button>
    `;

    toggle.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-plan]");
      if (!button || button.dataset.plan === plan) return;
      setPlan(button.dataset.plan);
      location.reload();
    });

    document.body.appendChild(toggle);
  }

  function showFlashToast() {
    try {
      const message = sessionStorage.getItem(FLASH_KEY);
      if (!message) return;
      sessionStorage.removeItem(FLASH_KEY);
      showToast(message);
    } catch (err) { /* storage unavailable: no toast */ }
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderShell();
    renderDevToggle();
    showFlashToast();
  });

  Object.assign(window, {
    openCreateSet, openUpgrade, openModal, confirmDialog, proGate, showToast,
    escapeHtml, richText, icon, toolUrl, toolLabel, formatDate, formatCountdown, examLabel, masteryRing,
    setFromUrl, topicName, setNotFoundHtml, toolHeaderHtml, emptyStateHtml,
    TOOLS,
  });
})();
