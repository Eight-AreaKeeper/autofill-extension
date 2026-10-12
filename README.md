# 自动填表助手

浏览器插件：先保存一份个人信息，之后在任意网页点一下就能自动填表。数据只存在本机。

需求与技术选型见 [docs/requirements.md](docs/requirements.md)。

## 开发

```bash
npm install
npm run dev      # 启动开发模式，会自动打开一个装好插件的 Chrome，改代码热更新
npm run build    # 生产构建，输出到 .output/chrome-mv3
npm test         # 字段匹配单元测试
npm run compile  # TypeScript 类型检查
npm run zip      # 打包成 zip，用于上架应用商店
```

## 在 Chrome / Edge 里加载测试

1. `npm run build`
2. 打开 `chrome://extensions`（Edge 为 `edge://extensions`），打开右上角「开发者模式」
3. 点「加载已解压的扩展程序」，选择 `.output/chrome-mv3` 目录
4. 点工具栏的拼图图标，把「自动填表助手」固定到工具栏
5. 点插件图标 →「去填写个人信息」，填好后保存
6. 用浏览器打开测试页：在项目目录运行 `npx serve test`，访问它给出的地址并打开 `sample-form.html`（或任意有表单的网站）
7. 点插件图标 →「一键填表」

改代码后重新 `npm run build`，再在扩展管理页点插件卡片上的刷新按钮。

> 直接双击打开 `file://` 测试页时，需要在插件「详细信息」里打开「允许访问文件网址」才能填表。

## 目录

```
entrypoints/options/        个人信息编辑页
entrypoints/popup/          工具栏弹窗（一键填表）
entrypoints/autofill.content.ts  点击时注入当前页的填表脚本
lib/profile.ts              资料字段定义与存储
lib/matcher.ts              表单字段识别规则
lib/filler.ts               填写、事件派发、高亮
test/                       测试页与单元测试
```
