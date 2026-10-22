/*
 * AI Tutor (app/tutor.html[?set=<id>&topic=<topicId>]). Pro feature, wrapped in proGate().
 * Without ?set= it shows a set picker. The chat itself (models, voice typing,
 * read aloud, voice call) is the shared component in tutor-chat.js; this page
 * adds the topic picker and the mastery meter. Correct answers raise the
 * topic's mastery (+5), wrong ones lower it a little (−2).
 * Load after data.js, app.js and tutor-chat.js.
 */
(function () {
  "use strict";

  const main = document.querySelector("main");
  const { set: initialSet, topic: startTopic } = setFromUrl();
  const set = () => getSet(initialSet.id);
  const tier = (m) => (m >= 70 ? "strong" : m >= 40 ? "mid" : "weak");

  let topicId = null;
  let chat = null;
  const topic = () => set().topics.find((t) => t.id === topicId);

  function meterHtml(t) {
    return `
      <div class="meter" aria-label="Topic mastery">
        <div class="meter-head">
          <span class="field-label">Mastery meter</span>
          <span class="meter-value tier-${tier(t.mastery)}" data-meter-value>${t.mastery}%</span>
        </div>
        <div class="meter-track" role="progressbar" aria-label="${escapeHtml(t.name)} mastery"
          aria-valuemin="0" aria-valuemax="100" aria-valuenow="${t.mastery}">
          <div class="meter-fill tier-${tier(t.mastery)}" style="width: ${t.mastery}%"></div>
        </div>
        <p class="meter-hint muted" data-meter-hint>Answer questions correctly to fill it up.</p>
      </div>`;
  }

  function renderMeter(before, after) {
    const fill = main.querySelector(".meter-fill");
    if (!fill) return;
    const cls = `tier-${tier(after)}`;
    fill.style.width = `${after}%`;
    fill.className = `meter-fill ${cls}`;
    const value = main.querySelector("[data-meter-value]");
    value.textContent = `${after}%`;
    value.className = `meter-value ${cls}`;
    main.querySelector(".meter-track").setAttribute("aria-valuenow", String(after));
    const option = main.querySelector(`#tutor-topic option[value="${topicId}"]`);
    if (option) option.textContent = `${topic().name} (${after}%)`;
    const diff = after - before;
    main.querySelector("[data-meter-hint]").textContent = diff > 0 ? `+${diff}% from that answer. Keep going!` : diff < 0 ? `${diff}% this time. Try another one.` : "Answer questions correctly to fill it up.";
  }

  function pickerHtml() {
    const sets = getSets();
    return `
      <header class="tool-header"><div class="tool-header-row"><h1>Tutor${getUser().plan === "free" ? ' <span class="badge badge-pro">Pro</span>' : ""}</h1></div></header>
      <p class="muted tutor-picker-intro">Choose a study set to start a session.</p>
      ${sets.length ? `
        <ul class="tutor-picker">
          ${sets.map((s) => `
            <li><a class="card tutor-set" href="tutor.html?set=${encodeURIComponent(s.id)}" style="--set-colour: ${s.colour}">
              <span class="tutor-set-emoji" aria-hidden="true">${s.emoji}</span>
              <span><span class="tutor-set-name">${escapeHtml(s.name)}</span><span class="muted">${s.topics.length} topics</span></span>
            </a></li>`).join("")}
        </ul>` : emptyStateHtml({ text: "Create a study set to start a tutor session.", action: { label: `${icon("plus")}New study set`, attrs: 'data-action="create-set"' } })}`;
  }

  function render() {
    if (!initialSet) {
      document.title = "Tutor · SkipXam";
      main.innerHTML = pickerHtml();
      return;
    }
    const s = set();
    document.title = `Tutor · ${s.name} · SkipXam`;
    const proBadge = getUser().plan === "free" ? ' <span class="badge badge-pro">Pro</span>' : "";

    if (s.topics.length === 0) {
      main.innerHTML = `${toolHeaderHtml(s, `Tutor${proBadge}`)}${emptyStateHtml({
        title: "Nothing to tutor yet", text: "The tutor works from the topics in your notes. Upload notes to this set first.",
        action: { label: "Go to set", href: `set.html?set=${encodeURIComponent(s.id)}` } })}`;
      return;
    }

    const t = topic();
    main.innerHTML = `
      ${toolHeaderHtml(s, `Tutor${proBadge}`)}
      <div class="tutor-layout">
        <aside class="card tutor-side">
          <div class="field">
            <label class="field-label" for="tutor-topic">Topic</label>
            <select class="input" id="tutor-topic">
              ${s.topics.map((x) => `<option value="${x.id}"${x.id === topicId ? " selected" : ""}>${escapeHtml(x.name)} (${x.mastery}%)</option>`).join("")}
            </select>
          </div>
          <div data-meter>${meterHtml(t)}</div>
        </aside>
        <div class="tutor-chat-mount"></div>
      </div>`;
    chat = createTutorChat({
      mount: main.querySelector(".tutor-chat-mount"),
      setId: s.id,
      topicId,
      variant: "page",
      onMastery: renderMeter,
    });
    proGate(main.querySelector(".tutor-layout"), "AI Tutor");
  }

  main.addEventListener("change", (event) => {
    if (event.target.id !== "tutor-topic") return;
    topicId = event.target.value;
    main.querySelector("[data-meter]").innerHTML = meterHtml(topic());
    chat.setTopic(topicId);
  });

  if (initialSet) {
    const s = set();
    const weakest = [...s.topics].sort((a, b) => a.mastery - b.mastery)[0];
    topicId = startTopic ? startTopic.id : weakest ? weakest.id : null;
  }
  render();
})();
