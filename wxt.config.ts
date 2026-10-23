import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Autofill Assistant',
    description: 'Save your details once, then fill any web form in one click. Your data never leaves your device.',
    // unlimitedStorage lifts the 10 MB storage.local cap so a resume fits; it shows no install warning.
    permissions: ['storage', 'unlimitedStorage', 'activeTab', 'scripting'],
    // Asked for only when the user turns on learning from every form (options page).
    optional_host_permissions: ['<all_urls>'],
    // End-to-end tests can't click the toolbar icon or a permission prompt, so test builds get host access.
    ...(process.env.E2E ? { host_permissions: ['<all_urls>'] } : {}),
  },
});
