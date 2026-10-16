import { fillPage } from '@/lib/filler';
import { getAnswers, getSettings, watchAnswers } from '@/lib/learning';
import { getProfile } from '@/lib/profile';
import { getResume } from '@/lib/resume';

declare global {
  // Survives re-injection: each click runs this script again in the same isolated world.
  var __autofillWatching: boolean | undefined;
}

// Not auto-injected: the popup injects this into the active tab on click (activeTab + scripting),
// and the value returned from main() becomes the executeScript result.
export default defineContentScript({
  registration: 'runtime',
  matches: [],
  async main() {
    const [profile, answers, resume, settings] = await Promise.all([getProfile(), getAnswers(), getResume(), getSettings()]);
    const result = fillPage(profile, document, { answers, resume });
    // From now until the page is closed, remember what the user types into fields we couldn't fill.
    if (settings.learn && !globalThis.__autofillWatching) {
      globalThis.__autofillWatching = true;
      watchAnswers();
    }
    return result;
  },
});
