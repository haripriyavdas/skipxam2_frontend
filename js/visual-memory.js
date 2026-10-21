/*
 * Visual memory (app/visual-memory.html?set=<id>). Pro feature, wrapped in proGate().
 * Tabs: Concept map (SVG, topics expand to subtopics), Diagrams (placeholder
 * images with numbered labels), Mnemonics (a memory trick per topic).
 * Load after data.js and app.js.
 */
(function () {
  "use strict";

  const main = document.querySelector("main");
  const { set } = setFromUrl();

  const TABS = [
    { id: "map", label: "Concept map" },
    { id: "diagrams", label: "Diagrams" },
    { id: "mnemonics", label: "Mnemonics" },
  ];

  const state = { tab: "map", expanded: null };

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------

  // Subtopics are the key terms (**term**) highlighted in the topic's notes.
  function subtopicsFor(topicId) {
    const section = set.notes.find((n) => n.topicId === topicId);
    if (!section) return [];
    const text = [section.intro, ...section.points, section.remember].join(" ");
    const seen = new Set();
    const terms = [];
    for (const [, term] of text.matchAll(/\*\*(.+?)\*\*/g)) {
      const key = term.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        terms.push(term.charAt(0).toUpperCase() + term.slice(1));
      }
    }
    return terms.slice(0, 5);
  }

  const tier = (m) => (m >= 70 ? "strong" : m >= 40 ? "mid" : "weak");

  // ---------------------------------------------------------------------------
  // Concept map (SVG)
  // ---------------------------------------------------------------------------

  const W = 800;
  const H = 520;
  const CX = W / 2;
  const CY = H / 2;

  const pillWidth = (text, min = 96) => Math.max(min, Math.round(text.length * 7.4 + 28));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function topicPositions() {
    const n = set.topics.length;
    return set.topics.map((topic, i) => {
      const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
      return { topic, angle, x: CX + Math.cos(angle) * 270, y: CY + Math.sin(angle) * 175 };
    });
  }

  function pill(x, y, text, cls, attrs = "") {
    const w = pillWidth(text);
    return `
      <g class="${cls}" transform="translate(${x} ${y})" ${attrs}>
        <rect x="${-w / 2}" y="-18" width="${w}" height="36" rx="18"/>
        <text text-anchor="middle" dominant-baseline="central">${escapeHtml(text)}</text>
      </g>`;
  }

  function conceptMapSvg() {
    const positions = topicPositions();
    const expanded = positions.find((p) => p.topic.id === state.expanded);

    const lines = positions.map((p) => `<line class="map-line${expanded && expanded !== p ? " is-dim" : ""}" x1="${CX}" y1="${CY}" x2="${p.x}" y2="${p.y}"/>`).join("");

    let subLines = "";
    let subNodes = "";
    if (expanded) {
      const subs = subtopicsFor(expanded.topic.id);
      subs.forEach((term, i) => {
        const a = expanded.angle + (i - (subs.length - 1) / 2) * 0.5;
        const w = pillWidth(term, 80);
        const x = clamp(expanded.x + Math.cos(a) * 150, w / 2 + 8, W - w / 2 - 8);
        const y = clamp(expanded.y + Math.sin(a) * 110, 26, H - 26);
        subLines += `<line class="map-line is-sub" x1="${expanded.x}" y1="${expanded.y}" x2="${x}" y2="${y}"/>`;
        subNodes += pill(x, y, term, "map-sub");
      });
    }

    const topicNodes = positions.map((p) => {
      const subs = subtopicsFor(p.topic.id).length;
      const isOpen = state.expanded === p.topic.id;
      const cls = `map-node tier-${tier(p.topic.mastery)}${isOpen ? " is-open" : ""}${expanded && !isOpen ? " is-dim" : ""}`;
      const label = `${p.topic.name}, ${p.topic.mastery}% mastery${subs ? `. ${isOpen ? "Hide" : "Show"} ${subs} subtopics` : ""}`;
      return pill(p.x, p.y, p.topic.name, cls,
        `role="button" tabindex="0" data-node="${p.topic.id}" aria-expanded="${isOpen}" aria-label="${escapeHtml(label)}"`);
    }).join("");

    return `
      <svg class="concept-map" viewBox="0 0 ${W} ${H}" role="group" aria-label="Concept map of ${escapeHtml(set.name)}">
        ${lines}${subLines}
        ${pill(CX, CY, set.name, "map-center")}
        ${topicNodes}${subNodes}
      </svg>`;
  }

  function topicDetailHtml() {
    const topic = set.topics.find((t) => t.id === state.expanded);
    if (!topic) {
      return '<p class="muted map-hint">Select a topic to see its subtopics.</p>';
    }
    const subs = subtopicsFor(topic.id);
    const mnemonic = set.mnemonics.find((m) => m.topicId === topic.id);
    return `
      <div class="card map-detail">
        <div class="map-detail-head">
          <h2>${escapeHtml(topic.name)}</h2>
          <span class="map-detail-pct tier-${tier(topic.mastery)}">${topic.mastery}% mastery</span>
        </div>
        ${subs.length ? `<ul class="chips">${subs.map((s) => `<li class="chip">${escapeHtml(s)}</li>`).join("")}</ul>` : ""}
        ${mnemonic ? `<p class="map-detail-trick">${icon("bulb")}<span>${escapeHtml(mnemonic.trick)}</span></p>` : ""}
        <div class="map-detail-links">
          <a class="text-link" href="${toolUrl("notes", set.id, { topic: topic.id })}">Read notes</a>
          <a class="text-link" href="${toolUrl("flashcards", set.id, { topic: topic.id })}">Flashcards</a>
          <a class="text-link" href="${toolUrl("quiz", set.id, { topic: topic.id })}">Quiz</a>
        </div>
      </div>`;
  }

  function mapPanelHtml() {
    if (set.topics.length === 0) return emptyStateHtml({ title: "No concept map yet", text: "The concept map appears once your notes are processed." });
    return `
      <div class="map-scroll">${conceptMapSvg()}</div>
      <ul class="map-legend">
        <li><span class="legend-dot tier-strong"></span>Strong</li>
        <li><span class="legend-dot tier-mid"></span>Getting there</li>
        <li><span class="legend-dot tier-weak"></span>Weak</li>
      </ul>
      <div class="map-detail-wrap" aria-live="polite">${topicDetailHtml()}</div>`;
  }

  // ---------------------------------------------------------------------------
  // Diagrams (placeholder images)
  // ---------------------------------------------------------------------------

  function placeholderSvg(labels) {
    // Numbered pins spread around an ellipse, standing in for a real diagram image.
    const pins = labels.map((_, i) => {
      const a = -Math.PI / 2 + (i / labels.length) * Math.PI * 2;
      const x = 160 + Math.cos(a) * 105;
      const y = 95 + Math.sin(a) * 58;
      return `<g class="pin" transform="translate(${x} ${y})"><circle r="12"/><text text-anchor="middle" dominant-baseline="central">${i + 1}</text></g>`;
    }).join("");
    return `
      <svg class="diagram-img" viewBox="0 0 320 190" role="img" aria-label="Placeholder diagram with ${labels.length} labelled parts">
        <defs>
          <pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M16 0H0V16" fill="none" class="grid-line"/>
          </pattern>
        </defs>
        <rect width="320" height="190" fill="url(#grid)"/>
        <ellipse class="diagram-shape" cx="160" cy="95" rx="105" ry="58"/>
        ${pins}
      </svg>`;
  }

  function diagramsPanelHtml() {
    if (set.diagrams.length === 0) return emptyStateHtml({ title: "No diagrams yet", text: "Diagrams appear once your notes are processed." });
    return `
      <ul class="diagram-grid">
        ${set.diagrams.map((d) => `
          <li class="card diagram-card">
            <figure>
              <div class="diagram-frame">
                ${placeholderSvg(d.labels)}
                <span class="diagram-badge">Placeholder image</span>
              </div>
              <figcaption>
                <span class="diagram-topic">${escapeHtml(topicName(set, d.topicId))}</span>
                <h2>${escapeHtml(d.title)}</h2>
                <ol class="diagram-labels">${d.labels.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ol>
              </figcaption>
            </figure>
          </li>`).join("")}
      </ul>`;
  }

  // ---------------------------------------------------------------------------
  // Mnemonics
  // ---------------------------------------------------------------------------

  function mnemonicsPanelHtml() {
    if (set.mnemonics.length === 0) return emptyStateHtml({ title: "No memory tricks yet", text: "Memory tricks appear once your notes are processed." });
    return `
      <ul class="mnemonic-grid">
        ${set.mnemonics.map((m) => `
          <li class="card mnemonic-card">
            <div class="mnemonic-head">
              <span class="mnemonic-icon">${icon("bulb")}</span>
              <span class="diagram-topic">${escapeHtml(topicName(set, m.topicId))}</span>
            </div>
            <h2>${escapeHtml(m.title)}</h2>
            <blockquote>${escapeHtml(m.trick)}</blockquote>
            <p class="muted">${richText(m.explain)}</p>
            <a class="text-link" href="${toolUrl("flashcards", set.id, { topic: m.topicId })}">Practise with flashcards</a>
          </li>`).join("")}
      </ul>`;
  }

  // ---------------------------------------------------------------------------
  // Render + events
  // ---------------------------------------------------------------------------

  function panelHtml(id) {
    if (id === "map") return mapPanelHtml();
    if (id === "diagrams") return diagramsPanelHtml();
    return mnemonicsPanelHtml();
  }

  function render() {
    if (!set) {
      main.innerHTML = setNotFoundHtml();
      return;
    }
    document.title = `Visual memory · ${set.name} · SkipXam`;
    const proBadge = getUser().plan === "free" ? ' <span class="badge badge-pro">Pro</span>' : "";

    main.innerHTML = `
      ${toolHeaderHtml(set, `Visual memory${proBadge}`)}
      <div class="vm-body">
        <div class="vm-tabs" role="tablist" aria-label="Visual memory views">
          ${TABS.map((t) => `
            <button type="button" role="tab" id="tab-${t.id}" aria-controls="panel-${t.id}"
              aria-selected="${state.tab === t.id}" tabindex="${state.tab === t.id ? 0 : -1}" data-tab="${t.id}">${t.label}</button>`).join("")}
        </div>
        <div class="vm-panels">
          ${TABS.map((t) => `
            <section role="tabpanel" id="panel-${t.id}" aria-labelledby="tab-${t.id}" class="vm-panel"${state.tab === t.id ? "" : " hidden"}>
              ${state.tab === t.id ? panelHtml(t.id) : ""}
            </section>`).join("")}
        </div>
      </div>`;
    proGate(main.querySelector(".vm-body"), "Visual memory");
  }

  function renderPanel() {
    const panel = main.querySelector(`#panel-${state.tab}`);
    panel.innerHTML = panelHtml(state.tab);
  }

  function selectTab(id, focus) {
    state.tab = id;
    main.querySelectorAll("[role='tab']").forEach((tab) => {
      const on = tab.dataset.tab === id;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on && focus) tab.focus();
    });
    main.querySelectorAll("[role='tabpanel']").forEach((p) => { p.hidden = p.id !== `panel-${id}`; });
    renderPanel();
  }

  function toggleNode(topicId) {
    state.expanded = state.expanded === topicId ? null : topicId;
    renderPanel();
    const node = main.querySelector(`[data-node="${topicId}"]`);
    if (node) node.focus();
  }

  main.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-tab]");
    if (tab) return selectTab(tab.dataset.tab, false);
    const node = event.target.closest("[data-node]");
    if (node) toggleNode(node.dataset.node);
  });

  main.addEventListener("keydown", (event) => {
    const node = event.target.closest("[data-node]");
    if (node && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      toggleNode(node.dataset.node);
      return;
    }
    const tab = event.target.closest("[role='tab']");
    if (tab && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
      const i = TABS.findIndex((t) => t.id === tab.dataset.tab);
      const next = TABS[(i + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
      selectTab(next.id, true);
    }
  });

  render();
})();
