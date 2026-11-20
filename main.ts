// Leonida 55 — the entry program for gta6-trophy-guide-01 (Node 22, standard library only).
//
// The guide itself is the app/ folder beside this file: static HTML, CSS and ES modules that a browser
// opens with no build step and no network. It carries its own trophy list in app/data/trophies.json and
// reads nothing from anywhere else. This program's whole job is to hand that folder in: it copies app/
// and screenshots/ to the output directory and writes dossier.json there with the vendored make.fun
// library — the file the judge reads, holding the screenshots, the first load's file and byte counts,
// and the source.
//
// vendor/makefun-frontend.ts stays exactly as it is. The scorer requires dossier.json to match, byte for
// byte, what its own copy of the library writes, so the call below passes only the limits from
// reference/gate.json and nothing else.
//
// To read the guide, run `node serve.ts` in this folder and open the local address it prints. Off the
// grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

/** Shown in the one log line this program prints, so a build is identifiable in a transcript. */
const ENTRY_TITLE = 'Leonida 55 — GTA VI trophy guide & tracker';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files and directories in app/ or
// 48 MiB of app files: app/ counts beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, app_max_files: 993, app_max_bytes: 50331648 }),
);

console.log(`${ENTRY_TITLE} — wrote ${join(out, 'dossier.json')}`);
