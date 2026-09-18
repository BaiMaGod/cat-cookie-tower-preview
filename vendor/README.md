# Three.js 本地离线依赖（可选）

游戏默认会先尝试读取本目录中的 `three.module.js`，读取不到时再自动尝试 jsDelivr 和 unpkg。

如果需要完全离线运行，请从 **Three.js r186 / 0.186.0** 的官方 `build/` 目录中同时复制：

- `three.module.js`
- `three.core.js`

到当前 `vendor/` 目录。r186 的 `three.module.js` 会相对导入 `./three.core.js`，所以两个文件缺一不可。

Three.js 使用 MIT License。
