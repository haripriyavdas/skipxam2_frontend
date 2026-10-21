/*
 * My Sets (app/sets.html). Load after data.js and app.js.
 */
(function () {
  "use strict";

  const main = document.querySelector("main");

  const SORTS = [
    { value: "recent", label: "Last accessed" },
    { value: "exam", label: "Exam date" },
    { value: "name", label: "Name" },
  ];

  const state = {
    query: "",
    sort: "recent",
    folder: "all", // "all" or a folder id
  };

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------

  // Upcoming exams first (nearest first), then past exams, then sets with no date.
  function examRank(set) {
    if (!set.examDate) return [2, 0];
    const days = daysUntil(set.examDate);
    return days >= 0 ? [0, days] : [1, -days];
  }

  function sortSets(sets) {
    const list = [...sets];
    if (state.sort === "name") return list.sort((a, b) => a.name.localeCompare(b.name));
    if (state.sort === "exam") {
      return list.sort((a, b) => {
        const [ga, da] = examRank(a);
        const [gb, db] = examRank(b);
        return ga - gb || da - db || a.name.localeCompare(b.name);
      });
    }
    return list.sort((a, b) => (b.lastOpened || "").localeCompare(a.lastOpened || ""));
  }

  function visibleSets() {
    const query = state.query.trim().toLowerCase();
    return sortSets(getSets()).filter((set) =>
      (state.folder === "all" || set.folderId === state.folder) &&
      (!query || set.name.toLowerCase().includes(query)));
  }

  function quizzesTaken(setId) {
    return getActivities().filter((a) => a.setId === setId && a.type === "quiz").length;
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  function createCardHtml() {
    return `
      <li>
        <button type="button" class="create-card" data-action="create-set">
          <span class="create-card-plus">${icon("plus")}</span>
          <span class="create-card-title">Create study set</span>
          <span class="muted">Create a new study set to organize your materials</span>
        </button>
      </li>`;
  }

  function cardHtml(set) {
    const pct = getSetProgress(set);
    const files = set.files.length;
    const quizzes = quizzesTaken(set.id);
    const started = set.topics.some((t) => topicStatus(t) !== "not-started");
    const current = started ? getCurrentTopic(set) : null;
    const name = escapeHtml(set.name);

    return `
      <li>
        <article class="set-card" style="--set-colour: ${set.colour}">
          <div class="set-card-top">
            <span class="set-tile" aria-hidden="true">${set.emoji}</span>
            <h2 class="set-name"><a class="set-link" href="set.html?set=${encodeURIComponent(set.id)}">${name}</a></h2>
            <div class="set-menu-wrap">
              <button type="button" class="icon-btn set-menu-btn" data-set="${set.id}"
                aria-haspopup="menu" aria-expanded="false" aria-label="Options for ${name}">${icon("more")}</button>
              <div class="set-menu glass" role="menu" hidden>
                <button type="button" role="menuitem" data-menu="rename">${icon("edit")}Rename</button>
                <button type="button" role="menuitem" data-menu="move">${icon("folder")}Move to folder</button>
                <button type="button" role="menuitem" data-menu="delete" class="is-danger">${icon("trash")}Delete</button>
              </div>
            </div>
          </div>

          <div class="set-progress">
            <div class="progress progress-thin" aria-hidden="true"><div class="progress-fill" style="width: ${pct}%"></div></div>
            <span class="set-progress-pct">${pct}%<span class="visually-hidden"> progress</span></span>
          </div>

          <ul class="set-chips">
            <li>${icon("file")}${files} ${files === 1 ? "material" : "materials"}</li>
            <li>${icon("quiz")}${quizzes} ${quizzes === 1 ? "quiz" : "quizzes"}</li>
          </ul>

          <p class="set-last muted">Last studied: ${relativeTime(set.lastOpened)}</p>

          <p class="set-topic-pill${current ? "" : " is-empty"}">
            ${current ? `${icon("plan")}<span>Current topic: <strong>${escapeHtml(current.topic.name)}</strong></span>`
              : "<span>You haven't started a study plan yet</span>"}
          </p>
        </article>
      </li>`;
  }

  function chipsHtml(folders) {
    if (!folders.length) return "";
    const chip = (id, label) => `
      <button type="button" class="chip folder-chip" data-folder="${id}" aria-pressed="${state.folder === id}">${label}</button>`;
    return chip("all", "All") + folders.map((f) => chip(f.id, `${icon("folder")}${escapeHtml(f.name)}`)).join("");
  }

  function renderGrid() {
    const sets = visibleSets();
    const grid = main.querySelector(".sets-grid");
    const filtered = state.query.trim() || state.folder !== "all";
    let html = createCardHtml() + sets.map(cardHtml).join("");
    if (!sets.length && filtered) {
      const message = state.query.trim()
        ? `No sets match “${escapeHtml(state.query.trim())}”.`
        : "No sets in this folder yet. Use a set's ⋮ menu to move it here.";
      html += `<li class="sets-no-results muted">${message}</li>`;
    }
    grid.innerHTML = html;
    main.querySelector(".sets-status").textContent = `${sets.length} ${sets.length === 1 ? "set" : "sets"} shown`;
  }

  function renderChips() {
    const folders = getFolders();
    if (state.folder !== "all" && !folders.some((f) => f.id === state.folder)) state.folder = "all";
    main.querySelector(".folder-chips").innerHTML = chipsHtml(folders);
  }

  function sortMenuHtml() {
    return menuSelectHtml({ name: "sort", prefix: "Sort:", label: "Sort by", value: state.sort, options: SORTS });
  }

  function render() {
    main.innerHTML = `
      <div class="sets-header"><h1>My Sets</h1></div>
      <div class="sets-toolbar">
        <div class="sets-search">
          ${icon("search")}
          <label class="visually-hidden" for="sets-search">Search study sets</label>
          <input class="input" id="sets-search" type="search" placeholder="Search study sets..." autocomplete="off" value="${escapeHtml(state.query)}">
        </div>
        ${sortMenuHtml()}
        <div class="sets-toolbar-actions">
          <button type="button" class="btn btn-secondary" data-materials>${icon("file")}Materials</button>
          <button type="button" class="btn btn-secondary" data-create-folder>${icon("folder")}Create folder</button>
          <button type="button" class="btn btn-primary" data-action="create-set">${icon("plus")}Create study set</button>
        </div>
      </div>
      <div class="folder-chips" role="group" aria-label="Filter by folder"></div>
      <p class="sets-status visually-hidden" aria-live="polite"></p>
      <ul class="sets-grid"></ul>`;
    renderChips();
    renderGrid();
  }

  // ---------------------------------------------------------------------------
  // Card menu
  // ---------------------------------------------------------------------------

  function closeMenus(except) {
    main.querySelectorAll(".set-menu-btn[aria-expanded='true']").forEach((btn) => {
      if (btn === except) return;
      btn.setAttribute("aria-expanded", "false");
      btn.nextElementSibling.hidden = true;
    });
  }

  function toggleMenu(btn) {
    const open = btn.getAttribute("aria-expanded") === "true";
    closeMenus(btn);
    btn.setAttribute("aria-expanded", String(!open));
    btn.nextElementSibling.hidden = open;
    if (!open) btn.nextElementSibling.querySelector("[role='menuitem']").focus();
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  // A sheet with one text field. onSave(value) runs with the trimmed value.
  function textFieldSheet({ title, label, value = "", placeholder = "", saveLabel, onSave }) {
    const modal = openModal({
      title,
      body: `
        <form>
          <div class="field">
            <label class="field-label" for="sheet-field">${label}</label>
            <input class="input" id="sheet-field" name="value" type="text" maxlength="60" autocomplete="off"
              value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" required>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
            <button type="submit" class="btn btn-primary"${value ? "" : " disabled"}>${saveLabel}</button>
          </div>
        </form>`,
    });
    const form = modal.dialog.querySelector("form");
    const input = form.elements.value;
    const submit = form.querySelector("[type='submit']");
    input.addEventListener("input", () => { submit.disabled = input.value.trim() === ""; });
    if (value) input.select(); else input.focus();
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const v = input.value.trim();
      if (!v) return;
      modal.close();
      onSave(v);
    });
  }

  function renameSet(set) {
    textFieldSheet({
      title: "Rename study set", label: "Name", value: set.name, saveLabel: "Save",
      onSave: (name) => {
        saveSet({ ...getSet(set.id), name });
        renderGrid();
        showToast(`Renamed to ${name}`);
      },
    });
  }

  function createFolderSheet() {
    textFieldSheet({
      title: "Create folder", label: "Folder name", placeholder: "e.g. Semester 3", saveLabel: "Create folder",
      onSave: (name) => {
        const folder = createFolder(name);
        state.folder = folder.id;
        renderChips();
        renderGrid();
        showToast(`Folder “${folder.name}” created. Use a set's ⋮ menu to move sets in.`);
      },
    });
  }

  function moveSet(set) {
    const folders = getFolders();
    const option = (value, label, checked) => `
      <label class="folder-option">
        <input type="radio" name="folder" value="${value}"${checked ? " checked" : ""}>
        <span>${label}</span>
      </label>`;

    const modal = openModal({
      title: `Move ${escapeHtml(set.name)}`,
      body: `
        <form class="move-form">
          <fieldset class="field folder-options">
            <legend class="visually-hidden">Folder</legend>
            ${option("", "No folder", !set.folderId)}
            ${folders.map((f) => option(f.id, `${icon("folder")}${escapeHtml(f.name)}`, f.id === set.folderId)).join("")}
            ${option("__new", `${icon("plus")}New folder`, false)}
            <input class="input new-folder-input" name="newFolder" type="text" maxlength="40"
              placeholder="e.g. Semester 3" aria-label="New folder name" autocomplete="off" hidden>
          </fieldset>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
            <button type="submit" class="btn btn-primary">Move</button>
          </div>
        </form>`,
    });

    const form = modal.dialog.querySelector("form");
    const newInput = form.elements.newFolder;
    const submit = form.querySelector("[type='submit']");
    const update = () => {
      const isNew = form.elements.folder.value === "__new";
      newInput.hidden = !isNew;
      submit.disabled = isNew && newInput.value.trim() === "";
    };
    form.addEventListener("change", (event) => {
      update();
      if (event.target.name === "folder" && event.target.value === "__new") newInput.focus();
    });
    newInput.addEventListener("input", update);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      let folderId = form.elements.folder.value || null;
      if (folderId === "__new") {
        const name = newInput.value.trim();
        if (!name) return;
        folderId = createFolder(name).id;
      }
      moveSetToFolder(set.id, folderId);
      const folder = getFolders().find((f) => f.id === folderId);
      modal.close();
      renderChips();
      renderGrid();
      showToast(folder ? `Moved ${set.name} to ${folder.name}` : `Removed ${set.name} from its folder`);
    });
  }

  async function removeSet(set) {
    const confirmed = await confirmDialog({
      title: `Delete ${escapeHtml(set.name)}?`,
      message: "This deletes the set with its files, flashcards, quizzes and study plan. You can't undo this.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    deleteSet(set.id);
    renderGrid();
    showToast(`Deleted ${set.name}`);
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  main.addEventListener("input", (event) => {
    if (event.target.id !== "sets-search") return;
    state.query = event.target.value;
    renderGrid();
  });

  main.addEventListener("menuselect", (event) => {
    if (event.detail.name !== "sort") return;
    state.sort = event.detail.value;
    event.target.closest(".menu-select").outerHTML = sortMenuHtml();
    main.querySelector("[data-menu-select='sort'] .menu-select-btn").focus();
    renderGrid();
  });

  main.addEventListener("click", (event) => {
    const t = event.target;
    if (t.closest("[data-materials]")) return openMaterials();
    if (t.closest("[data-create-folder]")) return createFolderSheet();

    const chip = t.closest(".folder-chip");
    if (chip) {
      state.folder = chip.dataset.folder;
      renderChips();
      renderGrid();
      return;
    }
    const menuBtn = t.closest(".set-menu-btn");
    if (menuBtn) return toggleMenu(menuBtn);

    const item = t.closest("[data-menu]");
    if (item) {
      const btn = item.closest(".set-menu-wrap").querySelector(".set-menu-btn");
      const set = getSet(btn.dataset.set);
      closeMenus();
      btn.focus();
      if (!set) return;
      if (item.dataset.menu === "move") moveSet(set);
      if (item.dataset.menu === "rename") renameSet(set);
      if (item.dataset.menu === "delete") removeSet(set);
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".set-menu-wrap")) closeMenus();
  });

  main.addEventListener("keydown", (event) => {
    const menu = event.target.closest(".set-menu");
    if (!menu) return;
    const items = [...menu.querySelectorAll("[role='menuitem']")];
    const index = items.indexOf(event.target);
    if (event.key === "Escape") {
      const btn = menu.previousElementSibling;
      closeMenus();
      btn.focus();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1) % items.length].focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length].focus();
    } else if (event.key === "Tab") {
      closeMenus();
    }
  });

  render();
})();
