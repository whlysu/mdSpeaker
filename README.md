# mdSpeaker — Markdown 朗读阅读器

纯前端 Markdown 阅读器：打开本地 `.md` 文件渲染阅读，开启朗读后按段落高亮，标题与正文、表格行之间自动插入停顿。

**在线演示：** https://whlysu.github.io/mdSpeaker/

## 功能

- 本地打开 / 拖入 Markdown 文件（无后端，支持多选与多次打开）
- 左侧文档列表，快速切换已打开的多个文档；列表自动保存到本地，刷新后还原
- 侧栏「清空」可一键清除全部文档
- 阅读区右侧视口进度条：只显示当前可见段落，点击可跳转
- 上一段 / 下一段 跳转控制
- 结构化朗读：标题、段落、列表、表格分段处理
- 朗读时当前块高亮并自动滚动
- 深色 / 明亮模式切换（偏好保存在本地）
- **Microsoft Edge**：使用 Edge TTS（自研浏览器客户端），中文 Neural 语音
- **Chrome / Firefox 等**：自动降级为 Web Speech API

## 快速开始

```bash
cd mdSpeaker
npm install
npm run dev      # 开发：http://localhost:5173
npm run build    # 构建到 dist/
npm run preview  # 预览 dist/
```

构建完成后，可直接用静态服务器或 `npm run preview` 打开 `dist/index.html`。

## 使用说明

1. 点击 **打开文档**（可多选）或将 `.md` 文件拖入阅读区；可多次打开追加文档
2. 在左侧列表点击切换文档，点击 × 关闭；**清空** 可清除全部（列表会写入 localStorage，刷新后自动还原）
3. 点击 **播放** 开始朗读；可用 **上一段 / 下一段** 或阅读区右侧视口进度条跳转可见段落
4. 工具栏可调整语速、语音，点击 🌙/☀️ 切换主题；状态栏显示当前朗读进度

## 朗读规则

| 块类型 | 行为 |
|--------|------|
| 标题 h1–h6 | 只读标题文字，段后停顿 800–1200ms |
| 段落 | 正常朗读，段后 400ms |
| 列表项 | 有序列表加「第 N 项」前缀 |
| 表格 | 先读「表格，共 M 行 N 列」→ 表头 → 每行「第 i 行：列名 值，…」 |
| `hr` / 代码块 / 图片 | 仅展示，不朗读 |
| 粗体 / 斜体等 | 正确渲染为 HTML；朗读只读文字，不读 `**` |
| `⭐⭐⭐` | 读作「三星」（按连续星数） |
| `🔵` `🟠` 等彩色圆点 | 不朗读 |
| `❌` `✅` | 不朗读 |

## 浏览器建议

| 浏览器 | TTS 引擎 | 说明 |
|--------|----------|------|
| Microsoft Edge | Edge TTS | 推荐，音质好，支持 Neural 中文语音 |
| Chrome / Firefox | Web Speech | 自动降级，依赖系统语音 |

**需联网**：Edge TTS 调用 Microsoft 在线服务。

## 技术栈

- [Vite](https://vitejs.dev/) — 构建
- [marked](https://marked.js.org/) — Markdown 渲染
- 自研浏览器端 Edge TTS 客户端（`api.msedgeservices.com`，含超时重试与预取）

## 目录结构

```
mdSpeaker/
├── index.html
├── src/
│   ├── main.js           # 入口与 UI 绑定
│   ├── md/               # 文件读取与渲染
│   ├── speech/           # 朗读分段规划
│   ├── tts/              # Edge TTS / Web Speech 适配
│   └── player/           # 播放队列与高亮
└── dist/                 # 构建产物
```

## 验证

```bash
node scripts/verify.mjs   # 检查 STORYBOARD.md 渲染分段数量
```

手动测试建议用 `videos/sdd-best-practices/STORYBOARD.md`：确认标题停顿、列表序号、表格按行朗读。
