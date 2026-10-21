/*
 * Study set page (app/set.html?set=<id>). Load after data.js and app.js.
 * Three states: upload (no files yet), processing (mock), and the set home.
 */
(function () {
  "use strict";

  const main = document.querySelector("main");
  const setId = new URLSearchParams(location.search).get("set");

  const ACCEPT = ".pdf,.ppt,.pptx,.doc,.docx,image/*";
  const FILE_TYPES = {
    pdf: { label: "PDF", icon: "file" },
    image: { label: "Image", icon: "image" },
    pptx: { label: "Slides", icon: "slides" },
    docx: { label: "Document", icon: "notes" },
    audio: { label: "Lecture recording", icon: "mic" },
  };

  // Steps shown while "processing" uploaded notes. Delays are fake.
  const PROCESS_STEPS = [
    { label: "Smart notes" },
    { label: "Flashcards" },
    { label: "Quiz" },
    { label: "Study plan" },
    { label: "Practice test", pro: true },
  ];

  const TOOL_GROUPS = [
    { title: "Organize", tools: ["notes", "plan", "record"] },
    { title: "Learn", tools: ["tutor", "visual"] },
    { title: "Practice", tools: ["flashcards", "quiz", "test"] },
  ];

  let processing = false;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const isFree = () => getUser().plan === "free";

  // Mock upload: only the file's name and type are used; contents are never read.
  function fileType(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "pdf") return "pdf";
    if (ext === "ppt" || ext === "pptx") return "pptx";
    if (ext === "doc" || ext === "docx") return "docx";
    if (file.type.startsWith("image/")) return "image";
    return null;
  }

  function toMockFiles(fileList) {
    const files = [...fileList].map((f) => ({ name: f.name, type: fileType(f) }));
    const supported = files.filter((f) => f.type);
    if (supported.length < files.length) showToast("Only PDFs, images, slides and documents can be added.");
    return supported;
  }

  function fileInputHtml() {
    return `<input type="file" class="visually-hidden file-input" multiple accept="${ACCEPT}" tabindex="-1" aria-hidden="true">`;
  }

  function topicTier(mastery) {
    if (mastery >= 70) return "strong";
    if (mastery >= 40) return "mid";
    return "weak";
  }

  // ---------------------------------------------------------------------------
  // Not found
  // ---------------------------------------------------------------------------

  function renderNotFound() {
    main.className = "container set-page";
    main.innerHTML = `
      <div class="set-missing">
        <h1>Study set not found</h1>
        <p class="muted">It may have been deleted.</p>
        <a class="btn btn-secondary" href="sets.html">Back to My Study Sets</a>
      </div>`;
  }

  // ---------------------------------------------------------------------------
  // Upload state (no files yet)
  // ---------------------------------------------------------------------------

  function renderUpload(set) {
    main.className = "container set-page set-upload";
    const previewTools = ["notes", "flashcards", "quiz", "plan", "test"];
    const meta = [set.subject, examLabel(set.examDate)].filter(Boolean).map(escapeHtml).join(" · ");

    main.innerHTML = `
      <div class="set-intro" style="--set-colour: ${set.colour}">
        <span class="set-emoji-lg" aria-hidden="true">${set.emoji}</span>
        <div>
          <h1>${escapeHtml(set.name)}</h1>
          <p class="muted">${meta}</p>
        </div>
      </div>

      <button type="button" class="dropzone">
        <span class="dropzone-icon">${icon("upload")}</span>
        <span class="dropzone-title">Upload your notes: PDF, images or slides</span>
        <span class="dropzone-hint">Drag files here, or click to choose</span>
      </button>
      ${fileInputHtml()}

      <div class="upload-alt">
        <button type="button" class="btn btn-secondary" data-record>
          ${icon("mic")}Record a lecture instead <span class="badge">Pro</span>
        </button>
      </div>

      <section class="unlock-preview" aria-labelledby="unlock-title">
        <h2 id="unlock-title">Your notes will unlock</h2>
        <ul class="preview-tiles">
          ${previewTools.map((tool) => `
            <li class="preview-tile">
              <span class="tool-icon">${icon(TOOLS[tool].icon)}</span>
              <span>${TOOLS[tool].label}</span>
              ${TOOLS[tool].pro && isFree() ? `<span class="lock-badge">${icon("lock")}Pro</span>` : ""}
            </li>`).join("")}
        </ul>
      </section>`;

    const dropzone = main.querySelector(".dropzone");
    const input = main.querySelector(".file-input");

    dropzone.addEventListener("click", () => input.click());
    input.addEventListener("change", () => startProcessing(set.id, input.files, false));

    dropzone.addEventListener("dragover", (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragging");
    });
    dropzone.addEventListener("dragleave", (event) => {
      if (!dropzone.contains(event.relatedTarget)) dropzone.classList.remove("is-dragging");
    });
    dropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragging");
      startProcessing(set.id, event.dataTransfer.files, false);
    });

    main.querySelector("[data-record]").addEventListener("click", () => {
      if (isFree()) openUpgrade("Record lecture");
      else location.href = toolUrl("record", set.id);
    });
  }

  // ---------------------------------------------------------------------------
  // Processing (mock): ticks off each tool with short fake delays
  // ---------------------------------------------------------------------------

  async function startProcessing(id, fileList, adding) {
    if (processing) return;
    const files = toMockFiles(fileList);
    if (files.length === 0) return;
    processing = true;

    const names = files.length === 1
      ? escapeHtml(files[0].name)
      : `${escapeHtml(files[0].name)} and ${files.length - 1} more`;

    main.className = "container set-page set-processing";
    main.innerHTML = `
      <section class="card processing" aria-labelledby="processing-title">
        <h1 id="processing-title">${adding ? "Adding your notes" : "Reading your notes"}</h1>
        <p class="muted processing-files">${icon("file")}${names}</p>
        <ol class="process-steps">
          ${PROCESS_STEPS.map((step) => `
            <li class="process-step is-pending">
              <span class="process-icon" aria-hidden="true"></span>
              <span class="process-label">${step.label}</span>
            </li>`).join("")}
        </ol>
        <p class="visually-hidden process-status" aria-live="polite"></p>
      </section>`;

    const rows = [...main.querySelectorAll(".process-step")];
    const status = main.querySelector(".process-status");
    const free = isFree();

    for (let i = 0; i < PROCESS_STEPS.length; i++) {
      const step = PROCESS_STEPS[i];
      const row = rows[i];
      const iconEl = row.querySelector(".process-icon");

      row.className = "process-step is-active";
      await sleep(600 + Math.random() * 500);

      if (step.pro && free) {
        row.className = "process-step is-locked";
        iconEl.innerHTML = icon("lock");
        row.insertAdjacentHTML("beforeend", '<span class="lock-badge">Pro</span>');
        status.textContent = `${step.label} needs Pro`;
      } else {
        row.className = "process-step is-done";
        iconEl.innerHTML = icon("check");
        status.textContent = `${step.label} ready`;
      }
    }

    await sleep(600);
    addFilesToSet(id, files);
    processing = false;
    render();
    showToast(adding ? "Notes added" : "Your study set is ready");
  }

  // ---------------------------------------------------------------------------
  // Set home
  // ---------------------------------------------------------------------------

  function headerHtml(set) {
    const days = set.examDate ? daysUntil(set.examDate) : null;
    const soon = days !== null && days >= 0 && days <= 3;
    const mastery = getSetMastery(set);
    const examDate = set.examDate && days >= 0 ? ` · ${formatDate(set.examDate)}` : "";

    return `
      <header class="set-header" style="--set-colour: ${set.colour}">
        <span class="set-emoji-lg" aria-hidden="true">${set.emoji}</span>
        <div class="set-header-text">
          <h1>${escapeHtml(set.name)}</h1>
          ${set.subject ? `<p class="muted">${escapeHtml(set.subject)}</p>` : ""}
          <p class="set-exam-line${soon ? " is-soon" : ""}">${examLabel(set.examDate)}${examDate}</p>
        </div>
        ${set.topics.length ? masteryRing(mastery, { size: 64, urgent: soon && mastery < 50 }) : ""}
      </header>`;
  }

  function topicsHtml(set) {
    if (set.topics.length === 0) return "";
    const topics = [...set.topics].sort((a, b) => b.mastery - a.mastery);
    return `
      <div class="topic-chips" aria-label="Topics by mastery">
        ${topics.map((t) => `
          <a class="chip topic-chip tier-${topicTier(t.mastery)}" href="${toolUrl("quiz", set.id, { topic: t.id })}"
            aria-label="${escapeHtml(t.name)}, ${t.mastery}% mastery. Quiz this topic">
            <span class="topic-dot" aria-hidden="true"></span>
            ${escapeHtml(t.name)}
            <span class="topic-pct">${t.mastery}%</span>
          </a>`).join("")}
      </div>`;
  }

  function todayTaskHtml(set) {
    const today = todayISO();
    const todays = set.studyPlan.filter((t) => t.date === today);
    const current = todays.find((t) => !t.done);
    const doneCount = todays.filter((t) => t.done).length;
    const upcoming = set.studyPlan
      .filter((t) => t.date > today && !t.done)
      .sort((a, b) => a.date.localeCompare(b.date))[0];

    const nextUp = upcoming
      ? `<p class="muted">Next up: ${escapeHtml(upcoming.title)}, ${formatDate(upcoming.date)}</p>`
      : "";

    let body;
    if (current) {
      body = `
        <div class="today-task-main">
          <span class="tool-icon">${icon(TOOLS[current.tool] ? TOOLS[current.tool].icon : "plan")}</span>
          <div>
            <h2>${escapeHtml(current.title)}</h2>
            <p class="muted">${toolLabel(current.tool)} · ${doneCount} of ${todays.length} done today</p>
          </div>
        </div>
        <a class="btn btn-primary" href="${toolUrl(current.tool, set.id)}">Start</a>`;
    } else if (todays.length) {
      body = `<div><h2>All done for today</h2>${nextUp}</div>`;
    } else if (set.studyPlan.length) {
      body = `<div><h2>Nothing planned for today</h2>${nextUp}</div>`;
    } else {
      body = `
        <div><h2>No study plan yet</h2><p class="muted">Add an exam date and we'll plan your study days.</p></div>
        <a class="btn btn-secondary" href="${toolUrl("plan", set.id)}">Open study plan</a>`;
    }

    return `
      <section class="card today-task" aria-label="Today's task">
        <p class="eyebrow">Today's task</p>
        <div class="today-task-body">${body}</div>
      </section>`;
  }

  function toolMeta(tool, set) {
    switch (tool) {
      case "notes": return set.notes.length ? `${set.notes.length} sections` : "Ready soon";
      case "plan": {
        const done = set.studyPlan.filter((t) => t.done).length;
        return set.studyPlan.length ? `${done} of ${set.studyPlan.length} tasks done` : "No tasks yet";
      }
      case "record": return "Turn a lecture into notes";
      case "tutor": return "Ask anything about this set";
      case "visual": return "Diagrams and memory maps";
      case "flashcards": return `${set.flashcards.length} cards`;
      case "quiz": return `${set.quiz.length} questions`;
      case "test": return "Timed, exam-style papers";
      default: return "";
    }
  }

  function toolsHtml(set) {
    const free = isFree();
    const label = (tool) => (tool === "quiz" ? "Quizzes" : TOOLS[tool].label);

    return `
      <section class="tool-groups" aria-label="Study tools">
        ${TOOL_GROUPS.map((group) => `
          <div class="tool-group">
            <h2>${group.title}</h2>
            <div class="tool-grid">
              ${group.tools.map((tool) => `
                <a class="tool-tile" href="${toolUrl(tool, set.id)}">
                  <span class="tool-icon">${icon(TOOLS[tool].icon)}</span>
                  <span class="tool-text">
                    <span class="tool-name">
                      ${label(tool)}
                      ${TOOLS[tool].pro && free ? `<span class="lock-badge">${icon("lock")}Pro</span>` : ""}
                    </span>
                    <span class="tool-meta">${toolMeta(tool, set)}</span>
                  </span>
                </a>`).join("")}
            </div>
          </div>`).join("")}
      </section>`;
  }

  function sourcesHtml(set) {
    const rows = set.files.map((file) => {
      const type = FILE_TYPES[file.type] || { label: "File", icon: "file" };
      return `
        <li class="source">
          <span class="source-icon">${icon(type.icon)}</span>
          <span class="source-text">
            <span class="source-name">${escapeHtml(file.name)}</span>
            <span class="source-meta">${type.label} · Added ${formatDate(file.date)}</span>
          </span>
        </li>`;
    }).join("");

    return `
      <section class="card sources" aria-labelledby="sources-title">
        <div class="section-head">
          <h2 id="sources-title">Sources</h2>
          <span class="muted">${set.files.length} ${set.files.length === 1 ? "file" : "files"}</span>
        </div>
        <ul class="source-list">${rows}</ul>
        <button type="button" class="btn btn-secondary btn-block" data-add-notes>${icon("plus")}Add more notes</button>
        ${fileInputHtml()}
      </section>`;
  }

  // Floating button that opens the tutor for this set.
  function tutorButtonHtml(set) {
    return `
      <a class="tutor-fab" href="${toolUrl("tutor", set.id)}">
        ${icon("tutor")}<span>Ask Tutor</span>${isFree() ? '<span class="badge">Pro</span>' : ""}
      </a>`;
  }

  function renderHome(set) {
    main.className = "container set-page set-home";
    main.innerHTML = [
      headerHtml(set),
      topicsHtml(set),
      todayTaskHtml(set),
      toolsHtml(set),
      sourcesHtml(set),
      tutorButtonHtml(set),
    ].join("");

    const input = main.querySelector(".file-input");
    main.querySelector("[data-add-notes]").addEventListener("click", () => input.click());
    input.addEventListener("change", () => startProcessing(set.id, input.files, true));
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  function render() {
    const set = setId ? getSet(setId) : null;
    if (!set) return renderNotFound();
    document.title = `${set.name} · SkipXam`;
    if (set.files.length === 0) renderUpload(set);
    else renderHome(set);
  }

  // Stop the browser opening a file dropped outside the drop zone.
  window.addEventListener("dragover", (event) => event.preventDefault());
  window.addEventListener("drop", (event) => event.preventDefault());

  if (setId) markSetOpened(setId);
  render();
})();
