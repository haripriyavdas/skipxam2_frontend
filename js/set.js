/*
 * Study set page (app/set.html?set=<id>). Load after data.js and app.js.
 * Three states: upload (no files yet), processing (mock), and the set home.
 */
(function () {
  "use strict";

  const main = document.querySelector("main");
  const setId = new URLSearchParams(location.search).get("set");

  const ACCEPT = ".pdf,.ppt,.pptx,.doc,.docx,image/*";
  // Steps shown while "processing" uploaded notes. Delays are fake.
  const PROCESS_STEPS = [
    { label: "Smart notes" },
    { label: "Flashcards" },
    { label: "Quiz" },
    { label: "Study plan" },
    { label: "Practice test", pro: true },
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
  // Upload state: a set with no files yet, or "Add more notes" (?upload=1)
  // ---------------------------------------------------------------------------

  function renderUpload(set, adding) {
    main.className = "container set-page set-upload";
    const previewTools = ["notes", "flashcards", "quiz", "plan", "test"];
    const meta = [set.subject, examLabel(set.examDate)].filter(Boolean).map(escapeHtml).join(" · ");

    main.innerHTML = `
      <div class="set-intro" style="--set-colour: ${set.colour}">
        <span class="set-tile set-tile-lg" aria-hidden="true">${set.emoji}</span>
        <div>
          <h1>${adding ? `Add notes to ${escapeHtml(set.name)}` : escapeHtml(set.name)}</h1>
          <p class="muted">${adding ? `${set.files.length} ${set.files.length === 1 ? "file" : "files"} so far` : meta}</p>
        </div>
        ${adding ? `<a class="btn btn-ghost btn-sm set-intro-back" href="set.html?set=${encodeURIComponent(set.id)}">Back to set</a>` : ""}
      </div>

      <button type="button" class="dropzone">
        <span class="dropzone-icon">${icon("upload")}</span>
        <span class="dropzone-title">Upload your notes: PDF, images or slides</span>
        <span class="dropzone-hint">Drag files here, or click to choose</span>
      </button>
      ${fileInputHtml()}

      <div class="upload-alt">
        <button type="button" class="btn btn-secondary" data-record>
          ${icon("mic")}Record a lecture instead <span class="badge badge-pro">Pro</span>
        </button>
      </div>

      ${adding ? "" : `<section class="unlock-preview" aria-labelledby="unlock-title">
        <h2 id="unlock-title">Your notes will unlock</h2>
        <ul class="preview-tiles">
          ${previewTools.map((tool) => `
            <li class="preview-tile">
              <span class="tool-icon">${icon(TOOLS[tool].icon)}</span>
              <span>${TOOLS[tool].label}</span>
              ${TOOLS[tool].pro && isFree() ? `<span class="lock-badge">${icon("lock")}Pro</span>` : ""}
            </li>`).join("")}
        </ul>
      </section>`}`;

    const dropzone = main.querySelector(".dropzone");
    const input = main.querySelector(".file-input");

    dropzone.addEventListener("click", () => input.click());
    input.addEventListener("change", () => startProcessing(set.id, input.files, adding));

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
      startProcessing(set.id, event.dataTransfer.files, adding);
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
    const updated = addFilesToSet(id, files);
    logActivity(id, "upload", files.length === 1
      ? `Uploaded ${files[0].name} to ${updated.name}`
      : `Uploaded ${files.length} files to ${updated.name}`);
    processing = false;
    // Drop ?upload=1 so the set home shows; reload so the sidebar lists the new materials.
    queueToast(adding ? "Notes added" : "Your study set is ready");
    location.replace(`set.html?set=${encodeURIComponent(id)}`);
  }

  // ---------------------------------------------------------------------------
  // Set home
  // ---------------------------------------------------------------------------

  // Activity cards for the current topic. The first three always show; the rest sit behind "Show more".
  const ACTIVITIES = [
    { tool: "tutor", label: "Recommended", action: "Guided tutor session", art: "art-tutor" },
    { tool: "notes", label: "Catch up quickly", action: "Read notes", art: "art-notes" },
    { tool: "quiz", label: "Most popular", action: "Quiz", art: "art-quiz" },
    { tool: "flashcards", label: "Quick review", action: "Flashcards", art: "art-cards" },
    { tool: "test", label: "Exam practice", action: "Practice test", art: "art-test" },
    { tool: "visual", label: "See the big picture", action: "Visual memory", art: "art-visual" },
  ];
  const FIRST_ACTIVITIES = 3;

  let showMore = false;

  function homeHeaderHtml(set) {
    const meta = [set.subject, examLabel(set.examDate)].filter(Boolean).map(escapeHtml).join(" · ");
    return `
      <header class="set-head" style="--set-colour: ${set.colour}">
        <span class="set-tile set-tile-lg" aria-hidden="true">${set.emoji}</span>
        <div class="set-head-text">
          <h1>${escapeHtml(set.name)}</h1>
          ${meta ? `<p class="muted">${meta}</p>` : ""}
        </div>
        <div class="set-head-actions">
          <button type="button" class="icon-btn" data-set-settings aria-label="Set settings" title="Set settings">${icon("settings")}</button>
          <button type="button" class="icon-btn" data-duplicate aria-label="Duplicate set" title="Duplicate set">${icon("copy")}</button>
        </div>
      </header>`;
  }

  function statsHtml(set) {
    const covered = set.topics.filter((t) => topicStatus(t) === "done").length;
    const mastered = set.topics.filter(isMastered).length;
    const pct = getSetProgress(set);
    const stat = (iconName, n, label) => `
      <li class="stat"><span class="stat-icon">${icon(iconName)}</span><span><strong>${n}</strong> ${label}</span></li>`;
    return `
      <section class="card stats-bar" aria-label="Progress">
        <ul class="stats">
          ${stat("notes", set.topics.length, set.topics.length === 1 ? "topic" : "topics")}
          ${stat("check", covered, "covered")}
          ${stat("sparkle", mastered, "mastered")}
        </ul>
        <div class="stats-progress">
          <div class="progress" role="progressbar" aria-label="Overall progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
            <div class="progress-fill" style="width: ${pct}%"></div>
          </div>
          <span class="stats-pct">${pct}%</span>
        </div>
      </section>`;
  }

  function topicTabsHtml(plan, current) {
    return `
      <div class="topic-tabs" role="tablist" aria-label="Topics in your study plan">
        ${plan.map((p, i) => {
          const selected = p.topic.id === current.topic.id;
          const status = topicStatus(p.topic);
          return `
            <button type="button" role="tab" class="topic-tab is-${status}" id="tab-${p.topic.id}" aria-controls="topic-panel"
              aria-selected="${selected}" tabindex="${selected ? 0 : -1}" data-topic-tab="${p.topic.id}" title="${escapeHtml(p.topic.name)}">
              <span class="topic-tab-num">${String(i + 1).padStart(2, "0")}</span>
              <span class="topic-tab-name">${escapeHtml(p.topic.name)}</span>
            </button>`;
        }).join("")}
      </div>`;
  }

  function activityCardHtml(a, set, topic) {
    const tool = TOOLS[a.tool];
    const locked = tool.pro && isFree();
    return `
      <li class="activity-card">
        <span class="activity-label">${a.label}</span>
        <a class="activity-body" href="${toolUrl(a.tool, set.id, { topic: topic.id })}">
          <span class="activity-art ${a.art}">
            ${icon(tool.icon)}
            ${locked ? `<span class="lock-badge activity-lock">${icon("lock")}Pro</span>` : ""}
          </span>
          <span class="activity-action">${icon(tool.icon)}<span>${a.action}</span></span>
        </a>
      </li>`;
  }

  function topicCardHtml(set, current) {
    const { topic, unit, unitTopics } = current;
    const index = unitTopics.findIndex((t) => t.id === topic.id) + 1;
    const status = topicStatus(topic);
    const statusLabel = { done: "Covered", "in-progress": "In progress", "not-started": "Not started" }[status];
    const shown = showMore ? ACTIVITIES : ACTIVITIES.slice(0, FIRST_ACTIVITIES);

    return `
      <section class="card topic-card" id="topic-panel" role="tabpanel" aria-labelledby="tab-${topic.id}">
        <div class="topic-card-head">
          <div>
            <p class="eyebrow">Topic ${index} of ${unitTopics.length} from ${escapeHtml(unit.name)}</p>
            <h2>${escapeHtml(topic.name)}</h2>
            <p class="topic-meta"><span class="status-chip is-${status}">${statusLabel}</span><span class="muted">${topic.mastery}% mastery</span></p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" data-skip>${icon("skip")}Skip topic</button>
        </div>
        <ul class="activity-grid">${shown.map((a) => activityCardHtml(a, set, topic)).join("")}</ul>
        <button type="button" class="btn btn-secondary btn-sm show-more" data-show-more aria-expanded="${showMore}">
          ${showMore ? "Show less" : "Show more"}
        </button>
      </section>`;
  }

  // Floating button that opens the side tutor panel (tutor-chat.js) for this set.
  function tutorButtonHtml(set) {
    return `
      <button type="button" class="tutor-fab glass" data-open-tutor aria-haspopup="dialog">
        ${icon("tutor")}<span>Ask Tutor</span>${isFree() ? '<span class="badge badge-pro">Pro</span>' : ""}
      </button>`;
  }

  function renderHome(set) {
    main.className = "container set-page set-home";
    const plan = getPlanTopics(set);
    const current = getCurrentTopic(set);

    const recommended = current ? `
      <section class="recommended" aria-labelledby="rec-title">
        <div class="section-head">
          <h2 id="rec-title">Recommended from your study plan</h2>
          <a class="btn btn-secondary btn-sm" href="${toolUrl("plan", set.id)}">${icon("plan")}View full study plan</a>
        </div>
        ${topicTabsHtml(plan, current)}
        ${topicCardHtml(set, current)}
      </section>` : emptyStateHtml({
        title: "Your study plan is on its way",
        text: "Topics and activities appear here once your notes are processed.",
        action: { label: "Upload more notes", href: `set.html?set=${encodeURIComponent(set.id)}&upload=1` },
      });

    main.innerHTML = `${homeHeaderHtml(set)}${statsHtml(set)}${recommended}${tutorButtonHtml(set)}`;
  }

  // Selecting a topic (tab, skip, or ?topic=) makes it the current one and keeps the URL in step.
  function selectTopic(topicIdValue, focusTab) {
    setCurrentTopic(setId, topicIdValue);
    const params = new URLSearchParams(location.search);
    params.set("topic", topicIdValue);
    history.replaceState(null, "", `?${params}`);
    renderHome(getSet(setId));
    if (focusTab) main.querySelector(`[data-topic-tab="${topicIdValue}"]`).focus();
    main.querySelector(".topic-tab[aria-selected='true']").scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function openSetSettings(set) {
    const modal = openModal({
      title: "Set settings",
      body: `
        <form class="settings-form">
          <div class="field">
            <label class="field-label" for="settings-name">Name</label>
            <input class="input" id="settings-name" name="name" type="text" maxlength="60" value="${escapeHtml(set.name)}" required>
          </div>
          <div class="field">
            <label class="field-label" for="settings-subject">Subject or exam <span class="muted">(optional)</span></label>
            <input class="input" id="settings-subject" name="subject" type="text" maxlength="80" value="${escapeHtml(set.subject || "")}">
          </div>
          <div class="field">
            <label class="field-label" for="settings-exam">Exam date <span class="muted">(optional)</span></label>
            <input class="input" id="settings-exam" name="examDate" type="date" value="${set.examDate || ""}">
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
            <button type="submit" class="btn btn-primary">Save</button>
          </div>
        </form>`,
    });
    const form = modal.dialog.querySelector("form");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = form.elements.name.value.trim();
      if (!name) return;
      saveSet({ ...getSet(set.id), name, subject: form.elements.subject.value.trim(), examDate: form.elements.examDate.value || null });
      modal.close();
      location.reload(); // the sidebar and breadcrumb show the name too
    });
  }

  function duplicate(set) {
    if (isFree() && getSets().length >= 3) {
      openUpgrade("Unlimited study sets");
      return;
    }
    const copy = duplicateSet(set.id);
    location.href = `set.html?set=${encodeURIComponent(copy.id)}`;
  }

  main.addEventListener("click", (event) => {
    const t = event.target;
    const set = setId && getSet(setId);
    if (!set) return;
    const tutorBtn = t.closest("[data-open-tutor]");
    if (tutorBtn) return openTutorPanel(setId, { opener: tutorBtn });
    const tab = t.closest("[data-topic-tab]");
    if (tab) return selectTopic(tab.dataset.topicTab, false);
    if (t.closest("[data-skip]")) {
      const next = skipTopic(setId);
      if (next) selectTopic(next, false);
      showToast("Skipped to the next topic");
      main.querySelector("[data-skip]").focus();
      return;
    }
    if (t.closest("[data-show-more]")) {
      showMore = !showMore;
      renderHome(set);
      main.querySelector("[data-show-more]").focus();
      return;
    }
    if (t.closest("[data-set-settings]")) return openSetSettings(set);
    if (t.closest("[data-duplicate]")) duplicate(set);
  });

  main.addEventListener("keydown", (event) => {
    const tab = event.target.closest("[data-topic-tab]");
    if (!tab || (event.key !== "ArrowRight" && event.key !== "ArrowLeft")) return;
    const tabs = [...main.querySelectorAll("[data-topic-tab]")];
    const i = tabs.indexOf(tab);
    const next = tabs[(i + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    selectTopic(next.dataset.topicTab, true);
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  function render() {
    const set = setId ? getSet(setId) : null;
    if (!set) return renderNotFound();
    document.title = `${set.name} · SkipXam`;
    const params = new URLSearchParams(location.search);
    if (set.files.length === 0) return renderUpload(set, false);
    if (params.get("upload")) return renderUpload(set, true);
    const topicParam = params.get("topic");
    if (topicParam && set.topics.some((t) => t.id === topicParam) && set.currentTopicId !== topicParam) {
      setCurrentTopic(set.id, topicParam);
      return renderHome(getSet(set.id));
    }
    renderHome(set);
  }

  // Stop the browser opening a file dropped outside the drop zone.
  window.addEventListener("dragover", (event) => event.preventDefault());
  window.addEventListener("drop", (event) => event.preventDefault());

  if (setId) markSetOpened(setId);
  render();
})();
