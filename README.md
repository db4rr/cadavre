# Cadavre exquis

A tiny multiplayer cadavre exquis for friends playing at the same time. One static `index.html`, no server of your own.

## Play

1. Open the page. You get a room link (`…/#abc123`); share it with everyone.
2. When everyone is in the lobby, anyone clicks **Start**.
3. Answer the nine questions one by one. When everybody has finished, you read the story that started with your first answer.

Each story is built by rotating answers around the group: line `k` of your story is the answer to question `k` from the player `k` places after you.

## Host on GitHub Pages

Settings → Pages → Deploy from a branch → `main` / root. The game is then at `https://<user>.github.io/<repo>/`.

## Notes

- Messages go through free public MQTT brokers (HiveMQ, Mosquitto, EMQX) over secure WebSockets, so it works behind strict phone networks and in iOS Lockdown Mode, with nothing peer-to-peer. They are best-effort services: if all are down, or your network blocks their ports (8884, 8081, 8084), the game won't connect. The lobby shows how many relays you reached.
- Everything is end-to-end encrypted with a key derived from the room code in the link, so the brokers only see ciphertext. Anyone with the link can join, so don't post it publicly.
- Answers live in the players' browsers (and `localStorage`); there is no privacy or anti-cheat. Friends only.
- Add `?local` after the room hash (`#abc123?local`) to play across tabs of the same browser without a network, useful for testing.
- Tests: `node --test test/*.test.mjs`
