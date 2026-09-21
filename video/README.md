# BrainBot 产品演示视频

45 秒 / 1920×1080 / 30 fps。React、HTML、CSS 和 SVG 由 Remotion 按帧渲染；主体素材来自当前项目的真实离线演示界面，重点卡片是对现有内容的动画化摘要。配乐为本工程生成的原创合成音频，无旁白。

## 成片与播放

- `out/brainbot-demo.mp4`：H.264 主成片，适合下载、演示与分享。
- `out/index.html`：本地 HTML 播放页，带播放按钮、章节跳转和下载链接。
- `out/keyframes/`：分镜和转场抽帧。
- `out/verification.json`：最终媒体参数检查记录，由验证脚本生成。

双击 HTML 播放页，或在本目录运行 `npm run preview`，打开终端打印的本地 URL。分享时将整个 `out` 目录一起拷贝，或只分享 MP4。`out` 已被 Git 忽略，成片保留在本地磁盘。

## 安装与编辑

已在 Windows、Node.js 24.14.1、npm 11.11.0 上制作。Remotion 依赖固定为 4.0.526。

```powershell
npm ci
npm run dev
```

Studio 默认使用本地 3000 端口（如被占用，以终端输出为准），composition 为 `BrainBotDemo`。首次渲染可能需要下载 Chrome Headless Shell；安装后渲染只读取本地素材，不需要业务后端、模型 API 或联网论文检索。

## 导出与检查

```powershell
npm run lint
npm run audio
npm run test:audio
npm run render
npm run prepare-preview
npm run verify
npm run preview
```

`npm run render` 输出 1080p H.264，CRF 18，并发 2。若本机资源紧张，可将并发改为 1。`verify` 在时长、分辨率、帧率、视频编码、音轨或 HTML 相对路径不满足约定时失败。

```powershell
node scripts/render-keyframes.mjs 0 90 300 450 457 464 600 900 1140 1290 1349
```

## 修改位置

- `src/scenes/`：六段画面、中文文案和场景运动。
- `src/timeline.ts`：0 / 6 / 15 / 25 / 35 / 41 / 45 秒的主时间轴。
- `src/components/`：三维投影知识节点、悬浮屏幕、重点卡片、标题。
- `src/design.ts`：片长、画幅、字体、颜色和缓动。
- `scripts/generate-score.mjs`：原创双声道音乐与转场音色。
- `preview/index.html`：独立播放页源文件，运行 `prepare-preview` 后复制到输出目录。

场景之间交叠 14 帧，总片长仍为 1350 帧。标题先退场再入场，避免中文文字叠在一起。所有场景状态由帧数计算，知识节点采用固定布局，不使用 CSS 时间动画或非固定随机数。

## 素材与表达

`public/product/manifest.json` 记录八张真实演示界面的来源组件。演示项目为「Mip-Splatting 复现」，全部采用本地模拟数据。片中 AI 协作与团队通讯保持区分，科研流程先核验来源再晋升共享记忆。动画展示的是产品流程，不代表真实联网请求的耗时或当前研究结论的独立验证结果。

字体优先 Segoe UI 和 Microsoft YaHei；换到其他系统时请安装可用中文字体并重新抽帧确认字形。配乐 PCM 为 48 kHz 双声道，数值峰值约 0.415，首尾淡入淡出；已执行采样与峰值检测，未进行人工听觉审音。

## 验证记录

TypeScript 与 ESLint 检查通过；六段关键帧及转场抽帧已经审阅。最终成片已通过 FFmpeg 全帧解码。最终影片的参数由 `out/verification.json` 给出；播放器的具体兼容验证记录见 `out/delivery-notes.md`。

## 制作范围

新增独立 `video/`，业务前端与后端不做改动。
