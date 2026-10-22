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
    video: svg('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor"/>'),
    pause: svg('<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>', 'fill="currentColor"'),
    stop: svg('<rect x="6" y="6" width="12" height="12" rx="2"/>', 'fill="currentColor"'),
    send: svg('<path d="M4 12 20 4l-6 16-3-7-7-1z"/>'),
    bulb: svg('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'),
    chevronLeft: svg('<path d="m15 18-6-6 6-6"/>'),
    chevronRight: svg('<path d="m9 18 6-6-6-6"/>'),
    bell: svg('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2zM10 21h4"/>'),
    menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
    panel: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>'),
    swap: svg('<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>'),
    chevronDown: svg('<path d="m6 9 6 6 6-6"/>'),
    share: svg('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>'),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    filter: svg('<path d="M3 5h18l-7 8v6l-4-2v-4z"/>'),
    settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    copy: svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
    skip: svg('<path d="m5 5 9 7-9 7zM18 5v14"/>'),
    fire: svg('<path d="M12 22a7 7 0 0 0 7-7c0-4-3-6.5-4-10-1.5 1.5-2.5 3.5-2.5 5.5C11 9 10 8 9.5 6.5 7 9 5 11.5 5 15a7 7 0 0 0 7 7z"/>', 'fill="currentColor"'),
  };

  // Study tools: each has its own page, opened with ?set=<id>. `pro` tools are gated for free users.
  const TOOLS = {
    notes: { label: "Smart notes", href: "notes.html", icon: "notes" },
    plan: { label: "Study plan", href: "plan.html", icon: "plan" },
    record: { label: "Record lecture", href: "record.html", icon: "mic", pro: true },
    tutor: { label: "Tutor", href: "tutor.html", icon: "tutor", pro: true },
    visual: { label: "Visual memory", href: "visual-memory.html", icon: "visual", pro: true },
    videos: { label: "Videos", href: "videos.html", icon: "video" }, // Free: YouTube only; Pro/Max add AI videos
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
  // Two blurred background glows (amber + ember). At most one orb layer per
  // surface: Home, the pricing sheet and empty states. Its parent needs .has-orbs.
  // The user's picture, or their initials when there is none.
  function avatarInnerHtml(user) {
    if (user.avatar) return `<img src="${user.avatar}" alt="">`;
    const initials = user.name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("");
    return escapeHtml(initials || "?");
  }

  // variant "diagonal": amber top-left, ember bottom-right.
  function orbsHtml(variant) {
    return `<div class="orb-layer${variant ? ` is-${variant}` : ""}" aria-hidden="true"><span class="orb orb-amber"></span><span class="orb orb-ember"></span></div>`;
  }

  function emptyStateHtml({ title, text, action }) {
    let button = "";
    if (action && action.href) button = `<a class="btn btn-primary" href="${action.href}">${action.label}</a>`;
    else if (action) button = `<button type="button" class="btn btn-primary" ${action.attrs || ""}>${action.label}</button>`;
    return `
      <div class="card empty-state has-orbs">
        ${orbsHtml()}
        ${title ? `<h2>${title}</h2>` : ""}
        <p class="muted">${text}</p>
        ${button}
      </div>`;
  }

  // Shared header for tool pages: the title row. (The breadcrumb links back to the set.)
  function toolHeaderHtml(set, title, actions = "") {
    return `
      <header class="tool-header">
        <div class="tool-header-row">
          <h1>${title}</h1>
          ${actions}
        </div>
      </header>`;
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
    dialog.className = `modal glass ${className}`.trim();
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
  // Pricing modal. The one place every upgrade offer leads to: full screen,
  // three tiers, monthly/yearly toggle. `feature` (optional) names what the
  // user was trying to use. Choosing a tier switches the mock plan.
  // ---------------------------------------------------------------------------

  const FLASH_KEY = "skipxam.flash"; // toast to show after the page reloads

  // Placeholder prices in rupees. Yearly is about two months free.
  const PLANS = {
    free: { name: "Free", monthly: 0, yearly: 0, line: "Everything you need to start studying smarter." },
    pro: { name: "Pro", monthly: 99, yearly: 999, line: "The full toolkit for exam season." },
    max: { name: "Max", monthly: 249, yearly: 2499, line: "For heavy users who record and revise every day." },
  };
  const PLAN_ORDER = ["free", "pro", "max"];

  // Each row: label per plan, or false where the plan doesn't include it.
  const PLAN_FEATURES = [
    { free: "Smart notes, flashcards &amp; quizzes", pro: true, max: true },
    { free: "Study plan, calendar &amp; reminders", pro: true, max: true },
    { free: "Up to 3 study sets", pro: "Unlimited study sets", max: "Unlimited study sets" },
    { free: false, pro: "Practice tests", max: true },
    { free: false, pro: "Visual memory", max: true },
    { free: false, pro: "AI Tutor", max: true },
    { free: false, pro: "Record lectures (5 hrs a month)", max: "Record lectures (30 hrs a month)" },
    { free: false, pro: false, max: "Priority tutor responses" },
    { free: false, pro: false, max: "Explainer videos (when they launch)" },
  ];

  const rupees = (n) => `₹${n.toLocaleString("en-IN")}`;

  function planLabel(plan) {
    return PLANS[plan] ? PLANS[plan].name : "Free";
  }

  function tierFeaturesHtml(plan) {
    return PLAN_FEATURES.map((row) => {
      // A `true` reuses the label from the cheapest plan that names it.
      const own = row[plan];
      const label = own === true ? PLAN_ORDER.map((p) => row[p]).find((v) => typeof v === "string") : own;
      if (own) return `<li class="tier-feature">${icon("check")}<span>${label}</span></li>`;
      const missing = PLAN_ORDER.map((p) => row[p]).find((v) => typeof v === "string");
      return `<li class="tier-feature is-missing">${icon("close")}<span>${missing}<span class="visually-hidden"> (not included)</span></span></li>`;
    }).join("");
  }

  function tierHtml(plan, billing, current) {
    const p = PLANS[plan];
    const featured = plan === "pro";
    const isCurrent = plan === current;
    const yearly = billing === "yearly";
    const price = plan === "free" ? rupees(0) : rupees(yearly ? p.yearly : p.monthly);
    const per = plan === "free" ? "forever" : yearly ? "per year" : "per month";
    const saving = yearly && plan !== "free" ? `Save ${rupees(p.monthly * 12 - p.yearly)} a year` : "";
    let button;
    if (isCurrent) button = '<button type="button" class="btn btn-secondary btn-block" disabled>Current plan</button>';
    else if (plan === "free") button = '<button type="button" class="btn btn-secondary btn-block" data-choose-plan="free">Switch to Free</button>';
    else if (plan === "pro") button = '<button type="button" class="btn btn-primary btn-block" data-choose-plan="pro" autofocus>Upgrade to Pro</button>';
    else button = '<button type="button" class="btn btn-secondary btn-block" data-choose-plan="max">Go Max</button>';

    return `
      <article class="tier tier-${plan}${featured ? " is-featured gradient-border" : ""}" aria-labelledby="tier-${plan}-name">
        ${featured ? '<span class="tier-badge">Most popular</span>' : ""}
        <h3 class="tier-name" id="tier-${plan}-name">${p.name}</h3>
        <p class="tier-price"><span class="tier-amount">${price}</span> <span class="muted">${per}</span></p>
        <p class="tier-saving">${saving || "&nbsp;"}</p>
        <p class="tier-line muted">${p.line}</p>
        ${button}
        <ul class="tier-features" aria-label="What's in ${p.name}">${tierFeaturesHtml(plan)}</ul>
      </article>`;
  }

  function openUpgrade(feature) {
    const user = getUser();
    let billing = user.billing || "monthly";

    const modal = openModal({
      title: "Choose your plan",
      className: "pricing-modal",
      body: `
        ${feature ? `<p class="pricing-lead"><strong>${escapeHtml(feature)}</strong> is part of SkipXam Pro.</p>` : '<p class="pricing-lead muted">Study smarter for less than a samosa a day.</p>'}
        <fieldset class="segmented billing-toggle">
          <legend class="visually-hidden">Billing period</legend>
          <label><input type="radio" name="billing" value="monthly"${billing === "monthly" ? " checked" : ""}><span>Monthly</span></label>
          <label><input type="radio" name="billing" value="yearly"${billing === "yearly" ? " checked" : ""}><span>Yearly <em class="billing-save">2 months free</em></span></label>
        </fieldset>
        <div class="tiers has-orbs">
          <div class="orb-layer tiers-orb" aria-hidden="true"><span class="orb orb-amber"></span></div>
          <div class="tiers-row">${PLAN_ORDER.map((p) => tierHtml(p, billing, user.plan)).join("")}</div>
        </div>
        <p class="pricing-foot muted">Cancel anytime. No hidden limits.</p>`,
    });

    const row = modal.dialog.querySelector(".tiers-row");
    modal.dialog.addEventListener("change", (event) => {
      if (event.target.name !== "billing") return;
      billing = event.target.value;
      row.innerHTML = PLAN_ORDER.map((p) => tierHtml(p, billing, user.plan)).join("");
    });
    modal.dialog.addEventListener("click", (event) => {
      const button = event.target.closest("[data-choose-plan]");
      if (!button) return;
      const plan = button.dataset.choosePlan;
      setPlan(plan, billing);
      queueToast(plan === "free" ? "You're on the Free plan now." : `You're on ${planLabel(plan)} now. Everything is unlocked.`);
      modal.close();
      setTimeout(() => location.reload(), 200);
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
    if (!element || getUser().plan !== "free" || element.classList.contains("pro-gate")) return;

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
  // Shared sheets: search, materials, share
  // ---------------------------------------------------------------------------

  const FILE_KINDS = {
    pdf: { label: "PDF", icon: "file" },
    image: { label: "IMG", icon: "image" },
    pptx: { label: "PPT", icon: "slides" },
    docx: { label: "DOC", icon: "notes" },
    audio: { label: "M4A", icon: "mic" },
  };

  // Small coloured file badge: icon + type, e.g. PDF.
  function fileBadgeHtml(type) {
    const kind = FILE_KINDS[type] || { label: "FILE", icon: "file" };
    return `<span class="file-badge is-${type || "file"}" aria-hidden="true">${icon(kind.icon)}</span>`;
  }

  function fileKindLabel(type) {
    return (FILE_KINDS[type] || { label: "File" }).label;
  }

  // All uploaded files across sets, newest first: [{ file, set }]
  function allMaterials(setId) {
    return getSets()
      .filter((s) => !setId || s.id === setId)
      .flatMap((s) => s.files.map((file) => ({ file, set: s })))
      .sort((a, b) => b.file.date.localeCompare(a.file.date));
  }

  function openMaterials(setId) {
    const sets = getSets();
    const listHtml = (filter) => {
      const items = allMaterials(filter);
      if (!items.length) return '<p class="muted">No materials yet.</p>';
      return `<ul class="materials-list">${items.map(({ file, set }) => `
        <li class="material-row">
          ${fileBadgeHtml(file.type)}
          <span class="material-text">
            <span class="material-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
            <span class="muted">${set.emoji} ${escapeHtml(set.name)} · ${fileKindLabel(file.type)} · ${formatDate(file.date)}</span>
          </span>
          <a class="btn btn-ghost btn-sm" href="set.html?set=${encodeURIComponent(set.id)}">Open set</a>
        </li>`).join("")}</ul>`;
    };
    const modal = openModal({
      title: "Materials",
      className: "materials-sheet",
      body: `
        <label class="visually-hidden" for="materials-filter">Show materials from</label>
        <select class="input materials-filter" id="materials-filter">
          <option value="">All study sets</option>
          ${sets.map((s) => `<option value="${s.id}"${s.id === setId ? " selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}
        </select>
        <div class="materials-results">${listHtml(setId)}</div>`,
    });
    const select = modal.dialog.querySelector("#materials-filter");
    select.addEventListener("change", () => {
      modal.dialog.querySelector(".materials-results").innerHTML = listHtml(select.value);
    });
  }

  function openShare() {
    const url = location.href;
    const modal = openModal({
      title: "Share",
      body: `
        <p class="muted share-lead">Anyone with the link can view this page. (Demo: sharing isn't live yet.)</p>
        <div class="share-row">
          <label class="visually-hidden" for="share-url">Link</label>
          <input class="input" id="share-url" type="text" readonly value="${escapeHtml(url)}">
          <button type="button" class="btn btn-primary" data-copy>${icon("copy")}Copy</button>
        </div>`,
    });
    const input = modal.dialog.querySelector("#share-url");
    modal.dialog.querySelector("[data-copy]").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(url);
      } catch (err) {
        input.select(); // clipboard API blocked (e.g. file://): leave the link selected to copy by hand
        document.execCommand && document.execCommand("copy");
      }
      showToast("Link copied");
    });
    input.addEventListener("focus", () => input.select());
  }

  function openSearch() {
    const modal = openModal({
      title: "Search",
      className: "search-sheet",
      body: `
        <label class="visually-hidden" for="global-search">Search sets, topics and materials</label>
        <input class="input" id="global-search" type="search" placeholder="Search sets, topics and materials…" autocomplete="off">
        <div class="search-results" aria-live="polite"></div>`,
    });
    const input = modal.dialog.querySelector("#global-search");
    const results = modal.dialog.querySelector(".search-results");

    const render = () => {
      const q = input.value.trim().toLowerCase();
      if (!q) {
        results.innerHTML = '<p class="muted">Type to search your study sets.</p>';
        return;
      }
      const sets = getSets();
      const groups = [
        { title: "Study sets", items: sets.filter((s) => s.name.toLowerCase().includes(q))
          .map((s) => ({ href: `set.html?set=${encodeURIComponent(s.id)}`, label: `${s.emoji} ${escapeHtml(s.name)}`, meta: escapeHtml(s.subject || "") })) },
        { title: "Topics", items: sets.flatMap((s) => s.topics.filter((t) => t.name.toLowerCase().includes(q))
          .map((t) => ({ href: `set.html?set=${encodeURIComponent(s.id)}&topic=${encodeURIComponent(t.id)}`, label: escapeHtml(t.name), meta: escapeHtml(s.name) }))) },
        { title: "Materials", items: allMaterials().filter(({ file }) => file.name.toLowerCase().includes(q))
          .map(({ file, set }) => ({ href: `set.html?set=${encodeURIComponent(set.id)}`, label: escapeHtml(file.name), meta: escapeHtml(set.name) })) },
      ].filter((g) => g.items.length);

      results.innerHTML = groups.length ? groups.map((g) => `
        <section class="search-group">
          <h3>${g.title}</h3>
          <ul>${g.items.slice(0, 6).map((it) => `
            <li><a class="search-hit" href="${it.href}"><span class="search-hit-label">${it.label}</span><span class="muted">${it.meta}</span></a></li>`).join("")}</ul>
        </section>`).join("") : `<p class="muted">No results for “${escapeHtml(input.value.trim())}”.</p>`;
    };
    input.addEventListener("input", render);
    render();
    input.focus();
  }

  // ---------------------------------------------------------------------------
  // Menu select: a dropdown button whose options can carry a hint (shown as a
  // tooltip on hover/focus, inline on touch screens). Fires a bubbling
  // "menuselect" event with { name, value } when an option is picked.
  //
  //   menuSelectHtml({ name: "mode", prefix: "Mode", value: "standard",
  //     options: [{ value: "cram", label: "Cram", hint: "…", icon: "sparkle" }] })
  // ---------------------------------------------------------------------------

  let menuSelectCount = 0;

  function menuSelectHtml({ name, prefix = "", value, options, label }) {
    const id = `menusel-${++menuSelectCount}`;
    const current = options.find((o) => o.value === value) || options[0];
    return `
      <div class="menu-select" data-menu-select="${name}">
        <button type="button" class="menu-select-btn" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}"
          ${label ? `aria-label="${escapeHtml(label)}: ${escapeHtml(current.label)}"` : ""}>
          ${prefix ? `<span class="menu-select-prefix">${prefix}</span>` : ""}
          ${current.icon ? icon(current.icon) : ""}
          <span class="menu-select-value">${escapeHtml(current.label)}</span>
          ${icon("chevronDown")}
        </button>
        <ul class="menu-select-list glass" id="${id}" role="listbox" hidden>
          ${options.map((o) => `
            <li role="option" tabindex="-1" data-value="${o.value}" aria-selected="${o.value === current.value}">
              ${o.icon ? icon(o.icon) : ""}<span class="menu-option-label">${escapeHtml(o.label)}</span>
              ${o.value === current.value ? `<span class="menu-option-check">${icon("check")}</span>` : ""}
              ${o.hint ? `<span class="menu-hint" role="tooltip">${escapeHtml(o.hint)}</span>` : ""}
            </li>`).join("")}
        </ul>
      </div>`;
  }

  function closeMenuSelects(except) {
    document.querySelectorAll(".menu-select-btn[aria-expanded='true']").forEach((btn) => {
      if (btn === except) return;
      btn.setAttribute("aria-expanded", "false");
      btn.nextElementSibling.hidden = true;
    });
  }

  function pickMenuOption(option) {
    const wrap = option.closest("[data-menu-select]");
    const btn = wrap.querySelector(".menu-select-btn");
    closeMenuSelects();
    btn.focus();
    wrap.dispatchEvent(new CustomEvent("menuselect", { bubbles: true, detail: { name: wrap.dataset.menuSelect, value: option.dataset.value } }));
  }

  function bindMenuSelects() {
    document.addEventListener("click", (event) => {
      const btn = event.target.closest(".menu-select-btn");
      if (btn) {
        const open = btn.getAttribute("aria-expanded") === "true";
        closeMenuSelects(btn);
        btn.setAttribute("aria-expanded", String(!open));
        btn.nextElementSibling.hidden = open;
        if (!open) (btn.nextElementSibling.querySelector("[aria-selected='true']") || btn.nextElementSibling.firstElementChild).focus();
        return;
      }
      const option = event.target.closest(".menu-select-list [role='option']");
      if (option) return pickMenuOption(option);
      if (!event.target.closest(".menu-select")) closeMenuSelects();
    });

    document.addEventListener("keydown", (event) => {
      const option = event.target.closest && event.target.closest(".menu-select-list [role='option']");
      if (!option) return;
      const items = [...option.parentElement.children];
      const i = items.indexOf(option);
      if (event.key === "ArrowDown") { event.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (event.key === "ArrowUp") { event.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pickMenuOption(option); }
      else if (event.key === "Escape" || event.key === "Tab") {
        if (event.key === "Escape") event.preventDefault(); // close the menu, not a surrounding modal
        const btn = option.closest(".menu-select").querySelector(".menu-select-btn");
        closeMenuSelects();
        if (event.key === "Escape") btn.focus();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Shell: sidebar (collapsible; a drawer on mobile), top bar, bottom tab bar
  // ---------------------------------------------------------------------------

  const GLOBAL_LINKS = [
    { page: "dashboard", href: "dashboard.html", label: "Home", icon: "home" },
    { page: "sets", href: "sets.html", label: "My Sets", icon: "sets" },
    { page: "calendar", href: "calendar.html", label: "Calendar", icon: "calendar" },
  ];

  // Links for the active set. `tool` keys into TOOLS; `page` is the file name.
  const SET_LINKS = [
    { tool: "plan", page: "plan", label: "Study Plan" },
    { tool: "tutor", page: "tutor", label: "Tutor" },
    { tool: "record", page: "record", label: "Record Lecture" },
  ];
  const PRACTICE_LINKS = [
    { tool: "notes", page: "notes", label: "Notes" },
    { tool: "flashcards", page: "flashcards", label: "Flashcards" },
    { tool: "quiz", page: "quiz", label: "Quizzes" },
    { tool: "test", page: "practice-test", label: "Practice Tests" },
    { tool: "visual", page: "visual-memory", label: "Visual Memory" },
    { tool: "videos", page: "videos", label: "Videos" },
  ];

  const PAGE_TITLES = {
    dashboard: "Home", sets: "My Sets", calendar: "Calendar", profile: "Profile", tutor: "Tutor",
    plan: "Study Plan", record: "Record Lecture", notes: "Notes", flashcards: "Flashcards",
    quiz: "Quizzes", "practice-test": "Practice Tests", "visual-memory": "Visual Memory", videos: "Videos",
  };

  const COLLAPSE_KEY = "skipxam.sidebarCollapsed";
  const PRACTICE_KEY = "skipxam.practiceOpen";
  const MATERIALS_IN_SIDEBAR = 5;

  // Per-viewer UI preferences; storage may be unavailable, so never rely on it.
  function readPref(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v === "1";
    } catch (err) { return fallback; }
  }

  function writePref(key, value) {
    try { localStorage.setItem(key, value ? "1" : "0"); } catch (err) { /* ignore */ }
  }

  function pageName() {
    return (location.pathname.split("/").pop() || "dashboard.html").replace(/\.html$/, "");
  }

  // The set this page belongs to, or null on Home, My Sets, Calendar, Profile and the tutor picker.
  function activeSet() {
    const page = pageName();
    if (["dashboard", "sets", "calendar", "profile"].includes(page)) return null;
    const id = new URLSearchParams(location.search).get("set");
    return id ? getSet(id) : null;
  }

  function formatMinutes(min) {
    if (min < 60) return `${min}m`;
    return `${Math.floor(min / 60)}h ${min % 60}m`;
  }

  function navLink(href, iconName, label, current, extra = "") {
    return `
      <li><a class="nav-link" href="${href}"${current ? ' aria-current="page"' : ""} title="${label}">
        ${icon(iconName)}<span class="nav-label">${label}</span>${extra}
      </a></li>`;
  }

  function setSectionHtml(set, page, free) {
    const lock = (tool) => (TOOLS[tool].pro && free ? `<span class="nav-pro">${icon("lock")}<span class="visually-hidden">Pro</span></span>` : "");
    const link = (item) => navLink(toolUrl(item.tool, set.id), TOOLS[item.tool].icon, item.label, page === item.page, lock(item.tool));
    const practiceOpen = readPref(PRACTICE_KEY, true) || PRACTICE_LINKS.some((l) => l.page === page);
    const files = [...set.files].reverse();

    return `
      <div class="sidebar-divider" role="separator"></div>
      <div class="set-switcher">
        <button type="button" class="set-switcher-btn" aria-haspopup="listbox" aria-expanded="false" aria-controls="set-switcher-list"
          title="${escapeHtml(set.name)}" style="--set-colour: ${set.colour}">
          <span class="set-switcher-icon" aria-hidden="true">${set.emoji}</span>
          <span class="set-switcher-name nav-label">${escapeHtml(set.name)}</span>
          <span class="nav-label set-switcher-swap">${icon("swap")}</span>
          <span class="visually-hidden">Switch study set</span>
        </button>
        <ul class="set-switcher-list glass" id="set-switcher-list" role="listbox" aria-label="Study sets" hidden>
          ${getSets().map((s) => `
            <li role="option" tabindex="-1" data-switch-set="${s.id}" aria-selected="${s.id === set.id}" style="--set-colour: ${s.colour}">
              <span class="set-switcher-icon small" aria-hidden="true">${s.emoji}</span>${escapeHtml(s.name)}
              ${s.id === set.id ? `<span class="menu-option-check">${icon("check")}</span>` : ""}
            </li>`).join("")}
        </ul>
      </div>

      <nav aria-label="${escapeHtml(set.name)}">
        <ul class="nav-list">
          ${SET_LINKS.map(link).join("")}
          <li class="nav-group">
            <button type="button" class="nav-group-btn" aria-expanded="${practiceOpen}" aria-controls="practice-links">
              ${icon("cards")}<span class="nav-label">Practice &amp; Activities</span>
              <span class="nav-label nav-group-chevron">${icon("chevronDown")}</span>
            </button>
            <ul class="nav-sublist" id="practice-links"${practiceOpen ? "" : " hidden"}>
              ${PRACTICE_LINKS.map(link).join("")}
            </ul>
          </li>
        </ul>
      </nav>

      <a class="btn btn-primary sidebar-upload" href="set.html?set=${encodeURIComponent(set.id)}&upload=1" title="Upload">
        ${icon("plus")}<span class="nav-label">Upload</span>
      </a>

      <section class="sidebar-materials" aria-labelledby="materials-title">
        <div class="sidebar-materials-head">
          <h2 id="materials-title">Materials</h2>
          ${files.length ? '<button type="button" class="link-btn" data-view-materials>View all</button>' : ""}
        </div>
        ${files.length ? `
          <ul class="sidebar-files">
            ${files.slice(0, MATERIALS_IN_SIDEBAR).map((f) => `
              <li class="sidebar-file" title="${escapeHtml(f.name)}">${fileBadgeHtml(f.type)}<span class="sidebar-file-name">${escapeHtml(f.name)}</span></li>`).join("")}
          </ul>` : '<p class="sidebar-empty">No materials yet.</p>'}
      </section>`;
  }

  function sidebarHtml(page, set, user) {
    return `
      <aside class="app-sidebar" id="app-sidebar" aria-label="Sidebar">
        <div class="sidebar-head">
          <a href="dashboard.html" class="app-logo" aria-label="SkipXam home"><span class="logo-full">Skip<span>Xam</span></span><span class="logo-mini">S<span>X</span></span></a>
          <div class="sidebar-head-actions">
            <button type="button" class="icon-btn" data-open-search aria-label="Search">${icon("search")}</button>
            <button type="button" class="icon-btn sidebar-collapse" data-collapse aria-label="Collapse sidebar" aria-expanded="true" aria-controls="app-sidebar">${icon("panel")}</button>
            <button type="button" class="icon-btn sidebar-close" data-close-drawer aria-label="Close menu">${icon("close")}</button>
          </div>
        </div>
        <nav aria-label="Main">
          <ul class="nav-list">
            ${GLOBAL_LINKS.map((l) => navLink(l.href, l.icon, l.label, l.page === page || (l.page === "sets" && page === "set"))).join("")}
          </ul>
        </nav>
        ${set ? setSectionHtml(set, page, user.plan === "free") : ""}
        <div class="sidebar-mobile-actions">
          ${user.plan === "free" ? `<button type="button" class="btn btn-primary btn-block" data-action="upgrade">${icon("sparkle")}Upgrade</button>` : ""}
          <button type="button" class="btn btn-secondary btn-block" data-open-share>${icon("share")}Share</button>
        </div>
      </aside>
      <div class="drawer-backdrop" data-close-drawer hidden></div>`;
  }

  function breadcrumbHtml(page, set) {
    const crumbs = [];
    if (set) {
      crumbs.push({ href: "sets.html", label: "My Sets" });
      crumbs.push({ href: page === "set" ? null : `set.html?set=${encodeURIComponent(set.id)}`, label: `${set.emoji} ${escapeHtml(set.name)}` });
      if (page !== "set") crumbs.push({ label: PAGE_TITLES[page] || page });
    } else if (page === "set") {
      crumbs.push({ href: "sets.html", label: "My Sets" });
    } else {
      crumbs.push({ label: PAGE_TITLES[page] || "SkipXam" });
    }
    return `
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <ol>
          ${crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return `<li>${c.href && !last ? `<a href="${c.href}">${c.label}</a>` : `<span${last ? ' aria-current="page"' : ""}>${c.label}</span>`}</li>`;
          }).join("")}
        </ol>
      </nav>`;
  }

  function topbarHtml(page, set, user) {
    const minutes = getStudiedToday();
    return `
      <header class="app-topbar glass">
        <button type="button" class="icon-btn topbar-menu" data-open-drawer aria-label="Open menu" aria-controls="app-sidebar" aria-expanded="false">${icon("menu")}</button>
        <a href="dashboard.html" class="app-logo topbar-logo">Skip<span>Xam</span></a>
        ${breadcrumbHtml(page, set)}
        <div class="topbar-actions">
          ${user.plan === "free" ? `<button type="button" class="upgrade-pill" data-action="upgrade">${icon("sparkle")}Upgrade</button>` : ""}
          <button type="button" class="btn btn-secondary btn-sm topbar-share" data-open-share>${icon("share")}Share</button>
          <span class="study-timer" title="Time studied today" aria-label="Studied today: ${minutes} minutes">
            ${icon("clock")}<span data-study-minutes>${formatMinutes(minutes)}</span>
          </span>
          <a class="avatar" href="profile.html" aria-label="Profile: ${escapeHtml(user.name)}">${avatarInnerHtml(user)}</a>
        </div>
      </header>`;
  }

  function tabbarHtml(page) {
    const tab = (href, iconName, label, current) => `
      <a href="${href}" class="tab"${current ? ' aria-current="page"' : ""}>${icon(iconName)}<span>${label}</span></a>`;
    const inSet = !["dashboard", "calendar", "profile"].includes(page);
    return `
      <nav class="app-tabbar glass" aria-label="Main">
        ${tab("dashboard.html", "home", "Home", page === "dashboard")}
        ${tab("sets.html", "sets", "My Sets", inSet)}
        <button type="button" class="tab-create" data-action="create-set" aria-label="Create study set">${icon("plus")}</button>
        ${tab("calendar.html", "calendar", "Calendar", page === "calendar")}
        ${tab("profile.html", "profile", "Profile", page === "profile")}
      </nav>`;
  }

  // ---------- Behaviour ----------

  const mobileQuery = window.matchMedia("(max-width: 899px)");

  function setCollapsed(collapsed) {
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    const btn = document.querySelector("[data-collapse]");
    btn.setAttribute("aria-expanded", String(!collapsed));
    btn.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
    writePref(COLLAPSE_KEY, collapsed);
  }

  // Mobile drawer: everything behind it is inert while it's open.
  function setDrawer(open) {
    const sidebar = document.querySelector(".app-sidebar");
    const backdrop = document.querySelector(".drawer-backdrop");
    const menuBtn = document.querySelector("[data-open-drawer]");
    document.body.classList.toggle("drawer-open", open);
    backdrop.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
    document.querySelectorAll("main, .app-topbar, .app-tabbar, .dev-toggle").forEach((el) => { el.inert = open; });
    if (open) sidebar.querySelector("a, button").focus();
    else menuBtn.focus();
  }

  function toggleSetSwitcher(force) {
    const btn = document.querySelector(".set-switcher-btn");
    if (!btn) return;
    const list = document.querySelector(".set-switcher-list");
    const open = force !== undefined ? force : btn.getAttribute("aria-expanded") !== "true";
    btn.setAttribute("aria-expanded", String(open));
    list.hidden = !open;
    if (open) (list.querySelector("[aria-selected='true']") || list.firstElementChild).focus();
  }

  // Switching sets keeps you on the same tool, for the new set.
  function switchToSet(setId) {
    const params = new URLSearchParams(location.search);
    params.set("set", setId);
    params.delete("topic");
    params.delete("unit");
    location.href = `${location.pathname.split("/").pop()}?${params}`;
  }

  function bindShell() {
    document.body.addEventListener("click", (event) => {
      const t = event.target;
      const action = t.closest("[data-action]");
      if (action) {
        if (action.dataset.action === "create-set") openCreateSet();
        if (action.dataset.action === "upgrade") openUpgrade(action.dataset.feature);
        return;
      }
      if (t.closest("[data-collapse]")) return setCollapsed(!document.body.classList.contains("sidebar-collapsed"));
      if (t.closest("[data-open-drawer]")) return setDrawer(true);
      if (t.closest("[data-close-drawer]")) return setDrawer(false);
      if (t.closest("[data-open-search]")) return openSearch();
      if (t.closest("[data-open-share]")) return openShare();
      if (t.closest("[data-view-materials]")) return openMaterials(activeSet() ? activeSet().id : undefined);
      if (t.closest(".set-switcher-btn")) return toggleSetSwitcher();
      const switchItem = t.closest("[data-switch-set]");
      if (switchItem) return switchToSet(switchItem.dataset.switchSet);
      const group = t.closest(".nav-group-btn");
      if (group) {
        const open = group.getAttribute("aria-expanded") !== "true";
        group.setAttribute("aria-expanded", String(open));
        document.getElementById("practice-links").hidden = !open;
        writePref(PRACTICE_KEY, open);
        return;
      }
      if (!t.closest(".set-switcher")) toggleSetSwitcher(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.body.classList.contains("drawer-open") && !document.querySelector("dialog[open]")) {
        setDrawer(false);
        return;
      }
      const item = event.target.closest && event.target.closest("[data-switch-set]");
      if (!item) return;
      const items = [...item.parentElement.children];
      const i = items.indexOf(item);
      if (event.key === "ArrowDown") { event.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (event.key === "ArrowUp") { event.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); switchToSet(item.dataset.switchSet); }
      else if (event.key === "Escape") { toggleSetSwitcher(false); document.querySelector(".set-switcher-btn").focus(); }
    });

    // Leaving mobile width with the drawer open: close it.
    mobileQuery.addEventListener("change", () => {
      if (!mobileQuery.matches && document.body.classList.contains("drawer-open")) setDrawer(false);
    });
  }

  // Counts a minute of study for every minute an app page is open and visible.
  function startStudyTimer() {
    setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const minutes = addStudyMinute();
      const el = document.querySelector("[data-study-minutes]");
      if (el) el.textContent = formatMinutes(minutes);
      const wrap = document.querySelector(".study-timer");
      if (wrap) wrap.setAttribute("aria-label", `Studied today: ${minutes} minutes`);
    }, 60000);
  }

  function renderShell() {
    const user = getUser();
    const page = pageName();
    const set = activeSet();

    document.body.classList.add("has-app-shell");
    if (set) document.body.classList.add("in-set");
    document.body.insertAdjacentHTML("afterbegin", sidebarHtml(page, set, user) + topbarHtml(page, set, user) + tabbarHtml(page));
    if (readPref(COLLAPSE_KEY, false)) setCollapsed(true);
    bindShell();
    bindMenuSelects();
    startStudyTimer();
  }

  // "just now", "8m ago", "3h ago", "2d ago", then a date.
  function relativeTime(iso) {
    if (!iso) return "never";
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }

  // The SkipXam mascot: a round amber face.
  function mascotHtml(size = 56) {
    return `
      <span class="mascot" style="--mascot-size: ${size}px" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="${size}" height="${size}">
          <circle cx="32" cy="32" r="30" class="mascot-face"/>
          <ellipse cx="22" cy="28" rx="4.5" ry="6" class="mascot-eye"/>
          <ellipse cx="42" cy="28" rx="4.5" ry="6" class="mascot-eye"/>
          <circle cx="23.5" cy="26" r="1.6" class="mascot-shine"/>
          <circle cx="43.5" cy="26" r="1.6" class="mascot-shine"/>
          <path d="M22 41c5 5 15 5 20 0" class="mascot-mouth"/>
          <circle cx="15" cy="38" r="3.5" class="mascot-cheek"/>
          <circle cx="49" cy="38" r="3.5" class="mascot-cheek"/>
        </svg>
      </span>`;
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
      <button type="button" data-plan="max" aria-pressed="${plan === "max"}">Max</button>
    `;

    toggle.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-plan]");
      if (!button || button.dataset.plan === plan) return;
      setPlan(button.dataset.plan);
      location.reload();
    });

    document.body.appendChild(toggle);
  }

  // Shows a toast on the next page load (for actions that navigate away).
  function queueToast(message) {
    try { sessionStorage.setItem(FLASH_KEY, message); } catch (err) { /* toast is optional */ }
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

  // ---------------------------------------------------------------------------
  // PDF.js, loaded from cdnjs the first time a page needs it. Resolves to pdfjsLib.
  // ---------------------------------------------------------------------------

  const PDFJS_BASE = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";
  let pdfjsPromise = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${src}`));
      document.head.appendChild(script);
    });
  }

  function loadPdfJs() {
    if (!pdfjsPromise) {
      pdfjsPromise = loadScript(`${PDFJS_BASE}/pdf.min.js`).then(() => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.js`;
        return window.pdfjsLib;
      });
      pdfjsPromise.catch(() => { pdfjsPromise = null; }); // allow a retry
    }
    return pdfjsPromise;
  }

  Object.assign(window, {
    openCreateSet, openUpgrade, openModal, confirmDialog, proGate, showToast,
    openMaterials, openShare, openSearch, menuSelectHtml, fileBadgeHtml, fileKindLabel, allMaterials,
    escapeHtml, richText, icon, toolUrl, toolLabel, formatDate, formatCountdown, examLabel, masteryRing,
    relativeTime, mascotHtml, queueToast, orbsHtml, planLabel, PLANS, avatarInnerHtml,
    setFromUrl, topicName, setNotFoundHtml, toolHeaderHtml, emptyStateHtml,
    TOOLS, loadScript, loadPdfJs,
  });
})();
