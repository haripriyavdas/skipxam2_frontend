# SkipXam 2.0 frontend: project notes

## 1. Overview

SkipXam is an AI study platform for Indian students. A student creates a **study set** (for example "Java"), uploads notes, and gets study tools generated from them: notes, flashcards, quizzes, practice tests, visual memory aids, a study plan, a tutor and lecture recording.

This repo is a **frontend-only prototype with mock data**. There is no backend or real AI.

- **Stack:** plain HTML, CSS and JavaScript. No frameworks, no libraries, no build step.
- **Font:** Plus Jakarta Sans, loaded from Google Fonts in `tokens.css`.
- **Scripts:** plain global scripts, not ES modules, so every page works when opened straight from disk (`file://`).
- **Storage:** data persists in `localStorage` under the key `skipxam.data.v7`.
- **Repo:** https://github.com/haripriyavdas/skipxam2_frontend (branch `main`).
- **Mock user:** "Samrat", a BMSCE student on the free plan.

## 2. File structure

```
index.html, style.css, script.js   Landing page (navbar, hero, footer); "Open app" links to app/dashboard.html
css/tokens.css     Design tokens (colours, spacing, type, radii, shadows, glass, gradients, orbs) + light theme
css/app.css        Shared styles: base, buttons, cards, inputs, modals/sheets, app shell, menu-select,
                   effects (.glass, .dot-grid, .orb, .gradient-border), pricing modal, toast, dev toggle
css/<page>.css     One stylesheet per page
js/data.js         Mock data + every data helper (sets, topics, plan, flashcards, activity log, profile,
                   settings, streaks, badges). Seeding, v7 migration, applyTheme()
js/app.js          Shared UI: icons, helpers, openModal/confirmDialog, toasts, openUpgrade (pricing modal),
                   proGate, openCreateSet, app shell (sidebar, top bar, tab bar, drawer), menuSelect,
                   search/share/materials sheets, study timer, dev plan toggle
js/<page>.js       Page logic (one per page)
js/college-picker.js   Searchable college picker (profile edit modal)
js/tutor-chat.js   Tutor chat component (tutor page + side tutor panel): mock replies, models, voice typing,
                   read aloud, voice call. css/tutor-chat.css holds its styles.
js/badges.js       Badge definitions, SVG emblems, badge detail card
js/notes-content.js  Seed document for the notes editor: Java notes HTML, auto stickies, source-star quotes
assets/sample.pdf  Mock Java lecture notes (7 pages) that the notes' source stars point into
assets/sample-pdf-source.html  HTML the PDF is printed from (rebuild steps are in its header comment)
assets/sample-pdf.js  Generated base64 copy of the PDF for file:// use. Regenerate: python assets/make-sample-pdf-js.py
data/colleges.json Source list: 226 colleges {name, short, city, state, type, university}
data/colleges.js   Generated copy for file:// use. Regenerate: python data/make-colleges-js.py
app/*.html         Pages: dashboard, sets, set, notes, flashcards, quiz, practice-test, visual-memory,
                   record, plan, calendar, tutor, profile, style-test (effects review page)
```

**Page template.** Every app page loads `tokens.css`, `app.css` and its page CSS, then `data.js`, `app.js` and its page JS. Profile also loads `college-picker.js` and `badges.js` before `profile.js`.

## 3. Features built

### App shell (`app.js`)

- **Sidebar:**
  - Logo, search and a collapse toggle (the collapsed state is remembered).
  - Global links: Home, My Sets, Calendar.
  - Set section, shown only inside a set:
    - a set switcher that keeps you on the same tool for the new set
    - Study Plan, Tutor and Record Lecture links
    - a collapsible Practice & Activities group: Notes, Flashcards, Quizzes, Practice Tests, Visual Memory
    - Upload, and a Materials list
  - Lock icons mark Pro tools for free users.
- **Top bar (glass):** breadcrumb, Upgrade pill (free users only), Share (mock), study timer (+1 minute per visible minute) and an avatar linking to Profile.
- **Mobile:** under 900px the sidebar becomes a drawer (the page behind is inert; Escape closes it) and a bottom tab bar appears with Home, Sets, +, Calendar and Profile.

### Home (`dashboard`)

- **Main column:** a bento grid using container queries: 4 columns at 640px+, 2 at 420px+, otherwise 1.
- **Tiles:**
  - Today's goals: 2×2, with confetti when all are done.
  - Greeting: mascot plus "Continue learning".
  - Streak and Next exam: 1×1 each, with a big number.
  - Study sets: horizontal scroll.
  - Weak spots.
  - Upgrade: free users only, with a gradient border.
  - Recent materials and Recent activities: full width, each with a filter.
- **Right column:** Upcoming, with Today and Exams tabs.
- **Background:** dot grid, plus two orbs (top-left and bottom-right).

### My Sets (`sets`)

- **Toolbar:** search, sort (Last accessed, Exam date, Name), Materials, Create folder and Create.
- **Folder chips** appear only when folders exist.
- **Grid:** starts with a dashed create card.
- **Set cards:** progress, chips, last studied, current topic, and a ⋮ menu with rename, move and delete (custom confirm).
- **Free limit:** 3 sets; past that, the pricing modal opens.

### Set page (`set`)

- **Upload:** an upload screen, then a processing step.
- **Set home:**
  - header with settings and duplicate
  - stats bar
  - numbered topic tabs in plan order (`?topic=`)
  - current topic card with Skip
  - activity cards (3, then 3 more behind "Show more")
- **Tutor button:** a floating glass "Ask Tutor" button. It opens the side tutor panel (`openTutorPanel`): a slide-in chat on the right (full screen on mobile) with a topic picker, Call, "open full page" and close. Free users get the pricing modal. Escape closes it.

### Study tools

- **Notes (read-and-edit):**
  - Document from `NOTES_SEED[setId]` (Java: 2,100+ words from the PDF) or, for other sets, built from their smart notes. Saved per set in `localStorage` under `skipxam.notes.v1` (`{ html, stickies, savedAt }`); `resetData()` clears it.
  - Contents on the left (container width 1040px+; otherwise a "Jump to section" select). Sub-headings show only for the current section.
  - Read/Edit toggle (remembered in `skipxam.notesMode`). Edit mode: contenteditable + `document.execCommand`, so undo/redo are the browser's. Toolbar: undo, redo, H1–H3, bold, italic, underline, strikethrough, highlight and text colour menus, four alignments, bullet/numbered/checklist, quote, code block, table, link (modal), image (shrunk to 1000px JPEG data URL). Shortcuts are listed in the keyboard sheet on the toolbar. Mini-toolbar on text selection; "Add sticky note" works in both modes.
  - Autosave 0.7s after a change, with a Saved / Saving… / "storage is full" indicator. Ctrl+S saves now.
  - Source stars (`button.source-star[data-source]`) open a side panel (bottom sheet on mobile): PDF.js renders the page and highlights the quoted passage (matched ignoring spacing and case). PDF.js loads from cdnjs on first use via `loadPdfJs()` in `app.js`; offline, the panel says so and still shows the quote.
  - Stickies: auto ones (Exam tip, Common mistake, Remember, Formula) and the user's own ("My note", type changeable). Each points at a `span.sticky-anchor`; in the right margin they line up with it and push each other down, can be dragged (or moved with arrow keys on the grip), collapsed, edited and deleted. Under 860px layout width they show inline after the paragraph.
- **Flashcards:** spaced repetition. "Got it" doubles the interval; "Again" resets it. Study view is centred: card, then Show answer / Again · Got it, then ‹ counter › arrows, session progress, and the Study/Browse + topic toolbar. Keys: Space flips, ← → move between cards, 1 Again, 2 Got it.
- **Quiz:** `?topic=` starts a topic quiz; `?unit=` runs a 5-question knowledge check. Results update topic mastery. The card is centred; below it "Your quiz history" (attempts, best, average, then rows with date, topics, score, time, Review and Retake). Every finished quiz, and every study plan lesson quiz, is saved with `saveQuizAttempt()` to `set.quizHistory` (newest first, 100 kept). Review opens each question with your answer, the correct one and the explanation.
- **Practice test:** Pro. Setup: choose a source (upload a reference paper as PDF/image, a saved pattern, or the standard 25-mark format) → for uploads an "Analysing the paper pattern" screen (mock: ~4s of steps, then a fixed 50-mark pattern) with a thumbnail of page 1 → pattern editor (name, total marks, duration, sections table: questions, marks each, question type, choice rule "Answer any N of M"; warnings when marks don't add up or the set lacks questions; "Save this pattern"; paper thumbnail beside the table) → "Generate test" → exam mode. In a section with a choice rule, the best N answers count. Saved patterns live in `user.testPatterns` (`getTestPatterns`, `saveTestPattern`, `deleteTestPattern`); one example is seeded. Exam mode, palette, confirm before submit and key-point marking are unchanged.
- **Visual memory:** Pro. Mnemonics and diagrams.
- **Record lecture:** Pro. Two columns (stacked under 760px of page width).
  - Left: lecture title, record button, timer, a scrolling waveform from the microphone (Web Audio `AnalyserNode`, RMS per frame), Pause / Resume / Stop. `MediaRecorder` keeps the audio; after Stop you can listen back, and transcript timestamps jump the player.
  - Right: live transcript (Web Speech API, `en-IN`, continuous, restarted after silences), each line stamped `[mm:ss]` from when the phrase started, interim words in italics, auto-scroll that pauses when you scroll up ("Jump to latest").
  - After Stop: "Generate notes from this lecture?" → Transcript / Notes tabs. Notes are drafted from the transcript (mock AI): summary, key points, key terms, "Remember" from the matched topic, an outline with timestamps. "Save to study set" saves the recording, transcript and notes in one go (`saveLecture` in `data.js`), with the audio in IndexedDB (`skipxam-audio` / `recordings`, keyed by recording id). The set's materials get the audio file, or a transcript file if there's no audio.
  - Past recordings for the set below, each with notes, transcript and, if saved on this device, the audio.
  - No microphone (or pages opened from disk, where browsers block it) → a labelled demo: simulated waveform and a transcript read from the set's notes. No speech recognition → real audio plus the demo transcript.
- **Tutor:** Pro. Topic picker and mastery meter beside the shared chat (`createTutorChat` in `tutor-chat.js`), which the side panel also uses.
  - Model picker beside the input (opens upward): Fast (short, ~0.3s), Smart (default), Deep ("Thinking it through…", ~2s, adds an exam angle). Remembered in `skipxam.tutorModel`; each reply shows its model.
  - Mic in the input: Web Speech API, `en-IN`, continuous with interim results, written into the box live. Unsupported browsers or a blocked mic get a toast.
  - Read aloud on each reply: `speechSynthesis` (prefers an en-IN voice), play/pause (pause remembers the word reached), speed 0.75–2× (remembered in `skipxam.tutorRate`; changing it restarts from the current word), stop. If audio fails, a toast says so.
  - Call: full-screen dialog with the mascot inside a pulsing radial orb (breathes while listening, pulses per spoken word), word-by-word captions of the tutor and live captions of what you say, a call timer, and Mute / Switch to chat / End call. It takes turns: speak, then listen. You can answer quiz questions by saying a letter ("option B") or the option. Everything said is added to the chat, with "Voice call started" / "Call ended · m:ss" notes. Without speech recognition (or with the mic blocked) a "Type instead" box appears; without audio the captions still advance at speaking pace.
- **Calendar:** month and week views, a mock Google Calendar connection, reminders.

### Study plan (`plan`)

- **Header:** a "How it works" link that can be dismissed.
- **Customize bar:**
  - Mode: Cram 40%, Standard 70%, Comprehensive 100% of topics. The weakest topics have priority.
  - Sort: Recommended, Exam order, Weakest first. Orders the unfinished lessons within each unit; done ones always come first.
  - Status filter (dims the nodes that don't match, so the path stays intact) and settings (exam date, rebuild).
- **Learning path (Duolingo-style):** units with a coloured banner (set colour), round topic nodes on a zig-zag, joined by a curved SVG line drawn from the measured node positions (redrawn on resize; amber up to the current node), a checkpoint node (trophy) at the end of each unit, then Exam day.
  - Node states: done, current (pulsing ring and a "Start" bubble), available, locked. A node unlocks when the one before it is done; a checkpoint unlocks when every lesson in its unit is done, and the next unit needs the checkpoint passed.
  - A topic counts as done when its lesson is finished (`topic.lessonDone`) or it is covered (75%+ mastery). Passed checkpoints are in `set.checkpoints` (`{ unitId: date }`). Helpers: `isLessonDone`, `completeLesson`, `completeCheckpoint` in `data.js`.
  - Clicking a node opens a popover: name, estimated time, and Start lesson / Practice again / Locked.
- **Lesson:** a full-screen dialog with a progress bar: the topic's smart notes → its flashcards (flip, Again / Got it, updates spaced repetition) → a 5-question quiz (topped up from the unit, then the set; keys 1–4 or A–D) → a done screen. Finishing marks the node done, updates mastery and the quiz stats, logs the activity and moves the set's current topic on. Quitting mid-lesson asks first.
- **Checkpoint:** 5 questions on the unit; 3 correct passes. Failing offers Try again.

### Profile (`profile`)

- **Layout:** bento grid, 4 columns at 900px+ container width, 2 at 560px+, otherwise 1.
- **Identity:**
  - Avatar: click to upload. The image is shrunk to 160px and also shows in the top bar.
  - Name and plan badge.
  - "BMSCE, Bengaluru" and "B.E. Mechanical, 2nd year".
  - Edit profile and a gear icon that opens Settings.
- **Edit profile modal:** name; college picker (search by name or city, State menu, type chips, arrow keys and Enter, "Add it" for a custom college); degree level; course (options depend on level); "Your degree is called" toggle for B.E./B.Tech; branch; year (1st–5th).
- **Settings modal:** daily goal slider (15–120 minutes), reminder time, Google Calendar (mock), notifications switch, dark/light theme. Changes save as you make them.
- **Study activity:** 16-week heatmap with current and longest streak and days studied. Hover, or use the arrow keys, to read each day.
- **Your numbers, and Mastery by set** (weakest first, each linking to its set).
- **Badges (2×2):** 12 SVG emblems.
  - Shape by family: hexagon for streaks, shield for quizzes and tests, circle for flashcards, diamond for special.
  - Tier ring: bronze, silver, gold or legend.
  - Locked badges show a progress ring.
  - Clicking opens a glass detail card: a popover on desktop, centred on mobile.
- **Plan and billing:** "Manage plan" opens the pricing modal; "Cancel plan" asks for confirmation first.
- **Study with your friends:** Copy button that changes to "Copied" for 2 seconds, WhatsApp share, and referral stats.
- **Account:** email, change password (mock), download my data (JSON), log out (mock), delete account (type DELETE; this resets to the demo data).

### Shared pieces

- **Pricing modal (`openUpgrade`):** full screen, glass.
  - Monthly/yearly toggle.
  - Tiers: Free ₹0, Pro ₹99/month or ₹999/year (featured), Max ₹249/month or ₹2,499/year. Placeholder prices are in `PLANS` in `app.js`.
  - Choosing a tier switches the mock plan and reloads the page.
- **proGate:** for free users, blurs the gated content and overlays an unlock button.
- **Create-set sheet.**
- **Dev toggle (bottom-left):** switches between Free, Pro and Max for testing.

## 4. Design decisions

- **Colours (keep these):**
  - Dark warm background `#0f0e0d`; surfaces `#181614` and `#221f1c`; border `#2e2a26`.
  - Off-white text `#f0eae0`; muted text `#a39b8f`.
  - Amber accent `#e08a38` (hover `#c27325`, soft rgba 0.14).
  - Text on amber is dark (`#0f0e0d`), because white fails contrast.
  - Success `#5db075`; danger `#e05a4f`.
  - Set colours: Java `#E0673A`, Thermodynamics `#4FA3D9`, DBMS `#A78BFA`.
- **Type and spacing:**
  - Font: Plus Jakarta Sans.
  - Spacing scale 4/8/12/16/24/32/48px; radii 8px (controls) and 16px (cards); tile gaps 16px.
- **Effects** (tokens in `tokens.css`, classes in `app.css`):
  - **Shadows:** three levels (`--shadow-sm`, `--shadow-md`, `--shadow-lg`), each a tight dark layer, a wide soft layer and a faint top highlight. On a dark background shadows need to be darker and larger.
  - **`.glass`:** only for the top bar, tab bar, modals and sheets, dropdowns, the tutor button and the featured pricing card or tier. Bars and modals add a darker tint for readability, and there's a solid fallback without `backdrop-filter`.
  - **Dot grid:** behind `main` on every app page, never inside cards.
  - **Orbs:** amber and ember (`#be123c`), at most 2 per surface: Home, the pricing modal, empty states.
  - **Hard-stop gradients:**
    - `--gradient-amber`, with dark text (7.2:1 and 5.4:1 contrast), for primary buttons, Pro badges, progress bars and the pricing header.
    - `--gradient-ember`, for borders only. No text colour passes on both of its ends.
- **Layout:** desktop-first shell with a 260px sidebar (72px collapsed). Breakpoints at 900px (shell to mobile) and 1100px (Home's right column). The bento grids use container queries because the side column changes the available width.
- **Accessibility:**
  - Global amber `:focus-visible` ring.
  - Reduced motion respected (global CSS rule, plus JS checks for confetti and the orb drift).
  - Modals use `<dialog>`.
  - Dropdowns and comboboxes have ARIA roles and keyboard support.
- **Light theme:** `:root[data-theme="light"]` in `tokens.css`. A first pass.

## 5. User rules and preferences

- Plain HTML, CSS and JS only. No frameworks or build step. Must work from `file://`.
- Keep the SkipXam colours: dark background, off-white text, amber accent.
- Responsive. Check pages at 375px and 1440px, keep keyboard focus visible, respect reduced motion.
- In consistency reviews, "only fix what's inconsistent; don't redesign".
- No emojis in badges; use SVG emblems.
- Tiles stay solid (no glass) so text is readable.
- Prices in ₹.
- Commit and push only when asked.

## 6. Left to do / planned next

- **Positioning changes:** not recorded in these notes. They weren't captured in the session history available when this file was written. Add them here.
- Replace `data/colleges.json` with the full AISHE list (same fields), then run `python data/make-colleges-js.py`.
- Real backend and auth: everything is mock (plans, payments, password, logout, delete, Share, WhatsApp referral stats, Google Calendar, AI output).
- Nothing uses the daily study goal yet.
- Page-specific CSS still has hard-coded dark colours, so the light theme needs a polish pass.
- Decide whether `app/style-test.html` stays in the repo.

## 7. Known issues

- **Data resets on version bumps:** bumping `STORAGE_KEY` re-seeds the demo data. The v7 migration in `data.js` adds new fields without a reset.
- **Mock-data quirks:** the seeded activity times are relative to page load, so some time-based checks vary. College types in `colleges.json` were written from memory; verify them.
- **Clipped shadows:** horizontal scroll rows (Recent materials, the set row) clip card shadows.
- **Two copies of the college list:** `colleges.js` must be regenerated whenever `colleges.json` changes. Only the `file://` fallback uses it.
- **Headless Edge testing quirks:** CSS animations on elements added late can stay stuck at frame 0, and a resize event fires during screenshots. Because of this, the badge card has no open animation and repositions on resize instead of closing.
