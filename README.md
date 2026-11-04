# PlayGround

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://go.ondev.store/).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://go.ondev.store/farelodebuceta/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/farelodebuceta/PlayGround)

- 🎮 [Open the project](https://go.ondev.store/farelodebuceta/PlayGround).
- ✨ [Remix this project](https://go.ondev.store/farelodebuceta/PlayGround?remix=1).
- 💻 [Explore the source](https://github.com/farelodebuceta/PlayGround).
- 🛠️ [Check build runs](https://github.com/farelodebuceta/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/farelodebuceta/PlayGround/issues).
- 👤 [Explore the creator's projects](https://go.ondev.store/farelodebuceta).
- 🌍 [Create with OMGithub](https://go.ondev.store/).
<!-- omgithub:readme:end -->

# WE ARE THE ROBOTS — Cityscape Arena

A playable, fan-made 3D tribute to Gamevial's **We Are The Robots**. It is a
single-player arena shooter with a full campaign loop: hold Cityscape for three
waves, open the Venus portal, and scrap the Venus Warden. Everything is built
from procedural Three.js geometry, canvas textures, and synthesized audio — no
external game assets are loaded.

This is an unofficial tribute and is not affiliated with Gamevial.

## Play

```bash
npm install
npm run dev
```

Then open the printed local URL. To produce a static build:

```bash
npm run build
npm run preview
```

The build is written to `dist/` and works from any static host.

## Controls

| Input | Action |
| --- | --- |
| `WASD` | Move / strafe |
| Mouse | Aim |
| Left mouse | Fire |
| Right mouse | Aim down sights (scope on the Dragunov) |
| `Shift` | Sprint |
| `Space` | Jump; press again in the air for a thruster double-jump |
| `C` | Crouch |
| `R` | Reload |
| `1`–`6` / mouse wheel | Switch weapon |
| `E` | Enter the Venus portal |
| `Tab` | Open arena chat |
| `Esc` | Pause |

Touch devices get a virtual joystick, drag-to-look, fire / jump / reload / swap
buttons, a chat button, and a pause button. The HUD reflows for portrait and
landscape phones.

## The arena

- **Cityscape** — three escalating waves of scout, trooper, heavy, sniper, and
  drone robots, with bot kill feed and ambient trash talk.
- **Venus** — a portal transition leads to the Warden's forge and a boss fight.
- **Six weapons** — P-9, SPAS-12, AK-47, Dragunov, RPG-7, and RG6 Plasma.
- **Chassis choice** — Blue trades armor for speed and reload; Red trades speed
  for extra plating and punch.
- **Progression** — headshot bonuses, kill combos, pickups (health, armor,
  overdrive), wave clear bonuses, and a local high score.

## Implementation notes

- Vite + Three.js (`three`), with a bloom/OutputPass post stack.
- Original procedural robot models, city and Venus environments, weapon view
  models, particle effects, and Web Audio music/SFX.
- No network requests are made at runtime; fonts are bundled locally.
- Assumption: since the original was an online multiplayer game and its servers
  are gone, this tribute recreates the arena atmosphere as a single-player fight
  against AI robot opponents.
