import { fillPage } from '@/lib/filler';
import { getProfile } from '@/lib/profile';

// Not auto-injected: the popup injects this into the active tab on click (activeTab + scripting),
// and the value returned from main() becomes the executeScript result.
export default defineContentScript({
  registration: 'runtime',
  matches: [],
  async main() {
    return fillPage(await getProfile());
  },
});
