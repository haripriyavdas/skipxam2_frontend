/*
 * Flashcards (app/flashcards.html?set=<id>[&topic=<topicId>]). Load after data.js and app.js.
 * Study mode: due cards one at a time, centred, with arrows to move between
 * them. "Again" sends a card to the back of the queue; "Got it" schedules it
 * for later (see reviewFlashcard in data.js).
 * Browse mode: a grid of every card.
 */
(function () {
  "use strict";

  const main = document.querySelector("main");
  const { set: initialSet, topic: initialTopic } = setFromUrl();
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    mode: "study",           // "study" | "browse"
    topicId: initialTopic ? initialTopic.id : null,
    queue: [],               // card ids still to answer this session
    pos: 0,                  // which queued card is showing (the arrows move it)
    deckSize: 0,
    flipped: false,
    gotIt: 0,
    firstTry: new Set(),     // got right without pressing Again
    needsAgain: new Set(),   // pressed Again at least once
    done: false,
    busy: false,             // true while a card animates away
  };

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------

  const currentSet = () => getSet(initialSet.id);

  function cardsInScope(set) {
    return set.flashcards.filter((c) => !state.topicId || c.topicId === state.topicId);
  }

  function startSession(includeAll = false) {
    const cards = cardsInScope(currentSet());
    const deck = includeAll ? cards : cards.filter(isCardDue);
    Object.assign(state, {
      queue: deck.map((c) => c.id),
      pos: 0,
      deckSize: deck.length,
      flipped: false,
      gotIt: 0,
      firstTry: new Set(),
      needsAgain: new Set(),
      done: false,
      busy: false,
    });
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  function filtersHtml(set) {
    const chip = (id, label) => `
      <button type="button" class="chip" data-topic="${id || ""}" aria-pressed="${state.topicId === id}">${label}</button>`;
    return `
      <div class="fc-toolbar">
        <div class="segmented" role="radiogroup" aria-label="View">
          <label><input type="radio" name="fc-mode" value="study"${state.mode === "study" ? " checked" : ""}><span>Study</span></label>
          <label><input type="radio" name="fc-mode" value="browse"${state.mode === "browse" ? " checked" : ""}><span>Browse all</span></label>
        </div>
        <div class="fc-topics" role="group" aria-label="Filter by topic">
          ${chip(null, "All topics")}
          ${set.topics.map((t) => chip(t.id, escapeHtml(t.name))).join("")}
        </div>
      </div>`;
  }

  // Under the card: "Show answer" until it's flipped, then Again / Got it.
  function answerSlotHtml() {
    if (!state.flipped) {
      return `<button type="button" class="btn btn-secondary btn-block" data-show-answer>Show answer <kbd aria-hidden="true">Space</kbd></button>`;
    }
    return `
      <div class="answer-buttons">
        <button type="button" class="btn btn-secondary answer-again" data-answer="again">
          <kbd aria-hidden="true">1</kbd> Again
        </button>
        <button type="button" class="btn btn-primary answer-got" data-answer="got">
          Got it <kbd aria-hidden="true">2</kbd>
        </button>
      </div>`;
  }

  function cardHtml(card, set) {
    return `
      <div class="flashcard-stage">
        <div class="flashcard${state.flipped ? " is-flipped" : ""}" tabindex="0" role="button"
          aria-label="${state.flipped ? "Answer shown. Press Space to flip back" : "Show answer"}">
          <div class="flashcard-inner">
            <div class="face face-front" aria-hidden="${state.flipped}">
              <span class="face-label">${escapeHtml(topicName(set, card.topicId))}</span>
              <p class="face-text">${richText(card.front)}</p>
              <span class="face-hint">Tap or press Space to flip</span>
            </div>
            <div class="face face-back" aria-hidden="${!state.flipped}">
              <span class="face-label">Answer</span>
              <p class="face-text">${richText(card.back)}</p>
            </div>
          </div>
        </div>
      </div>
      <div class="answer-slot">${answerSlotHtml()}</div>
      <div class="fc-controls">
        <button type="button" class="fc-arrow" data-move="-1" aria-label="Previous card"${state.queue.length > 1 ? "" : " disabled"}>${icon("chevronLeft")}</button>
        <span class="fc-counter"><strong>${state.pos + 1}</strong> / ${state.queue.length}</span>
        <button type="button" class="fc-arrow" data-move="1" aria-label="Next card"${state.queue.length > 1 ? "" : " disabled"}>${icon("chevronRight")}</button>
      </div>`;
  }

  function studyHtml(set) {
    const dueCount = cardsInScope(set).filter(isCardDue).length;
    const pct = state.deckSize ? Math.round((state.gotIt / state.deckSize) * 100) : 0;

    const stats = `
      <div class="fc-stats">
        <span class="due-pill">${dueCount} due today</span>
        <span class="muted">${state.gotIt} of ${state.deckSize} done</span>
      </div>
      <div class="progress progress-thin" role="progressbar" aria-label="Session progress"
        aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
        <div class="progress-fill" style="width: ${pct}%"></div>
      </div>`;

    if (state.done) return summaryHtml(set);

    if (state.deckSize === 0) {
      const total = cardsInScope(set).length;
      return emptyStateHtml(total
        ? { title: "Nothing due today", text: "You're up to date on these cards. Come back tomorrow, or review them all now.",
            action: { label: `Review all ${total} cards`, attrs: "data-study-all" } }
        : { title: "No flashcards yet", text: "Flashcards appear here once your notes are processed.",
            action: { label: "Go to set", href: `set.html?set=${encodeURIComponent(set.id)}` } });
    }

    const card = set.flashcards.find((c) => c.id === state.queue[state.pos]);
    return `${cardHtml(card, set)}<div class="fc-session">${stats}</div>`;
  }

  function summaryHtml(set) {
    const again = [...state.needsAgain].map((id) => set.flashcards.find((c) => c.id === id)).filter(Boolean);
    return `
      <section class="card fc-summary" aria-labelledby="summary-title">
        <h2 id="summary-title">Session complete</h2>
        <div class="summary-stats">
          <div><span class="summary-num">${state.deckSize}</span><span class="muted">cards reviewed</span></div>
          <div><span class="summary-num is-good">${state.firstTry.size}</span><span class="muted">got it first time</span></div>
          <div><span class="summary-num is-again">${again.length}</span><span class="muted">needed another look</span></div>
        </div>
        ${again.length ? `
          <div class="summary-again">
            <h3>Worth another look</h3>
            <ul>${again.map((c) => `<li>${richText(c.front)}</li>`).join("")}</ul>
          </div>` : '<p class="muted">Every card right on the first try. Nice work.</p>'}
        <div class="summary-actions">
          <a class="btn btn-primary" href="${toolUrl("quiz", set.id, state.topicId ? { topic: state.topicId } : {})}">Take a quiz</a>
          <button type="button" class="btn btn-secondary" data-mode-browse>Browse all cards</button>
          <a class="btn btn-ghost" href="set.html?set=${encodeURIComponent(set.id)}">Back to set</a>
        </div>
      </section>`;
  }

  function dueLabel(card) {
    if (isCardDue(card)) return '<span class="due-tag is-due">Due</span>';
    const days = daysUntil(card.due);
    return `<span class="due-tag">${days === 1 ? "Tomorrow" : `In ${days} days`}</span>`;
  }

  function browseHtml(set) {
    const cards = cardsInScope(set);
    if (cards.length === 0) return emptyStateHtml({ title: "No flashcards here yet", text: "There are no cards for this topic yet." });
    return `
      <p class="muted fc-count">${cards.length} cards</p>
      <ul class="fc-grid">
        ${cards.map((c) => `
          <li class="fc-tile">
            <div class="fc-tile-head">
              <span class="face-label">${escapeHtml(topicName(set, c.topicId))}</span>
              ${dueLabel(c)}
            </div>
            <p class="fc-tile-front">${richText(c.front)}</p>
            <p class="fc-tile-back">${richText(c.back)}</p>
          </li>`).join("")}
      </ul>`;
  }

  function render() {
    if (!initialSet) {
      main.innerHTML = setNotFoundHtml();
      return;
    }
    const set = currentSet();
    document.title = `Flashcards · ${set.name} · SkipXam`;
    main.innerHTML = `
      ${toolHeaderHtml(set, "Flashcards")}
      <div class="fc-page is-${state.mode}">
        <div class="fc-body">${state.mode === "study" ? studyHtml(set) : browseHtml(set)}</div>
        ${filtersHtml(set)}
        <p class="fc-help muted"${state.mode === "study" ? "" : " hidden"}>Space flips · ← → move between cards · 1 Again · 2 Got it · Swipe on mobile</p>
      </div>
      <p class="visually-hidden" aria-live="polite" id="fc-status"></p>`;
  }

  function renderBody() {
    const set = currentSet();
    main.querySelector(".fc-page").className = `fc-page is-${state.mode}`;
    main.querySelector(".fc-body").innerHTML = state.mode === "study" ? studyHtml(set) : browseHtml(set);
    main.querySelector(".fc-help").hidden = state.mode !== "study";
  }

  function announce(text) {
    const status = main.querySelector("#fc-status");
    if (status) status.textContent = text;
  }

  // ---------------------------------------------------------------------------
  // Study actions
  // ---------------------------------------------------------------------------

  function flip() {
    if (state.mode !== "study" || state.done || !state.queue.length || state.busy) return;
    state.flipped = !state.flipped;
    const card = main.querySelector(".flashcard");
    card.classList.toggle("is-flipped", state.flipped);
    card.setAttribute("aria-label", state.flipped ? "Answer shown. Press Space to flip back" : "Show answer");
    card.querySelector(".face-front").setAttribute("aria-hidden", String(state.flipped));
    card.querySelector(".face-back").setAttribute("aria-hidden", String(!state.flipped));
    const slot = main.querySelector(".answer-slot");
    const hadFocus = slot.contains(document.activeElement);
    slot.innerHTML = answerSlotHtml();
    if (hadFocus) slot.querySelector(".btn-primary, .btn").focus();
    if (state.flipped) announce(`Answer: ${card.querySelector(".face-back .face-text").textContent}`);
  }

  function answer(gotIt) {
    if (!state.flipped || state.busy || !state.queue.length) return;
    const id = state.queue[state.pos];
    reviewFlashcard(initialSet.id, id, gotIt);

    state.queue.splice(state.pos, 1);
    if (gotIt) {
      state.gotIt += 1;
      if (!state.needsAgain.has(id)) state.firstTry.add(id);
    } else {
      state.needsAgain.add(id);
      state.queue.push(id); // see it again later in this session
    }
    if (state.pos >= state.queue.length) state.pos = 0;
    recordActivity(initialSet.id, "flashcards", state.gotIt, state.deckSize);

    const advance = () => {
      state.flipped = false;
      state.busy = false;
      state.done = state.queue.length === 0;
      if (state.done) logActivity(initialSet.id, "flashcards", `Reviewed ${state.deckSize} flashcards in ${initialSet.name}`);
      renderBody();
      const next = main.querySelector(".flashcard");
      if (next) next.focus();
      announce(gotIt ? "Got it." : "Card moved to the back of the deck.");
    };

    const cardEl = main.querySelector(".flashcard");
    if (reducedMotion() || !cardEl) return advance();
    state.busy = true;
    cardEl.classList.add(gotIt ? "fly-right" : "fly-left");
    setTimeout(advance, 260);
  }

  function move(step) {
    if (state.mode !== "study" || state.done || state.queue.length < 2 || state.busy) return;
    state.pos = (state.pos + step + state.queue.length) % state.queue.length;
    state.flipped = false;
    renderBody();
    announce(`Card ${state.pos + 1} of ${state.queue.length}`);
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  main.addEventListener("click", (event) => {
    const topicChip = event.target.closest("[data-topic]");
    if (topicChip) {
      state.topicId = topicChip.dataset.topic || null;
      startSession();
      render();
      return;
    }
    if (event.target.closest("[data-study-all]")) {
      startSession(true);
      renderBody();
      return;
    }
    if (event.target.closest("[data-mode-browse]")) {
      state.mode = "browse";
      render();
      return;
    }
    if (event.target.closest("[data-show-answer]")) {
      flip();
      return;
    }
    const arrow = event.target.closest("[data-move]");
    if (arrow) {
      move(Number(arrow.dataset.move));
      const again = main.querySelector(`[data-move="${arrow.dataset.move}"]`);
      if (again) again.focus();
      return;
    }
    const answerBtn = event.target.closest("[data-answer]");
    if (answerBtn) answer(answerBtn.dataset.answer === "got");
  });

  main.addEventListener("change", (event) => {
    if (event.target.name !== "fc-mode") return;
    state.mode = event.target.value;
    if (state.mode === "study" && state.done) startSession();
    renderBody();
  });

  // Swipe (pointer events): drag the card; tap flips, a long drag answers once flipped.
  let drag = null;
  main.addEventListener("pointerdown", (event) => {
    const card = event.target.closest(".flashcard");
    if (!card || state.busy || (event.pointerType === "mouse" && event.button !== 0)) return;
    drag = { card, startX: event.clientX, startY: event.clientY, dx: 0, id: event.pointerId };
    card.setPointerCapture(event.pointerId);
  });

  main.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    drag.dx = event.clientX - drag.startX;
    if (state.flipped && Math.abs(drag.dx) > 8) {
      drag.card.classList.add("is-dragging");
      drag.card.style.transform = `translateX(${drag.dx}px) rotate(${drag.dx / 20}deg)`;
      drag.card.dataset.swipe = drag.dx > 60 ? "got" : drag.dx < -60 ? "again" : "";
    }
  });

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const { card, dx } = drag;
    const moved = Math.abs(dx) > 8 || Math.abs(event.clientY - drag.startY) > 8;
    drag = null;
    card.classList.remove("is-dragging");
    card.style.transform = "";
    delete card.dataset.swipe;
    if (event.type === "pointercancel") return;
    if (!moved) flip();
    else if (state.flipped && Math.abs(dx) > 90) answer(dx > 0);
  }
  main.addEventListener("pointerup", endDrag);
  main.addEventListener("pointercancel", endDrag);

  document.addEventListener("keydown", (event) => {
    if (state.mode !== "study" || document.querySelector("dialog[open]")) return;
    const tag = event.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    // Let Space/Enter activate other buttons and links normally.
    const onOtherControl = event.target.closest("button, a, [role='radiogroup']") && !event.target.closest(".flashcard");

    if ((event.key === " " && !onOtherControl) || (event.key === "Enter" && event.target.closest(".flashcard"))) {
      event.preventDefault();
      flip();
    } else if (event.key === "ArrowRight" && !event.target.closest("[role='radiogroup']")) {
      move(1);
    } else if (event.key === "ArrowLeft" && !event.target.closest("[role='radiogroup']")) {
      move(-1);
    } else if (event.key === "1") {
      answer(false);
    } else if (event.key === "2") {
      answer(true);
    }
  });

  if (initialSet) startSession();
  render();
})();
