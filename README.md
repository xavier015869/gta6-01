# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/xavier015869/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/xavier015869/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solana Heat** is an original open-world crime game that runs entirely in the browser, built for make.fun's "Make GTA 6" bounty. You are Rico, new in the sun-soaked coastal city of Port Solana, running jobs for the fixer Sol Duarte: steal a first car, move a hot package off the harbour, beat a checkpoint run, learn to lose the PSPD, and pull off the Port Solana Bank job before lying low at a safehouse on Solana Key island.

The city is alive around the story: five invented car models (plus the PSPD Interceptor) drive a real road graph with right-hand traffic, pedestrians stroll the pavements and flee gunfire, and a fractional wanted system feeds police who spawn out of sight, hunt where you are heading, and win by pinning you until the bust meter fills. Between jobs, taxi fares pay the bills. Everything — the seeded city, the physics, the synth-only sound, the HUD and live minimap — is hand-written vanilla JavaScript in `game/src/`, one file per system, with no libraries and no network requests. Progress (cash, story, stats) saves to your browser.

**Controls:** WASD / arrows to walk and drive · Shift to run · E to enter and exit cars · mouse to aim, click to shoot · Space handbrake · T for taxi fares · M mute · Esc pause.

## Run it

```sh
cd game && python3 -m http.server 8080
# then open http://localhost:8080 in a desktop browser
```

To hand the entry in (copies `game/` and `screenshots/` to the output directory and writes `dossier.json`):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=9d3wsaqp&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
