# 验证记录

## 已通过

- `node --check src/boot.js`
- `node --check src/main.js`
- `node --check src/logic.mjs`
- `node tests/logic.test.mjs`
- 本地 HTTP 静态服务器 smoke test：HTML、CSS、启动器、主逻辑、规则模块均返回 HTTP 200。

核心自动测试包括：

- 起跳 -1
- 穿层 +1
- 单层循环净变化 0
- 连穿 3 层净赚 2
- 0 跳饿瘪
- 危险区立即失败
- 最大 10 跳封顶与满腹溢出得分
- Reset 恢复初始状态
- 前 8 层无危险区
- 低跳数时缺口放宽
- 跨 0° 圆弧判定

## 当前环境限制

执行容器无法正常从公网加载 Three.js，同时容器内 Chromium headless 进程无法稳定结束，因此本次没有宣称完成真实 WebGL 画面验收。

项目启动器已做三段式加载：

1. 本地 `vendor/three.module.js`
2. jsDelivr
3. unpkg

如果完全离线运行，请同时将 Three.js r186 的 `three.module.js` 与 `three.core.js` 放入 `vendor/`。
