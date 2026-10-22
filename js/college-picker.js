/*
 * Searchable college picker. Load after app.js (uses menuSelectHtml, icon, escapeHtml).
 *
 * Data: data/colleges.json, an array of { name, short?, city, state, type, university }.
 * type is government | private | deemed | autonomous. Swap in a bigger list
 * (for example the full AISHE list) with the same fields; nothing here changes.
 * Pages opened from disk (file://) can't fetch() JSON, so the picker falls
 * back to data/colleges.js, a script copy made by data/make-colleges-js.py.
 *
 *   const picker = collegePicker(element, { value, onChange });
 *   picker.value -> the chosen college, or null
 */
(function () {
  "use strict";

  const MAX_RESULTS = 50;
  const TYPES = [
    { value: "", label: "All types" },
    { value: "government", label: "Government" },
    { value: "private", label: "Private" },
    { value: "deemed", label: "Deemed" },
    { value: "autonomous", label: "Autonomous" },
  ];

  // data/ next to js/, worked out from this script's own URL so any page can use the picker.
  const DATA_URL = new URL("../data/", document.currentScript.src);

  let collegesPromise = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function loadColleges() {
    if (!collegesPromise) {
      collegesPromise = fetch(new URL("colleges.json", DATA_URL))
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .catch(() => loadScript(new URL("colleges.js", DATA_URL).href).then(() => window.SKIPXAM_COLLEGES || []));
    }
    return collegesPromise;
  }

  // "BMSCE, Bengaluru". The short name when there is one.
  function collegeLabel(college) {
    if (!college) return "";
    return [college.short || college.name, college.city].filter(Boolean).join(", ");
  }

  let pickerCount = 0;

  function collegePicker(root, { value = null, onChange } = {}) {
    const uid = `cp${++pickerCount}`;
    const state = { value, query: "", stateFilter: "", typeFilter: "", active: -1, colleges: [], adding: false };

    root.classList.add("cp");
    root.innerHTML = `
      <label class="field-label" for="${uid}-input" id="${uid}-label">College</label>
      <div class="cp-selected" data-cp-selected hidden>
        <span class="cp-selected-icon" aria-hidden="true">${icon("sets")}</span>
        <span class="cp-selected-text" data-cp-selected-text></span>
        <button type="button" class="btn btn-ghost btn-sm" data-cp-change>Change</button>
      </div>
      <div class="cp-search" data-cp-search>
        <div class="cp-input-wrap">
          ${icon("search")}
          <input class="input" id="${uid}-input" type="text" autocomplete="off" spellcheck="false"
            role="combobox" aria-expanded="true" aria-controls="${uid}-list" aria-autocomplete="list"
            aria-describedby="${uid}-count" placeholder="Search by college or city">
        </div>
        <div class="cp-filters" data-cp-filters></div>
        <ul class="cp-list" id="${uid}-list" role="listbox" aria-labelledby="${uid}-label" data-cp-list>
          <li class="cp-loading muted">Loading colleges…</li>
        </ul>
        <p class="cp-count muted" id="${uid}-count" aria-live="polite" data-cp-count></p>
      </div>
      <div class="cp-add" data-cp-add hidden>
        <p class="cp-add-title">Add your college</p>
        <div class="field">
          <label class="field-label" for="${uid}-add-name">College name</label>
          <input class="input" id="${uid}-add-name" type="text" maxlength="120" data-cp-add-name>
        </div>
        <div class="field">
          <label class="field-label" for="${uid}-add-city">City <span class="muted">(optional)</span></label>
          <input class="input" id="${uid}-add-city" type="text" maxlength="60" data-cp-add-city>
        </div>
        <p class="field-hint p-error" data-cp-add-error hidden>Enter your college's name.</p>
        <div class="cp-add-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-cp-add-cancel>Back to search</button>
          <button type="button" class="btn btn-primary btn-sm" data-cp-add-save>Add college</button>
        </div>
      </div>`;

    const $ = (sel) => root.querySelector(sel);
    const input = $(`#${uid}-input`);
    const list = $("[data-cp-list]");

    function results() {
      const q = state.query.trim().toLowerCase();
      return state.colleges.filter((c) =>
        (!state.stateFilter || c.state === state.stateFilter)
        && (!state.typeFilter || c.type === state.typeFilter)
        && (!q || c.name.toLowerCase().includes(q) || (c.short || "").toLowerCase().includes(q) || (c.city || "").toLowerCase().includes(q)));
    }

    function renderFilters() {
      const states = [...new Set(state.colleges.map((c) => c.state))].sort();
      $("[data-cp-filters]").innerHTML = `
        ${menuSelectHtml({
          name: `${uid}-state`, label: "Filter by state", value: state.stateFilter,
          options: [{ value: "", label: "All states" }, ...states.map((s) => ({ value: s, label: s }))],
        })}
        <div class="cp-type-chips" role="group" aria-label="Filter by college type">
          ${TYPES.map((t) => `<button type="button" class="chip" data-cp-type="${t.value}" aria-pressed="${state.typeFilter === t.value}">${t.label}</button>`).join("")}
        </div>`;
    }

    function renderList() {
      const all = results();
      const shown = all.slice(0, MAX_RESULTS);
      const options = shown.map((c, i) => `
        <li role="option" id="${uid}-opt-${i}" class="cp-option" data-cp-index="${i}" aria-selected="${i === state.active}">
          <span class="cp-option-name">${escapeHtml(c.name)}</span>
          <span class="cp-option-meta muted">${escapeHtml([c.city, c.state].filter(Boolean).join(", "))}</span>
        </li>`).join("");
      const addIndex = shown.length;
      list.innerHTML = `
        ${options || '<li class="cp-empty muted" role="presentation">No colleges match. Try another name or city, or add yours.</li>'}
        <li role="option" id="${uid}-opt-add" class="cp-option cp-option-add" data-cp-index="${addIndex}" aria-selected="${state.active === addIndex}">
          ${icon("plus")}<span>Can't find your college? <strong>Add it</strong></span>
        </li>`;
      list._shown = shown;
      $("[data-cp-count]").textContent = all.length > MAX_RESULTS
        ? `Showing ${MAX_RESULTS} of ${all.length} colleges. Keep typing to narrow it down.`
        : `${all.length} ${all.length === 1 ? "college" : "colleges"}`;
      const activeEl = state.active >= 0 ? list.querySelector(`[data-cp-index="${state.active}"]`) : null;
      if (activeEl) {
        input.setAttribute("aria-activedescendant", activeEl.id);
        activeEl.scrollIntoView({ block: "nearest" });
      } else {
        input.removeAttribute("aria-activedescendant");
      }
    }

    function showMode(mode) { // "selected" | "search" | "add"
      $("[data-cp-selected]").hidden = mode !== "selected";
      $("[data-cp-search]").hidden = mode !== "search";
      $("[data-cp-add]").hidden = mode !== "add";
      if (mode === "selected") {
        const c = state.value;
        $("[data-cp-selected-text]").innerHTML = `
          <strong>${escapeHtml(c.name)}</strong>
          <span class="muted">${escapeHtml([c.city, c.state].filter(Boolean).join(", ") || "Added by you")}</span>`;
      }
    }

    function choose(college) {
      state.value = college;
      showMode("selected");
      $("[data-cp-change]").focus();
      if (onChange) onChange(college);
    }

    function chooseIndex(index) {
      const shown = list._shown || [];
      if (index === shown.length) {
        showMode("add");
        $("[data-cp-add-name]").value = state.query.trim();
        $("[data-cp-add-name]").focus();
      } else if (shown[index]) {
        choose(shown[index]);
      }
    }

    // ---------- Events ----------
    input.addEventListener("input", () => {
      state.query = input.value;
      state.active = -1;
      renderList();
    });

    input.addEventListener("keydown", (event) => {
      const count = (list._shown || []).length + 1; // + the "Add it" option
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        state.active = state.active < 0 && step < 0 ? count - 1 : (state.active + step + count) % count;
        renderList();
      } else if (event.key === "Enter") {
        event.preventDefault(); // don't submit the surrounding form
        if (state.active >= 0) chooseIndex(state.active);
      }
    });

    root.addEventListener("click", (event) => {
      const t = event.target;
      const option = t.closest("[data-cp-index]");
      if (option) return chooseIndex(Number(option.dataset.cpIndex));
      const typeChip = t.closest("[data-cp-type]");
      if (typeChip) {
        state.typeFilter = typeChip.dataset.cpType;
        root.querySelectorAll("[data-cp-type]").forEach((c) => c.setAttribute("aria-pressed", String(c === typeChip)));
        state.active = -1;
        return renderList();
      }
      if (t.closest("[data-cp-change]")) {
        showMode("search");
        input.focus();
        return;
      }
      if (t.closest("[data-cp-add-cancel]")) {
        showMode("search");
        input.focus();
        return;
      }
      if (t.closest("[data-cp-add-save]")) addCustom();
    });

    root.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.target.closest("[data-cp-add]") && event.target.matches("input")) {
        event.preventDefault();
        addCustom();
      }
    });

    root.addEventListener("menuselect", (event) => {
      if (event.detail.name !== `${uid}-state`) return;
      event.stopPropagation();
      state.stateFilter = event.detail.value;
      state.active = -1;
      renderFilters();
      renderList();
      root.querySelector(".menu-select-btn").focus();
    });

    function addCustom() {
      const name = $("[data-cp-add-name]").value.trim();
      $("[data-cp-add-error]").hidden = Boolean(name);
      if (!name) return $("[data-cp-add-name]").focus();
      choose({ name, short: "", city: $("[data-cp-add-city]").value.trim(), state: "", type: "", university: "", custom: true });
    }

    showMode(state.value ? "selected" : "search");
    loadColleges().then((colleges) => {
      state.colleges = colleges;
      renderFilters();
      renderList();
    }).catch(() => {
      renderList(); // empty list: "No colleges match" plus the "Add it" option
    });

    return { get value() { return state.value; } };
  }

  Object.assign(window, { collegePicker, collegeLabel, loadColleges });
})();
