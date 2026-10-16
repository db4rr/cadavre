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

- Players connect peer-to-peer (WebRTC) through [Trystero](https://github.com/dmotz/trystero), which uses public Nostr relays to find each other, and the library is loaded from the `esm.run` CDN. If either is down, or your network blocks WebRTC, the game won't connect.
- Answers live in the players' browsers (and `localStorage`); there is no privacy or anti-cheat. Friends only.
- Add `?local` after the room hash (`#abc123?local`) to play across tabs of the same browser without a network, useful for testing.
- Tests: `node --test test/*.test.mjs`
