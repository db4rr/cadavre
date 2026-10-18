# Cadavre exquis

A tiny multiplayer cadavre exquis for friends playing at the same time. One static `index.html`, no server of your own.

## Play

1. Open the page. You get a room link (`…/#abc123`); copy it with the **Copy** button next to it and share it with everyone.
2. When everyone is in the lobby (it shows how many players are here), anyone slides **Slide to start**.
3. Answer the nine questions one by one: type your answer, then slide **Slide to submit**. Nobody sees anyone else's answers.
4. When everybody has finished, you read the story that started with your first answer, one answer per line, each starting with a capital letter. **Copy story** puts it on your clipboard (with the line breaks) so you can share it.

Each story is built by rotating answers around the group: line `k` of your story is the answer to question `k` from the player `k` places after you (wrapping around when there are fewer than nine players).

### Controls

- Start and Submit are sliders, to avoid accidental taps: drag the knob (almost) all the way across.
- With a physical keyboard, **Shift+Enter** does the same as the slider (start the game, submit your answer). A plain Enter does nothing, on purpose.
- The Submit slider stays dimmed until you've typed something. Answers are trimmed and any line breaks or runs of spaces become a single space, so an answer is always one line.

### If something goes wrong

- Reloading the page (or coming back to the tab) resumes where you were: your answers are kept in the browser, and other players resend what you missed.
- If someone drops out after the game started, the others see "Waiting for N others…" with a **Reveal anyway** button; the missing player's lines show as "…".
- Opening the link after the game has started shows "This game has already started"; open a new room to play again.

## Host on GitHub Pages

Settings → Pages → Deploy from a branch → `main` / root. The game is then at `https://<user>.github.io/<repo>/`.

## How it works

- Players don't connect to each other. Messages go through free public MQTT brokers (HiveMQ, Mosquitto and EMQX) over secure WebSockets, all at once, with duplicates dropped. This works behind strict phone networks and in iOS Lockdown Mode, where peer-to-peer (WebRTC) did not.
- The lobby shows "Connected to X of Y relays". One unreachable broker is normal; if it never gets past "Connecting to relays…", your network is probably blocking the broker ports (8884, 8081, 8084).
- The brokers are best-effort public services with no uptime promise. If all of them are down, the game can't connect.
- Everything is end-to-end encrypted (AES-GCM) with a key derived from the room code in the link, which never leaves your browser, so the brokers only see ciphertext. Anyone with the link can join, so don't post it publicly.
- The only third-party code is [mqtt.js](https://github.com/mqttjs/MQTT.js), loaded from jsDelivr at a pinned version with a subresource-integrity hash.
- Answers live in the players' browsers (`localStorage`); there is no anti-cheat. Friends only.

## Development

- All the code is in `index.html`. The pure logic (`// <core>`), crypto (`// <crypto>`) and transport (`// <transport>`) sections are extracted by the tests, so they have no DOM dependencies.
- Add `?local` after the room hash (`#abc123?local`) to play across tabs of the same browser without a network, useful for testing.
- Tests: `node --test --test-timeout=8000 --test-force-exit test/*.test.mjs`
- Design notes: [docs/superpowers/specs](docs/superpowers/specs/2026-10-16-cadavre-exquis-design.md).
