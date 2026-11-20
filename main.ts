// Solana Heat — hand-in program for the make.fun "Make GTA 6" bounty (gta6-01).
//
// The game itself lives in game/ as plain static files (game/index.html plus its
// ES modules under game/src/), written from scratch for this entry: an original
// open-world crime game set in the fictional coastal city of Port Solana.
// This program copies game/ and screenshots/ into the output directory and
// writes dossier.json there with the vendored make.fun library, byte for byte
// the way the scorer rebuilds it.
//
// Run locally:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play locally: serve game/ with any static file server and open index.html.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

console.log(`Solana Heat: handing in the game to ${out}`);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps below are the scorer's own (see the gate in RULES.txt): at most 4
// screenshots of at most 256 KiB each, at most 993 files and 48 MiB in game/,
// no path under game/ longer than 1000 bytes, and the dossier text capped at
// 160 KiB. buildDossier refuses anything the scorer would refuse.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log('Solana Heat: dossier.json written.');
