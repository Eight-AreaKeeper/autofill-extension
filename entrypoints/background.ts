import { hasAllSites } from '@/lib/everywhere';
import { getSettings, settingsItem } from '@/lib/learning';

const LEARN_SCRIPT_ID = 'learn';

/** Run the learning script on every page while learning is on and the user has allowed all sites. */
async function syncLearnScript() {
  const want = (await getSettings()).learn && (await hasAllSites());
  const registered = (await browser.scripting.getRegisteredContentScripts({ ids: [LEARN_SCRIPT_ID] })).length > 0;
  if (want && !registered) {
    await browser.scripting.registerContentScripts([
      {
        id: LEARN_SCRIPT_ID,
        js: ['content-scripts/learn.js'],
        matches: ['<all_urls>'],
        allFrames: true,
        runAt: 'document_idle',
        persistAcrossSessions: true,
      },
    ]);
  } else if (!want && registered) {
    await browser.scripting.unregisterContentScripts({ ids: [LEARN_SCRIPT_ID] });
  }
}

export default defineBackground(() => {
  const sync = () => syncLearnScript().catch(console.error);
  browser.runtime.onInstalled.addListener(sync);
  browser.runtime.onStartup.addListener(sync);
  browser.permissions.onAdded.addListener(sync);
  browser.permissions.onRemoved.addListener(sync);
  settingsItem.watch(sync);
});
