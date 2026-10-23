import { getSettings, watchAnswers } from '@/lib/learning';

declare global {
  // Shared with the fill script: both run in the same isolated world, so only one watcher starts.
  var __autofillWatching: boolean | undefined;
}

// Registered by the background script on every site once the user allows it (see background.ts),
// so answers are learned on every form, not only on pages where Fill this page was clicked.
export default defineContentScript({
  registration: 'runtime',
  matches: [],
  async main() {
    if (globalThis.__autofillWatching || !(await getSettings()).learn) return;
    globalThis.__autofillWatching = true;
    watchAnswers();
  },
});
