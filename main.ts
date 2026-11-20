// Solana Heat — hand-in program for the make.fun "gta6-01" bounty (Node 22, standard library only).
//
// The game itself is the game/ folder beside this file: plain static files (an index.html and its
// ES modules) that a desktop browser loads fully offline. This program copies game/ and
// screenshots/ into the output directory and writes dossier.json there with the vendored
// make.fun library, exactly as the bounty's scorer will rebuild it to compare byte for byte.
//
// Play it locally by serving game/ with any static file server, e.g. `python3 -m http.server`
// inside game/, then opening the page in a desktop browser.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The entry is only complete with its screenshots: refuse early, with a clear word, rather than
// hand in a game the judge cannot see.
const shotsDir = join(here, 'screenshots');
const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((name) => !name.startsWith('.')) : [];
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`Solana Heat needs 3 or 4 screenshots in screenshots/, found ${shots.length}.`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others
// refuse an entry the scorer would refuse (more than 4 screenshots or one over 256 KiB; more than
// 993 files in game/ or 48 MiB of game files in all, or a path under game/ over 1000 bytes).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

console.log(`Solana Heat handed in: game/ plus ${shots.length} screenshots (${shots.join(', ')}) -> ${out}`);
