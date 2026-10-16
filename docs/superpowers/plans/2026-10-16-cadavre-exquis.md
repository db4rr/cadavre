# Cadavre Exquis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One static `index.html` for live multiplayer cadavre exquis, hostable on GitHub Pages.

**Architecture:** Pure state/assembly functions live between `// <core>` and `// </core>` markers inside the inline script so a node test can extract and eval them without a build step. A thin transport layer wraps Trystero (CDN ES module) and a BroadcastChannel shim with the same interface (`?local` in the hash query) so multi-tab play and manual testing work offline. UI is a single-screen state machine: lobby → play → wait → reveal.

**Tech Stack:** Vanilla HTML/CSS/JS, Trystero (`https://esm.run/trystero` or pinned jsdelivr URL, Nostr strategy), `node:test` for core tests.

**Spec:** `docs/superpowers/specs/2026-10-16-cadavre-exquis-design.md`

## Global Constraints

- Everything in a single `index.html` (inline CSS/JS); only external dependency is Trystero from a CDN.
- Questions, in this order and wording: Who? / Where? / When? / With whom? / What were they doing? / Why? / What did they say? / What happened next? / How did it end?
- Story for roster index `p`: line `k` (0-based) = answer to question `k` by `roster[(p+k) % N]`; missing answers render as `…`.
- Room id = URL hash; random if empty. Player id + answers persisted in `localStorage` keyed by room.
- No names, accounts, chat.

## Review Focus

- Two players click Start simultaneously with different rosters: all peers must converge on the same roster (deterministic rule: smallest `roster.join(',')` wins).
- Duplicate/replayed `answer` messages (rejoin resend) must not change state or double-count.
- N=1 and N=2 (heavy wraparound) assemble all 9 lines correctly.
- Empty/whitespace-only answer is rejected (submit disabled); answers containing `<script>`/HTML render as plain text in the reveal.
- A player opening the link after Start who is not in the roster sees "game already started" instead of a broken UI.

---

### Task 1: Core logic with tests

**Files:**
- Create: `index.html` (skeleton with `<script type="module">` containing the `// <core>` block)
- Create: `test/core.test.mjs`

**Interfaces:**
- Produces (all inside `// <core>`…`// </core>`, plain functions, no DOM/network):
  - `QUESTIONS: string[]` (9 entries per Global Constraints)
  - `assemble(roster: string[], answers: Record<string, string[]>, p: number): string[]` — 9 lines for story `p`, `…` when missing
  - `mergeAnswer(answers, playerId: string, q: number, text: string): answers` — idempotent, returns new object
  - `mergeRoster(current: string[]|null, incoming: string[]): string[]` — smallest `join(',')` wins
  - `nextQuestion(answers, playerId): number` — index of first unanswered, 9 when done
  - `allDone(roster, answers): boolean`

- [ ] **Step 1: Write failing tests** in `test/core.test.mjs`. It reads `index.html`, extracts the text between `// <core>` and `// </core>`, evals via `new Function(code + '; return {QUESTIONS, assemble, mergeAnswer, mergeRoster, nextQuestion, allDone}')()`. Tests:
  - `assemble` with roster `[a,b,c]`, each player's answers `"<id>0".."<id>8"`: story 0 line 0 = `a0`, line 1 = `b1`, line 2 = `c2`, line 3 = `a3`; story 1 line 0 = `b0`.
  - `assemble` N=1 returns the player's own 9 answers; N=2 alternates.
  - `assemble` missing answers give `…`.
  - `mergeAnswer` applied twice with same args deep-equals applied once; does not mutate input.
  - `mergeRoster(null, [b,a])` returns `[b,a]`; `mergeRoster([a,b],[a,c])` returns `[a,b]`; `mergeRoster([a,c],[a,b])` returns `[a,b]`.
  - `nextQuestion` is 0 for empty, 3 after answers 0–2, 9 when all answered.
  - `allDone` false if any roster member has <9 answers, true otherwise.
- [ ] **Step 2: Run** `node --test test/` — Expected: FAIL (no markers / functions).
- [ ] **Step 3: Implement** the core block and the minimal `index.html` skeleton containing it.
- [ ] **Step 4: Run** `node --test test/` — Expected: all PASS.
- [ ] **Step 5: Commit** `feat: core assembly/merge logic with tests`.

### Task 2: Transport (Trystero + local shim)

**Files:** Modify `index.html`.

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `async function connect(roomId: string, local: boolean): Promise<{ send(type: string, data: any): void, onMessage(fn: (type, data, peerId) => void): void, onPeerJoin(fn: (peerId) => void): void }>`.
  - Non-local: `import { joinRoom } from CDN` and `joinRoom({appId: 'cadavre-exquis-dbarr'}, roomId)`; one Trystero action `makeAction('msg')` carrying `{type, data}`; broadcast to all peers.
  - Local (`#room?local`): `BroadcastChannel('cadavre-'+roomId)`, same shape; `onPeerJoin` fires when a `hello` ping from another tab arrives (each tab pings on load and replies once to unknown pings).

- [ ] **Step 1:** Implement `connect` with both branches; pin the Trystero import to a versioned CDN URL.
- [ ] **Step 2: Verify** by loading two tabs with `index.html#test?local` via a static server (`python3 -m http.server`) and a temporary console log: each tab logs the other's join and a `send('ping', 1)` arrives. Remove temporary logging.
- [ ] **Step 3: Commit** `feat: transport with Trystero and local BroadcastChannel shim`.

### Task 3: Game UI and protocol

**Files:** Modify `index.html`.

**Interfaces:**
- Consumes: all Task 1 core functions; `connect` from Task 2.
- Protocol messages via `send(type, data)`: `hello` `{playerId}` (on connect and on peer join; receivers reply with `roster` if started and own `answer` for every answered question), `roster` `{roster}`, `answer` `{playerId, q, text}`.
- State: `{playerId, roomId, peers: Set, roster: string[]|null, answers}`; persisted to `localStorage['cadavre:'+roomId]` after every change.

- [ ] **Step 1: Lobby.** Empty hash → set `location.hash` to random 6-char code. Show room link (click to copy), "N players here" (self + distinct playerIds seen via `hello`), **Start** button. Start: `roster = sorted known playerIds`, `send('roster')`, apply locally via `mergeRoster`.
- [ ] **Step 2: Play.** On roster: if own id not in it → "Game already started" screen. Else show header (dimmed after first submit per spec) + current question + text input + Submit (disabled while trimmed value is empty; Enter submits). Submit → `mergeAnswer`, `send('answer')`, clear input, advance to `nextQuestion`. Reload resumes at `nextQuestion`.
- [ ] **Step 3: Wait/Reveal.** After question 9 show "waiting for N others…" with a "reveal anyway" button; when `allDone` (or button) show the story from `assemble(roster, answers, roster.indexOf(playerId))` joined as one paragraph, inserted via `textContent` only.
- [ ] **Step 4: Style.** Minimal: centered column, large serif question, dimmed (`opacity:.35`) header, no frameworks.
- [ ] **Step 5: Verify manually** with 3 tabs on `#room?local`: all three play through; each reveal starts with that tab's own first answer and line 2 comes from the next roster member; reload mid-game resumes; a 4th tab opened after Start shows "Game already started"; submitting `<b>x</b>` renders literally.
- [ ] **Step 6: Re-run** `node --test test/` — Expected: PASS. Commit `feat: lobby, play, wait and reveal UI`.

### Task 4: Publish notes

**Files:** Create `README.md`.

- [ ] **Step 1:** README with what it is, how to play (open link, share it, Start), and GitHub Pages steps (Settings → Pages → deploy from `main` root). Note the third-party relay/CDN dependency and WebRTC-blocking networks.
- [ ] **Step 2: Commit** `docs: README`. (Pushing and enabling Pages is left to the user.)
