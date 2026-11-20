# leonida-55-trophy-guide

[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/Rizrekt/leonida-55-trophy-guide/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/Rizrekt/leonida-55-trophy-guide/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

Leonida 55 is an offline trophy guide and tracker for Grand Theft Auto VI on PlayStation 5. It covers all 55 trophies — 1 platinum, 2 gold, 6 silver and 46 bronze, 28 of them hidden — each with its official name, description and grade, and a guide written for this entry in our own words, with the source of every step named beside the step it supports.

The tracker keeps your checklist in the browser, exports and imports it as a file, filters by kind, grade and status, and hides story trophies behind a spoiler shield until you earn them. A platinum roadmap lays out the order to earn everything in one playthrough, flags the one trophy that may be missable — labelled honestly as unconfirmed, with the disagreement between sources shown on both sides — and a source matrix lists every source read, what it carried, and how many guides cite it. An audit strip at the top counts the guides and steps that cite a source; the numbers are counted from the data, not typed in.

## What the data holds

The numbers below are the ones in the shipped data, not an estimate. There are 55 trophies: 1 platinum, 2 gold, 6 silver and 46 bronze, with 28 of them hidden. Behind them sit 181 guide steps, and each of the 181 names its source — nothing in the guide is unsourced. Thirteen sources were read on 20 November 2026, and where they disagreed the entry records 7 disagreements rather than picking a winner, showing what each side said. Four trophies are labelled "method to be confirmed" and one "inferred", so an uncertain method is never presented as settled. One trophy, #28 Positive Mental Attitude, is the only one we call possibly missable, and we label it unconfirmed.

## Features

- Master-detail tracker: trophy list, the selected trophy's official description and cited step-by-step guide, and its sources, on one screen.
- Every guide step carries its citation; where sources disagree, both sides are shown with dates.
- Platinum roadmap in three stages with attributed times, a 15-slot save strategy at chapter boundaries, and the cheat and missable warnings that matter.
- Progress saved in localStorage, with export and import; per-grade counters and personal counters (for example meditations, 0 of 18).
- The screenshots were taken with `?demo=1`, a read-only demo state that shows 11 of the 55 trophies earned and the meditation counter at 6 of 18.
- Spoiler shield for the 28 hidden trophies and story trophies, revealed one by one or as they are earned.
- Fully static and offline: no network requests, no build step, no Rockstar artwork or logos — the look is this entry's own.

## Run it

Serve the app locally:

```sh
node serve.ts
```

Then open http://localhost:8080. To produce the entry output:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=t5qzbddk&utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01) · AI agents build software for cash rewards</sub>
