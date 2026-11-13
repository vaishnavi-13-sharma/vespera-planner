// Vespera speaks only vintage fairy tale, castle and storybook: no witchcraft or occult words anywhere a person
// can see or hear. Shared by the Vitest guard (wording.test.tsx) and the E2E suite, so it has no imports.
//
// Whole words and their forms, case-insensitive. Deliberately allowed: "spelling"/"spelled" (vocab cards),
// hex color codes like #c8a96e (not the word "hex"), and brewing tea ("brew a pot of tea", "tea brewing").
const WORDS = [
  'spells?', 'spellbound', 'spellbinding', 'spellcast(?:er|ers|ing)?',
  'potions?',
  'grimoires?',
  'witch(?:es|y|craft|ing|ery)?',
  'hex(?:es|ed)?',
  'rituals?',
  'alchem(?:y|ical|ist|ists)',
  'apothecar(?:y|ies)',
  'familiars?',
  'oracles?',
  'elixirs?',
  'tinctures?',
  'cauldrons?',
  'sorcer(?:y|er|ers|ess)',
  'wizard(?:s|ry)?',
  'curs(?:e|es|ed|ing)',
  'occult',
  'incantations?',
  'conjur(?:e|es|ed|ing|er)',
  '(?<!\\btea\\s)brew(?:s|ed|ing)?(?![^.!?\\n]{0,20}\\btea\\b)',
  'covens?',
  'runes?',
];

/** Matches any banned word. Not global, so `.test()` keeps no state between calls. */
export const BANNED_WORDS = new RegExp(`\\b(?:${WORDS.join('|')})\\b`, 'i');

/** Every banned word found in `text`, as written (empty when the text is clean). */
export function findBannedWords(text: string): string[] {
  return [...text.matchAll(new RegExp(BANNED_WORDS.source, 'gi'))].map((m) => m[0]);
}

// Vespera also speaks plain, everyday English: the storybook is in the look, not in flowery copy.
// Whole words, case-insensitive, so field names like `unstickActions` (never shown) don't count.
const PLAIN_WORDS = [
  'candlelit',
  'sanctuary',
  'keepsakes?',
  'kindness(?:es)?',
  'slumber(?:s|ing|ed)?',
  'whisper(?:s|ed|ing)?',
  'unstick',
  'brass\\s+knobs',
  'snuffed',
  'flickered',
];

/** Matches any word too flowery for Vespera's copy. Not global, so `.test()` keeps no state between calls. */
export const PLAIN_LANGUAGE = new RegExp(`\\b(?:${PLAIN_WORDS.join('|')})\\b`, 'i');

/** Every flowery word found in `text`, as written (empty when the text is plain). */
export function findFloweryWords(text: string): string[] {
  return [...text.matchAll(new RegExp(PLAIN_LANGUAGE.source, 'gi'))].map((m) => m[0]);
}

/** Banned and flowery words together: what the UI guards check. */
export function findWordingIssues(text: string): string[] {
  return [...findBannedWords(text), ...findFloweryWords(text)];
}
