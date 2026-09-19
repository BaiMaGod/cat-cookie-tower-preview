const loadingEl = document.getElementById('loading');

const sources = [
  { src: './vendor/three.module.js', timeout: 700 },
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
  const card = loadingEl?.querySelector('.loader-card');
  if (!card) return;
  card.innerHTML = `
    <div class="cat-mark">😿🍪</div>
    <h1>Three.js 加载失败</h1>
    <p>请确认电脑可以访问网络，或把同一版本的 <code>three.module.js</code> 和 <code>three.core.js</code> 一起放进项目的 <code>vendor/</code> 目录后刷新。</p>
    <details style="text-align:left;font-size:12px;opacity:.72;max-height:150px;overflow:auto"><summary>错误详情</summary><pre style="white-space:pre-wrap">${escapeHTML(err?.message || err)}</pre></details>`;
}

try {
  globalThis.__THREE__ = await loadThree();
  await import('./main.js?v=238');
} catch (err) {
  console.error(err);
  showBootError(err);
}
