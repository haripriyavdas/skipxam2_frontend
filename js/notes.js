/*
 * Smart notes (app/notes.html?set=<id>[&topic=<topicId>]). Load after data.js and app.js.
 */
(function () {
  "use strict";

  const main = document.querySelector("main");
  const { set, topic: startTopic } = setFromUrl();

  const sectionId = (topicId) => `section-${topicId}`;

  function sectionHtml(section, index) {
    const topic = set.topics.find((t) => t.id === section.topicId);
    const name = topic ? topic.name : `Section ${index + 1}`;
    const cardCount = set.flashcards.filter((c) => c.topicId === section.topicId).length;
    const quizCount = set.quiz.filter((q) => q.topicId === section.topicId).length;

    const formulas = section.formulas.map((f) => `
      <div class="formula">
        <span class="formula-label">${escapeHtml(f.label)}</span>
        <span class="formula-expr">${escapeHtml(f.expr)}</span>
      </div>`).join("");

    const practice = [
      cardCount ? `<a class="practice-link" href="${toolUrl("flashcards", set.id, { topic: section.topicId })}">${icon("cards")}Flashcards <span class="muted">${cardCount}</span></a>` : "",
      quizCount ? `<a class="practice-link" href="${toolUrl("quiz", set.id, { topic: section.topicId })}">${icon("quiz")}Quiz <span class="muted">${quizCount}</span></a>` : "",
    ].join("");

    return `
      <details class="note-section" id="${sectionId(section.topicId)}" data-index="${index}" open>
        <summary>
          <span class="note-number">${index + 1}</span>
          <h2>${escapeHtml(name)}</h2>
          ${topic ? `<span class="note-mastery">${topic.mastery}%</span>` : ""}
          <span class="note-chevron" aria-hidden="true"></span>
        </summary>
        <div class="note-body">
          <p class="note-intro">${richText(section.intro)}</p>
          ${section.points.length ? `<ul class="note-points">${section.points.map((p) => `<li>${richText(p)}</li>`).join("")}</ul>` : ""}
          ${formulas ? `<div class="formulas">${formulas}</div>` : ""}
          ${section.remember ? `
            <aside class="remember">
              <span class="remember-label">${icon("sparkle")}Remember this</span>
              <p>${richText(section.remember)}</p>
            </aside>` : ""}
          ${practice ? `<div class="practice"><span class="practice-title">Practice this</span>${practice}</div>` : ""}
        </div>
      </details>`;
  }

  function tocHtml() {
    const name = (s, i) => {
      const t = set.topics.find((x) => x.id === s.topicId);
      return escapeHtml(t ? t.name : `Section ${i + 1}`);
    };
    return `
      <nav class="notes-toc" aria-label="Table of contents">
        <p class="toc-title">Contents</p>
        <ol>
          ${set.notes.map((s, i) => `<li><a href="#${sectionId(s.topicId)}" data-toc="${s.topicId}">${name(s, i)}</a></li>`).join("")}
        </ol>
      </nav>
      <div class="notes-toc-mobile">
        <label class="visually-hidden" for="toc-select">Jump to section</label>
        <select class="input" id="toc-select">
          <option value="">Jump to section…</option>
          ${set.notes.map((s, i) => `<option value="${s.topicId}">${i + 1}. ${name(s, i)}</option>`).join("")}
        </select>
      </div>`;
  }

  function render() {
    if (!set) {
      main.innerHTML = setNotFoundHtml();
      return;
    }
    document.title = `Smart notes · ${set.name} · SkipXam`;

    if (set.notes.length === 0) {
      main.innerHTML = `
        ${toolHeaderHtml(set, "Smart notes")}
        ${emptyStateHtml({
          title: "No smart notes yet",
          text: "Your smart notes appear here once your notes are processed.",
          action: { label: "Go to set", href: `set.html?set=${encodeURIComponent(set.id)}` },
        })}`;
      return;
    }

    main.innerHTML = `
      ${toolHeaderHtml(set, "Smart notes", `
        <div class="notes-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-toggle-all="close">Collapse all</button>
          <button type="button" class="btn btn-ghost btn-sm" data-toggle-all="open">Expand all</button>
        </div>`)}
      <div class="notes-layout">
        ${tocHtml()}
        <div class="notes-content">${set.notes.map(sectionHtml).join("")}</div>
      </div>`;
  }

  // ---------------------------------------------------------------------------
  // Behaviour
  // ---------------------------------------------------------------------------

  function goToSection(topicId) {
    const section = document.getElementById(sectionId(topicId));
    if (!section) return;
    section.open = true;
    section.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    section.querySelector("summary").focus({ preventScroll: true });
    record(Number(section.dataset.index));
  }

  const logged = new Set();

  function record(index) {
    recordActivity(set.id, "notes", index + 1, set.notes.length);
    const section = set.notes[index];
    if (index > 0 && section && !logged.has(section.topicId)) { // index 0 is the automatic first view
      logged.add(section.topicId);
      logActivity(set.id, "notes", `Read notes on ${topicName(set, section.topicId)}`);
    }
  }

  function highlightToc(topicId) {
    main.querySelectorAll("[data-toc]").forEach((a) => {
      if (a.dataset.toc === topicId) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  }

  function bind() {
    main.addEventListener("click", (event) => {
      const tocLink = event.target.closest("[data-toc]");
      if (tocLink) {
        event.preventDefault();
        goToSection(tocLink.dataset.toc);
        return;
      }
      const toggle = event.target.closest("[data-toggle-all]");
      if (toggle) {
        const open = toggle.dataset.toggleAll === "open";
        main.querySelectorAll(".note-section").forEach((d) => { d.open = open; });
      }
    });

    const select = main.querySelector("#toc-select");
    select.addEventListener("change", () => {
      if (select.value) goToSection(select.value);
      select.value = "";
    });

    main.querySelectorAll(".note-section").forEach((section) => {
      section.addEventListener("toggle", () => { if (section.open) record(Number(section.dataset.index)); });
    });

    // Highlight the section currently in view in the table of contents.
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) highlightToc(visible.target.id.replace("section-", ""));
      }, { rootMargin: "0px 0px -60% 0px" });
      main.querySelectorAll(".note-section").forEach((s) => observer.observe(s));
    }
  }

  render();
  if (set && set.notes.length) {
    bind();
    if (startTopic) requestAnimationFrame(() => goToSection(startTopic.id));
    else record(0);
  }
})();
