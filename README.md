# 抖音数据助手

一个面向 Codex 的本地数据工作流：浏览器扩展只采集你已登录抖音数据页面返回的数据；Codex Agent 读取本机交接文件，再通过飞书 CLI 写入已有的多维表格。

不需要后端、OAuth 回调地址、飞书密钥或激活码。

## 用户流程

1. 打开并登录抖音数据页面。
2. 正常搜索、筛选或翻页；扩展会自动监听页面返回的数据。
3. 对 Codex 说“导入飞书”。
4. Agent 自动读取最新采集数据，写入你指定的已有飞书多维表格。

用户无需手动导出、上传 JSON、填写 App ID 或配置 Table ID。

## 安装扩展

1. 在 Chromium 浏览器打开扩展管理页：Chrome 为 `chrome://extensions`，Edge 为 `edge://extensions`。
2. 开启“开发者模式”。
3. 选择“加载已解压的扩展程序”，选中本仓库根目录。
4. 首次更新本地源码后，在扩展管理页点击一次“刷新”。

Chrome/Edge 会提示页面正在被调试。这是扩展读取当前页面自身返回数据所必需的浏览器原生提示。

## 安装 Agent Skill

将 [`douyin-import-feishu`](./douyin-import-feishu) 安装到 Codex Skills 目录。它会在用户说“导入飞书”时自动寻找本机交接文件，并调用已登录的 `feishu-cli` 写入已有的数据表。

前置条件：本机已安装并登录 `feishu-cli`，且该账号对目标多维表格有写入权限。

## 数据与隐私

- 扩展仅在 `creator.douyin.com` 页面监听 XHR / Fetch 返回的 JSON。
- 扩展不保存飞书密钥、不直接连接飞书、不调用自建后端。
- 数据保存在浏览器扩展本地，并自动写入本机下载目录中的 Agent 交接文件。
- 只有用户明确说“导入飞书”后，Agent 才会通过本机飞书 CLI 写入数据表。

请只采集你有权访问的数据，并遵守抖音和飞书的服务规则。

## 仓库结构

```text
.
├── manifest.json                 # Chromium 扩展配置
├── background.js                 # 自动监听与本机交接
├── popup.*                       # 极简状态界面
├── offscreen.*                   # JSON 交接文件下载
└── douyin-import-feishu/         # Codex 导入 Skill
```

## 版本

当前为 `0.5.0`，处于个人工作流验证阶段。
