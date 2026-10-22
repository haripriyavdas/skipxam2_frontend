/*
 * Visual memory (app/visual-memory.html?set=<id>[&topic=<id>][&tab=<id>]).
 * Pro feature, wrapped in proGate(); the Memory palace tab needs Max.
 *
 * Every visual is drawn on the page from a small spec in data.js
 * (set.visuals, see visuals() there), never from a stored image:
 *   concept     JSON nodes + edges → interactive SVG (expand, pan, zoom)
 *   flowchart, hierarchy, timeline   Mermaid text → Mermaid.js (CDN)
 *   comparison  JSON rows → table, or a Venn diagram (SVG)
 *   graph       JSON x/y series → SVG line chart
 *   formula     TeX with @0, @1… symbols → KaTeX (CDN), symbols colour-coded
 *   figure      placeholder image from assets/ + numbered hotspots
 *   mnemonic    acronym card, one Lucide icon (CDN) per letter
 *   palace      placeholder image per topic + a story (Max)
 *
 * Shared toolbar on each visual: topic selector, source star (opens the PDF
 * page), Blank labels, Download (PNG or SVG). In Blank labels every element
 * marked data-label is hidden and a blank chip sits on top; clicking it opens
 * a small form that checks the typed answer.
 *
 * Load after data.js and app.js.
 */
(function () {
  "use strict";

  const main = document.querySelector("main");
  const { set, topic: startTopic } = setFromUrl();
  const SVG_NS = "http://www.w3.org/2000/svg";

  const LIBS = {
    mermaid: "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js",
    katex: "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js",
    katexCss: "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css",
    lucide: "https://cdn.jsdelivr.net/npm/lucide@0.460.0/dist/umd/lucide.min.js",
  };
  const PDF_URL = "../assets/sample.pdf"; // the Java set's source PDF (pages match set.visuals[].page)

  const TABS = [
    { id: "concept", label: "Concept map" },
    { id: "flowchart", label: "Flowchart" },
    { id: "hierarchy", label: "Hierarchy" },
    { id: "comparison", label: "Comparison" },
    { id: "timeline", label: "Timeline" },
    { id: "graph", label: "Graph" },
    { id: "formula", label: "Formula" },
    { id: "figure", label: "From your PDF" },
    { id: "mnemonic", label: "Mnemonics" },
    { id: "palace", label: "Memory palace", max: true },
  ];

  // Symbol and series colours: readable on both themes' surfaces.
  const PALETTE = ["#e08a38", "#3FB8AF", "#A78BFA", "#4FA3D9", "#E07A9B", "#6FBF73"];

  const params = new URLSearchParams(location.search);
  const state = {
    tab: TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "concept",
    pick: {},            // { [tab]: visual id }
    blank: false,        // Blank labels on (shared by every tab)
    answers: new Map(),  // blank key → "right" | "revealed"
    wrong: new Set(),    // blank keys with a wrong attempt
    compare: "table",    // comparison view: table | venn
    map: null,           // concept map view: { expanded: Set, tx, ty, scale, moved }
    renderId: 0,         // drops async renders that finished after the user moved on
  };

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------

  const allVisuals = () => set.visuals || [];

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
    return terms.slice(0, 4);
  }

  // Any set gets a whole-set concept map: set → topics → key terms from the notes.
  function wholeSetVisual() {
    const nodes = [{ id: "root", label: set.name }];
    const edges = [];
    set.topics.forEach((t) => {
      nodes.push({ id: t.id, label: t.name });
      edges.push({ from: "root", to: t.id, label: "topic" });
      subtopicsFor(t.id).forEach((term, i) => {
        nodes.push({ id: `${t.id}-k${i}`, label: term });
        edges.push({ from: t.id, to: `${t.id}-k${i}`, label: "" });
      });
    });
    return { id: `${set.id}-whole`, type: "concept", topicId: null, title: `${set.name}: all topics`, spec: { nodes, edges } };
  }

  function visualsFor(tab) {
    const list = allVisuals().filter((v) => v.type === tab);
    if (tab === "concept" && set.topics.length) list.unshift(wholeSetVisual());
    return list;
  }

  function currentVisual(tab = state.tab) {
    const list = visualsFor(tab);
    if (!list.length) return null;
    let pick = list.find((v) => v.id === state.pick[tab]);
    if (!pick && startTopic) pick = list.find((v) => v.topicId === startTopic.id);
    pick = pick || list[0];
    state.pick[tab] = pick.id;
    return pick;
  }

  // "Collections Framework", or "Collections Framework: Which bucket…" when a topic has several.
  function optionLabel(v, list) {
    if (!v.topicId) return "All topics";
    const name = topicName(set, v.topicId);
    return list.filter((x) => x.topicId === v.topicId).length > 1 ? `${name}: ${v.title}` : name;
  }

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------

  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const isLight = () => document.documentElement.dataset.theme === "light";
  const fmt = (n) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const measureCtx = document.createElement("canvas").getContext("2d");
  function textWidth(text, size, weight = 600) {
    measureCtx.font = `${weight} ${size}px ${getComputedStyle(document.body).fontFamily}`;
    return measureCtx.measureText(text).width;
  }

  const libPromises = {};
  function loadLib(name) {
    if (!libPromises[name]) {
      libPromises[name] = loadScript(LIBS[name]).catch((err) => {
        delete libPromises[name]; // let a later visit retry
        throw err;
      });
    }
    return libPromises[name];
  }

  function loadKatex() {
    if (!document.querySelector("link[data-katex]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LIBS.katexCss;
      link.dataset.katex = "";
      document.head.appendChild(link);
    }
    return loadLib("katex");
  }

  function libErrorHtml(what, source) {
    return `
      <div class="vis-offline">
        <p><strong>Couldn't load ${what}.</strong> Check your internet connection and open this tab again.</p>
        ${source ? `<pre class="vis-spec">${escapeHtml(source)}</pre>` : ""}
      </div>`;
  }

  // ---------------------------------------------------------------------------
  // Concept map: SVG built from nodes + edges
  // ---------------------------------------------------------------------------

  const RADII = [0, 180, 345, 480];
  const NODE_H = 36;

  // Radial tree: each node gets an angle span in proportion to its leaves.
  function conceptLayout(spec) {
    const nodes = new Map(spec.nodes.map((n) => [n.id, { ...n, children: [] }]));
    const hasParent = new Set();
    for (const e of spec.edges) {
      if (e.cross || !nodes.has(e.from) || !nodes.has(e.to) || hasParent.has(e.to)) continue;
      nodes.get(e.from).children.push(e.to);
      hasParent.add(e.to);
    }
    const root = spec.nodes.find((n) => !hasParent.has(n.id)).id;
    const leaves = (id) => {
      const n = nodes.get(id);
      return n.children.length ? n.children.reduce((sum, c) => sum + leaves(c), 0) : 1;
    };
    const place = (id, depth, a0, a1, parent) => {
      const n = nodes.get(id);
      const a = (a0 + a1) / 2;
      const r = RADII[Math.min(depth, RADII.length - 1)] + Math.max(0, depth - 3) * 120;
      Object.assign(n, { depth, parent, x: Math.cos(a) * r, y: Math.sin(a) * r * 0.62 });
      n.w = Math.ceil(textWidth(n.label, depth ? 14 : 16, depth ? 600 : 800)) + (n.children.length && depth ? 46 : 30);
      const total = leaves(id);
      let start = a0;
      for (const c of n.children) {
        const span = ((a1 - a0) * leaves(c)) / total;
        place(c, depth + 1, start, start + span, id);
        start += span;
      }
    };
    place(root, 0, -Math.PI * 0.75, Math.PI * 1.25, null);
    return { nodes, root };
  }

  function visibleNodes(layout) {
    const out = [];
    const walk = (id) => {
      out.push(id);
      if (id === layout.root || state.map.expanded.has(id)) layout.nodes.get(id).children.forEach(walk);
    };
    walk(layout.root);
    return out;
  }

  function conceptSvg(visual, size) {
    const layout = conceptLayout(visual.spec);
    const shown = new Set(visibleNodes(layout));
    const m = state.map;
    const edgeLabel = (x, y, text) => (text ? `<text class="cm-edge-label" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central">${escapeHtml(text)}</text>` : "");

    let edges = "";
    let labels = "";
    for (const e of visual.spec.edges) {
      if (!shown.has(e.from) || !shown.has(e.to)) continue;
      const a = layout.nodes.get(e.from);
      const b = layout.nodes.get(e.to);
      if (e.cross) {
        const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.25;
        const my = (a.y + b.y) / 2 - (b.x - a.x) * 0.25;
        edges += `<path class="cm-edge is-cross" d="M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}"/>`;
        labels += edgeLabel((a.x + 2 * mx + b.x) / 4, (a.y + 2 * my + b.y) / 4, e.label);
      } else {
        edges += `<line class="cm-edge" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
        labels += edgeLabel((a.x + b.x) / 2, (a.y + b.y) / 2, e.label);
      }
    }

    const nodes = [...shown].map((id) => {
      const n = layout.nodes.get(id);
      const isRoot = id === layout.root;
      const open = m.expanded.has(id);
      const kids = n.children.length;
      const toggle = kids && !isRoot;
      const label = toggle ? `${n.label}. ${open ? "Collapse" : "Expand"}, ${kids} linked ${kids === 1 ? "idea" : "ideas"}` : n.label;
      return `
        <g class="cm-node depth-${Math.min(n.depth, 3)}${isRoot ? " is-root" : ""}${open ? " is-open" : ""}" transform="translate(${n.x} ${n.y})"
          ${toggle ? `data-node="${id}" role="button" tabindex="0" aria-expanded="${open}" aria-label="${escapeHtml(label)}"` : ""}>
          <rect x="${-n.w / 2}" y="${-NODE_H / 2}" width="${n.w}" height="${NODE_H}" rx="${NODE_H / 2}"/>
          <text x="${toggle ? -9 : 0}" text-anchor="middle" dominant-baseline="central"${isRoot ? "" : ` data-label data-label-key="${id}"`}>${escapeHtml(n.label)}</text>
          ${toggle ? `<g class="cm-toggle" transform="translate(${n.w / 2 - 17} 0)" aria-hidden="true"><circle r="9"/><path d="M-4 0h8${open ? "" : "M0 -4v8"}"/></g>` : ""}
        </g>`;
    }).join("");

    // First draw, or nodes added/removed without the user moving the view: fit what's shown.
    if (!m.moved || m.tx === undefined) fitMap(layout, shown, size);

    return {
      layout,
      html: `
        <svg class="cm-svg" viewBox="0 0 ${size.w} ${size.h}" width="${size.w}" height="${size.h}" role="group" tabindex="0" aria-label="Concept map: ${escapeHtml(visual.title)}. Arrow keys pan, plus and minus zoom.">
          <g data-viewport transform="translate(${m.tx} ${m.ty}) scale(${m.scale})">${edges}${labels}${nodes}</g>
        </svg>`,
    };
  }

  function fitMap(layout, shown, size) {
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (const id of shown) {
      const n = layout.nodes.get(id);
      x0 = Math.min(x0, n.x - n.w / 2); x1 = Math.max(x1, n.x + n.w / 2);
      y0 = Math.min(y0, n.y - NODE_H / 2); y1 = Math.max(y1, n.y + NODE_H / 2);
    }
    const pad = 28;
    // On phones keep labels readable (at least 70%) and let the student pan to the rest.
    const fit = Math.min((size.w - pad * 2) / (x1 - x0), (size.h - pad * 2) / (y1 - y0), 1.15);
    const scale = size.w < 600 ? Math.max(fit, 0.7) : fit;
    Object.assign(state.map, { scale, tx: size.w / 2 - ((x0 + x1) / 2) * scale, ty: size.h / 2 - ((y0 + y1) / 2) * scale });
  }

  function mapSize(stage) {
    const w = Math.max(280, Math.round(stage.clientWidth));
    return { w, h: w < 600 ? 440 : 520 };
  }

  function renderConcept(stage, visual) {
    if (!state.map || state.map.visualId !== visual.id) {
      state.map = { visualId: visual.id, expanded: new Set(), moved: false };
    }
    const canvas = stage.querySelector("[data-map]") || stage;
    const size = mapSize(stage);
    canvas.innerHTML = conceptSvg(visual, size).html;
  }

  function applyMapTransform() {
    const g = main.querySelector("[data-viewport]");
    if (g) g.setAttribute("transform", `translate(${state.map.tx} ${state.map.ty}) scale(${state.map.scale})`);
    scheduleBlanks();
  }

  // Zoom by `factor` around (px, py) in SVG pixels.
  function zoomMap(factor, px, py) {
    const m = state.map;
    const next = clamp(m.scale * factor, 0.3, 3);
    m.tx = px - (px - m.tx) * (next / m.scale);
    m.ty = py - (py - m.ty) * (next / m.scale);
    m.scale = next;
    m.moved = true;
    applyMapTransform();
  }

  function toggleNode(id) {
    const m = state.map;
    if (m.expanded.has(id)) {
      // Collapse the node and everything under it.
      const visual = currentVisual();
      const layout = conceptLayout(visual.spec);
      const drop = (x) => { m.expanded.delete(x); layout.nodes.get(x).children.forEach(drop); };
      drop(id);
    } else {
      m.expanded.add(id);
    }
    m.moved = false; // refit so the new branch is on screen
    redrawStage();
    const node = main.querySelector(`[data-node="${id}"]`);
    if (node) node.focus();
  }

  // Pointer: drag to pan, two fingers to pinch, a tap on a node toggles it.
  const pointers = new Map();
  let drag = null;

  function svgPoint(svg, event) {
    const r = svg.getBoundingClientRect();
    const k = svg.viewBox.baseVal.width / r.width;
    return { x: (event.clientX - r.left) * k, y: (event.clientY - r.top) * k, k };
  }

  main.addEventListener("pointerdown", (event) => {
    const svg = event.target.closest(".cm-svg");
    if (!svg || (event.pointerType === "mouse" && event.button !== 0)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { svg.setPointerCapture(event.pointerId); } catch (err) { /* not a live pointer */ }
    const node = event.target.closest("[data-node]");
    drag = { svg, node: node && node.dataset.node, x: event.clientX, y: event.clientY, moved: false, pinch: null };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      drag.pinch = Math.hypot(a.x - b.x, a.y - b.y);
      drag.node = null;
    }
  });

  main.addEventListener("pointermove", (event) => {
    if (!drag || !pointers.has(event.pointerId)) return;
    const prev = pointers.get(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const k = svgPoint(drag.svg, event).k;
    if (pointers.size === 2 && drag.pinch) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = svgPoint(drag.svg, { clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
      zoomMap(dist / drag.pinch, mid.x, mid.y);
      drag.pinch = dist;
      drag.moved = true;
      return;
    }
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
    drag.moved = true;
    drag.svg.classList.add("is-panning");
    state.map.tx += (event.clientX - prev.x) * k;
    state.map.ty += (event.clientY - prev.y) * k;
    state.map.moved = true;
    applyMapTransform();
  });

  function endPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (!drag || pointers.size) return;
    drag.svg.classList.remove("is-panning");
    const tapped = !drag.moved && drag.node;
    drag = null;
    if (tapped && event.type === "pointerup") toggleNode(tapped);
  }
  main.addEventListener("pointerup", endPointer);
  main.addEventListener("pointercancel", endPointer);

  // Ctrl + wheel (and trackpad pinch, which sends ctrl + wheel) zooms; plain wheel scrolls the page.
  main.addEventListener("wheel", (event) => {
    const svg = event.target.closest(".cm-svg");
    if (!svg || !(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    const p = svgPoint(svg, event);
    zoomMap(Math.exp(-event.deltaY * 0.0025), p.x, p.y);
  }, { passive: false });

  // ---------------------------------------------------------------------------
  // Mermaid: flowchart, hierarchy, timeline
  // ---------------------------------------------------------------------------

  let mermaidSeq = 0;

  function mermaidConfig() {
    const light = isLight();
    const c = {
      bg: cssVar("--color-surface"), raised: cssVar("--color-surface-raised"), border: cssVar("--color-border"),
      text: cssVar("--color-text"), muted: cssVar("--color-text-muted"), accent: cssVar("--color-accent"),
    };
    // Timeline sections: warm and cool tints that keep text readable.
    const scales = light
      ? ["#fbe3cb", "#d6efec", "#e7defc", "#dbeaf7", "#f8dde6", "#e0f0e1"]
      : ["#4a3320", "#23403d", "#3a3352", "#263b4f", "#4a2d38", "#2d4430"];
    const vars = {
      darkMode: !light, background: c.bg, fontFamily: getComputedStyle(document.body).fontFamily, fontSize: "15px",
      primaryColor: c.raised, primaryTextColor: c.text, primaryBorderColor: c.accent,
      secondaryColor: c.raised, tertiaryColor: c.bg, lineColor: c.muted, textColor: c.text,
      mainBkg: c.raised, nodeBorder: c.accent, clusterBkg: c.bg, edgeLabelBackground: c.bg, titleColor: c.text,
    };
    scales.forEach((s, i) => {
      vars[`cScale${i}`] = s;
      vars[`cScale${i + 6}`] = s;
      vars[`cScaleLabel${i}`] = c.text;
      vars[`cScaleLabel${i + 6}`] = c.text;
    });
    return {
      startOnLoad: false, securityLevel: "strict", theme: "base", htmlLabels: false,
      flowchart: { htmlLabels: false, curve: "basis", useMaxWidth: false, padding: 14, nodeSpacing: 36, rankSpacing: 44 },
      timeline: { useMaxWidth: false, disableMulticolor: false },
      themeVariables: vars,
    };
  }

  async function renderMermaid(stage, visual, renderId) {
    const box = stage.querySelector("[data-mermaid]");
    try {
      await loadLib("mermaid");
      window.mermaid.initialize(mermaidConfig());
      const { svg } = await window.mermaid.render(`vm-mmd-${++mermaidSeq}`, visual.mermaid);
      if (renderId !== state.renderId) return;
      box.innerHTML = svg;
    } catch (err) {
      console.warn("Visual memory: Mermaid failed", err);
      if (renderId === state.renderId) box.innerHTML = libErrorHtml("the diagram library (Mermaid)", visual.mermaid);
      return;
    }
    const el = box.querySelector("svg");
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", visual.title);
    el.removeAttribute("style");
    sizeMermaid(box);
    markMermaidLabels(el, visual.type);
    scheduleBlanks();
  }

  // Fit the diagram to the width and at most 600px tall, but never below 80%
  // of its natural size: then it scrolls sideways instead (phones).
  function sizeMermaid(box) {
    const el = box.querySelector("svg");
    if (!el) return;
    const vb = el.viewBox.baseVal;
    let scale = Math.min(1, 600 / vb.height);
    const fit = box.clientWidth / vb.width;
    if (fit < scale) scale = Math.max(fit, Math.min(scale, 0.8));
    el.setAttribute("width", Math.round(vb.width * scale));
    el.setAttribute("height", Math.round(vb.height * scale));
    box.classList.toggle("is-wide", vb.width * scale > box.clientWidth + 1);
  }

  // Node labels become blanks. Edge labels (Yes/No, start…) and years stay as cues.
  function markMermaidLabels(svg, type) {
    const texts = type === "timeline" ? svg.querySelectorAll("text") : svg.querySelectorAll(".node text, g.label text");
    let i = 0;
    texts.forEach((text) => {
      if (text.closest(".edgeLabel") || text.parentElement.closest("text")) return;
      const words = [...text.querySelectorAll("tspan")].filter((t) => !t.querySelector("tspan")).map((t) => t.textContent.trim());
      const answer = (words.length ? words.join(" ") : text.textContent).replace(/\s+/g, " ").trim();
      if (!answer || /^\d{4}$/.test(answer)) return;
      text.setAttribute("data-label", "");
      text.dataset.labelKey = `m${i++}`;
      text.dataset.answer = answer;
    });
  }

  // ---------------------------------------------------------------------------
  // Comparison: table or Venn
  // ---------------------------------------------------------------------------

  function comparisonTableHtml(spec) {
    return `
      <div class="cmp-scroll">
        <table class="cmp-table">
          <thead><tr><td></td><th scope="col">${escapeHtml(spec.left)}</th><th scope="col">${escapeHtml(spec.right)}</th></tr></thead>
          <tbody>
            ${spec.rows.map((r, i) => `
              <tr>
                <th scope="row">${escapeHtml(r.aspect)}</th>
                <td><span data-label data-label-key="t${i}l">${escapeHtml(r.left)}</span></td>
                <td><span data-label data-label-key="t${i}r">${escapeHtml(r.right)}</span></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  // Two overlapping circles sized to the stage; stacked top/bottom when narrow.
  function vennSvg(spec, width) {
    const narrow = width < 560;
    const w = narrow ? Math.max(300, width) : Math.min(width, 860);
    const r = narrow ? Math.min(w / 2 - 14, 150) : 190;
    const h = narrow ? 600 : 430;
    const [c1, c2] = narrow
      ? [{ x: w / 2, y: 205 }, { x: w / 2, y: 395 }]
      : [{ x: w / 2 - 105, y: 225 }, { x: w / 2 + 105, y: 225 }];
    const regions = narrow
      ? [{ items: spec.venn.left, x: w / 2, y: 140 }, { items: spec.venn.both, x: w / 2, y: 300 }, { items: spec.venn.right, x: w / 2, y: 460 }]
      : [{ items: spec.venn.left, x: c1.x - 75, y: 225 }, { items: spec.venn.both, x: w / 2, y: 225 }, { items: spec.venn.right, x: c2.x + 75, y: 225 }];
    const gap = narrow ? 25 : 30;
    const items = regions.map((reg, ri) => reg.items.map((text, i) => {
      const y = reg.y + (i - (reg.items.length - 1) / 2) * gap;
      return `<text class="venn-item" x="${reg.x}" y="${y}" text-anchor="middle" dominant-baseline="central" data-label data-label-key="v${ri}-${i}">${escapeHtml(text)}</text>`;
    }).join("")).join("");
    const titles = narrow
      ? `<text class="venn-title" x="${w / 2}" y="22" text-anchor="middle">${escapeHtml(spec.left)}</text>
         <text class="venn-title" x="${w / 2}" y="${h - 10}" text-anchor="middle">${escapeHtml(spec.right)}</text>`
      : `<text class="venn-title" x="${c1.x - 60}" y="22" text-anchor="middle">${escapeHtml(spec.left)}</text>
         <text class="venn-title" x="${c2.x + 60}" y="22" text-anchor="middle">${escapeHtml(spec.right)}</text>
         <text class="venn-both" x="${w / 2}" y="${h - 8}" text-anchor="middle">Both</text>`;
    return `
      <svg class="venn-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Venn diagram: ${escapeHtml(spec.left)} and ${escapeHtml(spec.right)}">
        <circle class="venn-a" cx="${c1.x}" cy="${c1.y}" r="${r}"/>
        <circle class="venn-b" cx="${c2.x}" cy="${c2.y}" r="${r}"/>
        ${titles}${narrow ? `<text class="venn-both" x="${w - 8}" y="300" text-anchor="end" dominant-baseline="central">Both</text>` : ""}
        ${items}
      </svg>`;
  }

  // ---------------------------------------------------------------------------
  // Graph: SVG line chart sized to the stage
  // ---------------------------------------------------------------------------

  function niceStep(range, count) {
    const raw = range / count;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const f = raw / mag;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
  }

  function graphSvg(spec, width) {
    const w = clamp(width, 300, 900);
    const h = Math.round(clamp(w * 0.58, 260, 440));
    const narrow = w < 520;
    const pad = { l: narrow ? 52 : 68, r: narrow ? 92 : 128, t: 18, b: narrow ? 52 : 58 };
    const all = spec.series.flatMap((s) => s.points);
    const log = spec.xScale === "log2";
    const xs = all.map((p) => (log ? Math.log2(p[0]) : p[0]));
    const xMin = log ? Math.min(...xs) : 0;
    const xMax = Math.max(...xs);
    const yStep = niceStep(Math.max(...all.map((p) => p[1])), 5);
    const yMax = Math.ceil(Math.max(...all.map((p) => p[1])) / yStep) * yStep;
    const X = (v) => pad.l + (((log ? Math.log2(v) : v) - xMin) / (xMax - xMin)) * (w - pad.l - pad.r);
    const Y = (v) => h - pad.b - (v / yMax) * (h - pad.t - pad.b);
    const xTicks = log
      ? [...new Set(all.map((p) => p[0]))].sort((a, b) => a - b)
      : Array.from({ length: Math.floor(xMax / niceStep(xMax, narrow ? 3 : 5)) + 1 }, (_, i) => i * niceStep(xMax, narrow ? 3 : 5));
    const yTicks = Array.from({ length: Math.round(yMax / yStep) + 1 }, (_, i) => i * yStep);

    const grid = yTicks.map((t) => `
      <line class="g-grid" x1="${pad.l}" x2="${w - pad.r}" y1="${Y(t)}" y2="${Y(t)}"/>
      <text class="g-tick" x="${pad.l - 8}" y="${Y(t)}" text-anchor="end" dominant-baseline="central">${fmt(t)}</text>`).join("")
      + xTicks.map((t) => `<text class="g-tick" x="${X(t)}" y="${h - pad.b + 18}" text-anchor="middle">${t >= 10000 ? `${fmt(t / 1000)}k` : fmt(t)}</text>`).join("");

    // End labels, nudged apart so they don't overlap.
    const ends = spec.series.map((s, i) => ({ i, y: Y(s.points[s.points.length - 1][1]) })).sort((a, b) => a.y - b.y);
    for (let k = 1; k < ends.length; k++) ends[k].y = Math.max(ends[k].y, ends[k - 1].y + 18);

    const lines = spec.series.map((s, i) => {
      const colour = PALETTE[i % PALETTE.length];
      const d = s.points.map((p, k) => `${k ? "L" : "M"}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join(" ");
      const last = s.points[s.points.length - 1];
      const endY = ends.find((e) => e.i === i).y;
      return `
        <path class="g-line" d="${d}" style="stroke: ${colour}"/>
        ${s.points.map((p) => `<circle class="g-dot" cx="${X(p[0])}" cy="${Y(p[1])}" r="4" style="fill: ${colour}"><title>${escapeHtml(s.name)}: ${fmt(p[0])}, ${fmt(p[1])}</title></circle>`).join("")}
        <text class="g-series" x="${X(last[0]) + 10}" y="${endY}" dominant-baseline="central" style="fill: ${colour}" data-label data-label-key="s${i}">${escapeHtml(s.name)}</text>`;
    }).join("");

    return `
      <svg class="graph-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Line chart: ${escapeHtml(spec.yLabel)} against ${escapeHtml(spec.xLabel)}">
        ${grid}
        <line class="g-axis" x1="${pad.l}" x2="${w - pad.r}" y1="${h - pad.b}" y2="${h - pad.b}"/>
        <line class="g-axis" x1="${pad.l}" x2="${pad.l}" y1="${pad.t}" y2="${h - pad.b}"/>
        ${lines}
        <text class="g-axis-label" x="${(pad.l + w - pad.r) / 2}" y="${h - 10}" text-anchor="middle" data-label data-label-key="x">${escapeHtml(spec.xLabel)}</text>
        <text class="g-axis-label" transform="translate(16 ${(pad.t + h - pad.b) / 2}) rotate(-90)" text-anchor="middle" data-label data-label-key="y">${escapeHtml(spec.yLabel)}</text>
      </svg>`;
  }

  // ---------------------------------------------------------------------------
  // Formula: KaTeX, one colour per symbol
  // ---------------------------------------------------------------------------

  function formulaTex(spec) {
    return spec.tex.replace(/@(\d+)/g, (all, n) => {
      const sym = spec.symbols[Number(n)];
      return sym ? `{\\textcolor{${PALETTE[Number(n) % PALETTE.length]}}{${sym.tex}}}` : all;
    });
  }

  async function renderFormula(stage, visual, renderId) {
    const box = stage.querySelector("[data-formula]");
    try {
      await loadKatex();
      if (renderId !== state.renderId) return;
      window.katex.render(formulaTex(visual.spec), box, { displayMode: true, throwOnError: false });
      stage.querySelectorAll("[data-sym]").forEach((el) => {
        window.katex.render(visual.spec.symbols[Number(el.dataset.sym)].tex, el, { throwOnError: false });
      });
    } catch (err) {
      console.warn("Visual memory: KaTeX failed", err);
      if (renderId === state.renderId) box.innerHTML = libErrorHtml("the maths renderer (KaTeX)", visual.spec.tex);
    }
    if (document.fonts) document.fonts.ready.then(scheduleBlanks);
    scheduleBlanks();
  }

  // ---------------------------------------------------------------------------
  // Mnemonics: Lucide icons
  // ---------------------------------------------------------------------------

  async function renderIcons(stage, renderId) {
    try {
      await loadLib("lucide");
      if (renderId !== state.renderId) return;
      window.lucide.createIcons({ attrs: { "aria-hidden": "true", "stroke-width": 2 } });
    } catch (err) {
      console.warn("Visual memory: Lucide failed", err); // the letter stays in the icon slot
    }
    scheduleBlanks();
  }

  // ---------------------------------------------------------------------------
  // Visual bodies
  // ---------------------------------------------------------------------------

  function stageBodyHtml(visual) {
    const spec = visual.spec;
    switch (visual.type) {
      case "concept":
        return `
          <div class="cm-canvas" data-map></div>
          <div class="cm-controls" data-no-export>
            <button type="button" class="icon-btn" data-zoom="in" aria-label="Zoom in">+</button>
            <button type="button" class="icon-btn" data-zoom="out" aria-label="Zoom out">−</button>
            <button type="button" class="btn btn-secondary btn-sm" data-zoom="fit">Fit</button>
          </div>`;
      case "flowchart":
      case "hierarchy":
      case "timeline":
        return `
          <div class="mmd" data-mermaid><p class="vis-loading">Drawing the diagram…</p></div>
          ${visual.legend ? `<ul class="vis-legend">${visual.legend.map((l) => `<li><span style="--c: ${l.colour}"></span>${escapeHtml(l.label)}</li>`).join("")}</ul>` : ""}`;
      case "comparison":
        return state.compare === "venn" ? `<div class="venn" data-venn></div>` : comparisonTableHtml(spec);
      case "graph":
        return `<div class="graph" data-graph></div>${spec.note ? `<p class="vis-note">${escapeHtml(spec.note)}</p>` : ""}`;
      case "formula":
        return `
          <div class="fx-math" data-formula><p class="vis-loading">Loading the formula…</p></div>
          <ul class="fx-legend">
            ${spec.symbols.map((s, i) => `
              <li style="--sym: ${PALETTE[i % PALETTE.length]}">
                <span class="fx-sym" data-sym="${i}">${escapeHtml(s.tex)}</span>
                <span class="fx-meaning" data-label data-label-key="f${i}">${escapeHtml(s.meaning)}</span>
              </li>`).join("")}
          </ul>
          ${spec.example ? `<p class="vis-note"><strong>Example:</strong> ${escapeHtml(spec.example)}</p>` : ""}`;
      case "figure":
        return `
          <figure class="fig">
            <div class="fig-frame" style="aspect-ratio: ${spec.width} / ${spec.height}">
              <img src="../${spec.image}" alt="${escapeHtml(visual.title)}, with numbered parts" width="${spec.width}" height="${spec.height}">
              ${spec.hotspots.map((h, i) => `
                <button type="button" class="fig-hot" style="left: ${h.x}%; top: ${h.y}%" data-hot="${i}"
                  aria-label="Part ${i + 1}"${state.blank ? "" : ` title="${escapeHtml(h.label)}"`}>${i + 1}</button>`).join("")}
            </div>
            <figcaption>
              <ol class="fig-legend">
                ${spec.hotspots.map((h, i) => `
                  <li data-hot-item="${i}"><span class="fig-num" aria-hidden="true">${i + 1}</span><span data-label data-label-key="h${i}">${escapeHtml(h.label)}</span></li>`).join("")}
              </ol>
            </figcaption>
          </figure>`;
      case "mnemonic":
        return `
          <div class="mn-card">
            <p class="mn-acronym" aria-label="${escapeHtml(spec.acronym)}">${[...spec.acronym].map((c) => `<span>${escapeHtml(c)}</span>`).join("")}</p>
            <p class="mn-phrase">${escapeHtml(spec.phrase)}</p>
            <ol class="mn-letters">
              ${spec.letters.map((l, i) => `
                <li style="--c: ${PALETTE[i % PALETTE.length]}">
                  <span class="mn-icon"><i data-lucide="${escapeHtml(l.icon)}">${escapeHtml(l.letter)}</i></span>
                  <span class="mn-letter" aria-hidden="true">${escapeHtml(l.letter)}</span>
                  <span class="mn-text">
                    <span class="mn-word" data-label data-label-key="l${i}">${escapeHtml(l.word)}</span>
                    <span class="mn-meaning">${escapeHtml(l.meaning)}</span>
                  </span>
                </li>`).join("")}
            </ol>
          </div>`;
      case "palace": {
        const rooms = visualsFor("palace");
        const room = { n: rooms.findIndex((v) => v.id === visual.id) + 1, total: rooms.length };
        let k = 0;
        const story = escapeHtml(spec.story).replace(/\*\*(.+?)\*\*/g, (all, word) => `<mark class="palace-key" data-label data-label-key="p${k++}">${word}</mark>`);
        return `
          <figure class="palace">
            <img src="../${spec.image}" alt="Placeholder picture of ${escapeHtml(spec.place.toLowerCase())}" width="800" height="500">
            <figcaption>
              <p class="palace-place">${icon("home")}Room ${room.n} of ${room.total}: walk through it in your head</p>
              <p class="palace-story">${story}</p>
            </figcaption>
          </figure>`;
      }
      default:
        return "";
    }
  }

  // Draws the parts that depend on the stage's width, or load a library.
  function finishStage(stage, visual) {
    const renderId = state.renderId;
    const width = stage.clientWidth;
    if (visual.type === "concept") renderConcept(stage, visual);
    else if (["flowchart", "hierarchy", "timeline"].includes(visual.type)) renderMermaid(stage, visual, renderId);
    else if (visual.type === "comparison" && state.compare === "venn") stage.querySelector("[data-venn]").innerHTML = vennSvg(visual.spec, width);
    else if (visual.type === "graph") stage.querySelector("[data-graph]").innerHTML = graphSvg(visual.spec, width);
    else if (visual.type === "formula") renderFormula(stage, visual, renderId);
    else if (visual.type === "mnemonic") renderIcons(stage, renderId);
    stage.querySelectorAll("img").forEach((img) => { if (!img.complete) img.addEventListener("load", scheduleBlanks, { once: true }); });
    stage.dataset.width = String(Math.round(width));
    scheduleBlanks();
  }

  // ---------------------------------------------------------------------------
  // Panel: toolbar + stage
  // ---------------------------------------------------------------------------

  function sourceHtml(visual) {
    if (!visual.page) return "";
    const pdf = (set.files.find((f) => f.type === "pdf") || {}).name || "your PDF";
    return `
      <a class="vis-source" href="${PDF_URL}#page=${visual.page}" target="_blank" rel="noopener">
        <span class="vis-star" aria-hidden="true"></span>Page ${visual.page}<span class="visually-hidden"> of ${escapeHtml(pdf)}, the source (opens in a new tab)</span>
      </a>`;
  }

  function toolbarHtml(visual, list) {
    const compare = visual.type === "comparison" ? `
      <fieldset class="segmented vis-view" aria-label="Comparison view">
        <label><input type="radio" name="compareView" value="table"${state.compare === "table" ? " checked" : ""}><span>Table</span></label>
        <label><input type="radio" name="compareView" value="venn"${state.compare === "venn" ? " checked" : ""}><span>Venn</span></label>
      </fieldset>` : "";
    return `
      <div class="vis-head">
        <div class="vis-pick">
          <label class="visually-hidden" for="vis-topic-${visual.type}">Topic</label>
          <select class="input vis-select" id="vis-topic-${visual.type}" data-vis-select${list.length < 2 ? " disabled" : ""}>
            ${list.map((v) => `<option value="${v.id}"${v.id === visual.id ? " selected" : ""}>${escapeHtml(optionLabel(v, list))}</option>`).join("")}
          </select>
        </div>
        <h2 class="vis-title">${escapeHtml(visual.title)}${visual.type === "palace" ? ' <span class="badge badge-max">Max</span>' : ""}</h2>
      </div>
      <div class="vis-tools">
        ${sourceHtml(visual)}
        ${compare}
        <span class="vis-spacer"></span>
        <label class="vis-blank-toggle">
          <input type="checkbox" class="toggle-switch" role="switch" data-blank-toggle${state.blank ? " checked" : ""}>
          <span>Blank labels</span>
        </label>
        <span class="vis-score" data-score aria-live="polite"></span>
        <div class="vis-download">
          <button type="button" class="btn btn-secondary btn-sm" data-download-toggle aria-haspopup="true" aria-expanded="false">${DOWNLOAD_ICON}Download</button>
          <div class="vis-menu glass glass-dark" data-download-menu hidden>
            <button type="button" data-download="png">PNG image</button>
            <button type="button" data-download="svg">SVG file</button>
          </div>
        </div>
      </div>`;
  }

  const DOWNLOAD_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>';

  function maxGateHtml(visual) {
    return `
      <div class="palace-gate">
        <img src="../${visual.spec.image}" alt="" width="800" height="500">
        <div class="palace-gate-card">
          <span class="badge badge-max">Max</span>
          <p class="palace-gate-title">Memory palace is part of Max</p>
          <p class="muted">Turn each topic into a room you can walk through in your head.</p>
          <button type="button" class="btn btn-primary" data-upgrade-max>See Max</button>
        </div>
      </div>`;
  }

  function panelHtml(tab) {
    const info = TABS.find((t) => t.id === tab);
    const list = visualsFor(tab);
    const visual = currentVisual(tab);
    if (!visual) {
      return emptyStateHtml({
        title: `No ${info.label.toLowerCase()} for ${escapeHtml(set.name)} yet`,
        text: "Visuals are made from your notes once they're processed. The Java set shows every kind.",
      });
    }
    if (info.max && getUser().plan !== "max") return `<div class="card vis-card">${maxGateHtml(visual)}</div>`;
    return `
      <div class="card vis-card${info.max ? " is-max" : ""}">
        ${toolbarHtml(visual, list)}
        <div class="vis-stage vis-${visual.type}${state.blank ? " is-blank" : ""}" data-stage>
          ${stageBodyHtml(visual)}
          <div class="blank-layer" data-blank-layer></div>
        </div>
        ${visual.type === "concept" ? '<p class="cm-hint">Click a node to open it · drag to pan · Ctrl + scroll or pinch to zoom · arrow keys pan when the map has focus</p>' : ""}
      </div>`;
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
              aria-selected="${state.tab === t.id}" tabindex="${state.tab === t.id ? 0 : -1}" data-tab="${t.id}">${t.label}${t.max ? ' <span class="badge badge-max">Max</span>' : ""}</button>`).join("")}
        </div>
        <div class="vm-panels">
          ${TABS.map((t) => `<section role="tabpanel" id="panel-${t.id}" aria-labelledby="tab-${t.id}" class="vm-panel"${state.tab === t.id ? "" : " hidden"}></section>`).join("")}
        </div>
      </div>`;
    renderPanel();
    revealTab();
    proGate(main.querySelector(".vm-body"), "Visual memory");
  }

  function activeStage() {
    return main.querySelector(`#panel-${state.tab} [data-stage]`);
  }

  function renderPanel() {
    closeBlank();
    state.renderId += 1;
    const panel = main.querySelector(`#panel-${state.tab}`);
    panel.innerHTML = panelHtml(state.tab);
    const stage = panel.querySelector("[data-stage]");
    if (stage) {
      finishStage(stage, currentVisual());
      stageObserver.disconnect();
      stageObserver.observe(stage);
    }
  }

  // Re-draws only the stage (keeps the toolbar and its focus).
  function redrawStage() {
    const stage = activeStage();
    if (!stage) return renderPanel();
    closeBlank();
    state.renderId += 1;
    const visual = currentVisual();
    const layer = stage.querySelector("[data-blank-layer]");
    if (visual.type === "concept") {
      renderConcept(stage, visual);
      scheduleBlanks();
      return;
    }
    stage.innerHTML = stageBodyHtml(visual);
    stage.appendChild(layer);
    finishStage(stage, visual);
  }

  function resetBlanks() {
    state.answers.clear();
    state.wrong.clear();
  }

  // Scrolls the tab row (not the page) so the selected tab shows on phones.
  function revealTab() {
    const tab = main.querySelector(`#tab-${state.tab}`);
    const row = tab && tab.parentElement;
    if (!row) return;
    if (tab.offsetLeft < row.scrollLeft || tab.offsetLeft + tab.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollLeft = tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2;
    }
  }

  function selectTab(id, focus) {
    state.tab = id;
    resetBlanks();
    main.querySelectorAll("[role='tab']").forEach((tab) => {
      const on = tab.dataset.tab === id;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on && focus) tab.focus();
    });
    main.querySelectorAll("[role='tabpanel']").forEach((p) => {
      p.hidden = p.id !== `panel-${id}`;
      if (p.hidden) p.innerHTML = "";
    });
    const url = new URL(location.href);
    url.searchParams.set("tab", id);
    history.replaceState(null, "", url);
    revealTab();
    renderPanel();
  }

  // Width-dependent visuals redraw when the stage width changes.
  let resizeTimer;
  const stageObserver = new ResizeObserver(([entry]) => {
    const stage = entry.target;
    const visual = currentVisual();
    scheduleBlanks();
    if (!visual || Math.abs(stage.clientWidth - Number(stage.dataset.width || 0)) < 24) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      stage.dataset.width = String(stage.clientWidth);
      if (visual.type === "concept") {
        state.map.moved = false;
        redrawStage();
      } else if (visual.type === "graph" || (visual.type === "comparison" && state.compare === "venn")) {
        redrawStage();
      } else if (["flowchart", "hierarchy", "timeline"].includes(visual.type)) {
        const box = stage.querySelector("[data-mermaid]");
        if (box) sizeMermaid(box);
        scheduleBlanks();
      }
    }, 150);
  });

  // ---------------------------------------------------------------------------
  // Blank labels
  // ---------------------------------------------------------------------------

  const STOP = new Set(["the", "a", "an", "of", "to", "and", "in", "on", "for", "with", "by", "is", "it", "its", "at", "or"]);

  function normalise(text) {
    return text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/\(\)/g, "").replace(/[^a-z0-9+=<>&#→]+/g, " ").trim();
  }

  function editDistance(a, b) {
    const row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      let prev = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = tmp;
      }
    }
    return row[b.length];
  }

  const typoAllowance = (word) => (word.length <= 4 ? 0 : word.length <= 8 ? 1 : 2);

  // Right if it matches allowing small typos, ignoring case, punctuation and
  // little words; for long labels, if it has most of the key words.
  function isRight(typed, answer) {
    const a = normalise(typed);
    const b = normalise(answer);
    if (!a) return false;
    const strip = (s) => s.split(" ").filter((w) => !STOP.has(w)).join(" ");
    if (a === b || strip(a) === strip(b)) return true;
    if (editDistance(strip(a), strip(b)) <= typoAllowance(strip(b))) return true;
    const keys = strip(b).split(" ").filter((w) => w.length > 2);
    if (keys.length < 3) return false;
    const words = strip(a).split(" ");
    const hit = keys.filter((k) => words.some((w) => editDistance(w, k) <= typoAllowance(k))).length;
    return hit / keys.length >= 0.6;
  }

  const answerOf = (target) => target.dataset.answer || target.textContent.replace(/\s+/g, " ").trim();

  let blankFrame = 0;
  function scheduleBlanks() {
    cancelAnimationFrame(blankFrame);
    blankFrame = requestAnimationFrame(layoutBlanks);
  }

  // One chip over each hidden label, positioned from the label's box.
  function layoutBlanks() {
    const stage = activeStage();
    if (!stage) return;
    const layer = stage.querySelector("[data-blank-layer]");
    const score = main.querySelector(`#panel-${state.tab} [data-score]`);
    const targets = [...stage.querySelectorAll("[data-label]")];
    targets.forEach((t, i) => {
      const key = t.dataset.labelKey || `i${i}`;
      t.dataset.blankKey = key;
      const result = state.blank ? state.answers.get(key) : null;
      t.classList.toggle("is-right", result === "right");
      t.classList.toggle("is-revealed", result === "revealed");
    });
    if (!state.blank) {
      layer.innerHTML = "";
      if (score) score.innerHTML = "";
      return;
    }
    const focused = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.blank : null;
    const base = stage.getBoundingClientRect();
    let n = 0;
    let html = "";
    for (const t of targets) {
      const key = t.dataset.blankKey;
      n += 1;
      if (state.answers.has(key)) continue;
      const r = t.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      const w = Math.max(r.width + 10, 40);
      const h = Math.max(r.height + 6, 26);
      const left = r.left - base.left + r.width / 2 - w / 2;
      const top = r.top - base.top + r.height / 2 - h / 2;
      html += `<button type="button" class="blank-chip${state.wrong.has(key) ? " is-wrong" : ""}" data-blank="${key}"
        style="left: ${left.toFixed(1)}px; top: ${top.toFixed(1)}px; width: ${w.toFixed(1)}px; height: ${h.toFixed(1)}px"
        aria-label="Blank ${n}${state.wrong.has(key) ? ", not right yet" : ""}. Type the missing label.">?</button>`;
    }
    layer.innerHTML = html;
    if (focused) {
      const again = layer.querySelector(`[data-blank="${focused}"]`);
      if (again) again.focus();
    }
    if (pop && !pop.hidden) positionPop();
    if (score) {
      const right = targets.filter((t) => state.answers.get(t.dataset.blankKey) === "right").length;
      score.innerHTML = targets.length
        ? `<span>${right} of ${targets.length} right</span><button type="button" class="link-btn" data-blank-reset>Reset</button>`
        : "";
    }
  }

  // The answer form: one element, moved next to whichever chip is open.
  let pop = null;
  let popKey = null;

  function ensurePop() {
    if (pop) return pop;
    pop = document.createElement("form");
    pop.className = "blank-pop glass glass-dark";
    pop.hidden = true;
    pop.innerHTML = `
      <label class="blank-pop-label" for="blank-input">What goes here?</label>
      <div class="blank-pop-row">
        <input class="input" id="blank-input" autocomplete="off" spellcheck="false">
        <button type="submit" class="btn btn-primary btn-sm">Check</button>
      </div>
      <p class="blank-pop-msg" role="status" data-blank-msg></p>
      <button type="button" class="link-btn" data-blank-reveal hidden>Show answer</button>`;
    document.body.appendChild(pop);
    pop.addEventListener("submit", (event) => {
      event.preventDefault();
      checkBlank();
    });
    pop.querySelector("[data-blank-reveal]").addEventListener("click", () => settleBlank("revealed"));
    pop.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeBlank(true);
      }
    });
    return pop;
  }

  function chipFor(key) {
    const stage = activeStage();
    return stage && stage.querySelector(`[data-blank="${key}"]`);
  }

  function positionPop() {
    const chip = chipFor(popKey);
    if (!chip) return closeBlank();
    const r = chip.getBoundingClientRect();
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    let top = r.bottom + 8;
    if (top + ph > innerHeight - 8) top = Math.max(8, r.top - ph - 8);
    pop.style.left = `${clamp(r.left + r.width / 2 - pw / 2, 8, innerWidth - pw - 8)}px`;
    pop.style.top = `${top}px`;
  }

  function openBlank(chip) {
    ensurePop();
    popKey = chip.dataset.blank;
    pop.hidden = false;
    pop.classList.remove("is-wrong");
    pop.querySelector("input").value = "";
    pop.querySelector("[data-blank-msg]").textContent = "";
    pop.querySelector("[data-blank-reveal]").hidden = !state.wrong.has(popKey);
    positionPop();
    pop.querySelector("input").focus();
  }

  function closeBlank(returnFocus) {
    if (!pop || pop.hidden) return;
    pop.hidden = true;
    const chip = returnFocus && chipFor(popKey);
    popKey = null;
    if (chip) chip.focus();
  }

  function targetFor(key) {
    const stage = activeStage();
    return stage && stage.querySelector(`[data-blank-key="${key}"]`);
  }

  function checkBlank() {
    const target = targetFor(popKey);
    if (!target) return closeBlank();
    const input = pop.querySelector("input");
    if (!input.value.trim()) return input.focus();
    if (isRight(input.value, answerOf(target))) return settleBlank("right");
    state.wrong.add(popKey);
    pop.querySelector("[data-blank-msg]").textContent = "Not quite. Try again, or show the answer.";
    pop.querySelector("[data-blank-reveal]").hidden = false;
    pop.classList.remove("is-wrong");
    void pop.offsetWidth; // restart the shake
    pop.classList.add("is-wrong");
    const chip = chipFor(popKey);
    if (chip) chip.classList.add("is-wrong");
    input.select();
  }

  // Marks the open blank right or revealed, then moves to the next blank.
  function settleBlank(result) {
    const key = popKey;
    const chips = [...activeStage().querySelectorAll("[data-blank]")];
    const index = chips.findIndex((c) => c.dataset.blank === key);
    state.answers.set(key, result);
    pop.hidden = true;
    popKey = null;
    layoutBlanks();
    const rest = [...activeStage().querySelectorAll("[data-blank]")];
    const next = rest[Math.min(index, rest.length - 1)];
    if (next) next.focus();
    else main.querySelector(`#panel-${state.tab} [data-blank-toggle]`).focus();
    if (result === "right" && !rest.length) showToast("All blanks done");
  }

  document.addEventListener("pointerdown", (event) => {
    if (pop && !pop.hidden && !pop.contains(event.target) && !event.target.closest("[data-blank]")) closeBlank();
    const menu = main.querySelector("[data-download-menu]:not([hidden])");
    if (menu && !event.target.closest(".vis-download")) toggleDownloadMenu(false);
  });
  window.addEventListener("scroll", () => { if (pop && !pop.hidden) positionPop(); }, { passive: true });
  // Scrolling inside a stage (wide tables and diagrams) moves the labels.
  main.addEventListener("scroll", scheduleBlanks, { capture: true, passive: true });

  // ---------------------------------------------------------------------------
  // Download: the stage as SVG (HTML inside a foreignObject) or PNG
  // ---------------------------------------------------------------------------

  const COPY_PROPS = [
    "display", "position", "top", "left", "right", "bottom", "z-index", "box-sizing", "width", "height",
    "margin-top", "margin-right", "margin-bottom", "margin-left",
    "padding-top", "padding-right", "padding-bottom", "padding-left",
    "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
    "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
    "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
    "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius", "border-bottom-right-radius",
    "background-color", "background-image", "color", "opacity", "visibility", "overflow-x", "overflow-y",
    "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-align",
    "text-transform", "text-decoration-line", "text-decoration-style", "text-decoration-color", "white-space", "vertical-align",
    "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis", "align-items", "align-self", "justify-content",
    "row-gap", "column-gap", "grid-template-columns", "grid-template-rows", "grid-column-start", "grid-column-end",
    "transform", "transform-origin", "box-shadow", "object-fit", "border-collapse", "border-spacing", "list-style-type",
    "font-variant-numeric", "table-layout",
  ];
  const SVG_PROPS = [
    "fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "stroke-opacity",
    "opacity", "visibility", "display", "font-family", "font-size", "font-weight", "font-style", "text-anchor",
    "dominant-baseline", "paint-order", "letter-spacing",
  ];

  function inlineStyles(source, copy) {
    const isSvg = source instanceof SVGElement && source.tagName.toLowerCase() !== "svg";
    const cs = getComputedStyle(source);
    const props = isSvg ? SVG_PROPS : source instanceof SVGSVGElement ? [...COPY_PROPS, ...SVG_PROPS] : COPY_PROPS;
    copy.setAttribute("style", props.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";"));
    const a = source.children;
    const b = copy.children;
    for (let i = 0; i < a.length; i++) if (b[i]) inlineStyles(a[i], b[i]);
  }

  // Images inside an SVG image must be data URLs. File pages can't read their
  // own images (a "tainted" canvas), so those stay as links.
  function inlineImages(source, copy) {
    const from = source.querySelectorAll("img");
    copy.querySelectorAll("img").forEach((img, i) => {
      const orig = from[i];
      try {
        const c = document.createElement("canvas");
        c.width = orig.naturalWidth;
        c.height = orig.naturalHeight;
        c.getContext("2d").drawImage(orig, 0, 0);
        img.setAttribute("src", c.toDataURL("image/png"));
      } catch (err) {
        img.setAttribute("src", orig.src);
      }
    });
  }

  function stageSvgText(stage) {
    const r = stage.getBoundingClientRect();
    const w = Math.ceil(r.width);
    const h = Math.ceil(r.height);
    const copy = stage.cloneNode(true);
    inlineStyles(stage, copy);
    inlineImages(stage, copy);
    copy.querySelectorAll("[data-no-export]").forEach((el) => el.remove());
    copy.style.margin = "0";
    copy.style.backgroundColor = cssVar("--color-surface");
    const html = new XMLSerializer().serializeToString(copy);
    return `<svg xmlns="${SVG_NS}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><foreignObject x="0" y="0" width="${w}" height="${h}">${html}</foreignObject></svg>`;
  }

  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function download(format) {
    const stage = activeStage();
    const visual = currentVisual();
    if (!stage || !visual) return;
    closeBlank();
    const name = `${set.name} - ${visual.title}${state.blank ? " (blank)" : ""}`.replace(/[\\/:*?"<>|]+/g, "").slice(0, 80);
    const svgText = stageSvgText(stage);
    if (format === "svg") {
      saveBlob(new Blob([svgText], { type: "image/svg+xml" }), `${name}.svg`);
      showToast("SVG downloaded");
      return;
    }
    try {
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
      await img.decode();
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = cssVar("--color-surface");
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      const blob = await new Promise((resolve, reject) => {
        try { canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("empty"))), "image/png"); } catch (err) { reject(err); }
      });
      saveBlob(blob, `${name}.png`);
      showToast("PNG downloaded");
    } catch (err) {
      console.warn("Visual memory: PNG export failed", err);
      showToast("Couldn't make a PNG in this browser. Try SVG.");
    }
  }

  function toggleDownloadMenu(open, focusFirst) {
    const toggle = main.querySelector(`#panel-${state.tab} [data-download-toggle]`);
    const menu = main.querySelector(`#panel-${state.tab} [data-download-menu]`);
    if (!toggle || !menu) return;
    menu.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (open && focusFirst) menu.querySelector("button").focus();
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  function setHot(i, on) {
    const stage = activeStage();
    if (!stage) return;
    stage.querySelectorAll(".is-hot").forEach((el) => el.classList.remove("is-hot"));
    if (on && i !== undefined) stage.querySelectorAll(`[data-hot="${i}"], [data-hot-item="${i}"]`).forEach((el) => el.classList.add("is-hot"));
  }

  main.addEventListener("click", (event) => {
    const t = event.target;
    const tab = t.closest("[data-tab]");
    if (tab) return selectTab(tab.dataset.tab, false);
    const chip = t.closest("[data-blank]");
    if (chip) return openBlank(chip);
    if (t.closest("[data-blank-reset]")) {
      resetBlanks();
      layoutBlanks();
      const first = activeStage().querySelector("[data-blank]");
      if (first) first.focus();
      return;
    }
    if (t.closest("[data-download-toggle]")) {
      const open = t.closest("[data-download-toggle]").getAttribute("aria-expanded") !== "true";
      return toggleDownloadMenu(open, event.detail === 0);
    }
    const dl = t.closest("[data-download]");
    if (dl) {
      toggleDownloadMenu(false);
      return download(dl.dataset.download);
    }
    const zoom = t.closest("[data-zoom]");
    if (zoom) {
      const svg = activeStage().querySelector(".cm-svg");
      const vb = svg.viewBox.baseVal;
      if (zoom.dataset.zoom === "fit") {
        state.map.moved = false;
        return redrawStage();
      }
      return zoomMap(zoom.dataset.zoom === "in" ? 1.25 : 0.8, vb.width / 2, vb.height / 2);
    }
    const hot = t.closest("[data-hot]");
    if (hot) {
      setHot(hot.dataset.hot, true);
      const item = activeStage().querySelector(`[data-hot-item="${hot.dataset.hot}"]`);
      if (item) item.scrollIntoView({ block: "nearest", behavior: "smooth" });
      return;
    }
    if (t.closest("[data-upgrade-max]")) return openUpgrade("Memory palace");
    // Screen reader "click" on a concept map node (no pointer events).
    const node = t.closest("[data-node]");
    if (node && event.detail === 0) toggleNode(node.dataset.node);
  });

  main.addEventListener("change", (event) => {
    const t = event.target;
    if (t.matches("[data-vis-select]")) {
      state.pick[state.tab] = t.value;
      state.map = null;
      resetBlanks();
      renderPanel();
      const select = main.querySelector(`#panel-${state.tab} [data-vis-select]`);
      if (select) select.focus();
      return;
    }
    if (t.matches("[data-blank-toggle]")) {
      state.blank = t.checked;
      resetBlanks();
      closeBlank();
      const stage = activeStage();
      stage.classList.toggle("is-blank", state.blank);
      if (currentVisual().type === "figure") redrawStage(); // hotspot tooltips name the parts
      else layoutBlanks();
      return;
    }
    if (t.name === "compareView") {
      state.compare = t.value;
      resetBlanks();
      redrawStage();
    }
  });

  main.addEventListener("mouseover", (event) => {
    const hot = event.target.closest("[data-hot], [data-hot-item]");
    if (hot) setHot(hot.dataset.hot ?? hot.dataset.hotItem, true);
  });
  main.addEventListener("mouseout", (event) => {
    if (event.target.closest("[data-hot], [data-hot-item]")) setHot(null, false);
  });
  main.addEventListener("focusin", (event) => {
    const hot = event.target.closest("[data-hot]");
    if (hot) setHot(hot.dataset.hot, true);
  });

  main.addEventListener("keydown", (event) => {
    const t = event.target;
    const node = t.closest("[data-node]");
    if (node && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      toggleNode(node.dataset.node);
      return;
    }
    // Arrow keys pan, + and - zoom, 0 fits, when the map or a node has focus.
    const svg = t.closest(".cm-svg");
    if (svg) {
      const vb = svg.viewBox.baseVal;
      const pan = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[event.key];
      if (pan && !node) {
        event.preventDefault();
        state.map.tx += pan[0];
        state.map.ty += pan[1];
        state.map.moved = true;
        applyMapTransform();
        return;
      }
      if (event.key === "+" || event.key === "=") return zoomMap(1.25, vb.width / 2, vb.height / 2);
      if (event.key === "-") return zoomMap(0.8, vb.width / 2, vb.height / 2);
    }
    const menu = t.closest("[data-download-menu]");
    if (menu && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      const items = [...menu.querySelectorAll("button")];
      const i = items.indexOf(t);
      items[(i + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
      return;
    }
    if (event.key === "Escape" && t.closest(".vis-download")) {
      toggleDownloadMenu(false);
      main.querySelector(`#panel-${state.tab} [data-download-toggle]`).focus();
      return;
    }
    const tab = t.closest("[role='tab']");
    if (tab && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
      const i = TABS.findIndex((x) => x.id === tab.dataset.tab);
      const next = TABS[(i + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
      selectTab(next.id, true);
    }
  });

  window.addEventListener("resize", scheduleBlanks);
  if (document.fonts) document.fonts.ready.then(scheduleBlanks);

  render();
})();
