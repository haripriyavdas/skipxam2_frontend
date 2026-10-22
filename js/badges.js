/*
 * Achievement badges for the profile page. Load after data.js and app.js.
 *
 * Each badge is an SVG emblem: the shape shows its family (hexagon =
 * streaks, shield = quizzes and tests, circle = flashcards, diamond =
 * special), a line icon sits inside, and the ring colour shows the tier
 * (bronze, silver, gold, legend). Locked badges are dark outlines with a
 * small progress ring. Clicking one opens a detail card.
 *
 *   badgesTileHtml()      -> the Badges tile
 *   bindBadges(container) -> wires clicks to the detail card
 */
(function () {
  "use strict";

  const TIERS = {
    bronze: { label: "Bronze" },
    silver: { label: "Silver" },
    gold: { label: "Gold" },
    legend: { label: "Legend" },
  };

  // Outer shapes in a 64×64 box.
  const SHAPES = {
    hexagon: '<polygon points="32,3 57,17.5 57,46.5 32,61 7,46.5 7,17.5"/>',
    shield: '<path d="M32 3 L55 11 V29 C55 44 45 54.5 32 61 C19 54.5 9 44 9 29 V11 Z"/>',
    circle: '<circle cx="32" cy="32" r="28"/>',
    diamond: '<polygon points="32,2 62,32 32,62 2,32"/>',
  };
  const FAMILY_SHAPE = { streak: "hexagon", test: "shield", cards: "circle", special: "diamond" };

  // Line icons drawn in a 24×24 box (stroke only).
  const ICONS = {
    flame: '<path d="M12 3c.6 3 4.5 5 4.5 9.5a4.5 4.5 0 0 1-9 0c0-2 1-3.3 2.2-4.3.1 1.6.9 2.6 2 2.8C11 8.4 10.8 5.6 12 3Z"/>',
    quiz: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6"/><path d="M12 16.6h.01"/>',
    star: '<path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8Z"/>',
    test: '<rect x="5.5" y="4.5" width="13" height="16" rx="1.5"/><path d="M9.5 3.5h5v2.5h-5z"/><path d="m9 13 2 2 4-4"/>',
    cards: '<rect x="3.5" y="7.5" width="12" height="13" rx="1.5"/><path d="M8.5 4.5h10a1.5 1.5 0 0 1 1.5 1.5v11"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
    moon: '<path d="M19.5 14.6A7.8 7.8 0 1 1 9.4 4.5a6.2 6.2 0 0 0 10.1 10.1Z"/><path d="M16.5 4.5v3M15 6h3"/>',
    flag: '<path d="M6 21V4"/><path d="M6 4.5h11l-2.2 4 2.2 4H6"/>',
  };

  // Rarity numbers are mock values for the demo.
  const BADGES = [
    { id: "streak3", family: "streak", tier: "bronze", icon: "flame", mark: "3", name: "3-day streak",
      desc: "Studied 3 days in a row.", need: 3, unit: "days", rarity: 41, next: "Keep a 7-day streak for Silver." },
    { id: "streak7", family: "streak", tier: "silver", icon: "flame", mark: "7", name: "7-day streak",
      desc: "Studied every day for a week.", need: 7, unit: "days", rarity: 23, next: "Keep a 30-day streak for Gold." },
    { id: "streak30", family: "streak", tier: "gold", icon: "flame", mark: "30", name: "30-day streak",
      desc: "Studied every day for a month.", need: 30, unit: "days", rarity: 6, next: "Keep a 100-day streak for Legend." },
    { id: "firstQuiz", family: "test", tier: "bronze", icon: "quiz", name: "First quiz",
      desc: "Finished your first quiz.", need: 1, unit: "quizzes", rarity: 68, next: "Take 25 quizzes for Silver." },
    { id: "perfectQuiz", family: "test", tier: "gold", icon: "star", name: "Perfect quiz",
      desc: "Got every question right in a quiz.", need: 1, unit: "perfect quizzes", rarity: 14, next: "Get 5 perfect quizzes for Legend." },
    { id: "firstTest", family: "test", tier: "silver", icon: "test", name: "First practice test",
      desc: "Finished a timed practice test.", need: 1, unit: "practice tests", rarity: 31, next: "Score 80% or more on a practice test for Gold." },
    { id: "cards100", family: "cards", tier: "bronze", icon: "cards", mark: "100", name: "100 flashcards",
      desc: "Reviewed 100 flashcards.", need: 100, unit: "flashcards", rarity: 37, next: "Review 500 flashcards for Silver." },
    { id: "cards500", family: "cards", tier: "silver", icon: "cards", mark: "500", name: "500 flashcards",
      desc: "Reviewed 500 flashcards.", need: 500, unit: "flashcards", rarity: 12, next: "Review 2,000 flashcards for Gold." },
    { id: "hours10", family: "special", tier: "bronze", icon: "clock", mark: "10h", name: "10 study hours",
      desc: "Spent 10 hours studying on SkipXam.", need: 10, unit: "hours", rarity: 29, next: "Study for 100 hours for Silver." },
    { id: "earlyBird", family: "special", tier: "silver", icon: "sun", name: "Early bird",
      desc: "Studied before 8 AM.", need: 1, unit: "early sessions", rarity: 18, next: "Study before 8 AM on 10 days for Gold." },
    { id: "nightOwl", family: "special", tier: "silver", icon: "moon", name: "Night owl",
      desc: "Studied after 11 PM.", need: 1, unit: "late sessions", rarity: 22, next: "Study after 11 PM on 10 days for Gold." },
    { id: "planDone", family: "special", tier: "legend", icon: "flag", name: "Plan finisher",
      desc: "Covered every topic in a study plan.", need: 1, unit: "topics", rarity: 3, next: "" },
  ];

  // How far the user is towards each badge: { have, need }.
  function progressFor(badge) {
    const stats = getUserStats();
    const { longest } = getStreaks();
    const user = getUser();
    const activities = getActivities();
    const perfect = activities.filter((a) => {
      const m = a.type === "quiz" && a.text.match(/(\d+)\/(\d+)/);
      return m && m[1] === m[2];
    }).length;
    switch (badge.id) {
      case "streak3": case "streak7": case "streak30": return { have: longest, need: badge.need };
      case "firstQuiz": return { have: stats.quizzes, need: 1 };
      case "perfectQuiz": return { have: perfect, need: 1 };
      case "firstTest": return { have: activities.filter((a) => a.type === "test").length, need: 1 };
      case "cards100": case "cards500": return { have: stats.flashcards, need: badge.need };
      case "hours10": return { have: stats.hours, need: 10 };
      case "earlyBird": return { have: user.timeFlags && user.timeFlags.earlyBird ? 1 : 0, need: 1 };
      case "nightOwl": return { have: user.timeFlags && user.timeFlags.nightOwl ? 1 : 0, need: 1 };
      case "planDone": {
        // The set closest to done: covered topics out of its total.
        const best = getSets()
          .filter((s) => s.topics.length)
          .map((s) => ({ have: s.topics.filter((t) => topicStatus(t) === "done").length, need: s.topics.length }))
          .sort((a, b) => b.have / b.need - a.have / a.need)[0];
        return best || { have: 0, need: 1 };
      }
      default: return { have: 0, need: 1 };
    }
  }

  // Every badge with earned date and progress. Newly earned ones get today's date.
  function badgeStates() {
    const withProgress = BADGES.map((b) => ({ ...b, progress: progressFor(b) }));
    const met = withProgress.filter((b) => b.progress.have >= b.progress.need).map((b) => b.id);
    const dates = awardBadges(met);
    return withProgress.map((b) => ({ ...b, earnedOn: dates[b.id] || null }));
  }

  // ---------------------------------------------------------------------------
  // SVG
  // ---------------------------------------------------------------------------

  // Shared gradients, added to the page once.
  function ensureDefs() {
    if (document.getElementById("badge-defs")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <svg id="badge-defs" width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute">
        <defs>
          <linearGradient id="tier-bronze" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0b27a"/><stop offset="1" stop-color="#9c5a2b"/></linearGradient>
          <linearGradient id="tier-silver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset="1" stop-color="#8b95a3"/></linearGradient>
          <linearGradient id="tier-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe390"/><stop offset="1" stop-color="#c38f17"/></linearGradient>
          <linearGradient id="tier-legend" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#e08a38"/><stop offset="0.5" stop-color="#e08a38"/>
            <stop offset="0.5" stop-color="#ea580c"/><stop offset="1" stop-color="#9f1239"/>
          </linearGradient>
          <radialGradient id="face-bronze" cx="0.35" cy="0.3" r="0.9"><stop offset="0" stop-color="#5a3a24"/><stop offset="1" stop-color="#22170f"/></radialGradient>
          <radialGradient id="face-silver" cx="0.35" cy="0.3" r="0.9"><stop offset="0" stop-color="#4a4f57"/><stop offset="1" stop-color="#1b1d21"/></radialGradient>
          <radialGradient id="face-gold" cx="0.35" cy="0.3" r="0.9"><stop offset="0" stop-color="#5f4a17"/><stop offset="1" stop-color="#231b08"/></radialGradient>
          <radialGradient id="face-legend" cx="0.35" cy="0.3" r="0.9"><stop offset="0" stop-color="#6a2f14"/><stop offset="1" stop-color="#2a0f12"/></radialGradient>
        </defs>
      </svg>`);
  }

  function emblemSvg(badge, size) {
    const earned = Boolean(badge.earnedOn);
    const shape = SHAPES[FAMILY_SHAPE[badge.family]];
    const inner = `<g transform="translate(32 32) scale(0.78) translate(-32 -32)">${shape}</g>`;
    const { have, need } = badge.progress;
    const pct = Math.min(1, have / need);
    const ringLen = 2 * Math.PI * 7;
    const iconY = badge.mark ? 15 : 20;

    const body = earned ? `
      <g class="em-ring" fill="url(#face-${badge.tier})" stroke="url(#tier-${badge.tier})" stroke-width="4">${shape}</g>
      <g class="em-inner" fill="none" stroke="url(#tier-${badge.tier})" stroke-width="1" opacity="0.55">${inner}</g>
      <g class="em-icon" transform="translate(${20} ${iconY})" fill="none" stroke="url(#tier-${badge.tier})" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[badge.icon]}</g>
      ${badge.mark ? `<text x="32" y="48" text-anchor="middle" class="em-mark" fill="url(#tier-${badge.tier})">${badge.mark}</text>` : ""}
    ` : `
      <g class="em-ring is-locked" fill="var(--color-surface-raised)" stroke="var(--color-border)" stroke-width="2.5">${shape}</g>
      <g class="em-icon" transform="translate(20 ${iconY})" fill="none" stroke="var(--color-text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.6">${ICONS[badge.icon]}</g>
      ${badge.mark ? `<text x="32" y="48" text-anchor="middle" class="em-mark" fill="var(--color-text-muted)" opacity="0.6">${badge.mark}</text>` : ""}
      <g class="em-progress">
        <circle cx="52" cy="52" r="10" fill="var(--color-surface)"/>
        <circle cx="52" cy="52" r="7" fill="none" stroke="var(--color-border)" stroke-width="3"/>
        <circle cx="52" cy="52" r="7" fill="none" stroke="var(--color-accent)" stroke-width="3" stroke-linecap="round"
          stroke-dasharray="${(ringLen * pct).toFixed(2)} ${ringLen.toFixed(2)}" transform="rotate(-90 52 52)"/>
      </g>`;
    return `<svg class="emblem" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">${body}</svg>`;
  }

  // ---------------------------------------------------------------------------
  // Tile + detail card
  // ---------------------------------------------------------------------------

  let current = [];

  function badgesTileHtml() {
    ensureDefs();
    current = badgeStates();
    const earned = current.filter((b) => b.earnedOn).length;
    return `
      <section class="card tile p-badges" aria-labelledby="badges-title">
        <div class="p-heat-head">
          <h2 class="tile-title" id="badges-title">Badges</h2>
          <span class="muted">${earned} of ${current.length} earned</span>
        </div>
        <ul class="badge-grid">
          ${current.map((b) => `
            <li>
              <button type="button" class="badge-item${b.earnedOn ? "" : " is-locked"}" data-badge="${b.id}" aria-haspopup="dialog"
                aria-label="${b.name}, ${b.earnedOn ? `${TIERS[b.tier].label}, earned` : `locked, ${Math.min(b.progress.have, b.progress.need)} of ${b.progress.need}`}">
                ${emblemSvg(b, 64)}
                <span class="badge-name" aria-hidden="true">${b.name}</span>
              </button>
            </li>`).join("")}
        </ul>
      </section>`;
  }

  let pop = null;

  function closeCard() {
    if (!pop) return;
    const { card, backdrop, trigger } = pop;
    card.remove();
    if (backdrop) backdrop.remove();
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("pointerdown", onPointer, true);
    window.removeEventListener("resize", placeCard);
    pop = null;
    if (trigger && document.contains(trigger)) trigger.focus();
  }

  function onKey(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeCard();
    } else if (event.key === "Tab" && pop) {
      // Keep focus inside the card while it's open.
      const items = [...pop.card.querySelectorAll("button, a[href]")];
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }

  function onPointer(event) {
    if (pop && !pop.card.contains(event.target) && !event.target.closest("[data-badge]")) closeCard();
  }

  function openCard(trigger, badge) {
    closeCard();
    const earned = Boolean(badge.earnedOn);
    const { have, need } = badge.progress;
    const mobile = window.matchMedia("(max-width: 699px)").matches;

    const card = document.createElement("div");
    card.className = `badge-card glass glass-dark${mobile ? " is-centred" : ""}`;
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", "badge-card-title");
    card.innerHTML = `
      <button type="button" class="icon-btn badge-card-close" aria-label="Close">${icon("close")}</button>
      <div class="badge-card-emblem">${emblemSvg(badge, 112)}</div>
      <p class="badge-card-tier tier-${badge.tier}">${TIERS[badge.tier].label}</p>
      <h2 class="badge-card-title" id="badge-card-title">${badge.name}</h2>
      <p class="badge-card-desc muted">${badge.desc}</p>
      <dl class="badge-card-facts">
        <div><dt>${earned ? "Earned" : "Progress"}</dt>
          <dd>${earned ? formatDate(badge.earnedOn) : `${Math.min(have, need).toLocaleString("en-IN")} of ${need.toLocaleString("en-IN")} ${badge.unit}`}</dd></div>
        <div><dt>Rarity</dt><dd>Earned by ${badge.rarity}% of SkipXam students</dd></div>
        <div><dt>Next tier</dt><dd>${badge.next || "This is the top tier."}</dd></div>
      </dl>
      ${earned ? "" : `<div class="progress" role="progressbar" aria-label="Progress to ${badge.name}" aria-valuemin="0" aria-valuemax="${need}" aria-valuenow="${Math.min(have, need)}"><div class="progress-fill" style="width: ${Math.min(100, (have / need) * 100)}%"></div></div>`}`;

    let backdrop = null;
    if (mobile) {
      backdrop = document.createElement("div");
      backdrop.className = "badge-card-backdrop";
      document.body.appendChild(backdrop);
    }
    document.body.appendChild(card);

    card.querySelector(".badge-card-close").addEventListener("click", closeCard);
    pop = { card, backdrop, trigger };
    placeCard();
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("resize", placeCard);
    card.querySelector(".badge-card-close").focus();
  }

  // Desktop: a popover next to the badge, below it if there's room, otherwise
  // above. Mobile: centred by CSS. Runs again when the window resizes.
  function placeCard() {
    if (!pop) return;
    const { card, trigger } = pop;
    if (card.classList.contains("is-centred")) return;
    const r = trigger.getBoundingClientRect();
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const left = Math.min(Math.max(r.left + r.width / 2 - w / 2, 12), window.innerWidth - w - 12);
    const below = r.bottom + 8 + h < window.innerHeight;
    const top = below ? r.bottom + 8 : Math.max(12, r.top - h - 8);
    card.style.left = `${left + window.scrollX}px`;
    card.style.top = `${top + window.scrollY}px`;
  }

  function bindBadges(container) {
    container.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-badge]");
      if (!trigger) return;
      const badge = current.find((b) => b.id === trigger.dataset.badge);
      if (pop && pop.trigger === trigger) return closeCard();
      openCard(trigger, badge);
    });
  }

  Object.assign(window, { badgesTileHtml, bindBadges });
})();
