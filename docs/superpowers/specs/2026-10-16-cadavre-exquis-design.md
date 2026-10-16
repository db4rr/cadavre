# Cadavre exquis — design

## Goal
Minimal multiplayer cadavre exquis for friends playing at the same time. One static `index.html`, hosted on GitHub Pages, no server of our own.

## Questions (fixed order)
1. Who? 2. Where? 3. When? 4. With whom? 5. What were they doing? 6. Why? 7. What did they say? 8. What happened next? 9. How did it end?

## Key insight
Nobody sees others' answers while playing, so players answer all 9 questions at their own pace. Paper-passing is only simulated at assembly time.

## Flow
1. **Lobby**: first visitor gets a room link `…/#<code>` (random code generated if hash empty). Others open same link. Shows player count and a **Start** button (any player). Start broadcasts the frozen roster (ordered list of player IDs); that order defines rotation.
2. **Playing**: one question + one text input. Submit clears input, dims the header, shows next question. Each submitted answer is broadcast to all peers and stored locally.
3. **Waiting**: after Q9, "waiting for N others…". A "reveal anyway" button is available.
4. **Reveal**: player at roster index `p` reads story `S_p` = for k in 1..9, the answer to question k by roster[(p+k-1) mod N]. Missing answers render as "…". With N<9 players, rotation wraps (a player supplies several lines of one story). N=1 works (all own answers).

## Networking
- WebRTC mesh via Trystero (ES module from CDN, public relay signaling). Room id = URL hash.
- Messages: `roster` (start), `answer` (player id, question index, text), `hello` (on peer join: sender replies with roster if started and all its own answers so far).
- Player identity: random ID in `localStorage`; answers also persisted in `localStorage` keyed by room. Reload/rejoin keeps slot and resumes at first unanswered question.
- Roster/answer state is merged idempotently (last write per (player, question) wins; first roster received wins).

## Structure
Single `index.html` with inline CSS/JS. Pure function `assemble(roster, answers, p)` kept separate in the script (and tested via a small node script) so assembly logic is verifiable without networking.

## Out of scope
Names, accounts, chat, anti-cheat/privacy of answers in devtools, i18n.

## Risks
Third-party relay/CDN availability; networks blocking WebRTC. Multi-device networking verified only by manual trial.
