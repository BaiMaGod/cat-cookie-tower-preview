const STORAGE_KEY = 'cat-tower.language.v1';

const STRINGS = {
  zh: {
    revive: '看广告复活', adLoading: '广告加载中…', adCancelled: '看完广告才能复活哦',
    adFailed: '广告暂不可用，请稍后重试', adUnavailable: '当前平台暂不支持广告复活',
    title: '猫猫果冻塔', labTitle: '果冻材质小样 · 猫猫果冻塔',
    gameAria: '左右拖动旋转果冻塔', depth: '层数', jumps: '弹跳', score: '分数',
    combo: '连吃 ×{count}',
    guideKicker: '小爪爪，准备好了吗？', guideMain: '左右滑动，转动果冻塔',
    guideDetail: '找准缺口，让猫猫一路往下跳', guideReward: '连吃果冻，补充弹跳',
    guideSmash: '连坠满5层，可砸穿果冻。',
    resultKicker: '本 次 冒 险 结 束', starvedTitle: '没力气啦！',
    starvedText: '少空跳，多追连续缺口，吃掉果冻就能补充弹跳次数。',
    hazardTitle: '被毒果冻困住啦', hazardText: '黏住了小爪爪，跳不起来了…',
    resultDepth: '下降层数', resultCombo: '最高连吃', resultScore: '得分',
    depthValue: '{count} 层', restart: '再来一次', home: '返回首页',
    leaderboard: '排行榜', share: '分享', achievements: '成就',
    shareRecord: '分享新纪录', shareAchievement: '分享成就', newRecord: '🎉 打破新纪录！',
    newAchievement: '🏅 解锁 {count} 项新成就！', recordAndAchievement: '🎉 新纪录 · 解锁 {count} 项新成就！',
    leaderboardLoading: '正在打开排行榜…', leaderboardFailed: '排行榜暂时打不开，请稍后重试',
    homeAria: '猫猫果冻塔首页', homeTitleAlt: '猫猫果冻塔，越掉越甜，越深越惊喜',
    openSettings: '打开设置', start: '开始游戏', closeSettings: '关闭设置',
    bestRecord: '历史最高记录', bestScore: '最高分', bestDepth: '最深层数',
    settingsTitle: '游戏设置', settingsHelp: '左右滑动旋转果冻塔，让胖猫从缺口落下。穿过果冻可以补充弹跳次数，避开粉红色危险果冻。',
    settingsSmash: '连坠满5层后，下一次触碰可砸穿果冻，包括毒果冻。',
    language: '语言', homeMotion: '首页动画', sound: '游戏音效', done: '完成',
    loading: '正在进入果冻乐园……', plusOne: '+1 弹跳', smash: '砸碎！',
    powerupBurst: '暴走爪', powerupShield: '泡泡盾', powerupEnergy: '活力布丁',
    powerupBurstHint: '3秒内砸碎所有果冻，毒果冻也不怕！',
    powerupShieldHint: '抵挡一次毒果冻，并砸开脚下这一层。',
    powerupEnergyHint: '立即获得3000分。',
    powerupShieldBreak: '护盾挡住了！', powerupShieldBreakHint: '毒果冻砸开啦，继续冲！',
    powerupShieldDuplicate: '护盾已备好', powerupTime: '{seconds}秒', powerupCharge: '1次',
    powerupEnergyResult: '+{count} 弹跳', powerupScoreResult: '+{score} 分',
    powerupEnergyOverflow: '+{count} 弹跳 · +{score} 分',
    powerupHelp: '碰到悬浮甜点，马上获得道具！',
    materialGroup: '平台材质', materialSummary: '材质 · {name}', materialLabLink: '打开材质小样 ↗',
    materialSaved: '已记住选择', materialUrl: '本次选择已保存在页面地址中',
    presetJelly: '透明果冻', presetJellyDescription: '鲜亮青提 · 软糖猫爪',
    presetClassic: '原版糖块', presetClassicDescription: '保留原版，随时对照',
    presetPudding: '奶油布丁', presetPuddingDescription: '柔和奶绿 · 草莓粉',
    bootErrorTitle: '游戏加载失败', bootErrorText: '请检查网络连接与游戏资源是否完整，然后刷新页面重试。',
    errorDetails: '错误详情', startupTimeout: '游戏初始化超时，请检查网络后刷新页面重试。',
    loadTimeout: '{label} 加载超时', threeMissing: '模块缺少 Three.js 核心导出',
    assetError: '素材加载失败：{url}', labError: '小样加载失败：{error}。请通过 start.bat 启动后重试。',
    labBack: '‹ 返回游戏', labHeader: '猫猫果冻塔 / 材质小样', labPreviewAria: '果冻材质交互预览',
    labLive: '实时小样', labDrag: '左右拖动，看看不同角度的反光', labLoading: '正在准备果冻小样……',
    labReference: '素材参考', labSafe: '绿色果冻', labDanger: '毒果冻',
    labSafeAlt: '用户提供的绿色果冻参考素材', labDangerAlt: '带奶油白圆角叉号的毒果冻参考素材',
    labSpecimenAria: '查看的果冻类型', labEyebrow: '甜 品 研 究 室',
    labHeading1: '一层果冻，', labHeading2: '试试不同口感。',
    labIntro1: '先看清透感，再试试回弹。', labIntro2: '绿色是安全区，莓红色是毒果冻。',
    labClean: '干净背景', labSolo: '单块细看', labRotate: '自动旋转', labStack: '多层对照',
    labGrid: '格纹背景，看清透射', labBounce: '轻轻压一下 · 看回弹',
    labNoBounce: '毒果冻 · 不回弹', labApply: '应用到游戏 →',
    labStatus: '小样中的切换不会立即改变游戏。',
    labNote: '当前展示分块压缩回弹。局部凹陷与毒果冻包裹将在材质确定后继续细化。',
  },
  en: {
    revive: 'Watch Ad to Revive', adLoading: 'Loading ad…', adCancelled: 'Finish the ad to revive',
    adFailed: 'Ad unavailable. Please retry later.', adUnavailable: 'Ad revival is unavailable',
    title: 'Jelly Cat Tower', labTitle: 'Jelly Lab · Jelly Cat Tower',
    gameAria: 'Drag left or right to rotate the jelly tower', depth: 'LEVEL', jumps: 'BOUNCE', score: 'SCORE',
    combo: 'COMBO ×{count}',
    guideKicker: 'Ready, little paws?', guideMain: 'Swipe to spin the jelly tower',
    guideDetail: 'Find the gaps and keep the cat falling', guideReward: 'Eat jelly to gain a bounce',
    guideSmash: 'Drop 5 levels in a row to smash jelly.',
    resultKicker: 'ADVENTURE OVER', starvedTitle: 'Out of bounces!',
    starvedText: 'Find gaps quickly. Eat jelly to regain bounces.',
    hazardTitle: 'Stuck in poison jelly!', hazardText: 'Those sticky paws cannot jump now.',
    resultDepth: 'Levels dropped', resultCombo: 'Best combo', resultScore: 'Score',
    depthValue: '{count}', restart: 'Play Again', home: 'Back to Home',
    leaderboard: 'Leaderboard', share: 'Share', achievements: 'Achievements',
    shareRecord: 'Share Record', shareAchievement: 'Share Achievement', newRecord: '🎉 New personal best!',
    newAchievement: '🏅 {count} new achievements!', recordAndAchievement: '🎉 New best · {count} new achievements!',
    leaderboardLoading: 'Opening leaderboard…', leaderboardFailed: 'Could not open the leaderboard. Please retry.',
    homeAria: 'Jelly Cat Tower home screen', homeTitleAlt: 'Jelly Cat Tower — drop, bounce and snack',
    openSettings: 'Open settings', start: 'Start game', closeSettings: 'Close settings',
    bestRecord: 'PERSONAL BEST', bestScore: 'BEST SCORE', bestDepth: 'DEEPEST',
    settingsTitle: 'Game Settings', settingsHelp: 'Swipe left or right to spin the tower. Drop through gaps to regain bounces. Avoid the pink poison jelly.',
    settingsSmash: 'Drop 5 levels in a row to charge a smash. Your next hit breaks through jelly, including poison jelly.',
    language: 'Language', homeMotion: 'Home animation', sound: 'Game sounds', done: 'Done',
    loading: 'Entering Jelly Land…', plusOne: '+1 BOUNCE', smash: 'SMASH!',
    powerupBurst: 'Paw Frenzy', powerupShield: 'Bubble Shield', powerupEnergy: 'Energy Pudding',
    powerupBurstHint: 'Smash every jelly for 3 seconds, including poison!',
    powerupShieldHint: 'Block one poison hit and smash through that layer.',
    powerupEnergyHint: 'Gain 3,000 points instantly.',
    powerupShieldBreak: 'Shield saved you!', powerupShieldBreakHint: 'Poison smashed. Keep going!',
    powerupShieldDuplicate: 'Shield is ready', powerupTime: '{seconds}s', powerupCharge: '1 hit',
    powerupEnergyResult: '+{count} BOUNCES', powerupScoreResult: '+{score} POINTS',
    powerupEnergyOverflow: '+{count} BOUNCES · +{score} POINTS',
    powerupHelp: 'Touch a floating treat to grab a powerup!',
    materialGroup: 'Platform material', materialSummary: 'Style · {name}', materialLabLink: 'Open Jelly Lab ↗',
    materialSaved: 'Selection saved', materialUrl: 'Selection stored in the page URL',
    presetJelly: 'Clear Jelly', presetJellyDescription: 'Grape glow · candy paws',
    presetClassic: 'Classic Candy', presetClassicDescription: 'The original candy look',
    presetPudding: 'Cream Pudding', presetPuddingDescription: 'Soft green · strawberry pink',
    bootErrorTitle: 'Game failed to load', bootErrorText: 'Check your connection and game files, then reload.',
    errorDetails: 'Error details', startupTimeout: 'Game startup timed out. Please reload.',
    loadTimeout: '{label} timed out', threeMissing: 'Three.js core exports are missing',
    assetError: 'Failed to load asset: {url}', labError: 'Jelly Lab failed to load: {error}. Please restart the local server and try again.',
    labBack: '‹ Back to Game', labHeader: 'Jelly Cat Tower / Jelly Lab', labPreviewAria: 'Interactive jelly material preview',
    labLive: 'Live preview', labDrag: 'Drag left or right to see the reflections', labLoading: 'Preparing Jelly Lab…',
    labReference: 'Art reference', labSafe: 'Safe jelly', labDanger: 'Poison jelly',
    labSafeAlt: 'Original safe jelly art reference', labDangerAlt: 'Poison jelly art reference with a cream rounded X',
    labSpecimenAria: 'Choose jelly type', labEyebrow: 'JELLY LAB',
    labHeading1: 'One jelly layer,', labHeading2: 'three sweet styles.',
    labIntro1: 'Explore the shine and test the bounce.', labIntro2: 'Green is safe; pink is poison.',
    labClean: 'Clean background', labSolo: 'Single piece', labRotate: 'Auto rotate', labStack: 'Compare layers',
    labGrid: 'Grid background for refraction', labBounce: 'Give it a bounce',
    labNoBounce: 'Poison jelly · no bounce', labApply: 'Use in Game →',
    labStatus: 'Lab selections do not change the game until applied.',
    labNote: 'This preview shows compression and bounce. Local dents and poison wrapping are still in development.',
  },
};

function initialLocale() {
  const requested = new URLSearchParams(location.search).get('lang');
  if (requested === 'zh' || requested === 'en') return requested;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'zh' || stored === 'en') return stored;
  } catch { /* Storage can be unavailable in private contexts. */ }
  return /^zh\b/i.test(navigator.language) ? 'zh' : 'en';
}

let locale = initialLocale();
export function getLocale() { return locale; }
export function t(key, values = {}) {
  const template = STRINGS[locale][key];
  if (template === undefined) throw new Error(`Missing ${locale} translation: ${key}`);
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}
export function applyTranslations() {
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  document.title = t(location.pathname.endsWith('material-lab.html') ? 'labTitle' : 'title');
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const el of document.querySelectorAll('[data-i18n-alt]')) el.alt = t(el.dataset.i18nAlt);
  for (const el of document.querySelectorAll('[data-i18n-image]')) {
    const prefix = el.dataset.i18nImagePrefix ?? 'home-';
    el.src = `./assets/${prefix}${el.dataset.i18nImage}${locale === 'en' ? '-en' : ''}.png`;
  }
  const language = document.getElementById('languageSelect');
  if (language) language.value = locale;
  document.dispatchEvent(new CustomEvent('cat-language-change', { detail: { locale } }));
}
export function setLocale(next) {
  if (next !== 'zh' && next !== 'en') throw new Error(`Unsupported language: ${next}`);
  locale = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Keep this session's selection. */ }
  const url = new URL(location.href);
  if (url.searchParams.has('lang')) {
    url.searchParams.set('lang', next);
    history.replaceState(null, '', url);
  }
  applyTranslations();
}
