import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: '自动填表助手',
    description: '保存个人信息，一键自动填写网页表单。数据只存在本机。',
    permissions: ['storage', 'activeTab', 'scripting'],
    // End-to-end tests can't click the toolbar icon to grant activeTab, so test builds get host access.
    ...(process.env.E2E ? { host_permissions: ['http://localhost/*'] } : {}),
  },
});
