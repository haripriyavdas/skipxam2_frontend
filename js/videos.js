/*
 * Videos (app/videos.html?set=<id>[&video=<id> | &yt=<youtube id>][&topic=<id>]).
 * A lecture page in the style of Udemy's. What it shows depends on the plan:
 *   Free  a grid of related YouTube videos (links), filtered by topic chips,
 *         under a locked "AI explainer video" card.
 *   Pro   player + tabs (Overview, Transcript, Notes) + a collapsible panel:
 *         Generated videos (one full explainer for the set; topic videos are
 *         locked rows with a Max badge) and YouTube (related, plays embedded).
 *   Max   one generated video per topic, plus "Search a topic to generate a
 *         video" (a mock generating row, then a playable video).
 * Generated videos all play the placeholder VIDEO_FILE and end at their own
 * duration; captions come from data.js. Load after data.js and app.js.
 */
(function () {
  "use strict";

  const main = document.querySelector("main");
  const { set, topic: startTopic } = setFromUrl();
  const params = new URLSearchParams(location.search);
  const plan = getUser().plan;

  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  const PREFS = { speed: "skipxam.videoSpeed", captions: "skipxam.videoCaptions", volume: "skipxam.videoVolume", panel: "skipxam.videoPanel" };
  const GEN_STEPS = ["Writing script", "Creating visuals", "Adding voice"];
  const STEP_MS = 1400;

  function readPref(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch (err) {
      return fallback;
    }
  }
  function writePref(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { /* per-viewer pref only */ }
  }

  const state = {
    current: null,       // { kind: "gen" | "yt", id }
    context: null,       // topic id the YouTube tab is related to (null = whole set)
    playerTab: "overview",
    panelTab: "generated",
    panelOpen: readPref(PREFS.panel, true),
    captions: readPref(PREFS.captions, true),
    speed: SPEEDS.includes(readPref(PREFS.speed, 1)) ? readPref(PREFS.speed, 1) : 1,
    volume: Math.min(1, Math.max(0, Number(readPref(PREFS.volume, 1)) || 0)),
    muted: false,
    generating: null,    // { query, step }
    freeTopic: startTopic ? startTopic.id : "all",
    noteDraft: null,     // { t } while the note form is open
  };

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------

  const plain = (text) => text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`(.+?)`/g, "$1");
  const firstSentence = (text) => (plain(text).match(/^.*?[.!?](\s|$)/) || [plain(text)])[0].trim();

  // Sets without video specs (anything but the Java demo) get videos made
  // from their topics and notes.
  function builtVideos() {
    const notesFor = (t) => set.notes.find((n) => n.topicId === t.id);
    const full = {
      id: `${set.id}-vid-full`, topicId: null, title: `Full explainer: ${set.name}`,
      captions: [[0, `Welcome to your full explainer for ${set.name}.`]],
    };
    set.topics.forEach((t, i) => {
      const n = notesFor(t);
      full.captions.push([5 + i * 8, `${t.name}: ${n ? firstSentence(n.intro) : "the key ideas and how they connect."}`]);
    });
    full.captions.push([5 + set.topics.length * 8, "That's the whole set. Test yourself with a quiz next."]);
    full.duration = Math.min(60, 12 + set.topics.length * 8);
    const topics = set.topics.map((t, i) => {
      const n = notesFor(t);
      const lines = n ? [n.intro, ...n.points, n.remember].filter(Boolean).map(plain) : [`An introduction to ${t.name}.`];
      const captions = lines.slice(0, 7).map((line, k) => [k * 8, line]);
      return { id: `${set.id}-vid-t${i + 1}`, topicId: t.id, title: t.name, captions, duration: Math.min(60, captions.length * 8 + 4) };
    });
    return { full, topics };
  }

  const videos = set ? set.videos || builtVideos() : null;
  const youtube = set ? set.youtube || [] : [];

  function videoState() {
    return getVideoState(set.id);
  }

  // The generated videos this plan can play, in list order.
  function genList() {
    if (plan === "free") return [];
    if (plan === "pro") return [videos.full];
    return [videos.full, ...videos.topics, ...videoState().generated];
  }

  const findGen = (id) => [videos.full, ...videos.topics, ...videoState().generated].find((v) => v.id === id);
  const findYt = (id) => youtube.find((v) => v.id === id);

  // Related YouTube videos: the topic's own first, then ones on the whole subject.
  function relatedYoutube(topicId) {
    if (!topicId) return youtube;
    return [...youtube.filter((v) => v.topicId === topicId), ...youtube.filter((v) => !v.topicId)];
  }

  function currentVideo() {
    if (!state.current) return null;
    return state.current.kind === "yt" ? findYt(state.current.id) : findGen(state.current.id);
  }

  // Prev/next walk the list the current video came from.
  function playlist() {
    return state.current && state.current.kind === "yt"
      ? relatedYoutube(state.context).map((v) => ({ kind: "yt", id: v.id, title: v.title }))
      : genList().map((v) => ({ kind: "gen", id: v.id, title: v.title }));
  }

  // ---------------------------------------------------------------------------
  // Formatting
  // ---------------------------------------------------------------------------

  // 1:05, or 2:30:48 for long YouTube videos.
  function clock(sec) {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = String(s % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
  }
  // 02:14, for notes and transcript stamps.
  const stamp = (sec) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
  const spoken = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m ? `${m} minute${m === 1 ? "" : "s"} ` : ""}${s} second${s === 1 ? "" : "s"}`;
  };
  const thumb = (id) => `https://img.youtube.com/vi/${encodeURIComponent(id)}/mqdefault.jpg`;

  // ---------------------------------------------------------------------------
  // Icons for the player (the shared set has play, pause and chevrons)
  // ---------------------------------------------------------------------------

  const svgIcon = (body, extra = "") => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" ${extra}>${body}</svg>`;
  const ICONS = {
    back10: svgIcon('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><text x="12" y="15.5" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor" stroke="none" font-family="system-ui, sans-serif">10</text>'),
    fwd10: svgIcon('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/><text x="12" y="15.5" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor" stroke="none" font-family="system-ui, sans-serif">10</text>'),
    cc: svgIcon('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10.5 10.2a2.2 2.2 0 1 0 0 3.6M16.5 10.2a2.2 2.2 0 1 0 0 3.6"/>'),
    volume: svgIcon('<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
    mute: svgIcon('<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="m17 9.5 5 5M22 9.5l-5 5"/>'),
    fullscreen: svgIcon('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    exitFullscreen: svgIcon('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
    replay: svgIcon('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
    external: svgIcon('<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
    youtube: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3Z"/></svg>',
  };

  // ---------------------------------------------------------------------------
  // Free plan: YouTube grid
  // ---------------------------------------------------------------------------

  function freeHtml() {
    const topics = set.topics.filter((t) => youtube.some((v) => v.topicId === t.id));
    const shown = state.freeTopic === "all" ? youtube : youtube.filter((v) => v.topicId === state.freeTopic);
    const chip = (id, label, count) => `<button type="button" class="chip" data-free-topic="${id}" aria-pressed="${state.freeTopic === id}">${escapeHtml(label)} <span class="vf-count">${count}</span></button>`;
    return `
      <section class="card vf-lock" aria-labelledby="vf-lock-title">
        <div class="vf-lock-art" aria-hidden="true">
          <span class="vf-lock-play">${icon("play")}</span>
          <span class="vf-lock-badge">${icon("lock")}</span>
        </div>
        <div class="vf-lock-text">
          <h2 id="vf-lock-title">Get an AI explainer video for this set</h2>
          <p class="muted">A short video that walks through ${escapeHtml(set.name)} with captions, a transcript and your own timestamped notes. Pro makes one for the whole set; Max makes one for every topic.</p>
          <button type="button" class="btn btn-primary" data-upgrade="AI explainer videos">Upgrade</button>
        </div>
      </section>

      <section class="vf-youtube" aria-labelledby="vf-yt-title">
        <h2 class="vf-heading" id="vf-yt-title">${ICONS.youtube}Related on YouTube</h2>
        ${youtube.length ? `
          <div class="chips vf-chips" role="group" aria-label="Filter by topic">
            ${chip("all", "All topics", youtube.length)}
            ${topics.map((t) => chip(t.id, t.name, youtube.filter((v) => v.topicId === t.id).length)).join("")}
          </div>
          <ul class="vf-grid">
            ${shown.map((v) => `
              <li>
                <a class="vf-card" href="https://www.youtube.com/watch?v=${encodeURIComponent(v.id)}" target="_blank" rel="noopener">
                  <span class="vf-thumb">
                    <img src="${thumb(v.id)}" alt="" loading="lazy" width="320" height="180" data-thumb>
                    <span class="yt-duration">${clock(v.duration)}</span>
                  </span>
                  <span class="vf-title">${escapeHtml(v.title)}</span>
                  <span class="vf-channel">${escapeHtml(v.channel)} · ${escapeHtml(v.topicId ? topicName(set, v.topicId) : "Whole subject")}</span>
                  <span class="visually-hidden"> (opens YouTube in a new tab)</span>
                </a>
              </li>`).join("")}
          </ul>` : '<p class="muted">No YouTube videos for this set yet.</p>'}
      </section>`;
  }

  // ---------------------------------------------------------------------------
  // Player
  // ---------------------------------------------------------------------------

  function edgeHtml() {
    const list = playlist();
    const i = list.findIndex((x) => x.kind === state.current.kind && x.id === state.current.id);
    const prev = i > 0 ? list[i - 1] : null;
    const next = i >= 0 && i < list.length - 1 ? list[i + 1] : null;
    const edge = (item, dir) => (item ? `
      <button type="button" class="vp-edge is-${dir}" data-go="${item.kind}:${item.id}" aria-label="${dir === "prev" ? "Previous" : "Next"} video: ${escapeHtml(item.title)}" title="${escapeHtml(item.title)}">
        ${icon(dir === "prev" ? "chevronLeft" : "chevronRight")}
      </button>` : "");
    return { html: edge(prev, "prev") + edge(next, "next"), next };
  }

  function playerHtml() {
    const v = currentVideo();
    const edges = edgeHtml();
    if (state.current.kind === "yt") {
      return `
        <div class="vp-player is-youtube" data-player>
          <iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.id)}?autoplay=1&rel=0&modestbranding=1"
            title="${escapeHtml(v.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
          ${edges.html}
        </div>`;
    }
    const speeds = SPEEDS.map((s) => `<option value="${s}"${s === state.speed ? " selected" : ""}>${s}x</option>`).join("");
    return `
      <div class="vp-player is-paused${state.captions ? " has-captions" : ""}" data-player tabindex="-1" role="region" aria-label="Video player: ${escapeHtml(v.title)}">
        <video data-video src="../${VIDEO_FILE}" preload="metadata" playsinline aria-hidden="true"></video>
        <button type="button" class="vp-bigplay" data-act="toggle" aria-label="Play">${icon("play")}</button>
        <p class="vp-caption" data-caption hidden></p>
        ${edges.html}
        <div class="vp-end" data-end hidden>
          <p class="vp-end-title">Video complete</p>
          <div class="vp-end-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-act="replay">${ICONS.replay}Replay</button>
            ${edges.next ? `<button type="button" class="btn btn-primary btn-sm" data-go="${edges.next.kind}:${edges.next.id}">Next: ${escapeHtml(edges.next.title)}</button>` : ""}
          </div>
        </div>
        <div class="vp-controls">
          <input type="range" class="vp-seek" data-seek min="0" max="${v.duration}" step="0.1" value="0" aria-label="Seek" aria-valuetext="0 seconds of ${spoken(v.duration)}">
          <div class="vp-bar">
            <button type="button" class="vp-btn" data-act="toggle" aria-label="Play">${icon("play")}</button>
            <button type="button" class="vp-btn" data-act="back" aria-label="Rewind 10 seconds">${ICONS.back10}</button>
            <label class="visually-hidden" for="vp-speed">Playback speed</label>
            <select class="vp-speed" id="vp-speed" data-speed>${speeds}</select>
            <button type="button" class="vp-btn" data-act="fwd" aria-label="Forward 10 seconds">${ICONS.fwd10}</button>
            <span class="vp-time" data-time>0:00 / ${clock(v.duration)}</span>
            <span class="vp-spacer"></span>
            <button type="button" class="vp-btn" data-act="cc" aria-pressed="${state.captions}" aria-label="Captions">${ICONS.cc}</button>
            <span class="vp-volume">
              <button type="button" class="vp-btn" data-act="mute" aria-label="Mute">${ICONS.volume}</button>
              <input type="range" class="vp-vol" data-volume min="0" max="1" step="0.05" value="${state.volume}" aria-label="Volume">
            </span>
            <button type="button" class="vp-btn" data-act="fs" aria-label="Full screen">${ICONS.fullscreen}</button>
          </div>
        </div>
      </div>`;
  }

  // The <video> and the controls bound to it.
  let video = null;
  let idleTimer = null;

  const playerEl = () => main.querySelector("[data-player]");
  const duration = () => (currentVideo() || {}).duration || 0;

  function bindVideo() {
    video = main.querySelector("[data-video]");
    if (!video) return;
    video.playbackRate = state.speed;
    video.volume = state.volume;
    video.muted = state.muted;
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("seeked", onTime);
    video.addEventListener("play", syncPlaying);
    video.addEventListener("pause", syncPlaying);
    video.addEventListener("loadedmetadata", onTime);
    video.addEventListener("ended", finishVideo); // the full explainer runs to the end of the file
    syncVolume();
    onTime();
  }

  function syncPlaying() {
    const player = playerEl();
    if (!player || !video) return;
    const playing = !video.paused;
    player.classList.toggle("is-paused", !playing);
    player.querySelectorAll('[data-act="toggle"]').forEach((b) => {
      b.setAttribute("aria-label", playing ? "Pause" : "Play");
      if (!b.classList.contains("vp-bigplay")) b.innerHTML = icon(playing ? "pause" : "play");
    });
    if (playing) wakeControls();
    else player.classList.remove("is-idle");
  }

  function captionAt(t) {
    const caps = currentVideo().captions || [];
    let index = -1;
    for (let i = 0; i < caps.length; i++) if (caps[i][0] <= t) index = i;
    return index;
  }

  let lastCaption = -2;
  function onTime() {
    if (!video) return;
    const end = duration();
    if (video.currentTime >= end - 0.05 && !video.paused) {
      video.pause();
      video.currentTime = end;
      finishVideo();
    }
    const t = Math.min(video.currentTime, end);
    const seek = main.querySelector("[data-seek]");
    if (seek && document.activeElement !== seek) seek.value = t;
    if (seek) {
      seek.style.setProperty("--pct", `${(t / end) * 100}%`);
      seek.setAttribute("aria-valuetext", `${spoken(t)} of ${spoken(end)}`);
    }
    const time = main.querySelector("[data-time]");
    if (time) time.textContent = `${clock(t)} / ${clock(end)}`;
    const ci = captionAt(t);
    if (ci !== lastCaption) {
      lastCaption = ci;
      const cap = main.querySelector("[data-caption]");
      const text = ci >= 0 ? currentVideo().captions[ci][1] : "";
      cap.textContent = text;
      cap.hidden = !state.captions || !text;
      main.querySelectorAll("[data-line]").forEach((line) => {
        const on = Number(line.dataset.line) === ci;
        line.classList.toggle("is-active", on);
        if (on) line.setAttribute("aria-current", "true");
        else line.removeAttribute("aria-current");
        if (on && !video.paused) keepLineInView(line);
      });
    }
    const note = main.querySelector("[data-add-note]");
    if (note && !state.noteDraft) note.querySelector("span").textContent = `Add note at ${stamp(t)}`;
    if (t < end - 0.5) {
      const ended = main.querySelector("[data-end]");
      if (ended && !ended.hidden) ended.hidden = true;
    }
  }

  // Scrolls the transcript list (not the page) to the current line.
  function keepLineInView(line) {
    const list = line.closest(".vt-list");
    if (!list) return;
    const top = line.offsetTop - list.offsetTop;
    if (top < list.scrollTop || top + line.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTo({ top: top - list.clientHeight / 3, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }

  function finishVideo() {
    const v = currentVideo();
    if (!videoState().watched[v.id]) {
      setVideoWatched(set.id, v.id, true);
      renderPanelList();
    }
    const ended = main.querySelector("[data-end]");
    if (ended) ended.hidden = false;
  }

  function togglePlay() {
    if (!video) return;
    if (video.paused) {
      if (video.currentTime >= duration() - 0.1) video.currentTime = 0;
      video.play().catch(() => showToast("Couldn't play the video."));
    } else {
      video.pause();
    }
  }

  function seekTo(t, play) {
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration() - 0.05, t));
    onTime();
    if (play && video.paused) video.play().catch(() => {});
  }

  function syncVolume() {
    if (!video) return;
    const quiet = video.muted || video.volume === 0;
    const btn = main.querySelector('[data-act="mute"]');
    if (btn) {
      btn.innerHTML = quiet ? ICONS.mute : ICONS.volume;
      btn.setAttribute("aria-label", quiet ? "Unmute" : "Mute");
    }
    const slider = main.querySelector("[data-volume]");
    if (slider) {
      slider.value = video.muted ? 0 : video.volume;
      slider.style.setProperty("--pct", `${(video.muted ? 0 : video.volume) * 100}%`);
    }
  }

  function toggleCaptions() {
    state.captions = !state.captions;
    writePref(PREFS.captions, state.captions);
    const btn = main.querySelector('[data-act="cc"]');
    if (btn) btn.setAttribute("aria-pressed", String(state.captions));
    playerEl().classList.toggle("has-captions", state.captions);
    lastCaption = -2;
    onTime();
  }

  function toggleFullscreen() {
    const player = playerEl();
    if (document.fullscreenElement) document.exitFullscreen();
    else if (player.requestFullscreen) player.requestFullscreen().catch(() => showToast("Full screen isn't available here."));
  }

  document.addEventListener("fullscreenchange", () => {
    const btn = main.querySelector('[data-act="fs"]');
    if (!btn) return;
    const on = Boolean(document.fullscreenElement);
    btn.innerHTML = on ? ICONS.exitFullscreen : ICONS.fullscreen;
    btn.setAttribute("aria-label", on ? "Exit full screen" : "Full screen");
  });

  // Controls fade out after a few still seconds while playing.
  function wakeControls() {
    const player = playerEl();
    if (!player) return;
    player.classList.remove("is-idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (video && !video.paused && !player.contains(document.activeElement)) player.classList.add("is-idle");
    }, 2500);
  }

  // ---------------------------------------------------------------------------
  // Player tabs: Overview, Transcript, Notes
  // ---------------------------------------------------------------------------

  const PLAYER_TABS = [
    { id: "overview", label: "Overview" },
    { id: "transcript", label: "Transcript" },
    { id: "notes", label: "Notes" },
  ];

  function overviewHtml(v) {
    if (state.current.kind === "yt") {
      return `
        <div class="vo">
          <p class="vo-lead">${escapeHtml(v.channel)} · ${clock(v.duration)} · on YouTube</p>
          <p>Related to <strong>${escapeHtml(v.topicId ? topicName(set, v.topicId) : set.name)}</strong>. SkipXam doesn't make this video, so there's no transcript here.</p>
          <a class="btn btn-secondary btn-sm" href="https://www.youtube.com/watch?v=${encodeURIComponent(v.id)}" target="_blank" rel="noopener">${ICONS.external}Watch on YouTube<span class="visually-hidden"> (opens in a new tab)</span></a>
        </div>`;
    }
    if (v.generated) {
      return `
        <div class="vo">
          <p class="vo-lead">Made for you from your search: <strong>${escapeHtml(v.query)}</strong></p>
          <p class="muted">A generated explainer (mock): what it is, how it works, an exam-style example, common mistakes and a recap.</p>
        </div>`;
    }
    if (!v.topicId) {
      return `
        <div class="vo">
          <p class="vo-lead">Everything in ${escapeHtml(set.name)} in about a minute: one idea from each topic.</p>
          <ol class="vo-topics">
            ${set.topics.map((t) => {
              const n = set.notes.find((x) => x.topicId === t.id);
              return `<li><strong>${escapeHtml(t.name)}</strong>${n ? `<span class="muted">${escapeHtml(firstSentence(n.intro))}</span>` : ""}</li>`;
            }).join("")}
          </ol>
        </div>`;
    }
    const topic = set.topics.find((t) => t.id === v.topicId);
    const n = set.notes.find((x) => x.topicId === v.topicId);
    return `
      <div class="vo">
        <p class="vo-lead">${escapeHtml(topic.name)} · ${topic.mastery}% mastery</p>
        ${n ? `
          <p>${richText(n.intro)}</p>
          <ul class="vo-points">${n.points.map((p) => `<li>${richText(p)}</li>`).join("")}</ul>
          ${n.remember ? `<p class="vo-remember"><strong>Remember:</strong> ${richText(n.remember)}</p>` : ""}` : ""}
        <p class="vo-links">
          <a class="text-link" href="${toolUrl("notes", set.id, { topic: v.topicId })}">Read the notes</a>
          <a class="text-link" href="${toolUrl("flashcards", set.id, { topic: v.topicId })}">Flashcards</a>
          <a class="text-link" href="${toolUrl("quiz", set.id, { topic: v.topicId })}">Take a quiz</a>
        </p>
      </div>`;
  }

  function transcriptHtml(v) {
    if (state.current.kind === "yt") return '<p class="muted">Transcripts are available for SkipXam videos only.</p>';
    return `
      <ol class="vt-list">
        ${v.captions.map(([t, text], i) => `
          <li><button type="button" class="vt-line" data-line="${i}" data-seek-to="${t}">
            <span class="vt-time">${stamp(t)}</span><span class="vt-text">${escapeHtml(text)}</span>
          </button></li>`).join("")}
      </ol>`;
  }

  function notesHtml(v) {
    const yt = state.current.kind === "yt";
    const notes = (videoState().notes[v.id] || []).slice().sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
    const t = video ? Math.min(video.currentTime, duration()) : 0;
    const form = state.noteDraft ? `
      <form class="vn-form" data-note-form>
        <label class="field-label" for="vn-text">${state.noteDraft.t === null ? "Your note" : `Note at ${stamp(state.noteDraft.t)}`}</label>
        <textarea class="input" id="vn-text" rows="3" maxlength="1000" required></textarea>
        <div class="vn-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-note-cancel>Cancel</button>
          <button type="submit" class="btn btn-primary btn-sm">Save note</button>
        </div>
      </form>` : `
      <button type="button" class="btn btn-secondary btn-sm vn-add" data-add-note>${icon("plus")}<span>${yt ? "Add note" : `Add note at ${stamp(t)}`}</span></button>`;
    return `
      ${form}
      ${notes.length ? `
        <ul class="vn-list">
          ${notes.map((n) => `
            <li class="vn-item">
              ${n.t === null ? "" : `<button type="button" class="vn-time" data-seek-to="${n.t}" aria-label="Go to ${stamp(n.t)}">${stamp(n.t)}</button>`}
              <p class="vn-text">${escapeHtml(n.text)}</p>
              <button type="button" class="icon-btn vn-delete" data-note-delete="${n.id}" aria-label="Delete note">${icon("trash")}</button>
            </li>`).join("")}
        </ul>` : `<p class="muted vn-empty">${yt ? "Notes you add here stay with this video." : "Pause at a moment worth remembering and add a note. Click its time to jump back."}</p>`}`;
  }

  function playerTabHtml(v) {
    if (state.playerTab === "transcript") return transcriptHtml(v);
    if (state.playerTab === "notes") return notesHtml(v);
    return overviewHtml(v);
  }

  function renderPlayerTab() {
    const v = currentVideo();
    const panel = main.querySelector("[data-player-panel]");
    panel.innerHTML = playerTabHtml(v);
    panel.setAttribute("aria-labelledby", `vtab-${state.playerTab}`);
    main.querySelectorAll("[data-player-tab]").forEach((b) => {
      const on = b.dataset.playerTab === state.playerTab;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    lastCaption = -2;
    onTime();
  }

  // ---------------------------------------------------------------------------
  // Right panel: Generated videos and YouTube
  // ---------------------------------------------------------------------------

  function genRowsHtml() {
    const watched = videoState().watched;
    const list = genList();
    let rows = list.map((v, i) => {
      const current = state.current.kind === "gen" && state.current.id === v.id;
      return `
        <li class="vrow${current ? " is-current" : ""}">
          <input type="checkbox" class="vrow-check" data-watch="${v.id}" aria-label="Watched: ${escapeHtml(v.title)}"${watched[v.id] ? " checked" : ""}>
          <button type="button" class="vrow-main" data-go="gen:${v.id}"${current ? ' aria-current="true"' : ""}>
            <span class="vrow-title">${i + 1}. ${escapeHtml(v.title)}</span>
            <span class="vrow-meta">${icon("play")}${clock(v.duration)}${v.generated ? '<span class="vrow-tag">Generated</span>' : ""}</span>
          </button>
        </li>`;
    }).join("");
    if (plan === "pro") {
      rows += `<li class="vrow-heading">Topic-wise videos <span class="badge badge-max">Max</span></li>`;
      rows += videos.topics.map((v, i) => `
        <li class="vrow is-locked">
          <span class="vrow-lock" aria-hidden="true">${icon("lock")}</span>
          <button type="button" class="vrow-main" data-upgrade="Topic-wise videos">
            <span class="vrow-title">${i + 2}. ${escapeHtml(v.title)}</span>
            <span class="vrow-meta"><span class="badge badge-max">Max</span>${clock(v.duration)}<span class="visually-hidden">. Locked: part of Max</span></span>
          </button>
        </li>`).join("");
    }
    if (state.generating) {
      const g = state.generating;
      rows += `
        <li class="vrow is-generating" aria-live="polite">
          <span class="vrow-spinner" aria-hidden="true"></span>
          <div class="vrow-gen">
            <span class="vrow-title">Generating: ${escapeHtml(g.query)}</span>
            <ol class="gen-steps">
              ${GEN_STEPS.map((s, i) => `<li class="${i < g.step ? "is-done" : i === g.step ? "is-active" : ""}">${i < g.step ? icon("check") : '<span class="gen-dot"></span>'}${s}${i === g.step ? "…" : ""}</li>`).join("")}
            </ol>
          </div>
        </li>`;
    }
    return rows;
  }

  function ytRowsHtml() {
    const list = relatedYoutube(state.context);
    if (!list.length) return '<li class="muted vp-empty">No YouTube videos for this set yet.</li>';
    return list.map((v) => {
      const current = state.current.kind === "yt" && state.current.id === v.id;
      return `
        <li><button type="button" class="yt-row${current ? " is-current" : ""}" data-go="yt:${v.id}"${current ? ' aria-current="true"' : ""}>
          <span class="yt-thumb"><img src="${thumb(v.id)}" alt="" loading="lazy" width="320" height="180" data-thumb><span class="yt-duration">${clock(v.duration)}</span></span>
          <span class="yt-text"><span class="yt-title">${escapeHtml(v.title)}</span><span class="yt-channel">${escapeHtml(v.channel)}</span></span>
        </button></li>`;
    }).join("");
  }

  function panelHtml() {
    const ctx = state.context ? topicName(set, state.context) : "the whole set";
    const tab = (id, label) => `<button type="button" role="tab" id="ptab-${id}" aria-controls="ppanel-${id}" aria-selected="${state.panelTab === id}" tabindex="${state.panelTab === id ? 0 : -1}" data-panel-tab="${id}">${label}</button>`;
    return `
      <div class="vp-panel-head">
        <h2 class="vp-panel-title">Course content</h2>
        <button type="button" class="icon-btn" data-panel-close aria-label="Hide course content">${icon("close")}</button>
      </div>
      ${plan === "max" ? `
        <form class="vp-search" data-gen-form role="search">
          <label class="visually-hidden" for="vp-search">Search a topic to generate a video</label>
          <span class="vp-search-icon" aria-hidden="true">${icon("search")}</span>
          <input class="input" id="vp-search" type="search" placeholder="Search a topic to generate a video" autocomplete="off"${state.generating ? " disabled" : ""}>
          <button type="submit" class="btn btn-primary btn-sm vp-search-go" aria-label="Generate video" title="Generate video"${state.generating ? " disabled" : ""}>${icon("sparkle")}</button>
        </form>` : ""}
      <div class="vp-panel-tabs" role="tablist" aria-label="Video lists">
        ${tab("generated", "Generated videos")}${tab("youtube", "YouTube")}
      </div>
      <div class="vp-panel-body" role="tabpanel" id="ppanel-${state.panelTab}" aria-labelledby="ptab-${state.panelTab}">
        ${state.panelTab === "generated"
          ? `<ol class="vrow-list" data-gen-list>${genRowsHtml()}</ol>`
          : `<p class="vp-related">Related to <strong>${escapeHtml(ctx)}</strong></p><ul class="yt-list">${ytRowsHtml()}</ul>`}
      </div>`;
  }

  function renderPanel() {
    const aside = main.querySelector("[data-panel]");
    if (!aside) return;
    const focusedId = document.activeElement && aside.contains(document.activeElement) ? document.activeElement.id : null;
    aside.innerHTML = panelHtml();
    if (focusedId) {
      const again = aside.querySelector(`#${focusedId}`);
      if (again) again.focus();
    }
  }

  // Updates the rows only (keeps the search box and its focus).
  function renderPanelList() {
    const list = main.querySelector("[data-gen-list]");
    if (list) list.innerHTML = genRowsHtml();
    else renderPanel();
  }

  // ---------------------------------------------------------------------------
  // Max: generate a video from a topic search
  // ---------------------------------------------------------------------------

  const stem = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(ies|es|s)$/, "");

  // An existing video for the query: a topic whose name contains every word
  // (thread → Multithreading, exceptions → Exception Handling), or one the
  // student generated before.
  function existingVideoFor(query) {
    const words = query.split(/\s+/).map(stem).filter((w) => w.length >= 3);
    if (!words.length) return null;
    const matches = (text) => {
      const hay = text.toLowerCase().replace(/[^a-z0-9]/g, "");
      return words.every((w) => hay.includes(w));
    };
    const topic = set.topics.find((t) => matches(t.name));
    if (topic) return videos.topics.find((v) => v.topicId === topic.id) || null;
    return videoState().generated.find((v) => matches(v.query)) || null;
  }

  function generate(query) {
    const q = query.trim();
    if (!q || state.generating) return;
    const found = existingVideoFor(q);
    if (found) {
      showToast(`There's already a video for that: ${found.title}`);
      openVideo({ kind: "gen", id: found.id }, true);
      return;
    }
    state.generating = { query: q, step: 0 };
    state.panelTab = "generated";
    renderPanel();
    const list = main.querySelector("[data-gen-list]");
    const row = list && list.querySelector(".is-generating");
    if (row) row.scrollIntoView({ block: "nearest" });
    const advance = () => {
      state.generating.step += 1;
      if (state.generating.step < GEN_STEPS.length) {
        renderPanelList();
        setTimeout(advance, STEP_MS);
        return;
      }
      const made = addGeneratedVideo(set.id, q);
      state.generating = null;
      renderPanel();
      showToast(`Your video is ready: ${made.title}`);
      const btn = main.querySelector(`[data-go="gen:${made.id}"]`);
      if (btn) btn.focus();
    };
    setTimeout(advance, STEP_MS);
  }

  // ---------------------------------------------------------------------------
  // Layout + switching videos
  // ---------------------------------------------------------------------------

  function titleHtml(v) {
    const meta = state.current.kind === "yt"
      ? `${escapeHtml(v.channel)} · YouTube · ${clock(v.duration)}`
      : `${v.topicId ? escapeHtml(topicName(set, v.topicId)) : v.generated ? "Generated from your search" : "All topics"} · ${clock(v.duration)} · AI explainer`;
    return `
      <div class="vp-titles">
        <h2 class="vp-title" id="vp-title">${escapeHtml(v.title)}</h2>
        <p class="vp-meta">${meta}</p>
      </div>
      <button type="button" class="btn btn-secondary btn-sm vp-show-panel" data-panel-open${state.panelOpen ? " hidden" : ""} aria-controls="vp-panel">${icon("panel")}Course content</button>`;
  }

  function layoutHtml() {
    const v = currentVideo();
    return `
      <div class="vp-wrap"><div class="vp-layout${state.panelOpen ? "" : " is-panel-closed"}">
        <section class="vp-main" aria-labelledby="vp-title">
          <div class="vp-head" data-title>${titleHtml(v)}</div>
          <div data-player-slot>${playerHtml()}</div>
          <div class="vp-tabs" role="tablist" aria-label="About this video">
            ${PLAYER_TABS.map((t) => `<button type="button" role="tab" id="vtab-${t.id}" aria-controls="vp-tabpanel" aria-selected="${state.playerTab === t.id}" tabindex="${state.playerTab === t.id ? 0 : -1}" data-player-tab="${t.id}">${t.label}</button>`).join("")}
          </div>
          <div class="vp-tabpanel" id="vp-tabpanel" role="tabpanel" aria-labelledby="vtab-${state.playerTab}" data-player-panel>${playerTabHtml(v)}</div>
        </section>
        <aside class="vp-panel card" id="vp-panel" data-panel aria-label="Course content"${state.panelOpen ? "" : " hidden"}>${panelHtml()}</aside>
      </div></div>`;
  }

  function openVideo(next, autoplay) {
    if (video) video.pause();
    state.current = next;
    state.noteDraft = null;
    if (next.kind === "gen") state.context = findGen(next.id).topicId;
    const url = new URL(location.href);
    url.searchParams.delete(next.kind === "yt" ? "video" : "yt");
    url.searchParams.set(next.kind === "yt" ? "yt" : "video", next.id);
    history.replaceState(null, "", url);

    const v = currentVideo();
    main.querySelector("[data-title]").innerHTML = titleHtml(v);
    main.querySelector("[data-player-slot]").innerHTML = playerHtml();
    video = null;
    lastCaption = -2;
    bindVideo();
    renderPlayerTab();
    renderPanel();
    if (autoplay && video) video.play().catch(() => {});
  }

  function setPanelOpen(open) {
    state.panelOpen = open;
    writePref(PREFS.panel, open);
    main.querySelector(".vp-layout").classList.toggle("is-panel-closed", !open);
    main.querySelector("[data-panel]").hidden = !open;
    const show = main.querySelector("[data-panel-open]");
    show.hidden = open;
    (open ? main.querySelector("[data-panel-close]") : show).focus();
  }

  function startVideo() {
    const want = params.get("yt") && findYt(params.get("yt"))
      ? { kind: "yt", id: params.get("yt") }
      : params.get("video") && genList().some((v) => v.id === params.get("video"))
        ? { kind: "gen", id: params.get("video") }
        : null;
    if (want) return want;
    if (startTopic && plan === "max") {
      const topicVideo = videos.topics.find((v) => v.topicId === startTopic.id);
      if (topicVideo) return { kind: "gen", id: topicVideo.id };
    }
    return { kind: "gen", id: genList()[0].id };
  }

  function render() {
    if (!set) {
      main.innerHTML = setNotFoundHtml();
      return;
    }
    document.title = `Videos · ${set.name} · SkipXam`;
    main.classList.add("videos-page");
    if (plan === "free") {
      main.innerHTML = `${toolHeaderHtml(set, "Videos")}<div class="vf-body">${freeHtml()}</div>`;
      return;
    }
    state.current = startVideo();
    if (state.current.kind === "gen") state.context = findGen(state.current.id).topicId;
    else state.context = startTopic ? startTopic.id : findYt(state.current.id).topicId;
    if (state.current.kind === "yt") state.panelTab = "youtube";
    main.innerHTML = `${toolHeaderHtml(set, "Videos")}${layoutHtml()}`;
    bindVideo();
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  main.addEventListener("click", (event) => {
    const t = event.target;
    const chip = t.closest("[data-free-topic]");
    if (chip) {
      state.freeTopic = chip.dataset.freeTopic;
      main.querySelector(".vf-body").innerHTML = freeHtml();
      main.querySelector(`[data-free-topic="${state.freeTopic}"]`).focus();
      return;
    }
    const upgrade = t.closest("[data-upgrade]");
    if (upgrade) return openUpgrade(upgrade.dataset.upgrade);
    const go = t.closest("[data-go]");
    if (go) {
      const [kind, ...rest] = go.dataset.go.split(":");
      return openVideo({ kind, id: rest.join(":") }, true);
    }
    const act = t.closest("[data-act]");
    if (act) {
      const a = act.dataset.act;
      if (a === "toggle") togglePlay();
      else if (a === "back") seekTo(video.currentTime - 10);
      else if (a === "fwd") seekTo(video.currentTime + 10);
      else if (a === "replay") seekTo(0, true);
      else if (a === "cc") toggleCaptions();
      else if (a === "fs") toggleFullscreen();
      else if (a === "mute") {
        if (video.muted || video.volume === 0) {
          video.muted = false;
          if (video.volume === 0) video.volume = state.volume = 0.6;
        } else {
          video.muted = true;
        }
        state.muted = video.muted;
        syncVolume();
      }
      return;
    }
    // A click on the picture itself plays or pauses.
    if (t.matches("[data-video]") || (t.matches("[data-player]") && video)) {
      playerEl().focus({ preventScroll: true }); // so the keyboard shortcuts work next
      return togglePlay();
    }
    const seekBtn = t.closest("[data-seek-to]");
    if (seekBtn) return seekTo(Number(seekBtn.dataset.seekTo), true);
    const ptab = t.closest("[data-player-tab]");
    if (ptab) {
      state.playerTab = ptab.dataset.playerTab;
      return renderPlayerTab();
    }
    const panelTab = t.closest("[data-panel-tab]");
    if (panelTab) {
      state.panelTab = panelTab.dataset.panelTab;
      renderPanel();
      main.querySelector(`#ptab-${state.panelTab}`).focus();
      return;
    }
    if (t.closest("[data-panel-close]")) return setPanelOpen(false);
    if (t.closest("[data-panel-open]")) return setPanelOpen(true);
    if (t.closest("[data-add-note]")) {
      if (video && !video.paused) video.pause();
      state.noteDraft = { t: state.current.kind === "yt" || !video ? null : Math.min(video.currentTime, duration()) };
      renderPlayerTab();
      main.querySelector("#vn-text").focus();
      return;
    }
    if (t.closest("[data-note-cancel]")) {
      state.noteDraft = null;
      renderPlayerTab();
      main.querySelector("[data-add-note]").focus();
      return;
    }
    const del = t.closest("[data-note-delete]");
    if (del) {
      deleteVideoNote(set.id, currentVideo().id, del.dataset.noteDelete);
      renderPlayerTab();
      showToast("Note deleted");
      const add = main.querySelector("[data-add-note]");
      if (add) add.focus();
    }
  });

  main.addEventListener("submit", (event) => {
    if (event.target.matches("[data-note-form]")) {
      event.preventDefault();
      const text = main.querySelector("#vn-text").value.trim();
      if (!text) return;
      addVideoNote(set.id, currentVideo().id, state.noteDraft.t, text);
      state.noteDraft = null;
      renderPlayerTab();
      showToast("Note saved");
      main.querySelector("[data-add-note]").focus();
    } else if (event.target.matches("[data-gen-form]")) {
      event.preventDefault();
      const input = event.target.querySelector("input");
      const q = input.value;
      input.value = "";
      generate(q);
    }
  });

  main.addEventListener("input", (event) => {
    const t = event.target;
    if (t.matches("[data-seek]")) {
      seekTo(Number(t.value));
    } else if (t.matches("[data-volume]")) {
      video.volume = Number(t.value);
      video.muted = Number(t.value) === 0;
      state.volume = video.volume;
      state.muted = video.muted;
      writePref(PREFS.volume, state.volume);
      syncVolume();
    }
  });

  main.addEventListener("change", (event) => {
    const t = event.target;
    if (t.matches("[data-speed]")) {
      state.speed = Number(t.value);
      if (video) video.playbackRate = state.speed;
      writePref(PREFS.speed, state.speed);
    } else if (t.matches("[data-watch]")) {
      setVideoWatched(set.id, t.dataset.watch, t.checked);
    }
  });

  main.addEventListener("keydown", (event) => {
    const t = event.target;
    // Arrow keys between tabs.
    const tab = t.closest("[role='tab']");
    if (tab && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
      const tabs = [...tab.parentElement.querySelectorAll("[role='tab']")];
      const next = tabs[(tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      next.click();
      const again = main.querySelector(`#${next.id}`);
      if (again) again.focus();
      return;
    }
    // Player shortcuts (not while typing or on a slider / select).
    const player = t.closest("[data-player]");
    if (!player || !video || t.matches("input, select, textarea")) return;
    const key = event.key.toLowerCase();
    if ((key === " " && !t.matches("button")) || key === "k") {
      event.preventDefault();
      togglePlay();
    } else if (event.key === "ArrowLeft" || key === "j") {
      event.preventDefault();
      seekTo(video.currentTime - 10);
    } else if (event.key === "ArrowRight" || key === "l") {
      event.preventDefault();
      seekTo(video.currentTime + 10);
    } else if (key === "c") {
      toggleCaptions();
    } else if (key === "m") {
      main.querySelector('[data-act="mute"]').click();
    } else if (key === "f") {
      toggleFullscreen();
    }
  });

  main.addEventListener("pointermove", (event) => {
    if (event.target.closest("[data-player]") && video && !video.paused) wakeControls();
  });
  main.addEventListener("focusin", (event) => {
    if (event.target.closest("[data-player]")) wakeControls();
  });

  // Thumbnails that fail to load leave a plain tile instead of a broken image.
  main.addEventListener("error", (event) => {
    if (event.target.matches && event.target.matches("[data-thumb]")) event.target.classList.add("is-broken");
  }, true);

  render();
})();
