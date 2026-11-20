// The Roadmap view: one read-through of dossier §4, arranged as the three
// stages the sources lay out, then the facts that decide how you plan (hours,
// saves, cheats), then the two warnings that actually cost you a trophy.
//
// Nothing here is computed from progress — it is the same page for everyone —
// so the module is a single render call with no state of its own. Counts that
// appear (trophies per stage) are counted from the data, not typed in.

import { esc, citeChips } from './guide-render.js';

const STAGES = [
  {
    num: '01',
    title: 'Story, side missions and scans',
    range: '~60–80 hours',
    cites: ['S3'],
    lede:
      'Play the five chapters in order and take the optional work as it appears beside them. Nothing in this stage needs to be farmed later, and the two story trophies for finishing chapters arrive on their own.',
    facts: [
      ['Work through all five chapters of the main story; the story trophies pop automatically as each chapter closes.', ['S2', 'S3']],
      ['Take the stranger and character questlines as they unlock rather than leaving them — most start during the story and stay open afterwards.', ['S2']],
      ['Scan vehicles and animals with the phone app as you travel; the counters keep climbing while you do anything else.', ['S2']],
      ['Do the Chapter 1 balcony meditation when Lucia offers it, and keep a save from that chapter. See the warning below.', ['S3']],
      ['Finish the story before chasing 100%: the completion checklist only becomes readable in the stats menu afterwards.', ['S2']],
    ],
  },
  {
    num: '02',
    title: 'The 100% checklist and the challenge list',
    range: '~100 hours',
    cites: ['S3'],
    lede:
      'The long stage. The in-game checklist is the spine of it, and one trophy — A Long Road — simply asks for the whole thing. The challenge quota inside that checklist is 70 of the 80, while the standalone challenge trophy only wants 50.',
    facts: [
      ['Open Progress → Stats after the story and work down the checklist; earlier progress already counts toward it.', ['S2']],
      ['Complete 70 of the 80 challenges for the checklist, and 50 for the challenge trophy, which the checklist subsumes.', ['S2', 'S3']],
      ['Clear all bank vaults, gang operations and robberies: the checklist wants every one, not the five-vault trophy quota.', ['S2']],
      ['Finish all Shooting Range golds, all drone races and every one of Bret\'s Target Decks for the checklist.', ['S2']],
      ['Reach the partial quotas too: 200 vehicle scans, 100 animal studies and 250 stunts (the checklist asks for 300).', ['S2', 'S3']],
    ],
  },
  {
    num: '03',
    title: 'Strangers, Freaks and the misc cleanup',
    range: '~10 hours',
    cites: ['S3'],
    lede:
      'The last sweep. Whatever the story left open — stranger strands, the money and property trophies, the odd combat and robbery one-offs — is still available in free-roam, so this stage is tidy-up rather than a race.',
    facts: [
      ['Finish the eight qualifying stranger strands; the full qualifying set was still being confirmed by one source.', ['S2', 'S3']],
      ['Buy all eight garage properties and register ten vehicles to the delivery app — both need free garage space and money.', ['S2']],
      ['Launder $250,000 of marked bills and spend $100,000 across shops; both are cumulative, so start early if you can.', ['S3', 'S4']],
      ['Take the four- and five-star robbery trophies with your partner present, since the partner is part of the requirement.', ['S2']],
      ['Re-check the counters in the tracker after each session: this stage is where a single missed counter shows up.', ['S4']],
    ],
  },
];

const HEADLINE_FACTS = [
  { key: 'Difficulty', value: '4 / 10', note: 'Both roadmap sources put it here, independently.', cites: ['S3', 'S6'] },
  { key: 'Time to platinum', value: '~200 hours', note: 'One source says 250–300; see the disagreement below.', cites: ['S2', 'S3'] },
  { key: 'Playthroughs', value: '1', note: 'No difficulty trophies, no second run needed.', cites: ['S2', 'S3'] },
  { key: 'Mission replay', value: 'None', note: 'And no New Game+. Free-roam continues after the story.', cites: ['S2', 'S3'] },
  { key: 'Manual saves', value: '15 + autosave', note: 'Use ten of them, at the start and end of each chapter.', cites: ['S3'] },
  { key: 'Cheats', value: 'Off', note: 'Cheats disable trophies and saving for the session.', cites: ['S2', 'S3'] },
  { key: 'Hardest trophy', value: 'A Long Road', note: 'The 100% completion trophy, by both sources.', cites: ['S2', 'S3'] },
  { key: 'Online trophies', value: 'None', note: 'All 55 are single-player, offline.', cites: ['S2', 'S3'] },
];

function stageHtml(stage) {
  const facts = stage.facts
    .map(
      ([text, cites]) =>
        `<li><span>${esc(text)}</span><span class="stage__cites">${citeChips(cites)}</span></li>`,
    )
    .join('');
  return (
    '<section class="stage">' +
    `<div class="stage__num">${stage.num}<small>Stage</small></div>` +
    '<div>' +
    `<h3 class="stage__title">${esc(stage.title)}</h3>` +
    `<p class="stage__range">${esc(stage.range)} ${citeChips(stage.cites)}</p>` +
    `<p>${esc(stage.lede)}</p>` +
    `<ul class="stage__facts">${facts}</ul>` +
    '</div></section>'
  );
}

function factsHtml() {
  return (
    '<div class="fact-grid">' +
    HEADLINE_FACTS.map(
      (fact) =>
        '<div class="fact">' +
        `<span class="fact__key">${esc(fact.key)}</span>` +
        `<span class="fact__value">${esc(fact.value)}</span>` +
        `<span class="fact__note">${esc(fact.note)}</span> ` +
        citeChips(fact.cites) +
        '</div>',
    ).join('') +
    '</div>'
  );
}

function hoursDisagreement() {
  return (
    '<div class="disagree">' +
    '<p class="disagree__head">Sources disagree — time to platinum</p>' +
    '<p class="disagree__topic">Around 200 hours, or 250 to 300?</p>' +
    '<ul class="disagree__sides">' +
    '<li class="disagree__side"><span class="disagree__source">S2</span>' +
    '<span>Around 200 hours for the full list.</span></li>' +
    '<li class="disagree__side"><span class="disagree__source">S3</span>' +
    '<span>Also around 200 hours, split roughly 60–80 for the story and 100 more for the checklist.</span></li>' +
    '<li class="disagree__side"><span class="disagree__source">S6</span>' +
    '<span>250+ hours in its roadmap box, and up to 300 in its introduction.</span></li>' +
    '</ul>' +
    '<p class="disagree__call">Our call: we headline ~200 hours and show the 250–300 hour figure beside it. ' +
    'We do not average the two, because no source states the number in between.</p>' +
    '</div>'
  );
}

function warningsHtml() {
  return (
    '<section class="warnings">' +
    '<h3>Two things that cost you a trophy</h3>' +
    '<div class="callout">' +
    '<p class="callout__head">#28 Positive Mental Attitude — the Chapter 1 meditation</p>' +
    '<p>After <em>Down to Earth</em> in Chapter 1, Lucia says she is going to meditate and walks to the ' +
    'balcony at Jason\'s house. Follow her and choose <em>Accept</em>. That session raises the progress ' +
    'counter but is not flagged as a Meditation Spot like the others, so nobody has confirmed whether the ' +
    'trophy requires it. Do it on the way past, and keep a save from Chapter 1: with no mission replay and ' +
    'no New Game+, a missed story-side meditation cannot be recovered.</p>' +
    `<p>${citeChips(['S2', 'S3'])}</p>` +
    '</div>' +
    '<div class="callout">' +
    '<p class="callout__head">#48 Actions Speak Louder — the permanent profile</p>' +
    '<p>The trophy wants 500 criminal-profile-changing actions, and the profile moves both ways. ' +
    'One source warns against pushing the character all the way to the permanent <em>Irredeemable</em> ' +
    'state to farm the counter, because that state stays on the character. Mix the actions instead of ' +
    'grinding one kind.</p>' +
    `<p>${citeChips(['S2', 'S4'])}</p>` +
    '</div>' +
    '</section>'
  );
}

export function renderRoadmap(el, data) {
  if (!el) return;
  const storyCount = data.trophies.filter((t) => t.type === 'Story').length;
  const total = data.trophies.length;

  el.innerHTML =
    '<div class="view-head">' +
    '<h2>The road to the platinum</h2>' +
    `<p>${total} trophies · 3 stages · every fact attributed</p>` +
    '</div>' +
    '<p class="roadmap-lede">' +
    'The platinum is a long single playthrough, not a difficult one. Two sources lay the same route out ' +
    `in three stages, and ${storyCount} of the ${total} trophies come from the story itself, so the ` +
    'route below is about the other ' +
    `${total - storyCount}. Everything on it stays reachable after the final mission except the one ` +
    'Chapter 1 meditation flagged further down.' +
    '</p>' +
    factsHtml() +
    STAGES.map(stageHtml).join('') +
    hoursDisagreement() +
    warningsHtml();
}
