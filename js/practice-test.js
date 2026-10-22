/*
 * Practice tests (app/practice-test.html?set=<id>). Pro feature: the setup is
 * wrapped in proGate() for free users. Load after data.js and app.js.
 *
 * Setup: choose a source (upload a reference paper, a saved pattern, or the
 * standard format) → for uploads, an "Analysing the paper pattern" screen →
 * edit the pattern (marks, duration, sections with question types and choice
 * rules like "Answer any 2 of 3") → generate the test in that format.
 * Then exam mode (timer, question palette, mark for review) → results.
 * In a section with a choice rule, the best answers up to the required number count.
 * MCQs are marked exactly. Written answers are mock-marked by how many of the
 * question's key points they mention (a stand-in for AI marking).
 */
(function () {
  "use strict";

  const main = document.querySelector("main");
  const { set: initialSet } = setFromUrl();
  const set = () => getSet(initialSet.id);

  // Question types and the two built-in patterns. A section is
  // { name, type: mcq | short | long, count, marks, attempt }: "attempt" of "count"
  // questions must be answered ("Answer any 2 of 3"), each worth "marks".
  const PART_NAMES = { mcq: "Multiple choice", short: "Short answer", long: "Long answer" };
  const STANDARD_PATTERN = {
    name: "Standard format",
    totalMarks: 25,
    minutes: 45,
    sections: [
      { name: "Part A", type: "mcq", count: 5, marks: 1, attempt: 5 },
      { name: "Part B", type: "short", count: 2, marks: 5, attempt: 2 },
      { name: "Part C", type: "long", count: 1, marks: 10, attempt: 1 },
    ],
  };
  // What "analysing" an uploaded paper finds: a stand-in for AI pattern detection.
  const DETECTED_PATTERN = {
    totalMarks: 50,
    minutes: 90,
    sections: [
      { name: "Part A", type: "mcq", count: 15, marks: 1, attempt: 15 },
      { name: "Part B", type: "short", count: 4, marks: 5, attempt: 3 },
      { name: "Part C", type: "long", count: 3, marks: 10, attempt: 2 },
    ],
  };
  const ANALYSIS_STEPS = ["Reading the pages", "Finding the sections", "Counting questions and marks", "Detecting question types", "Reading the choice rules"];
  const ANALYSIS_STEP_MS = 750;
  const MAX_UPLOAD_MB = 20;

  const state = {
    screen: "source",      // "source" | "analysing" | "pattern" | "generating" | "exam" | "results"
    savedOpen: false,      // saved-pattern list showing on the source screen
    paper: null,           // uploaded reference paper: { name, kind, thumb, pages }
    pattern: null,         // the pattern being edited, then used for the test
    patternFrom: "",       // "upload" | "saved" | "standard"
    analysisStep: 0,
    analysisTimer: null,
    questions: [],         // { part, type, marks, item, answer, visited, marked }
    current: 0,
    endsAt: 0,
    startedAt: 0,
    timer: null,
    warned: new Set(),
    result: null,
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const clonePattern = (p) => JSON.parse(JSON.stringify(p));
  const sectionMarks = (sec) => sec.attempt * sec.marks;
  const sectionsTotal = (p) => p.sections.reduce((n, sec) => n + sectionMarks(sec), 0);
  const choiceLabel = (sec) => (sec.attempt >= sec.count ? "Answer all" : `Answer any ${sec.attempt} of ${sec.count}`);
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

  // Questions the set has for each type. Short answers are the 5-mark written
  // questions, long answers the rest.
  function pools(s) {
    return {
      mcq: s.quiz,
      short: s.written.filter((w) => w.marks <= 5),
      long: s.written.filter((w) => w.marks > 5),
    };
  }

  function isAnswered(q) {
    return q.type === "mcq" ? q.answer !== null : q.answer.trim().length > 0;
  }

  function formatClock(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function wordCount(text) {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }

  // ---------------------------------------------------------------------------
  // Setup, step 1: choose a source
  // ---------------------------------------------------------------------------

  function introHtml(s) {
    return `
      <section class="card test-intro">
        <span class="tool-icon">${icon("test")}</span>
        <div>
          <h2>Sit a timed paper for ${escapeHtml(s.name)}</h2>
          <p class="muted">Practise under exam conditions in your exam's own format: same sections, marks and choices, with a timer and question palette.</p>
        </div>
      </section>`;
  }

  function savedListHtml() {
    const patterns = getTestPatterns();
    return `
      <section class="card saved-patterns" id="saved-patterns" aria-labelledby="saved-title">
        <h3 id="saved-title" class="results-h">Saved patterns</h3>
        ${patterns.length ? `
          <ul class="saved-list">
            ${patterns.map((p) => `
              <li class="saved-item">
                <div>
                  <p class="saved-name">${escapeHtml(p.name)}</p>
                  <p class="muted saved-meta">${p.totalMarks} marks · ${p.minutes} min · ${p.sections.map((sec) => `${escapeHtml(sec.name)}: ${choiceLabel(sec).toLowerCase()}`).join(" · ")}</p>
                </div>
                <div class="saved-actions">
                  <button type="button" class="icon-btn" data-delete-pattern="${p.id}" aria-label="Delete ${escapeHtml(p.name)}">${icon("trash")}</button>
                  <button type="button" class="btn btn-primary btn-sm" data-use-pattern="${p.id}">Use</button>
                </div>
              </li>`).join("")}
          </ul>` : '<p class="muted">No saved patterns yet. Edit a pattern and choose "Save this pattern" to keep it here.</p>'}
      </section>`;
  }

  function sourceHtml(s) {
    const saved = getTestPatterns().length;
    return `
      <div class="test-setup">
        ${introHtml(s)}
        <h2 class="setup-step">Choose the paper format</h2>
        <div class="source-options">
          <div class="source-card is-upload" data-drop>
            <span class="source-icon">${icon("upload")}</span>
            <h3>Upload a reference paper</h3>
            <p class="muted">A PDF or photo of a past paper. We'll copy its sections, marks and choices.</p>
            <label class="btn btn-primary btn-sm source-file">
              Choose file
              <input type="file" accept="application/pdf,image/*" class="visually-hidden" data-paper-input>
            </label>
            <span class="source-hint muted">or drop it here · PDF, JPG or PNG</span>
          </div>
          <button type="button" class="source-card" data-source="saved" aria-expanded="${state.savedOpen}" aria-controls="saved-patterns">
            <span class="source-icon">${icon("folder")}</span>
            <h3>Use a saved pattern</h3>
            <p class="muted">${saved ? `${plural(saved, "pattern")} saved from earlier papers.` : "Patterns you save will appear here."}</p>
          </button>
          <button type="button" class="source-card" data-source="standard">
            <span class="source-icon">${icon("test")}</span>
            <h3>Standard format</h3>
            <p class="muted">Part A MCQs, Part B short answers, Part C long answers. 25 marks, 45 minutes.</p>
          </button>
        </div>
        ${state.savedOpen ? savedListHtml() : ""}
      </div>`;
  }

  // Reads the uploaded file: a thumbnail of the first page and the page count.
  async function readPaper(file) {
    if (file.type.startsWith("image/")) {
      return { thumb: URL.createObjectURL(file), pages: 1 };
    }
    try {
      const lib = await loadPdfJs();
      const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 440 / page.getViewport({ scale: 1 }).width });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      return { thumb: canvas.toDataURL("image/jpeg", 0.85), pages: pdf.numPages };
    } catch (err) {
      console.warn("SkipXam: could not preview the paper.", err);
      return { thumb: null, pages: null };
    }
  }

  function uploadPaper(file) {
    if (!file) return;
    if (getUser().plan === "free") {
      openUpgrade("Practice tests");
      return;
    }
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf && !file.type.startsWith("image/")) {
      showToast("Upload the paper as a PDF or an image (JPG or PNG).");
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      showToast(`That file is over ${MAX_UPLOAD_MB} MB. Try a smaller scan.`);
      return;
    }
    state.paper = { name: file.name, kind: isPdf ? "pdf" : "image", thumb: null, pages: null };
    state.screen = "analysing";
    state.analysisStep = 0;
    render();
    const paper = state.paper;
    readPaper(file).then((info) => {
      if (state.paper !== paper) return;
      Object.assign(paper, info);
      const thumb = main.querySelector(".analysis-thumb");
      if (thumb && info.thumb) thumb.innerHTML = `<img src="${info.thumb}" alt="First page of ${escapeHtml(paper.name)}">`;
    });
    runAnalysis();
  }

  // ---------------------------------------------------------------------------
  // Setup, step 2: "Analysing the paper pattern"
  // ---------------------------------------------------------------------------

  function analysingHtml() {
    const pct = Math.round((state.analysisStep / ANALYSIS_STEPS.length) * 100);
    return `
      <div class="test-setup">
        <section class="card analysis" aria-labelledby="analysis-title">
          <div class="analysis-thumb" aria-hidden="${!state.paper.thumb}">
            ${state.paper.thumb ? `<img src="${state.paper.thumb}" alt="First page of ${escapeHtml(state.paper.name)}">` : `<span class="thumb-placeholder">${icon("file")}</span>`}
          </div>
          <div class="analysis-body">
            <h2 id="analysis-title">Analysing the paper pattern</h2>
            <p class="muted analysis-file">${icon("file")}${escapeHtml(state.paper.name)}</p>
            <div class="progress" role="progressbar" aria-label="Analysis progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
              <div class="progress-fill" style="width: ${pct}%"></div>
            </div>
            <ol class="analysis-steps">
              ${ANALYSIS_STEPS.map((step, i) => {
                const status = i < state.analysisStep ? "done" : i === state.analysisStep ? "active" : "todo";
                return `<li class="is-${status}"><span class="step-mark" aria-hidden="true">${status === "done" ? icon("check") : ""}</span>${step}${status === "done" ? '<span class="visually-hidden"> (done)</span>' : ""}</li>`;
              }).join("")}
            </ol>
            <p class="visually-hidden" aria-live="polite">${ANALYSIS_STEPS[Math.min(state.analysisStep, ANALYSIS_STEPS.length - 1)]}</p>
            <button type="button" class="btn btn-ghost btn-sm" data-cancel-analysis>Cancel</button>
          </div>
        </section>
      </div>`;
  }

  function runAnalysis() {
    clearTimeout(state.analysisTimer);
    state.analysisTimer = setTimeout(() => {
      if (state.screen !== "analysing") return;
      state.analysisStep += 1;
      if (state.analysisStep < ANALYSIS_STEPS.length) {
        render();
        runAnalysis();
        return;
      }
      const base = state.paper.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
      openPattern({ ...clonePattern(DETECTED_PATTERN), name: `${base} pattern` }, "upload");
    }, ANALYSIS_STEP_MS);
  }

  // ---------------------------------------------------------------------------
  // Setup, step 3: edit the detected pattern
  // ---------------------------------------------------------------------------

  function openPattern(pattern, from) {
    state.pattern = clonePattern(pattern);
    delete state.pattern.id;
    state.patternFrom = from;
    if (from !== "upload") state.paper = null;
    state.screen = "pattern";
    render();
    main.querySelector(".pattern-card h2").focus();
  }

  function sectionRowHtml(sec, i) {
    const num = (field, value, label, min = 1, max = 50) => `
      <input class="input pattern-num" type="number" inputmode="numeric" min="${min}" max="${max}" value="${value}"
        data-sec="${i}" data-field="${field}" aria-label="${escapeHtml(sec.name)}: ${label}">`;
    const choices = [`<option value="${sec.count}"${sec.attempt >= sec.count ? " selected" : ""}>Answer all</option>`];
    for (let k = sec.count - 1; k >= 1; k--) {
      choices.push(`<option value="${k}"${sec.attempt === k ? " selected" : ""}>Answer any ${k} of ${sec.count}</option>`);
    }
    return `
      <tr>
        <td data-label="Section"><input class="input" value="${escapeHtml(sec.name)}" data-sec="${i}" data-field="name" aria-label="Section ${i + 1} name"></td>
        <td data-label="Questions">${num("count", sec.count, "number of questions")}</td>
        <td data-label="Marks each">${num("marks", sec.marks, "marks for each question", 1, 100)}</td>
        <td data-label="Question type">
          <select class="input" data-sec="${i}" data-field="type" aria-label="${escapeHtml(sec.name)}: question type">
            ${Object.entries(PART_NAMES).map(([value, label]) => `<option value="${value}"${sec.type === value ? " selected" : ""}>${label}</option>`).join("")}
          </select>
        </td>
        <td data-label="Choice rule">
          <select class="input" data-sec="${i}" data-field="attempt" aria-label="${escapeHtml(sec.name)}: choice rule">${choices.join("")}</select>
        </td>
        <td data-label="Marks" class="pattern-marks">${sectionMarks(sec)}</td>
        <td class="pattern-remove">
          <button type="button" class="icon-btn" data-remove-sec="${i}" aria-label="Remove ${escapeHtml(sec.name)}"${state.pattern.sections.length === 1 ? " disabled" : ""}>${icon("trash")}</button>
        </td>
      </tr>`;
  }

  function patternNotesHtml(s) {
    const p = state.pattern;
    const notes = [];
    const total = sectionsTotal(p);
    if (total !== p.totalMarks) {
      notes.push(`<li class="is-warning">${icon("bell")}<span>The sections add up to <strong>${total} marks</strong>, but the total is set to ${p.totalMarks}.
        <button type="button" class="link-btn" data-fix-total>Use ${total}</button></span></li>`);
    }
    const available = pools(s);
    const needed = { mcq: 0, short: 0, long: 0 };
    p.sections.forEach((sec) => { needed[sec.type] += sec.count; });
    for (const [type, n] of Object.entries(needed)) {
      if (n > available[type].length) {
        notes.push(`<li class="is-warning">${icon("bell")}<span>This pattern needs ${plural(n, `${PART_NAMES[type].toLowerCase()} question`)}, but ${escapeHtml(s.name)} has ${available[type].length}. The test will use the ones it has.</span></li>`);
      }
    }
    return notes.length ? `<ul class="pattern-notes">${notes.join("")}</ul>` : "";
  }

  function patternHtml(s) {
    const p = state.pattern;
    const kicker = {
      upload: `Detected from ${escapeHtml(state.paper ? state.paper.name : "your paper")}`,
      saved: "Saved pattern",
      standard: "Standard format",
    }[state.patternFrom];
    const paper = state.patternFrom === "upload" && state.paper;

    return `
      <div class="test-setup pattern-setup">
        <button type="button" class="link-btn back-link" data-back>${icon("chevronLeft")}Choose a different format</button>
        <section class="card pattern-card" aria-labelledby="pattern-title">
          <div class="pattern-head">
            <p class="pattern-kicker">${icon(state.patternFrom === "upload" ? "sparkle" : "test")}${kicker}</p>
            <h2 id="pattern-title" tabindex="-1">Check the paper pattern</h2>
            <p class="muted">Change anything that doesn't match your exam, then generate a test in this format.</p>
          </div>

          <div class="pattern-top">
            <div class="field">
              <label class="field-label" for="pattern-name">Pattern name</label>
              <input class="input" id="pattern-name" data-field="patternName" value="${escapeHtml(p.name)}" maxlength="60">
            </div>
            <div class="field">
              <label class="field-label" for="pattern-total">Total marks</label>
              <input class="input" id="pattern-total" type="number" inputmode="numeric" min="1" max="300" data-field="totalMarks" value="${p.totalMarks}">
            </div>
            <div class="field">
              <label class="field-label" for="pattern-minutes">Duration (minutes)</label>
              <input class="input" id="pattern-minutes" type="number" inputmode="numeric" min="5" max="240" step="5" data-field="minutes" value="${p.minutes}">
            </div>
          </div>

          <div class="pattern-grid${paper ? " has-thumb" : ""}">
            <div class="pattern-table-wrap">
              <table class="pattern-table">
                <caption class="visually-hidden">Sections of the paper</caption>
                <thead>
                  <tr><th scope="col">Section</th><th scope="col">Questions</th><th scope="col">Marks each</th><th scope="col">Question type</th>
                    <th scope="col">Choice rule</th><th scope="col">Marks</th><th scope="col"><span class="visually-hidden">Remove</span></th></tr>
                </thead>
                <tbody>${p.sections.map(sectionRowHtml).join("")}</tbody>
                <tfoot>
                  <tr><th scope="row" colspan="5">Sections total</th><td class="pattern-marks"><strong>${sectionsTotal(p)}</strong></td><td></td></tr>
                </tfoot>
              </table>
              <button type="button" class="btn btn-ghost btn-sm" data-add-sec${p.sections.length >= 6 ? " disabled" : ""}>${icon("plus")}Add section</button>
            </div>
            ${paper ? `
              <figure class="paper-thumb">
                ${paper.thumb ? `<img src="${paper.thumb}" alt="First page of ${escapeHtml(paper.name)}">` : `<span class="thumb-placeholder">${icon("file")}</span>`}
                <figcaption><span class="paper-name">${escapeHtml(paper.name)}</span>${paper.pages ? `<span class="muted">${plural(paper.pages, "page")}</span>` : ""}</figcaption>
              </figure>` : ""}
          </div>

          <div aria-live="polite" class="pattern-notes-wrap">${patternNotesHtml(s)}</div>

          <div class="pattern-actions">
            <button type="button" class="btn btn-secondary" data-save-pattern>Save this pattern</button>
            <button type="button" class="btn btn-primary" data-generate>Generate test</button>
          </div>
        </section>
      </div>`;
  }

  // Updates the parts of the pattern screen that depend on the numbers, without
  // re-rendering the inputs (so focus and typing aren't interrupted).
  function refreshPattern(index) {
    const s = set();
    if (index !== undefined) {
      const sec = state.pattern.sections[index];
      const row = main.querySelectorAll(".pattern-table tbody tr")[index];
      row.querySelector(".pattern-marks").textContent = sectionMarks(sec);
      const select = row.querySelector("[data-field='attempt']");
      const choices = [`<option value="${sec.count}"${sec.attempt >= sec.count ? " selected" : ""}>Answer all</option>`];
      for (let k = sec.count - 1; k >= 1; k--) choices.push(`<option value="${k}"${sec.attempt === k ? " selected" : ""}>Answer any ${k} of ${sec.count}</option>`);
      select.innerHTML = choices.join("");
    }
    main.querySelector(".pattern-table tfoot strong").textContent = sectionsTotal(state.pattern);
    main.querySelector(".pattern-notes-wrap").innerHTML = patternNotesHtml(s);
  }

  function updatePatternField(el) {
    const p = state.pattern;
    const field = el.dataset.field;
    const clampInt = (v, min, max) => Math.max(min, Math.min(max, Math.round(Number(v) || min)));
    if (field === "patternName") { p.name = el.value; return; }
    if (field === "totalMarks") { p.totalMarks = clampInt(el.value, 1, 300); refreshPattern(); return; }
    if (field === "minutes") { p.minutes = clampInt(el.value, 5, 240); return; }
    const i = Number(el.dataset.sec);
    const sec = p.sections[i];
    if (field === "name") { sec.name = el.value; return; }
    if (field === "type") sec.type = el.value;
    else if (field === "attempt") sec.attempt = Number(el.value);
    else if (field === "count") {
      if (el.value === "") return; // still typing
      const wasAll = sec.attempt >= sec.count;
      sec.count = clampInt(el.value, 1, 50);
      sec.attempt = wasAll ? sec.count : Math.min(sec.attempt, sec.count);
    } else if (field === "marks") {
      if (el.value === "") return;
      sec.marks = clampInt(el.value, 1, 100);
    }
    refreshPattern(i);
  }

  function savePattern() {
    const p = state.pattern;
    if (!p.name.trim()) {
      showToast("Give the pattern a name first.");
      main.querySelector("#pattern-name").focus();
      return;
    }
    const replacing = getTestPatterns().some((x) => x.name.trim().toLowerCase() === p.name.trim().toLowerCase());
    saveTestPattern({ ...p, name: p.name.trim() });
    showToast(replacing ? `Updated "${p.name.trim()}"` : `Saved "${p.name.trim()}". Find it under "Use a saved pattern".`);
  }

  // ---------------------------------------------------------------------------
  // Setup, step 4: generate the paper and open exam mode
  // ---------------------------------------------------------------------------

  function generateHtml() {
    return `
      <div class="test-setup">
        <section class="card analysis is-generating" aria-live="polite">
          <span class="generate-spinner" aria-hidden="true"></span>
          <div class="analysis-body">
            <h2>Generating your test</h2>
            <p class="muted">${escapeHtml(state.pattern.name)} · ${state.pattern.totalMarks} marks · ${state.pattern.minutes} min</p>
          </div>
        </section>
      </div>`;
  }

  function buildPaper() {
    const s = set();
    const available = pools(s);
    const used = { mcq: shuffle(available.mcq), short: shuffle(available.short), long: shuffle(available.long) };
    const questions = [];
    for (const sec of state.pattern.sections) {
      used[sec.type].splice(0, sec.count).forEach((item) => {
        questions.push({ part: sec.name.trim() || "Section", type: sec.type, marks: sec.marks, item, answer: sec.type === "mcq" ? null : "", visited: false, marked: false });
      });
    }
    return questions;
  }

  function generateTest() {
    if (getUser().plan === "free") {
      openUpgrade("Practice tests");
      return;
    }
    const p = state.pattern;
    p.sections.forEach((sec, i) => { if (!sec.name.trim()) sec.name = `Section ${i + 1}`; });
    const questions = buildPaper();
    if (!questions.length) {
      showToast("This set doesn't have questions of those types yet.");
      return;
    }
    // Sections that came out short keep their choice rule in proportion.
    for (const sec of p.sections) {
      const got = questions.filter((q) => q.part === sec.name).length;
      if (got < sec.count) {
        sec.attempt = Math.min(sec.attempt, got);
        sec.count = got;
      }
    }
    p.sections = p.sections.filter((sec) => sec.count > 0);
    state.screen = "generating";
    render();
    setTimeout(() => startTest(questions), reducedMotionPref() ? 300 : 1400);
  }

  const reducedMotionPref = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function startTest(questions) {
    Object.assign(state, {
      screen: "exam",
      questions,
      current: 0,
      startedAt: Date.now(),
      endsAt: Date.now() + state.pattern.minutes * 60000,
      warned: new Set(),
      result: null,
    });
    questions[0].visited = true;
    document.body.classList.add("exam-mode");
    window.addEventListener("beforeunload", warnBeforeLeaving);
    render();
    main.querySelector(".exam-q-text").focus({ preventScroll: true });
    state.timer = setInterval(tick, 1000);
  }

  // ---------------------------------------------------------------------------
  // Exam mode
  // ---------------------------------------------------------------------------

  function warnBeforeLeaving(event) {
    event.preventDefault();
    event.returnValue = "";
  }

  function tick() {
    const left = state.endsAt - Date.now();
    const timer = main.querySelector(".exam-timer");
    if (timer) {
      timer.querySelector(".exam-timer-value").textContent = formatClock(left);
      timer.classList.toggle("is-warning", left <= 5 * 60000 && left > 60000);
      timer.classList.toggle("is-danger", left <= 60000);
    }
    for (const mins of [5, 1]) {
      if (left <= mins * 60000 && !state.warned.has(mins) && state.pattern.minutes > mins) {
        state.warned.add(mins);
        const msg = `${mins} minute${mins === 1 ? "" : "s"} left`;
        showToast(msg);
        const status = main.querySelector("#exam-status");
        if (status) status.textContent = msg;
      }
    }
    if (left <= 0) {
      showToast("Time's up. Your test has been submitted.");
      submit();
    }
  }

  function paletteHtml() {
    const parts = [...new Set(state.questions.map((q) => q.part))];
    const answered = state.questions.filter(isAnswered).length;
    const groups = parts.map((part) => `
      <div class="palette-part">
        ${parts.length > 1 ? `<p class="palette-part-title">${escapeHtml(part)}</p>` : ""}
        <div class="palette-grid">
          ${state.questions.map((q, i) => {
            if (q.part !== part) return "";
            let status = "not-visited";
            let label = "not visited";
            if (q.marked) { status = "marked"; label = isAnswered(q) ? "answered, marked for review" : "marked for review"; }
            else if (isAnswered(q)) { status = "answered"; label = "answered"; }
            else if (q.visited) { status = "not-answered"; label = "not answered"; }
            return `
              <button type="button" class="palette-btn is-${status}${isAnswered(q) && q.marked ? " has-answer" : ""}"
                data-goto="${i}"${i === state.current ? ' aria-current="true"' : ""}
                aria-label="Question ${i + 1}, ${label}">${i + 1}</button>`;
          }).join("")}
        </div>
      </div>`).join("");

    return `
      <aside class="exam-palette card" aria-label="Question palette">
        <p class="palette-count"><strong>${answered}</strong> of ${state.questions.length} answered</p>
        ${groups}
        <ul class="palette-legend">
          <li><span class="palette-swatch is-answered"></span>Answered</li>
          <li><span class="palette-swatch is-not-answered"></span>Not answered</li>
          <li><span class="palette-swatch is-marked"></span>Marked for review</li>
          <li><span class="palette-swatch is-not-visited"></span>Not visited</li>
        </ul>
      </aside>`;
  }

  function answerAreaHtml(q, i) {
    if (q.type === "mcq") {
      return `
        <fieldset class="exam-options">
          <legend class="visually-hidden">Choose one answer</legend>
          ${q.item.options.map((opt, o) => `
            <label class="exam-option">
              <input type="radio" name="answer-${i}" value="${o}"${q.answer === o ? " checked" : ""}>
              <span class="exam-option-letter">${"ABCD"[o]}</span>
              <span>${richText(opt)}</span>
            </label>`).join("")}
        </fieldset>
        ${q.answer !== null ? '<button type="button" class="btn btn-ghost btn-sm" data-clear>Clear answer</button>' : ""}`;
    }
    const words = wordCount(q.answer);
    const target = q.type === "short" ? "about 80–120 words" : "about 200–300 words";
    return `
      <label class="visually-hidden" for="written-${i}">Your answer</label>
      <textarea class="input exam-textarea" id="written-${i}" rows="${q.type === "short" ? 7 : 12}"
        placeholder="Write your answer here (${target})">${escapeHtml(q.answer)}</textarea>
      <p class="word-count muted"><span data-words>${words}</span> words · aim for ${target}</p>`;
  }

  function examHtml(s) {
    const q = state.questions[state.current];
    const i = state.current;
    const last = i === state.questions.length - 1;
    const left = state.endsAt - Date.now();
    const sec = state.pattern.sections.find((x) => x.name === q.part);
    const rule = sec && sec.attempt < sec.count ? ` · ${choiceLabel(sec)}` : "";

    return `
      <div class="exam">
        <header class="exam-bar">
          <div class="exam-title">
            <span class="exam-set">${s.emoji} ${escapeHtml(s.name)}</span>
            <span class="muted">${escapeHtml(state.pattern.name)} · ${sectionsTotal(state.pattern)} marks</span>
          </div>
          <div class="exam-timer" role="timer" aria-label="Time left">
            ${icon("calendar")}<span class="exam-timer-value">${formatClock(left)}</span>
          </div>
          <button type="button" class="btn btn-primary btn-sm" data-submit>Submit</button>
        </header>

        <div class="exam-layout">
          <section class="exam-question card" aria-labelledby="exam-q">
            <div class="exam-q-meta">
              <span>${escapeHtml(q.part)}${rule} · Question ${i + 1} of ${state.questions.length}</span>
              <span class="exam-marks">${q.marks} ${q.marks === 1 ? "mark" : "marks"}</span>
            </div>
            <h2 class="exam-q-text" id="exam-q" tabindex="-1">${richText(q.item.question)}</h2>
            ${answerAreaHtml(q, i)}
            <div class="exam-nav">
              <button type="button" class="btn btn-secondary" data-prev${i === 0 ? " disabled" : ""}>← Previous</button>
              <button type="button" class="btn btn-ghost mark-btn" data-mark aria-pressed="${q.marked}">
                ${q.marked ? "Marked for review" : "Mark for review"}
              </button>
              <button type="button" class="btn btn-primary" data-next${last ? " disabled" : ""}>Next →</button>
            </div>
          </section>
          ${paletteHtml()}
        </div>
        <p class="visually-hidden" aria-live="assertive" id="exam-status"></p>
      </div>`;
  }

  function goTo(index) {
    state.current = Math.max(0, Math.min(state.questions.length - 1, index));
    state.questions[state.current].visited = true;
    render();
    main.querySelector(".exam-q-text").focus({ preventScroll: true });
    main.querySelector(".exam-question").scrollIntoView({ block: "nearest" });
  }

  function refreshPalette() {
    const palette = main.querySelector(".exam-palette");
    if (palette) palette.outerHTML = paletteHtml();
  }

  async function confirmSubmit() {
    const total = state.questions.length;
    const answered = state.questions.filter(isAnswered).length;
    const marked = state.questions.filter((q) => q.marked).length;
    const unanswered = total - answered;
    const parts = [`You've answered ${answered} of ${total} questions.`];
    if (unanswered) parts.push(`${unanswered} ${unanswered === 1 ? "is" : "are"} unanswered.`);
    if (marked) parts.push(`${marked} ${marked === 1 ? "is" : "are"} marked for review.`);
    parts.push("You can't change your answers after submitting.");

    const ok = await confirmDialog({ title: "Submit test?", message: parts.join(" "), confirmLabel: "Submit test" });
    if (ok && state.screen === "exam") submit();
  }

  // ---------------------------------------------------------------------------
  // Marking + results
  // ---------------------------------------------------------------------------

  function markQuestion(q) {
    if (q.type === "mcq") {
      return { earned: q.answer === q.item.answer ? q.marks : 0, covered: [], missed: [] };
    }
    const text = q.answer.toLowerCase();
    const covered = q.item.keyPoints.filter((k) => text.includes(k.toLowerCase()));
    const missed = q.item.keyPoints.filter((k) => !covered.includes(k));
    // Very short answers get no credit even if they name a key term.
    if (wordCount(q.answer) < 8) return { earned: 0, covered, missed };
    const raw = (q.marks * covered.length) / q.item.keyPoints.length;
    return { earned: Math.round(raw * 2) / 2, covered, missed }; // nearest half mark
  }

  function submit() {
    clearInterval(state.timer);
    window.removeEventListener("beforeunload", warnBeforeLeaving);
    document.body.classList.remove("exam-mode");

    const marked = state.questions.map((q) => ({ ...q, ...markQuestion(q) }));
    // With "Answer any N of M", the best N answers in the section count.
    const sections = state.pattern.sections.map((sec) => {
      const qs = marked.filter((q) => q.part === sec.name);
      const counted = [...qs].sort((x, y) => y.earned - x.earned).slice(0, sec.attempt);
      return {
        part: sec.name,
        type: sec.type,
        rule: choiceLabel(sec),
        count: qs.length,
        attempted: qs.filter(isAnswered).length,
        earned: counted.reduce((n, q) => n + q.earned, 0),
        possible: sec.attempt * sec.marks,
      };
    }).filter((sec) => sec.count);

    const byTopic = {};
    for (const q of marked) {
      const t = (byTopic[q.item.topicId] = byTopic[q.item.topicId] || { correct: 0, total: 0 });
      t.correct += q.earned;
      t.total += q.marks;
    }
    const changes = applyTopicResults(initialSet.id, byTopic);

    state.result = {
      questions: marked,
      sections,
      changes,
      earned: sections.reduce((n, s) => n + s.earned, 0),
      possible: sections.reduce((n, s) => n + s.possible, 0),
      minutesUsed: Math.max(1, Math.round((Date.now() - state.startedAt) / 60000)),
    };
    logActivity(initialSet.id, "test", `Took a practice test in ${initialSet.name}, ${fmtMarks(state.result.earned)}/${state.result.possible}`);
    state.screen = "results";
    render();
    window.scrollTo(0, 0);
    main.querySelector(".score-big").focus();
  }

  const fmtMarks = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  function resultsHtml(s) {
    const r = state.result;
    const pct = Math.round((r.earned / r.possible) * 100);
    const strong = r.changes.filter((c) => c.score >= 70);
    const weak = r.changes.filter((c) => c.score < 50);
    const hasWritten = r.questions.some((q) => q.type !== "mcq");

    const sectionRows = r.sections.map((sec) => `
      <tr>
        <th scope="row">${escapeHtml(sec.part)} <span class="muted">${PART_NAMES[sec.type]} · ${sec.rule}</span></th>
        <td>${sec.attempted} / ${sec.count}</td>
        <td><strong>${fmtMarks(sec.earned)}</strong> / ${sec.possible}</td>
      </tr>`).join("");

    const topicRow = (c) => {
      const tier = c.score >= 70 ? "is-strong" : c.score < 50 ? "is-weak" : "";
      return `
        <li class="bar-row">
          <span>${escapeHtml(c.name)}</span>
          <span class="bar-row-value">${c.score}%</span>
          <div class="progress progress-thin" aria-hidden="true"><div class="progress-fill ${tier}" style="width: ${c.score}%"></div></div>
        </li>`;
    };
    const sorted = [...r.changes].sort((a, b) => b.score - a.score);

    const review = r.questions.map((q, i) => {
      let detail;
      if (q.type === "mcq") {
        const yours = q.answer === null ? "Not answered" : richText(q.item.options[q.answer]);
        detail = `
          <p class="${q.earned ? "review-right" : "review-yours"}">Your answer: ${yours}</p>
          ${q.earned ? "" : `<p class="review-right">Correct: ${richText(q.item.options[q.item.answer])}</p>`}
          <p class="muted">${richText(q.item.explanation)}</p>`;
      } else {
        detail = `
          <p class="muted">${q.answer.trim() ? `Your answer: ${escapeHtml(q.answer.trim().slice(0, 240))}${q.answer.trim().length > 240 ? "…" : ""}` : "Not answered"}</p>
          <div class="key-points">
            ${q.covered.map((k) => `<span class="kp is-covered">${icon("check")}${escapeHtml(k)}</span>`).join("")}
            ${q.missed.map((k) => `<span class="kp is-missed">${escapeHtml(k)}</span>`).join("")}
          </div>
          <p class="model-answer"><strong>Model answer:</strong> ${escapeHtml(q.item.modelAnswer)}</p>`;
      }
      return `
        <details class="review-item">
          <summary>
            <span class="review-num">${i + 1}</span>
            <span class="review-q-text">${richText(q.item.question)}</span>
            <span class="review-score ${q.earned === q.marks ? "is-full" : q.earned === 0 ? "is-zero" : ""}">${fmtMarks(q.earned)}/${q.marks}</span>
          </summary>
          <div class="review-detail">${detail}</div>
        </details>`;
    }).join("");

    return `
      <div class="test-results">
        <section class="card">
          <div class="score-hero">
            ${masteryRing(pct, { size: 96 })}
            <div>
              <h2 class="score-big" tabindex="-1">${fmtMarks(r.earned)} / ${r.possible}</h2>
              <p class="muted">${escapeHtml(state.pattern.name)} · finished in ${r.minutesUsed} of ${state.pattern.minutes} min</p>
            </div>
          </div>
        </section>

        <section class="card" aria-labelledby="sections-title">
          <h3 class="results-h" id="sections-title">Section-wise marks</h3>
          <table class="section-table">
            <thead><tr><th scope="col">Section</th><th scope="col">Attempted</th><th scope="col">Marks</th></tr></thead>
            <tbody>${sectionRows}</tbody>
            <tfoot><tr><th scope="row">Total</th><td></td><td><strong>${fmtMarks(r.earned)}</strong> / ${r.possible}</td></tr></tfoot>
          </table>
          ${hasWritten ? '<p class="marking-note muted">Written answers are marked by checking which key points they cover. This previews AI marking.</p>' : ""}
        </section>

        <div class="topic-summary">
          <section class="card" aria-labelledby="strong-title">
            <h3 class="results-h" id="strong-title">Strengths</h3>
            ${strong.length ? `<ul class="topic-tags">${strong.map((c) => `<li class="topic-tag is-strong">${escapeHtml(c.name)} · ${c.score}%</li>`).join("")}</ul>` : '<p class="muted">No topic above 70% yet.</p>'}
          </section>
          <section class="card" aria-labelledby="weak-title">
            <h3 class="results-h" id="weak-title">Needs work</h3>
            ${weak.length ? `<ul class="topic-tags">${weak.map((c) => `<li><a class="topic-tag is-weak" href="${toolUrl("notes", s.id, { topic: c.topicId })}">${escapeHtml(c.name)} · ${c.score}%</a></li>`).join("")}</ul>` : '<p class="muted">No topic below 50%. Well done.</p>'}
          </section>
        </div>

        <section class="card" aria-labelledby="by-topic-title">
          <h3 class="results-h" id="by-topic-title">Score by topic</h3>
          <ul class="topic-results">${sorted.map(topicRow).join("")}</ul>
        </section>

        <section class="card" aria-labelledby="answers-title">
          <h3 class="results-h" id="answers-title">Review answers</h3>
          <div class="review-items">${review}</div>
        </section>

        <div class="results-actions">
          <button type="button" class="btn btn-primary" data-same-pattern>New test in this format</button>
          <button type="button" class="btn btn-secondary" data-new>Choose another format</button>
          <a class="btn btn-ghost" href="set.html?set=${encodeURIComponent(s.id)}">Back to set</a>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------------------------
  // Render + events
  // ---------------------------------------------------------------------------

  function render() {
    if (!initialSet) {
      main.innerHTML = setNotFoundHtml();
      return;
    }
    const s = set();
    document.title = `Practice test · ${s.name} · SkipXam`;

    if (state.screen === "exam") {
      main.innerHTML = examHtml(s);
      return;
    }
    const proBadge = getUser().plan === "free" ? '<span class="badge badge-pro">Pro</span>' : "";
    if (state.screen === "source" && s.quiz.length === 0) {
      main.innerHTML = `${toolHeaderHtml(s, `Practice test ${proBadge}`)}${emptyStateHtml({
        title: "No questions yet", text: "Practice tests are built from your notes. Upload notes to this set first.",
        action: { label: "Go to set", href: `set.html?set=${encodeURIComponent(s.id)}` } })}`;
      return;
    }
    const screens = { source: sourceHtml, analysing: analysingHtml, pattern: patternHtml, generating: generateHtml, results: resultsHtml };
    main.innerHTML = `
      ${toolHeaderHtml(s, `Practice test ${proBadge}`)}
      ${screens[state.screen](s)}`;
    if (state.screen === "source" || state.screen === "pattern") proGate(main.querySelector(".test-setup"), "Practice tests");
  }

  main.addEventListener("change", (event) => {
    const { name, value } = event.target;
    if (event.target.matches("[data-paper-input]")) {
      uploadPaper(event.target.files[0]);
      event.target.value = "";
    } else if (event.target.matches("select[data-field]")) {
      updatePatternField(event.target);
    } else if (event.target.matches("input[data-field]")) {
      updatePatternField(event.target);
      // Show the clamped value once the user leaves the field.
      const sec = state.pattern.sections[Number(event.target.dataset.sec)];
      const field = event.target.dataset.field;
      if (sec && (field === "count" || field === "marks")) event.target.value = sec[field];
      if (field === "totalMarks" || field === "minutes") event.target.value = state.pattern[field];
    } else if (name && name.startsWith("answer-")) {
      state.questions[state.current].answer = Number(value);
      refreshPalette();
      // Show the "Clear answer" button now that there is an answer.
      if (!main.querySelector("[data-clear]")) {
        main.querySelector(".exam-options").insertAdjacentHTML("afterend",
          '<button type="button" class="btn btn-ghost btn-sm" data-clear>Clear answer</button>');
      }
    }
  });

  main.addEventListener("input", (event) => {
    if (event.target.matches("input[data-field]")) {
      updatePatternField(event.target);
      return;
    }
    if (!event.target.classList.contains("exam-textarea")) return;
    const q = state.questions[state.current];
    const wasAnswered = isAnswered(q);
    q.answer = event.target.value;
    main.querySelector("[data-words]").textContent = wordCount(q.answer);
    if (wasAnswered !== isAnswered(q)) refreshPalette();
  });

  main.addEventListener("click", (event) => {
    const t = event.target;
    const source = t.closest("[data-source]");
    if (source) {
      if (getUser().plan === "free") return openUpgrade("Practice tests");
      if (source.dataset.source === "standard") return openPattern(STANDARD_PATTERN, "standard");
      state.savedOpen = !state.savedOpen;
      render();
      const list = main.querySelector("#saved-patterns");
      if (list) list.scrollIntoView({ block: "nearest", behavior: reducedMotionPref() ? "auto" : "smooth" });
      main.querySelector("[data-source='saved']").focus({ preventScroll: true });
      return undefined;
    }
    const use = t.closest("[data-use-pattern]");
    if (use) return openPattern(getTestPatterns().find((x) => x.id === use.dataset.usePattern), "saved");
    const del = t.closest("[data-delete-pattern]");
    if (del) {
      const pattern = getTestPatterns().find((x) => x.id === del.dataset.deletePattern);
      confirmDialog({ title: "Delete this pattern?", message: `"${escapeHtml(pattern.name)}" will be removed from your saved patterns.`, confirmLabel: "Delete", danger: true })
        .then((ok) => {
          if (!ok) return;
          deleteTestPattern(pattern.id);
          render();
          showToast("Pattern deleted");
        });
      return undefined;
    }
    if (t.closest("[data-cancel-analysis]") || t.closest("[data-back]") || t.closest("[data-new]")) {
      clearTimeout(state.analysisTimer);
      state.screen = "source";
      state.paper = null;
      render();
      window.scrollTo(0, 0);
      return undefined;
    }
    if (t.closest("[data-same-pattern]")) {
      state.screen = "pattern";
      render();
      window.scrollTo(0, 0);
      return undefined;
    }
    if (t.closest("[data-add-sec]")) {
      const n = state.pattern.sections.length;
      state.pattern.sections.push({ name: `Part ${String.fromCharCode(65 + n)}`, type: "short", count: 2, marks: 5, attempt: 2 });
      render();
      main.querySelectorAll(".pattern-table tbody tr")[n].querySelector("input").focus();
      return undefined;
    }
    const remove = t.closest("[data-remove-sec]");
    if (remove) {
      state.pattern.sections.splice(Number(remove.dataset.removeSec), 1);
      render();
      main.querySelector("[data-add-sec]").focus();
      return undefined;
    }
    if (t.closest("[data-fix-total]")) {
      state.pattern.totalMarks = sectionsTotal(state.pattern);
      main.querySelector("#pattern-total").value = state.pattern.totalMarks;
      refreshPattern();
      main.querySelector("#pattern-total").focus();
      return undefined;
    }
    if (t.closest("[data-save-pattern]")) return savePattern();
    if (t.closest("[data-generate]")) return generateTest();

    if (t.closest("[data-goto]")) goTo(Number(t.closest("[data-goto]").dataset.goto));
    else if (t.closest("[data-prev]")) goTo(state.current - 1);
    else if (t.closest("[data-next]")) goTo(state.current + 1);
    else if (t.closest("[data-mark]")) {
      const q = state.questions[state.current];
      q.marked = !q.marked;
      const btn = t.closest("[data-mark]");
      btn.setAttribute("aria-pressed", String(q.marked));
      btn.textContent = q.marked ? "Marked for review" : "Mark for review";
      refreshPalette();
    } else if (t.closest("[data-clear]")) {
      state.questions[state.current].answer = null;
      render();
    } else if (t.closest("[data-submit]")) confirmSubmit();
  });

  // Drop a paper onto the upload card.
  main.addEventListener("dragover", (event) => {
    const zone = event.target.closest("[data-drop]");
    if (!zone) return;
    event.preventDefault();
    zone.classList.add("is-dragging");
  });
  main.addEventListener("dragleave", (event) => {
    const zone = event.target.closest("[data-drop]");
    if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove("is-dragging");
  });
  main.addEventListener("drop", (event) => {
    const zone = event.target.closest("[data-drop]");
    if (!zone) return;
    event.preventDefault();
    zone.classList.remove("is-dragging");
    uploadPaper(event.dataTransfer.files[0]);
  });

  render();
})();
