/*
 * My Study Sets (app/sets.html). Load after data.js and app.js.
 */
(function () {
  "use strict";

  const main = document.querySelector("main");

  const state = {
    query: "",
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
    return [...sets].sort((a, b) => {
      const [ga, da] = examRank(a);
      const [gb, db] = examRank(b);
      return ga - gb || da - db || a.name.localeCompare(b.name);
    });
  }

  function visibleSets() {
    const query = state.query.trim().toLowerCase();
    return sortSets(getSets()).filter((set) =>
      (state.folder === "all" || set.folderId === state.folder) &&
      (!query || set.name.toLowerCase().includes(query)));
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  function cardHtml(set, folders) {
    const mastery = getSetMastery(set);
    const files = set.files.length;
    const days = set.examDate ? daysUntil(set.examDate) : null;
    const soon = days !== null && days >= 0 && days <= 3;
    const folder = state.folder === "all" && folders.find((f) => f.id === set.folderId);
    const name = escapeHtml(set.name);

    return `
      <article class="set-card" style="--set-colour: ${set.colour}">
        <div class="set-card-top">
          <span class="set-emoji" aria-hidden="true">${set.emoji}</span>
          <div class="set-menu-wrap">
            <button type="button" class="icon-btn set-menu-btn" data-set="${set.id}"
              aria-haspopup="menu" aria-expanded="false" aria-label="Options for ${name}">${icon("more")}</button>
            <div class="set-menu" role="menu" hidden>
              <button type="button" role="menuitem" data-menu="move">${icon("folder")}Move to folder</button>
              <button type="button" role="menuitem" data-menu="rename">${icon("edit")}Rename</button>
              <button type="button" role="menuitem" data-menu="delete" class="is-danger">${icon("trash")}Delete</button>
            </div>
          </div>
        </div>
        <h2 class="set-name"><a class="set-link" href="set.html?set=${encodeURIComponent(set.id)}">${name}</a></h2>
        ${set.subject ? `<p class="set-subject">${escapeHtml(set.subject)}</p>` : ""}
        <p class="set-meta">
          <span>${icon("file")}${files} ${files === 1 ? "file" : "files"}</span>
          ${folder ? `<span>${icon("folder")}${escapeHtml(folder.name)}</span>` : ""}
        </p>
        <div class="set-mastery">
          <div class="set-mastery-label"><span>Mastery</span><span>${mastery}%</span></div>
          <div class="progress progress-thin" aria-hidden="true">
            <div class="progress-fill" style="width: ${mastery}%"></div>
          </div>
        </div>
        <p class="set-exam${soon ? " is-soon" : ""}">${examLabel(set.examDate)}</p>
      </article>`;
  }

  function chipsHtml(folders) {
    const chip = (id, label) => `
      <button type="button" class="chip folder-chip" data-folder="${id}"
        aria-pressed="${state.folder === id}">${label}</button>`;
    return chip("all", "All") + folders.map((f) => chip(f.id, `${icon("folder")}${escapeHtml(f.name)}`)).join("");
  }

  function renderGrid() {
    const folders = getFolders();
    const sets = visibleSets();
    const grid = main.querySelector(".sets-grid");
    const status = main.querySelector(".sets-status");

    if (sets.length === 0) {
      const message = state.query.trim()
        ? `No sets match “${escapeHtml(state.query.trim())}”.`
        : "No sets in this folder yet. Use a set's ⋮ menu to move it here.";
      grid.innerHTML = `<p class="sets-no-results muted">${message}</p>`;
    } else {
      grid.innerHTML = sets.map((set) => cardHtml(set, folders)).join("");
    }
    status.textContent = `${sets.length} ${sets.length === 1 ? "set" : "sets"} shown`;
  }

  function renderChips() {
    const folders = getFolders();
    // If the active folder disappeared, fall back to All.
    if (state.folder !== "all" && !folders.some((f) => f.id === state.folder)) state.folder = "all";
    main.querySelector(".folder-chips").innerHTML = chipsHtml(folders);
  }

  function render() {
    if (getSets().length === 0) {
      main.innerHTML = `
        <div class="sets-header"><h1>My Study Sets</h1></div>
        ${emptyStateHtml({ text: "You don't have any study sets yet.",
          action: { label: `${icon("plus")}New study set`, attrs: 'data-action="create-set"' } })}`;
      return;
    }

    main.innerHTML = `
      <div class="sets-header">
        <h1>My Study Sets</h1>
        <button type="button" class="btn btn-primary" data-action="create-set">${icon("plus")}New study set</button>
      </div>
      <div class="sets-search">
        ${icon("search")}
        <label class="visually-hidden" for="sets-search">Search study sets</label>
        <input class="input" id="sets-search" type="search" placeholder="Search study sets"
          autocomplete="off" value="${escapeHtml(state.query)}">
      </div>
      <div class="folder-chips" role="group" aria-label="Filter by folder"></div>
      <p class="sets-status visually-hidden" aria-live="polite"></p>
      <div class="sets-grid"></div>`;
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

  function renameSet(set) {
    const modal = openModal({
      title: "Rename study set",
      body: `
        <form class="rename-form">
          <div class="field">
            <label class="field-label" for="rename-input">Name</label>
            <input class="input" id="rename-input" name="name" type="text" maxlength="60"
              autocomplete="off" value="${escapeHtml(set.name)}" required>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
            <button type="submit" class="btn btn-primary">Save</button>
          </div>
        </form>`,
    });

    const form = modal.dialog.querySelector("form");
    const input = form.elements.name;
    const save = form.querySelector("[type='submit']");
    input.addEventListener("input", () => { save.disabled = input.value.trim() === ""; });
    input.select();

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = input.value.trim();
      if (!name) return;
      saveSet({ ...getSet(set.id), name });
      modal.close();
      renderGrid();
      showToast(`Renamed to ${name}`);
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
    render();
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

  main.addEventListener("click", (event) => {
    const chip = event.target.closest(".folder-chip");
    if (chip) {
      state.folder = chip.dataset.folder;
      renderChips();
      renderGrid();
      return;
    }

    const menuBtn = event.target.closest(".set-menu-btn");
    if (menuBtn) {
      toggleMenu(menuBtn);
      return;
    }

    const item = event.target.closest("[data-menu]");
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

  // Close menus on outside click.
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".set-menu-wrap")) closeMenus();
  });

  // Menu keyboard: Escape closes, arrows move between items.
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
