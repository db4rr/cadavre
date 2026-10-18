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

## Controls
Start and Submit are slide-to-confirm sliders (90% of travel); Submit is disabled while the answer is blank. Shift+Enter triggers the same action from a keyboard; plain Enter does nothing. The reveal and the lobby link each have a "Copy" button with "Copied ✓" feedback; the reveal (and the "already started" screen) also has "New game".

## Text rules
Answers are cleaned (`\s+` runs, including line breaks, become one space; trimmed; blank answers ignored) both when submitted and when received from peers. The reveal puts each line on its own row with the first letter capitalised (missing lines stay "…"); Copy story copies that exact text. Layout uses `100dvh` and `overscroll-behavior: none` so phones don't show an extra scroll area.

## Rounds
The room code is reused: `hello`/`roster`/`answer` messages carry a `round` number (missing = 0). Pressing New game moves only that player to round+1 with an empty lobby (`nextRound`). Messages from another round are ignored, except that a player in an unstarted lobby adopts a higher round. On receiving a hello from an unknown player, a player replies with its full state so lobbies find each other. Storage per room holds `{round, roster, answers}`; previous rounds are not kept.

## Networking
WebRTC (Trystero) was dropped: phones in iOS Lockdown Mode / on some mobile networks never discovered peers. Messages now travel through free public MQTT brokers over secure WebSockets, with no server of our own.
- Brokers (all connected at once, every message published to all, duplicates dropped by message id): HiveMQ `wss://broker.hivemq.com:8884/mqtt`, Mosquitto `wss://test.mosquitto.org:8081`, EMQX `wss://broker.emqx.io:8084/mqtt`. mqtt.js 5.16.1 loaded from jsDelivr with an SRI hash.
- Topic = `cadavre/` + hash of the room code. Every message is AES-GCM encrypted with a key derived (PBKDF2) from the room code, which only lives in the URL hash, so brokers see ciphertext only.
- Presence is a `ping`/`bye` layer on top (same as the offline `?local` BroadcastChannel transport): join on ping, reply once, rejoin pings re-trigger state resend.
- App messages: `hello`, `roster` (start), `answer`; on peer join each side resends hello, roster and all answers it knows. Roster/answer state is merged idempotently.
- Player identity: random ID in `localStorage` (separated per `window.name` when set); answers persisted per room.
- The lobby shows "Connected to X of Y relays" so connection problems are visible.

## Structure
Single `index.html` with inline CSS/JS. Pure function `assemble(roster, answers, p)` kept separate in the script (and tested via a small node script) so assembly logic is verifiable without networking.

## Out of scope
Names, accounts, chat, anti-cheat/privacy of answers in devtools, i18n.

## Risks
Public brokers are best-effort (no SLA, may rate-limit); networks blocking the broker ports; Lockdown Mode behaviour untested on a real device. Multi-device networking verified only by manual trial.
