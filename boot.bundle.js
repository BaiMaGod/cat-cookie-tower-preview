/* cat-cookie-tower preview | source 3552a1f8 | web a3657a77d9e4 */
const loadingEl = document.getElementById('loading');
const startBtn = document.getElementById('startBtn');
let gameReady = false;
let startQueued = false;

function queueStart(event) {
  if (gameReady) return;
  event.stopImmediatePropagation();
  startQueued = true;
  loadingEl.classList.remove('hidden');
}

startBtn.addEventListener('click', queueStart, true);
globalThis.addEventListener('cat-game-ready', () => {
  gameReady = true;
  clearTimeout(startupTimeout);
  startBtn.removeEventListener('click', queueStart, true);
  loadingEl.classList.add('hidden');
  if (startQueued) startBtn.click();
}, { once: true });

// The title screen needs no WebGL textures. Show it while the game loads.
loadingEl.classList.add('hidden');
globalThis.CatAndroidLifecycle ||= {
  active: true,
  setActive(active) { this.active = !!active; },
};

const sources = [
  { src: './vendor/three.module.js', timeout: 6000 },
  { src: 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js', timeout: 3500 },
  { src: 'https://unpkg.com/three@0.186.0/build/three.module.js', timeout: 3500 },
];

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} 加载超时`)), ms)),
  ]);
}

async function loadThree() {
  const errors = [];
  for (const { src, timeout } of sources) {
    try {
      const mod = await withTimeout(import(src), timeout, src);
      if (mod?.Scene && mod?.WebGLRenderer) return mod;
      throw new Error('模块缺少 Three.js 核心导出');
    } catch (err) {
      errors.push(`${src}: ${err?.message || err}`);
    }
  }
  throw new Error(errors.join('\n'));
}

function escapeHTML(value) {
  return String(value).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function showBootError(err) {
  loadingEl?.classList.remove('hidden');
  const card = loadingEl?.querySelector('.loader-card');
  if (!card) return;
  card.innerHTML = `
    <div class="cat-mark">😿🍪</div>
    <h1>游戏加载失败</h1>
    <p>请检查网络连接与游戏资源是否完整，然后刷新页面重试。</p>
    <details style="text-align:left;font-size:12px;opacity:.72;max-height:150px;overflow:auto"><summary>错误详情</summary><pre style="white-space:pre-wrap">${escapeHTML(err?.message || err)}</pre></details>`;
}

const startupTimeout = setTimeout(() => {
  if (!gameReady) showBootError(new Error('游戏初始化超时，请检查网络后刷新页面重试。'));
}, 45000);

try {
  globalThis.__THREE__ = await loadThree();
  await import('./game.bundle.js?v=a3657a77d9e4');
} catch (err) {
  console.error(err);
  showBootError(err);
}
