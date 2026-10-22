/*
 * Smart notes (app/notes.html?set=<id>[&topic=<topicId>]). Load after data.js,
 * app.js and notes-content.js.
 *
 * A read-and-edit document. Read mode shows the notes; Edit mode turns on a
 * contenteditable editor with a formatting toolbar (document.execCommand, so
 * undo/redo come from the browser), keyboard shortcuts and a mini-toolbar on
 * text selection. Changes autosave to localStorage.
 *
 * Source stars (button.source-star) open a side panel with the PDF page the
 * point came from, rendered by PDF.js with the passage highlighted.
 * Sticky notes sit in the right margin next to the text they point to
 * (span.sticky-anchor), or inline under it on narrow screens.
 */
(function () {
  "use strict";

  const main = document.querySelector("main");
  const { set, topic: startTopic } = setFromUrl();

  const STORE_KEY = "skipxam.notes.v1";   // { [setId]: { html, stickies, savedAt } }
  const MODE_KEY = "skipxam.notesMode";   // "read" | "edit"
  const INLINE_BELOW = 860;               // layout width under which stickies show inline
  const PDF_URL = "../assets/sample.pdf";
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const KINDS = {
    tip: "Exam tip",
    mistake: "Common mistake",
    remember: "Remember",
    formula: "Formula",
    mine: "My note",
  };

  const HIGHLIGHTS = [
    { name: "Yellow", value: "rgba(250, 204, 21, 0.35)" },
    { name: "Amber", value: "rgba(224, 138, 56, 0.4)" },
    { name: "Green", value: "rgba(93, 176, 117, 0.38)" },
    { name: "Blue", value: "rgba(79, 163, 217, 0.38)" },
    { name: "Pink", value: "rgba(224, 108, 159, 0.38)" },
  ];
  const TEXT_COLOURS = [
    { name: "Amber", value: "#e08a38" },
    { name: "Red", value: "#e05a4f" },
    { name: "Green", value: "#5db075" },
    { name: "Blue", value: "#4fa3d9" },
    { name: "Violet", value: "#a78bfa" },
  ];

  // Editor icons (24×24, stroked like the app's icon set).
  const tb = (body) => `<svg class="icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const TB = {
    undo: tb('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
    redo: tb('<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>'),
    bold: tb('<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>'),
    italic: tb('<path d="M11 5h7M6 19h7M15 5l-6 14"/>'),
    underline: tb('<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>'),
    strike: tb('<path d="M16 7c-.7-1.3-2.2-2-4-2-2.4 0-4 1.3-4 3 0 1.2.7 2 2 2.6M5 12h14M8 17c.8 1.3 2.3 2 4 2 2.4 0 4-1.3 4-3 0-.6-.2-1.2-.5-1.6"/>'),
    highlight: tb('<path d="m14 5 5 5-7 7H7v-5z"/><path d="m7 17-3 3"/>'),
    color: tb('<path d="m6 17 6-13 6 13M8.3 12h7.4"/>'),
    alignLeft: tb('<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>'),
    alignCenter: tb('<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>'),
    alignRight: tb('<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>'),
    justify: tb('<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>'),
    bullets: tb('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
    numbers: tb('<path d="M10 6h10M10 12h10M10 18h10M4 4.5h1.5V9M3.5 9h3M3.5 14.6a1.5 1.5 0 0 1 3 .4c0 1-3 2-3 3.5h3"/>'),
    checklist: tb('<path d="m3.5 6 1.5 1.5 3-3M3.5 16l1.5 1.5 3-3M11 6h9M11 16h9"/>'),
    quote: tb('<path d="M5 18c2-1 3-3 3-6V7H4v5h4M15 18c2-1 3-3 3-6V7h-4v5h4"/>'),
    code: tb('<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>'),
    table: tb('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>'),
    link: tb('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    keyboard: tb('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'),
    sticky: tb('<path d="M4 4h16v10l-6 6H4z"/><path d="M14 20v-6h6"/>'),
    grip: tb('<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>'),
    read: tb('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  };

  // Toolbar layout. `keys` is shown in the tooltip and the shortcuts sheet.
  const TOOLBAR = [
    [{ cmd: "undo", label: "Undo", keys: "Ctrl+Z" }, { cmd: "redo", label: "Redo", keys: "Ctrl+Y" }],
    [{ cmd: "h1", text: "H1", label: "Heading 1", keys: "Ctrl+Alt+1" }, { cmd: "h2", text: "H2", label: "Heading 2", keys: "Ctrl+Alt+2" },
     { cmd: "h3", text: "H3", label: "Heading 3", keys: "Ctrl+Alt+3" }],
    [{ cmd: "bold", label: "Bold", keys: "Ctrl+B" }, { cmd: "italic", label: "Italic", keys: "Ctrl+I" },
     { cmd: "underline", label: "Underline", keys: "Ctrl+U" }, { cmd: "strike", label: "Strikethrough", keys: "Ctrl+Shift+X" }],
    [{ cmd: "highlight", label: "Highlight colour", keys: "Ctrl+Shift+H", menu: true }, { cmd: "color", label: "Text colour", menu: true }],
    [{ cmd: "alignLeft", label: "Align left", keys: "Alt+Shift+L" }, { cmd: "alignCenter", label: "Align centre", keys: "Alt+Shift+E" },
     { cmd: "alignRight", label: "Align right", keys: "Alt+Shift+R" }, { cmd: "justify", label: "Justify", keys: "Alt+Shift+J" }],
    [{ cmd: "bullets", label: "Bullet list", keys: "Ctrl+Shift+8" }, { cmd: "numbers", label: "Numbered list", keys: "Ctrl+Shift+7" },
     { cmd: "checklist", label: "Checklist", keys: "Ctrl+Shift+9" }],
    [{ cmd: "quote", label: "Quote", keys: "Ctrl+Alt+Q" }, { cmd: "code", label: "Code block", keys: "Ctrl+Alt+C" },
     { cmd: "table", label: "Insert table" }],
    [{ cmd: "link", label: "Link", keys: "Ctrl+K" }, { cmd: "image", label: "Insert image" }],
    [{ cmd: "shortcuts", label: "Keyboard shortcuts", icon: "keyboard" }],
  ];

  const state = {
    mode: readPref(MODE_KEY, "read") === "edit" ? "edit" : "read",
    inline: false,
    highlight: HIGHLIGHTS[0].value, // last highlight colour used
    savedRange: null,               // selection kept while a menu or modal is open
    saveTimer: null,
    tocTimer: null,
    edited: false,                  // logged an "edited notes" activity this visit
    source: null,                   // { id, page, quote, star } while the panel is open
    menu: null,                     // open colour menu element
  };

  let doc = null;      // the saved document: { html, stickies, savedAt }
  let editor = null;   // the contenteditable article
  let seed = null;

  // ---------------------------------------------------------------------------
  // Storage
  // ---------------------------------------------------------------------------

  function readPref(key, fallback) {
    try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
  }

  function writePref(key, value) {
    try { localStorage.setItem(key, value); } catch { /* private mode: not remembered */ }
  }

  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
  }

  function writeStore(store) {
    localStorage.setItem(STORE_KEY, JSON.stringify(store)); // may throw when storage is full
  }

  // A document built from the set's smart notes, for sets without hand-written seed content.
  function generatedSeed(s) {
    const stickies = [];
    const sticky = (kind, text, inner) => {
      const id = `${s.id}-st-${stickies.length + 1}`;
      stickies.push({ id, kind, text });
      return `<span class="sticky-anchor" data-sticky="${id}">${inner}</span>`;
    };
    const sections = s.notes.map((n) => {
      const name = topicName(s, n.topicId);
      const formulas = n.formulas.map((f) =>
        `<p class="formula-line">${sticky("formula", f.label, `<strong>${escapeHtml(f.label)}:</strong> ${escapeHtml(f.expr)}`)}</p>`).join("");
      return `
<h2 id="h-${n.topicId}">${escapeHtml(name)}</h2>
<p>${richText(n.intro)}</p>
${n.points.length ? `<ul>${n.points.map((p) => `<li>${richText(p)}</li>`).join("")}</ul>` : ""}
${formulas}
${n.remember ? `<blockquote><p>${sticky("remember", n.remember.replace(/\*\*|`/g, ""), `<strong>Remember:</strong> ${richText(n.remember)}`)}</p></blockquote>` : ""}`;
    }).join("");
    return { file: null, html: `<h1 id="h-top">${escapeHtml(s.name)}: smart notes</h1>${sections}`, stickies, sources: [] };
  }

  function loadDoc() {
    const saved = readStore()[set.id];
    if (saved && saved.html) return saved;
    return {
      html: seed.html,
      stickies: seed.stickies.map((x) => ({ ...x, auto: true, collapsed: false, offset: 0 })),
      savedAt: null,
    };
  }

  // The editor's HTML without the page's own UI (inline stickies, hover classes).
  function serialize() {
    const clone = editor.cloneNode(true);
    clone.querySelectorAll(".sticky").forEach((el) => el.remove());
    clone.querySelectorAll(".is-linked").forEach((el) => el.classList.remove("is-linked"));
    return clone.innerHTML;
  }

  function setSaveStatus(status) {
    const el = main.querySelector(".save-status");
    if (!el) return;
    el.dataset.status = status;
    el.innerHTML = {
      saving: "Saving…",
      saved: `${icon("check")}Saved`,
      error: "Couldn't save: storage is full",
    }[status];
  }

  function save() {
    clearTimeout(state.saveTimer);
    state.saveTimer = null;
    ensureHeadingIds();
    doc.html = serialize();
    doc.savedAt = new Date().toISOString();
    const store = readStore();
    store[set.id] = doc;
    try {
      writeStore(store);
      setSaveStatus("saved");
    } catch (err) {
      console.warn("SkipXam: could not save notes.", err);
      setSaveStatus("error");
    }
  }

  function scheduleSave() {
    setSaveStatus("saving");
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(save, 700);
    clearTimeout(state.tocTimer);
    state.tocTimer = setTimeout(renderToc, 400);
    if (!state.edited && state.mode === "edit") {
      state.edited = true;
      logActivity(set.id, "notes", `Edited notes in ${set.name}`);
    }
  }

  window.addEventListener("beforeunload", () => { if (state.saveTimer) save(); });

  // ---------------------------------------------------------------------------
  // Page structure
  // ---------------------------------------------------------------------------

  function toolbarHtml() {
    const button = (t) => {
      if (t.menu) {
        return `
          <div class="tb-menu-wrap">
            <button type="button" class="tb-btn tb-colour" data-cmd="${t.cmd}" aria-haspopup="true" aria-expanded="false"
              aria-label="${t.label}" title="${t.label}${t.keys ? ` (${t.keys})` : ""}">
              ${TB[t.cmd]}<span class="tb-swatch" style="background: ${t.cmd === "highlight" ? state.highlight : "currentColor"}"></span>
            </button>
          </div>`;
      }
      const glyph = t.text ? `<span class="tb-text">${t.text}</span>` : t.cmd === "image" ? icon("image") : TB[t.icon || t.cmd];
      return `<button type="button" class="tb-btn" data-cmd="${t.cmd}" aria-label="${t.label}"
        title="${t.label}${t.keys ? ` (${t.keys})` : ""}"${["undo", "redo", "table", "link", "image", "shortcuts"].includes(t.cmd) ? "" : ' aria-pressed="false"'}>${glyph}</button>`;
    };
    return `
      <div class="notes-toolbar" role="toolbar" aria-label="Formatting"${state.mode === "edit" ? "" : " hidden"}>
        ${TOOLBAR.map((group) => `<div class="tb-group">${group.map(button).join("")}</div>`).join('<span class="tb-sep" aria-hidden="true"></span>')}
        <input type="file" accept="image/*" class="visually-hidden" id="image-input" tabindex="-1" aria-hidden="true">
      </div>`;
  }

  function headerActionsHtml() {
    return `
      <div class="notes-actions">
        <span class="save-status muted" role="status" data-status="saved">${icon("check")}Saved</span>
        <div class="segmented" role="radiogroup" aria-label="Mode">
          <label><input type="radio" name="notes-mode" value="read"${state.mode === "read" ? " checked" : ""}><span>Read</span></label>
          <label><input type="radio" name="notes-mode" value="edit"${state.mode === "edit" ? " checked" : ""}><span>Edit</span></label>
        </div>
      </div>`;
  }

  function render() {
    if (!set) {
      main.innerHTML = setNotFoundHtml();
      return false;
    }
    document.title = `Smart notes · ${set.name} · SkipXam`;
    seed = (window.NOTES_SEED || {})[set.id] || generatedSeed(set);

    if (!seed.html || (!set.notes.length && !(window.NOTES_SEED || {})[set.id])) {
      main.innerHTML = `
        ${toolHeaderHtml(set, "Smart notes")}
        ${emptyStateHtml({
          title: "No smart notes yet",
          text: "Your smart notes appear here once your notes are processed.",
          action: { label: "Go to set", href: `set.html?set=${encodeURIComponent(set.id)}` },
        })}`;
      return false;
    }

    doc = loadDoc();
    main.innerHTML = `
      ${toolHeaderHtml(set, "Smart notes", headerActionsHtml())}
      ${seed.file ? `<p class="notes-source-line muted">${icon("file")}From <strong>${escapeHtml(seed.file)}</strong> · click a <span class="star-sample" aria-hidden="true"></span> to see the passage in the PDF</p>` : ""}
      ${toolbarHtml()}
      <div class="notes-shell"><div class="notes-layout">
        <nav class="notes-toc" aria-label="Table of contents"><p class="toc-title">Contents</p><ol></ol></nav>
        <div class="notes-toc-mobile">
          <label class="visually-hidden" for="toc-select">Jump to section</label>
          <select class="input" id="toc-select"></select>
        </div>
        <div class="notes-doc-wrap">
          <article class="notes-doc" id="notes-doc" aria-label="Notes" spellcheck="true">${doc.html}</article>
          <div class="sticky-rail" aria-label="Sticky notes"></div>
        </div>
      </div></div>
      <div class="mini-toolbar glass" role="toolbar" aria-label="Selection" hidden></div>
      <aside class="source-panel glass" role="dialog" aria-modal="false" aria-labelledby="source-title" hidden></aside>`;

    editor = main.querySelector("#notes-doc");
    setMode(state.mode, { initial: true });
    renderToc();
    return true;
  }

  // ---------------------------------------------------------------------------
  // Read / Edit
  // ---------------------------------------------------------------------------

  function setMode(mode, { initial = false } = {}) {
    state.mode = mode;
    writePref(MODE_KEY, mode);
    editor.contentEditable = mode === "edit" ? "true" : "false";
    editor.classList.toggle("is-editing", mode === "edit");
    main.querySelector(".notes-toolbar").hidden = mode !== "edit";
    main.querySelectorAll("[name='notes-mode']").forEach((r) => { r.checked = r.value === mode; });
    hideMini();
    if (mode === "edit") {
      try { document.execCommand("styleWithCSS", false, true); } catch { /* old browsers */ }
      if (!initial) {
        editor.focus({ preventScroll: true });
        showToast("Editing. Changes save automatically.");
      }
    }
    layoutStickies();
  }

  // ---------------------------------------------------------------------------
  // Table of contents
  // ---------------------------------------------------------------------------

  function ensureHeadingIds() {
    const used = new Set();
    editor.querySelectorAll("h1, h2, h3").forEach((h, i) => {
      if (!h.id || used.has(h.id)) h.id = `h-${i + 1}-${Date.now().toString(36)}`;
      used.add(h.id);
    });
  }

  let tocObserver = null;

  function renderToc() {
    if (!editor) return;
    ensureHeadingIds();
    const headings = [...editor.querySelectorAll("h1, h2, h3")].filter((h) => h.textContent.trim());
    const list = main.querySelector(".notes-toc ol");
    let section = "";
    list.innerHTML = headings.map((h) => {
      if (h.tagName !== "H3") section = h.id;
      return `
      <li class="toc-${h.tagName.toLowerCase()}" data-section="${section}"><a href="#${h.id}" data-toc="${h.id}">${escapeHtml(h.textContent.trim())}</a></li>`;
    }).join("");
    main.querySelector("#toc-select").innerHTML = `<option value="">Jump to section…</option>${headings
      .map((h) => `<option value="${h.id}">${h.tagName === "H3" ? "   " : ""}${escapeHtml(h.textContent.trim())}</option>`).join("")}`;

    if (tocObserver) tocObserver.disconnect();
    if (!("IntersectionObserver" in window)) return;
    tocObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) highlightToc(visible.target.id);
    }, { rootMargin: "-80px 0px -65% 0px" });
    headings.forEach((h) => tocObserver.observe(h));
  }

  const loggedSections = new Set();

  function highlightToc(id) {
    main.querySelectorAll("[data-toc]").forEach((a) => {
      if (a.dataset.toc === id) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
    // Sub-headings are listed only for the section you're in.
    const current = main.querySelector(`.notes-toc [data-toc="${id}"]`);
    const sectionId = current && current.parentElement.dataset.section;
    main.querySelectorAll(".notes-toc .toc-h3").forEach((li) => li.classList.toggle("is-open", li.dataset.section === sectionId));
    // "Continue learning" on Home tracks which top-level section you reached.
    const sections = [...editor.querySelectorAll("h2")];
    const heading = document.getElementById(id);
    // The last h2 at or before this heading.
    const index = heading ? sections.reduce((found, h, i) =>
      (h === heading || h.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING ? i : found), -1) : -1;
    if (index >= 0) {
      recordActivity(set.id, "notes", index + 1, sections.length);
      const name = sections[index].textContent.trim();
      if (index > 0 && !loggedSections.has(name)) {
        loggedSections.add(name);
        logActivity(set.id, "notes", `Read notes on ${name.replace(/^\d+\.\s*/, "")}`);
      }
    }
  }

  function goToHeading(id, { instant = false } = {}) {
    const heading = document.getElementById(id);
    if (!heading) return;
    heading.scrollIntoView({ behavior: instant || reducedMotion() ? "auto" : "smooth", block: "start" });
    highlightToc(id);
  }

  // ---------------------------------------------------------------------------
  // Formatting
  // ---------------------------------------------------------------------------

  function selectionInEditor() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    return editor.contains(range.commonAncestorContainer) ? range : null;
  }

  function saveRange() {
    const range = selectionInEditor();
    state.savedRange = range ? range.cloneRange() : state.savedRange;
  }

  function restoreRange() {
    editor.focus({ preventScroll: true });
    if (!state.savedRange) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(state.savedRange);
  }

  function exec(command, value = null) {
    document.execCommand(command, false, value);
    scheduleSave();
    updateToolbarState();
  }

  function currentBlock() {
    const range = selectionInEditor();
    if (!range) return null;
    let node = range.startContainer;
    if (node.nodeType === 3) node = node.parentNode;
    return node.closest && node.closest("h1, h2, h3, p, li, blockquote, pre, td, th, div");
  }

  function toggleBlock(tag) {
    const block = currentBlock();
    const inside = block && block.closest(tag);
    exec("formatBlock", inside ? "p" : tag);
  }

  function insertChecklist() {
    const range = selectionInEditor();
    const list = range && (range.startContainer.nodeType === 3 ? range.startContainer.parentNode : range.startContainer).closest("ul");
    if (list && list.classList.contains("checklist")) {
      exec("insertUnorderedList"); // turns the list off
      return;
    }
    if (!list) document.execCommand("insertUnorderedList");
    const sel = window.getSelection();
    const node = sel.anchorNode && (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode);
    const ul = node && node.closest("ul");
    if (ul) ul.classList.add("checklist");
    scheduleSave();
    updateToolbarState();
  }

  function insertTable() {
    const cells = (tag) => `<${tag}><br></${tag}>`.repeat(3);
    exec("insertHTML", `<table><thead><tr>${"<th>Heading</th>".repeat(3)}</tr></thead><tbody><tr>${cells("td")}</tr><tr>${cells("td")}</tr></tbody></table><p><br></p>`);
  }

  function insertCodeBlock() {
    const block = currentBlock();
    if (block && block.closest("pre")) return exec("formatBlock", "p");
    exec("formatBlock", "pre");
  }

  function openLinkDialog() {
    saveRange();
    const range = state.savedRange;
    const existing = range && (range.startContainer.nodeType === 3 ? range.startContainer.parentNode : range.startContainer).closest("a");
    const hasText = range && !range.collapsed;
    const modal = openModal({
      title: existing ? "Edit link" : "Add a link",
      body: `
        <form>
          ${hasText || existing ? "" : `
          <div class="field">
            <label class="field-label" for="link-text">Text</label>
            <input class="input" id="link-text" name="text" required>
          </div>`}
          <div class="field">
            <label class="field-label" for="link-url">Link</label>
            <input class="input" id="link-url" name="url" type="url" required placeholder="https://" value="${existing ? escapeHtml(existing.getAttribute("href")) : ""}" autofocus>
          </div>
          <div class="modal-actions">
            ${existing ? '<button type="button" class="btn btn-ghost" data-unlink>Remove link</button>' : ""}
            <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
            <button type="submit" class="btn btn-primary">${existing ? "Save" : "Add link"}</button>
          </div>
        </form>`,
    });
    const form = modal.dialog.querySelector("form");
    const unlink = modal.dialog.querySelector("[data-unlink]");
    if (unlink) unlink.addEventListener("click", () => {
      modal.close();
      restoreRange();
      const r = document.createRange();
      r.selectNodeContents(existing);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
      exec("unlink");
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      let url = form.elements.url.value.trim();
      if (!/^[a-z]+:/i.test(url)) url = `https://${url}`;
      modal.close();
      restoreRange();
      if (existing) {
        existing.setAttribute("href", url);
        scheduleSave();
      } else if (hasText) {
        exec("createLink", url);
      } else {
        exec("insertHTML", `<a href="${escapeHtml(url)}">${escapeHtml(form.elements.text.value)}</a>&nbsp;`);
      }
    });
  }

  // Images are shrunk to 1000px wide and stored inline as JPEG data URLs.
  function insertImage(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1000 / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        restoreRange();
        exec("insertHTML", `<img src="${canvas.toDataURL("image/jpeg", 0.82)}" alt="${escapeHtml(file.name.replace(/\.[^.]+$/, ""))}"><p><br></p>`);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function openShortcuts() {
    const rows = TOOLBAR.flat().filter((t) => t.keys).map((t) => `<tr><td>${t.label}</td><td><kbd>${t.keys.split("+").join("</kbd>+<kbd>")}</kbd></td></tr>`).join("");
    openModal({
      title: "Keyboard shortcuts",
      className: "shortcuts-modal",
      body: `
        <table class="shortcuts-table">
          <tbody>
            ${rows}
            <tr><td>Paragraph text</td><td><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>0</kbd></td></tr>
            <tr><td>Add a sticky note to the selection</td><td><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>M</kbd></td></tr>
            <tr><td>Save now</td><td><kbd>Ctrl</kbd>+<kbd>S</kbd></td></tr>
          </tbody>
        </table>
        <div class="modal-actions"><button type="button" class="btn btn-primary" data-modal-close autofocus>Done</button></div>`,
    });
  }

  function openColourMenu(button) {
    closeColourMenu();
    saveRange();
    const isHighlight = button.dataset.cmd === "highlight";
    const options = isHighlight ? HIGHLIGHTS : TEXT_COLOURS;
    const menu = document.createElement("div");
    menu.className = "colour-menu glass";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", isHighlight ? "Highlight colours" : "Text colours");
    menu.innerHTML = `
      ${options.map((o) => `<button type="button" class="colour-swatch" role="menuitem" data-colour="${o.value}" aria-label="${o.name}" title="${o.name}" style="--swatch: ${o.value}"></button>`).join("")}
      <button type="button" class="colour-swatch is-none" role="menuitem" data-colour="" aria-label="${isHighlight ? "No highlight" : "Default colour"}" title="${isHighlight ? "None" : "Default"}"></button>`;
    menu.dataset.cmd = button.dataset.cmd;
    main.appendChild(menu);
    const r = button.getBoundingClientRect();
    menu.style.left = `${Math.min(r.left, window.innerWidth - menu.offsetWidth - 8)}px`;
    menu.style.top = `${r.bottom + 6}px`;
    button.setAttribute("aria-expanded", "true");
    state.menu = menu;
    state.menuButton = button;
    menu.querySelector("button").focus();
  }

  function closeColourMenu({ returnFocus = false } = {}) {
    if (!state.menu) return;
    const button = state.menuButton;
    button.setAttribute("aria-expanded", "false");
    state.menu.remove();
    state.menu = null;
    if (returnFocus) button.focus();
  }

  function applyColour(cmd, value) {
    restoreRange();
    if (cmd === "highlight") {
      if (value) {
        state.highlight = value;
        main.querySelector("[data-cmd='highlight'] .tb-swatch").style.background = value;
      }
      exec("hiliteColor", value || "transparent");
    } else {
      exec("foreColor", value || getComputedStyle(editor).color);
    }
  }

  function runCommand(cmd, button) {
    if (cmd === "shortcuts") return openShortcuts();
    if (state.mode !== "edit") return;
    if (cmd === "highlight" || cmd === "color") {
      if (state.menu && state.menu.dataset.cmd === cmd) return closeColourMenu();
      return openColourMenu(button);
    }
    if (cmd === "link") return openLinkDialog();
    if (cmd === "image") {
      saveRange();
      return main.querySelector("#image-input").click();
    }
    editor.focus({ preventScroll: true });
    switch (cmd) {
      case "undo": return exec("undo");
      case "redo": return exec("redo");
      case "h1": case "h2": case "h3": return toggleBlock(cmd);
      case "p": return exec("formatBlock", "p");
      case "bold": return exec("bold");
      case "italic": return exec("italic");
      case "underline": return exec("underline");
      case "strike": return exec("strikeThrough");
      case "alignLeft": return exec("justifyLeft");
      case "alignCenter": return exec("justifyCenter");
      case "alignRight": return exec("justifyRight");
      case "justify": return exec("justifyFull");
      case "bullets": return exec("insertUnorderedList");
      case "numbers": return exec("insertOrderedList");
      case "checklist": return insertChecklist();
      case "quote": return toggleBlock("blockquote");
      case "code": return insertCodeBlock();
      case "table": return insertTable();
      case "quickHighlight": return exec("hiliteColor", state.highlight);
      default: return undefined;
    }
  }

  function updateToolbarState() {
    if (state.mode !== "edit") return;
    const range = selectionInEditor();
    const block = currentBlock();
    const node = range && (range.startContainer.nodeType === 3 ? range.startContainer.parentNode : range.startContainer);
    const list = node && node.closest && node.closest("ul, ol");
    const q = (c) => { try { return document.queryCommandState(c); } catch { return false; } };
    const pressed = {
      bold: q("bold"), italic: q("italic"), underline: q("underline"), strike: q("strikeThrough"),
      alignLeft: q("justifyLeft"), alignCenter: q("justifyCenter"), alignRight: q("justifyRight"), justify: q("justifyFull"),
      h1: !!(block && block.closest("h1")), h2: !!(block && block.closest("h2")), h3: !!(block && block.closest("h3")),
      quote: !!(block && block.closest("blockquote")), code: !!(block && block.closest("pre")),
      bullets: !!(list && list.tagName === "UL" && !list.classList.contains("checklist")),
      numbers: !!(list && list.tagName === "OL"),
      checklist: !!(list && list.classList.contains("checklist")),
    };
    main.querySelectorAll(".notes-toolbar [aria-pressed]").forEach((b) => {
      b.setAttribute("aria-pressed", String(Boolean(range && pressed[b.dataset.cmd])));
    });
  }

  // ---------------------------------------------------------------------------
  // Mini-toolbar on text selection
  // ---------------------------------------------------------------------------

  function showMini() {
    const range = selectionInEditor();
    const mini = main.querySelector(".mini-toolbar");
    if (!range || range.collapsed || !range.toString().trim() || range.commonAncestorContainer.closest?.(".sticky")) return hideMini();
    const editing = state.mode === "edit";
    mini.innerHTML = `
      ${editing ? `
        <button type="button" class="tb-btn" data-mini="bold" aria-label="Bold" title="Bold (Ctrl+B)">${TB.bold}</button>
        <button type="button" class="tb-btn" data-mini="italic" aria-label="Italic" title="Italic (Ctrl+I)">${TB.italic}</button>
        <button type="button" class="tb-btn" data-mini="underline" aria-label="Underline" title="Underline (Ctrl+U)">${TB.underline}</button>
        <button type="button" class="tb-btn" data-mini="quickHighlight" aria-label="Highlight" title="Highlight (Ctrl+Shift+H)">${TB.highlight}<span class="tb-swatch" style="background: ${state.highlight}"></span></button>
        <button type="button" class="tb-btn" data-mini="link" aria-label="Link" title="Link (Ctrl+K)">${TB.link}</button>
        <span class="tb-sep" aria-hidden="true"></span>` : ""}
      <button type="button" class="mini-sticky" data-mini="sticky" title="Add sticky note (Ctrl+Alt+M)">${TB.sticky}Add sticky note</button>`;
    mini.hidden = false;
    const rect = range.getBoundingClientRect();
    const width = mini.offsetWidth;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2));
    const above = rect.top - mini.offsetHeight - 10;
    mini.style.left = `${left}px`;
    mini.style.top = `${above > 70 ? above : rect.bottom + 10}px`;
  }

  function hideMini() {
    const mini = main.querySelector(".mini-toolbar");
    if (mini) mini.hidden = true;
  }

  // ---------------------------------------------------------------------------
  // Sticky notes
  // ---------------------------------------------------------------------------

  const anchorFor = (id) => editor.querySelector(`.sticky-anchor[data-sticky="${id}"]`);

  function stickyHtml(st, inline) {
    const label = KINDS[st.kind] || KINDS.mine;
    const kindControl = st.auto
      ? `<span class="sticky-kind">${label}</span>`
      : `<label class="visually-hidden" for="kind-${st.id}">Sticky type</label>
         <select class="sticky-kind-select" id="kind-${st.id}" data-sticky-kind>
           ${Object.entries(KINDS).map(([k, v]) => `<option value="${k}"${k === st.kind ? " selected" : ""}>${v}</option>`).join("")}
         </select>`;
    const preview = st.text.trim() ? escapeHtml(st.text.trim().slice(0, 48)) + (st.text.trim().length > 48 ? "…" : "") : "Empty note";
    return `
      <aside class="sticky kind-${st.kind}${st.collapsed ? " is-collapsed" : ""}${inline ? " is-inline" : ""}" data-sticky-id="${st.id}"
        contenteditable="false" aria-label="${label} sticky note">
        <div class="sticky-head">
          ${inline ? "" : `<button type="button" class="sticky-btn sticky-grip" data-sticky-grip aria-label="Move sticky note. Use the up and down arrow keys" title="Drag to move">${TB.grip}</button>`}
          ${kindControl}
          <button type="button" class="sticky-btn" data-sticky-collapse aria-expanded="${!st.collapsed}" aria-label="${st.collapsed ? "Expand" : "Collapse"} sticky note">${icon("chevronDown")}</button>
          <button type="button" class="sticky-btn" data-sticky-delete aria-label="Delete sticky note">${icon("trash")}</button>
        </div>
        ${st.collapsed
          ? `<p class="sticky-preview">${preview}</p>`
          : `<textarea class="sticky-text" rows="2" aria-label="${label} text" placeholder="Write your note…">${escapeHtml(st.text)}</textarea>`}
      </aside>`;
  }

  function sizeTextarea(t) {
    t.style.height = "auto";
    t.style.height = `${t.scrollHeight}px`;
  }

  function renderStickies() {
    editor.querySelectorAll(".sticky").forEach((el) => el.remove());
    const rail = main.querySelector(".sticky-rail");
    rail.innerHTML = "";
    // Order by position in the document; stickies whose text was deleted go last.
    const ordered = [...doc.stickies].sort((a, b) => {
      const x = anchorFor(a.id);
      const y = anchorFor(b.id);
      if (!x || !y) return x ? -1 : y ? 1 : 0;
      return x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });

    for (const st of ordered) {
      const anchor = anchorFor(st.id);
      if (anchor) anchor.dataset.kind = st.kind;
      if (state.inline) {
        if (!anchor) continue;
        let block = anchor;
        while (block.parentElement && block.parentElement !== editor) block = block.parentElement;
        block.insertAdjacentHTML("afterend", stickyHtml(st, true));
      } else {
        rail.insertAdjacentHTML("beforeend", stickyHtml(st, false));
      }
    }
    main.querySelectorAll(".sticky-text").forEach(sizeTextarea);
    positionStickies();
  }

  // Margin mode: each sticky goes level with its anchor (plus the user's offset),
  // pushed down so stickies never overlap.
  function positionStickies() {
    if (state.inline) return;
    const rail = main.querySelector(".sticky-rail");
    const railTop = rail.getBoundingClientRect().top;
    let bottom = 0;
    rail.querySelectorAll(".sticky").forEach((el) => {
      const st = doc.stickies.find((x) => x.id === el.dataset.stickyId);
      const anchor = anchorFor(st.id);
      const want = anchor ? anchor.getBoundingClientRect().top - railTop + (st.offset || 0) : bottom;
      const top = Math.max(want, bottom);
      el.style.top = `${Math.round(top)}px`;
      el.classList.toggle("is-orphan", !anchor);
      bottom = top + el.offsetHeight + 8;
    });
    rail.style.minHeight = `${bottom}px`;
  }

  function layoutStickies() {
    const width = main.querySelector(".notes-layout").clientWidth;
    const inline = width < INLINE_BELOW;
    if (inline !== state.inline || !main.querySelector(".sticky")) {
      state.inline = inline;
      main.querySelector(".notes-doc-wrap").classList.toggle("is-inline", inline);
      renderStickies();
    } else {
      positionStickies();
    }
  }

  function wrapSelection(range, el) {
    try {
      range.surroundContents(el);
    } catch {
      el.appendChild(range.extractContents()); // selection crosses element boundaries
      range.insertNode(el);
    }
  }

  function addSticky() {
    const range = selectionInEditor() || state.savedRange;
    if (!range || range.collapsed) {
      showToast("Select some text first, then add a sticky note.");
      return;
    }
    if (range.commonAncestorContainer.closest?.(".sticky-anchor") || (range.commonAncestorContainer.nodeType === 3 && range.commonAncestorContainer.parentNode.closest(".sticky-anchor"))) {
      showToast("That text already has a sticky note.");
      return;
    }
    const id = `my-st-${Date.now().toString(36)}`;
    const anchor = document.createElement("span");
    anchor.className = "sticky-anchor";
    anchor.dataset.sticky = id;
    wrapSelection(range, anchor);
    window.getSelection().removeAllRanges();
    doc.stickies.push({ id, kind: "mine", text: "", auto: false, collapsed: false, offset: 0 });
    hideMini();
    renderStickies();
    scheduleSave();
    const text = main.querySelector(`[data-sticky-id="${id}"] .sticky-text`);
    text.focus({ preventScroll: true });
    text.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
  }

  async function deleteSticky(id) {
    const st = doc.stickies.find((x) => x.id === id);
    if (st.text.trim()) {
      const ok = await confirmDialog({ title: "Delete this sticky note?", message: "Its text will be removed from your notes.", confirmLabel: "Delete", danger: true });
      if (!ok) return;
    }
    doc.stickies = doc.stickies.filter((x) => x.id !== id);
    const anchor = anchorFor(id);
    if (anchor) anchor.replaceWith(...anchor.childNodes);
    renderStickies();
    scheduleSave();
    showToast("Sticky note deleted");
  }

  function linkSticky(id, on) {
    const anchor = anchorFor(id);
    if (anchor) anchor.classList.toggle("is-linked", on);
    const el = main.querySelector(`[data-sticky-id="${id}"]`);
    if (el) el.classList.toggle("is-linked", on);
  }

  // Drag the grip to move a sticky up or down the margin.
  let drag = null;
  function startDrag(event, el) {
    const st = doc.stickies.find((x) => x.id === el.dataset.stickyId);
    drag = { el, st, startY: event.clientY, startOffset: st.offset || 0, startTop: parseFloat(el.style.top) || 0, id: event.pointerId };
    el.classList.add("is-dragging");
    event.target.setPointerCapture(event.pointerId);
  }

  // ---------------------------------------------------------------------------
  // Source panel: the PDF page a star came from, with the passage highlighted
  // ---------------------------------------------------------------------------

  let pdfPromise = null;

  function getPdf() {
    if (!pdfPromise) {
      pdfPromise = loadPdfJs().then(async (lib) => {
        let data;
        try {
          const res = await fetch(PDF_URL);
          if (!res.ok) throw new Error(res.statusText);
          data = new Uint8Array(await res.arrayBuffer());
        } catch {
          // Opened from disk: fetch() can't read files, so use the bundled base64 copy.
          if (!window.SAMPLE_PDF_BASE64) await loadScript("../assets/sample-pdf.js");
          data = Uint8Array.from(atob(window.SAMPLE_PDF_BASE64), (c) => c.charCodeAt(0));
        }
        return lib.getDocument({ data }).promise;
      });
      pdfPromise.catch(() => { pdfPromise = null; });
    }
    return pdfPromise;
  }

  // Finds the quote in the page's text items (ignoring spacing and case) and
  // returns highlight rectangles in viewport pixels, one per text run.
  function findQuoteRects(items, quote, viewport) {
    let joined = "";
    const map = []; // joined index -> [item, char]
    items.forEach((item, i) => {
      const str = item.str.normalize("NFKC");
      for (let c = 0; c < str.length; c++) {
        if (/\s/.test(str[c])) continue;
        joined += str[c].toLowerCase();
        map.push([i, c]);
      }
    });
    const needle = quote.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
    const start = joined.indexOf(needle);
    if (start < 0) return [];
    const spans = new Map();
    for (let k = start; k < start + needle.length; k++) {
      const [i, c] = map[k];
      const span = spans.get(i) || { from: c, to: c };
      span.to = c;
      spans.set(i, span);
    }
    const { Util } = window.pdfjsLib;
    return [...spans.entries()].map(([i, { from, to }]) => {
      const item = items[i];
      const len = item.str.normalize("NFKC").length || 1;
      const tx = Util.transform(viewport.transform, item.transform);
      const height = Math.hypot(tx[2], tx[3]);
      const width = item.width * viewport.scale;
      return {
        left: tx[4] + (width * from) / len - 2,
        top: tx[5] - height * 0.95,
        width: (width * (to + 1 - from)) / len + 4,
        height: height * 1.25,
      };
    });
  }

  function sourceShellHtml(src) {
    return `
      <div class="source-head">
        <div>
          <p class="source-kicker">${icon("file")}Source</p>
          <h2 id="source-title">${escapeHtml(seed.file)}</h2>
        </div>
        <button type="button" class="icon-btn" data-source-close aria-label="Close source">${icon("close")}</button>
      </div>
      <div class="source-nav">
        <button type="button" class="icon-btn" data-page="-1" aria-label="Previous page">${icon("chevronLeft")}</button>
        <span class="source-page" aria-live="polite">Page ${src.page}</span>
        <button type="button" class="icon-btn" data-page="1" aria-label="Next page">${icon("chevronRight")}</button>
      </div>
      <div class="source-body">
        <div class="pdf-frame"><p class="source-loading muted">Loading page ${src.page}…</p></div>
        <figure class="source-quote">
          <figcaption>Highlighted passage · page ${src.page}</figcaption>
          <blockquote>${escapeHtml(src.quote)}</blockquote>
        </figure>
      </div>`;
  }

  async function renderSourcePage(pageNumber) {
    const panel = main.querySelector(".source-panel");
    const frame = panel.querySelector(".pdf-frame");
    const src = state.source;
    src.shown = pageNumber;
    panel.querySelector(".source-page").textContent = `Page ${pageNumber}${src.pages ? ` of ${src.pages}` : ""}`;
    try {
      const pdf = await getPdf();
      if (state.source !== src) return; // closed or replaced while loading
      src.pages = pdf.numPages;
      panel.querySelector(".source-page").textContent = `Page ${pageNumber} of ${pdf.numPages}`;
      panel.querySelector("[data-page='-1']").disabled = pageNumber <= 1;
      panel.querySelector("[data-page='1']").disabled = pageNumber >= pdf.numPages;

      const page = await pdf.getPage(pageNumber);
      const cssWidth = frame.clientWidth;
      const viewport = page.getViewport({ scale: cssWidth / page.getViewport({ scale: 1 }).width });
      const ratio = window.devicePixelRatio || 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `Page ${pageNumber} of ${seed.file}`);
      await page.render({ canvasContext: canvas.getContext("2d"), viewport, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null }).promise;
      if (state.source !== src || src.shown !== pageNumber) return;

      frame.innerHTML = "";
      frame.style.height = `${viewport.height}px`;
      frame.appendChild(canvas);

      if (pageNumber === src.page) {
        const text = await page.getTextContent();
        const rects = findQuoteRects(text.items, src.quote, viewport);
        frame.insertAdjacentHTML("beforeend", rects.map((r) =>
          `<span class="pdf-hl" style="left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px"></span>`).join(""));
        const first = frame.querySelector(".pdf-hl");
        if (first) {
          const body = panel.querySelector(".source-body");
          body.scrollTo({ top: Math.max(0, first.offsetTop - 80), behavior: reducedMotion() ? "auto" : "smooth" });
        } else {
          frame.insertAdjacentHTML("afterend", '<p class="source-miss muted">Couldn\'t pinpoint the passage on this page; it\'s quoted below.</p>');
        }
      }
    } catch (err) {
      console.warn("SkipXam: could not show the PDF.", err);
      frame.style.height = "";
      frame.innerHTML = `<p class="source-error">Couldn't load the PDF viewer. Check your connection and try again. The passage is quoted below.</p>
        <button type="button" class="btn btn-secondary btn-sm" data-source-retry>Try again</button>`;
    }
  }

  function openSource(star) {
    const src = seed.sources.find((x) => x.id === star.dataset.source);
    if (!src) return;
    const panel = main.querySelector(".source-panel");
    main.querySelectorAll(".source-star.is-active").forEach((s) => s.classList.remove("is-active"));
    star.classList.add("is-active");
    state.source = { ...src, star };
    panel.innerHTML = sourceShellHtml(src);
    panel.hidden = false;
    document.body.classList.add("has-source-panel");
    panel.querySelector("[data-source-close]").focus();
    renderSourcePage(src.page);
  }

  function closeSource() {
    if (!state.source) return;
    const { star } = state.source;
    state.source = null;
    const panel = main.querySelector(".source-panel");
    panel.hidden = true;
    panel.innerHTML = "";
    document.body.classList.remove("has-source-panel");
    star.classList.remove("is-active");
    if (document.contains(star)) star.focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  function bind() {
    // Keep the editor selection when pressing toolbar buttons.
    main.addEventListener("mousedown", (event) => {
      if (event.target.closest(".notes-toolbar .tb-btn, .mini-toolbar button, .colour-menu button")) event.preventDefault();
    });

    main.addEventListener("click", (event) => {
      const t = event.target;

      const star = t.closest(".source-star");
      if (star) {
        event.preventDefault();
        if (state.source && state.source.star === star) return closeSource();
        return openSource(star);
      }
      if (t.closest("[data-source-close]")) return closeSource();
      if (t.closest("[data-source-retry]")) return renderSourcePage(state.source.page);
      const pageBtn = t.closest("[data-page]");
      if (pageBtn && state.source) return renderSourcePage(state.source.shown + Number(pageBtn.dataset.page));

      const swatch = t.closest("[data-colour]");
      if (swatch) {
        const { cmd } = state.menu.dataset;
        closeColourMenu();
        return applyColour(cmd, swatch.dataset.colour);
      }
      if (state.menu && !t.closest(".tb-menu-wrap, .colour-menu")) closeColourMenu();

      const tool = t.closest("[data-cmd]");
      if (tool) return runCommand(tool.dataset.cmd, tool);

      const mini = t.closest("[data-mini]");
      if (mini) {
        if (mini.dataset.mini === "sticky") return addSticky();
        if (mini.dataset.mini === "link") { hideMini(); return openLinkDialog(); }
        runCommand(mini.dataset.mini);
        return showMini();
      }

      const tocLink = t.closest("[data-toc]");
      if (tocLink) {
        event.preventDefault();
        return goToHeading(tocLink.dataset.toc);
      }

      const sticky = t.closest(".sticky");
      if (sticky) {
        const id = sticky.dataset.stickyId;
        const st = doc.stickies.find((x) => x.id === id);
        if (t.closest("[data-sticky-delete]")) return deleteSticky(id);
        if (t.closest("[data-sticky-collapse]")) {
          st.collapsed = !st.collapsed;
          renderStickies();
          scheduleSave();
          main.querySelector(`[data-sticky-id="${id}"] [data-sticky-collapse]`).focus();
          return undefined;
        }
        if (st.collapsed && t.closest(".sticky-preview")) {
          st.collapsed = false;
          renderStickies();
          scheduleSave();
          main.querySelector(`[data-sticky-id="${id}"] .sticky-text`).focus();
        }
        return undefined;
      }

      // Checklist: clicking the box toggles the item.
      const item = t.closest(".checklist > li");
      if (item && event.clientX - item.getBoundingClientRect().left < 28) {
        event.preventDefault();
        item.dataset.checked = item.dataset.checked === "true" ? "false" : "true";
        scheduleSave();
        return undefined;
      }

      // Links: open in a new tab when reading, or with Ctrl/Cmd+click when editing.
      const link = t.closest(".notes-doc a[href]");
      if (link && (state.mode === "read" || event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        window.open(link.href, "_blank", "noopener");
      }
      return undefined;
    });

    main.addEventListener("change", (event) => {
      const t = event.target;
      if (t.name === "notes-mode") return setMode(t.value);
      if (t.id === "toc-select") {
        if (t.value) goToHeading(t.value);
        t.value = "";
        return undefined;
      }
      if (t.id === "image-input") {
        insertImage(t.files[0]);
        t.value = "";
        return undefined;
      }
      if (t.matches("[data-sticky-kind]")) {
        const el = t.closest(".sticky");
        const st = doc.stickies.find((x) => x.id === el.dataset.stickyId);
        st.kind = t.value;
        const anchor = anchorFor(st.id);
        if (anchor) anchor.dataset.kind = st.kind;
        el.className = el.className.replace(/kind-\w+/, `kind-${st.kind}`);
        scheduleSave();
      }
      return undefined;
    });

    main.addEventListener("input", (event) => {
      if (event.target.classList.contains("sticky-text")) {
        const el = event.target.closest(".sticky");
        doc.stickies.find((x) => x.id === el.dataset.stickyId).text = event.target.value;
        sizeTextarea(event.target);
        positionStickies();
        scheduleSave();
        return;
      }
      if (event.target === editor || editor.contains(event.target)) {
        scheduleSave();
        positionStickies();
      }
    });

    main.addEventListener("focusin", (event) => {
      const el = event.target.closest(".sticky");
      if (el) linkSticky(el.dataset.stickyId, true);
    });
    main.addEventListener("focusout", (event) => {
      const el = event.target.closest(".sticky");
      if (el) linkSticky(el.dataset.stickyId, false);
    });
    main.addEventListener("pointerover", (event) => {
      const el = event.target.closest(".sticky, .sticky-anchor");
      if (el) linkSticky(el.dataset.stickyId || el.dataset.sticky, true);
    });
    main.addEventListener("pointerout", (event) => {
      const el = event.target.closest(".sticky, .sticky-anchor");
      if (el && !el.contains(event.relatedTarget)) linkSticky(el.dataset.stickyId || el.dataset.sticky, false);
    });

    // Moving stickies: drag the grip, or arrow keys on it.
    main.addEventListener("pointerdown", (event) => {
      const grip = event.target.closest("[data-sticky-grip]");
      if (grip && event.button === 0) startDrag(event, grip.closest(".sticky"));
    });
    main.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      drag.el.style.top = `${Math.max(0, drag.startTop + event.clientY - drag.startY)}px`;
    });
    const endDrag = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      drag.st.offset = drag.startOffset + (event.clientY - drag.startY);
      drag.el.classList.remove("is-dragging");
      drag = null;
      positionStickies();
      scheduleSave();
    };
    main.addEventListener("pointerup", endDrag);
    main.addEventListener("pointercancel", endDrag);

    main.addEventListener("keydown", (event) => {
      const grip = event.target.closest("[data-sticky-grip]");
      if (grip && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        const st = doc.stickies.find((x) => x.id === grip.closest(".sticky").dataset.stickyId);
        st.offset = (st.offset || 0) + (event.key === "ArrowUp" ? -16 : 16);
        positionStickies();
        scheduleSave();
        return;
      }
      if (event.key === "Escape") {
        if (state.menu) { event.preventDefault(); closeColourMenu({ returnFocus: true }); return; }
        if (state.source) { event.preventDefault(); closeSource(); return; }
        if (!main.querySelector(".mini-toolbar").hidden) hideMini();
      }
    });

    // Editor shortcuts.
    editor.addEventListener("keydown", (event) => {
      if (event.target.closest(".sticky")) return; // typing in an inline sticky
      const ctrl = event.ctrlKey || event.metaKey;
      const k = event.key.toLowerCase();
      let cmd = null;
      if (ctrl && k === "s") { event.preventDefault(); save(); return; }
      if (ctrl && event.altKey && event.code === "KeyM") cmd = "sticky";
      else if (state.mode !== "edit") return;
      else if (ctrl && event.altKey && /^Digit[0-3]$/.test(event.code)) cmd = ["p", "h1", "h2", "h3"][Number(event.code.slice(-1))];
      else if (ctrl && event.altKey && event.code === "KeyQ") cmd = "quote";
      else if (ctrl && event.altKey && event.code === "KeyC") cmd = "code";
      else if (ctrl && event.shiftKey && event.code === "KeyX") cmd = "strike";
      else if (ctrl && event.shiftKey && event.code === "KeyH") cmd = "quickHighlight";
      else if (ctrl && event.shiftKey && event.code === "Digit7") cmd = "numbers";
      else if (ctrl && event.shiftKey && event.code === "Digit8") cmd = "bullets";
      else if (ctrl && event.shiftKey && event.code === "Digit9") cmd = "checklist";
      else if (ctrl && !event.shiftKey && k === "k") cmd = "link";
      else if (event.altKey && event.shiftKey && !ctrl) cmd = { KeyL: "alignLeft", KeyE: "alignCenter", KeyR: "alignRight", KeyJ: "justify" }[event.code];
      if (!cmd) return;
      event.preventDefault();
      if (cmd === "sticky") addSticky(); else runCommand(cmd);
    });

    document.addEventListener("selectionchange", () => {
      updateToolbarState();
      clearTimeout(state.miniTimer);
      state.miniTimer = setTimeout(showMini, 180);
    });
    window.addEventListener("scroll", () => {
      if (!main.querySelector(".mini-toolbar").hidden) showMini();
    }, { passive: true });

    // Stickies follow the text as the layout changes (resizing, images loading, fonts).
    new ResizeObserver(() => layoutStickies()).observe(main.querySelector(".notes-layout"));
    new ResizeObserver(() => positionStickies()).observe(editor);
    if (document.fonts) document.fonts.ready.then(positionStickies);
  }

  if (render()) {
    bind();
    if (startTopic) {
      const heading = [...editor.querySelectorAll("h2, h3")].find((h) => h.textContent.toLowerCase().includes(startTopic.name.toLowerCase().split(/[&(]/)[0].trim()));
      // Wait for the web font: text reflows when it loads and would move the heading.
      const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
      if (heading) fontsReady.then(() => requestAnimationFrame(() => goToHeading(heading.id, { instant: true })));
    } else {
      recordActivity(set.id, "notes", 1, Math.max(1, editor.querySelectorAll("h2").length));
    }
  }
})();
