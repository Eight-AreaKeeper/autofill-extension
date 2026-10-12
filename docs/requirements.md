# 自动填表浏览器插件：需求分析与技术栈

## 1. 产品定位

一个浏览器插件。用户先在插件里填写一份个人信息（姓名、电话、邮箱、地址等），之后浏览任意网页时，点一下插件按钮，插件就识别当前页面的表单字段并自动填入对应信息。

目标用户：经常需要在注册、报名、下单、求职、问卷等页面重复填写个人信息的普通用户。

## 2. 核心使用流程

1. 安装插件后，打开「个人信息」设置页（options 页），填写并保存资料。
2. 打开一个带表单的网页。
3. 点击工具栏插件图标，弹出 popup，点「一键填表」。
4. 插件在当前页面识别字段并填入，popup 显示「已填写 N 个字段」。
5. 用户检查无误后自行提交表单。插件**从不**自动提交。

## 3. 功能需求

### MVP（本次骨架实现）

| 编号 | 需求 | 说明 |
|---|---|---|
| F1 | 个人信息编辑 | options 页表单，可编辑、保存、清空；存在本地 |
| F2 | 一键填表 | popup 按钮触发，对当前标签页填充 |
| F3 | 字段识别 | 基于 `autocomplete` / `name` / `id` / `label` / `placeholder` / `aria-label` 的规则映射，中英文关键词 |
| F4 | 兼容框架 | 用原生 setter 赋值并派发 `input`/`change` 事件，让 React/Vue 表单感知到变化 |
| F5 | 不覆盖已有内容 | 已有值的输入框默认跳过 |
| F6 | 填写反馈 | 被填的字段短暂高亮，popup 显示填写数量 |
| F7 | 下拉框支持 | `<select>` 按选项文本/值模糊匹配（如性别、省份） |

### 后续迭代（不在本次范围）

- 多套资料（个人 / 工作），按站点自动选择
- 站点级自定义映射：用户在页面上右键某字段 → 指定对应资料项，记住该站点规则
- 自定义字段（任意 键 → 值）
- 快捷键填表、右键菜单填表
- iframe 内表单、Shadow DOM 内表单
- 资料导入/导出（JSON），可选加密备份
- 多语言界面；Firefox / Edge 适配（WXT 可直接出多浏览器包）
- 可选：LLM 辅助识别规则无法匹配的字段（需用户明确开启，且只发送字段描述，不发送资料值）

## 4. 非功能需求

- **隐私**：所有资料只存在本机 `chrome.storage.local`，不联网、不上传、无统计。
- **敏感信息**：MVP 不收集身份证号、银行卡号、密码等；后续若加入，需单独开关并考虑本地加密。
- **安全**：不填 `type=password`、`type=hidden`、`disabled`、`readonly` 字段；从不自动提交。
- **权限最小化**：使用 `activeTab` + `scripting`，仅在用户点击时向当前页注入脚本，无需申请「读取所有网站」权限，安装时不会弹出吓人的权限提示。
- **性能**：只在点击时运行，平时对页面零开销。

## 5. 技术栈决定

| 方面 | 选择 | 理由 |
|---|---|---|
| 平台 | Chrome Manifest V3 | Chrome 已淘汰 MV2；Edge 同内核可直接用 |
| 语言 | TypeScript | 资料结构与匹配规则类型安全 |
| 构建框架 | [WXT](https://wxt.dev) (基于 Vite) | 约定式入口、自动生成 manifest、HMR、一套代码可出 Chrome/Firefox/Edge 包；比 CRXJS 维护更活跃 |
| UI | React 18 | popup 与 options 页；生态成熟 |
| 存储 | `chrome.storage.local`（经 `wxt/storage` 封装） | 本地、容量足够、扩展各部分共享 |
| 页面注入 | `browser.scripting.executeScript` + `activeTab` | 按需注入，权限最小 |
| 测试 | Vitest + happy-dom | 对字段匹配规则做单元测试 |

## 6. 架构

```
entrypoints/
  options/        个人信息编辑页（React）
  popup/          工具栏弹窗：一键填表按钮（React）
  autofill.content.ts  按需注入的填表脚本（不自动注入）
lib/
  profile.ts      资料类型定义、字段元数据、存储读写
  matcher.ts      字段识别：元素 → 资料项 key
  filler.ts       遍历页面表单、赋值、派发事件、高亮
test/
  sample-form.html  本地测试用表单页
```

填表流程：popup 读取资料 → `scripting.executeScript` 注入 `autofill.content.js` 到当前标签页 → 再执行一个函数调用 `window.__autofill(profile)` → 返回填写数量 → popup 显示结果。

## 7. 字段匹配策略

按优先级：

1. **`autocomplete` 属性**：标准值（`name`、`given-name`、`email`、`tel`、`postal-code`、`address-level1` 等）直接映射，最可靠。
2. **关键词规则**：把 `name`、`id`、`placeholder`、`aria-label`、关联 `<label>` 文本、`title` 拼成一个签名串，依次用每个资料项的正则（中英文关键词）匹配，命中第一条即可。规则顺序从具体到泛化（如「邮编」先于「地址」，「姓」「名」先于「姓名」）。
3. **`input type`**：`type=email` / `type=tel` 作为兜底。

无法识别的字段保持原样不动。
