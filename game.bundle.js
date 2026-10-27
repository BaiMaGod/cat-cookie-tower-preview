/* cat-cookie-tower preview | compiled base a289010e | role rename from dad5e22b | web 420b31c4fd6e */

// src/drag-input.mjs?v=420b31c4fd6e
function bindDragInput(element, { onStart, onMove, onEnd, runtime = globalThis, diagnostics } = {}) {
  const doc = element.ownerDocument || runtime.document;
  const pointer = typeof runtime.PointerEvent === "function";
  let active = null;
  const listeners = [];
  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  }
  function point(event, id) {
    return { clientX: event.clientX, clientY: event.clientY, pointerId: id };
  }
  function end() {
    if (active === null) return;
    const id = active;
    active = null;
    if (pointer) {
      try {
        if (element.hasPointerCapture?.(id)) element.releasePointerCapture(id);
      } catch {
      }
    }
    onEnd?.({ pointerId: id });
  }
  function begin(event, id) {
    if (active !== null || onStart?.(point(event, id)) === false) return false;
    active = id;
    return true;
  }
  if (pointer) {
    listen(element, "pointerdown", (event) => {
      if (event.button !== void 0 && event.button !== 0) return;
      if (begin(event, event.pointerId)) {
        try {
          element.setPointerCapture?.(event.pointerId);
        } catch {
        }
      }
    });
    listen(runtime, "pointermove", (event) => {
      if (active === event.pointerId) onMove?.(point(event, active));
    });
    for (const type of ["pointerup", "pointercancel"]) listen(runtime, type, (event) => {
      if (active === event.pointerId) end();
    });
    listen(element, "lostpointercapture", (event) => {
      if (active === event.pointerId) end();
    });
  } else {
    let touch = function(event, list = "changedTouches") {
      return Array.from(event[list] || []).find((item) => item.identifier === active);
    };
    listen(element, "touchstart", (event) => {
      if (active !== null) return;
      const first = event.changedTouches[0];
      if (first && begin(first, first.identifier) && event.cancelable) event.preventDefault();
    }, { passive: false });
    listen(runtime, "touchmove", (event) => {
      const current = touch(event);
      if (active !== null && current) {
        if (event.cancelable) event.preventDefault();
        onMove?.(point(current, active));
      }
    }, { passive: false });
    for (const type of ["touchend", "touchcancel"]) listen(runtime, type, (event) => {
      if (active !== null && touch(event)) end();
    });
    let mouseAllowedAt = 0;
    listen(element, "touchstart", () => {
      mouseAllowedAt = Date.now() + 1e3;
    }, { passive: true });
    listen(element, "mousedown", (event) => {
      if (event.button === 0 && Date.now() >= mouseAllowedAt) begin(event, "mouse");
    });
    listen(runtime, "mousemove", (event) => {
      if (active === "mouse") onMove?.(point(event, active));
    });
    listen(runtime, "mouseup", () => {
      if (active === "mouse") end();
    });
  }
  listen(runtime, "blur", end);
  listen(doc, "visibilitychange", () => {
    if (doc.hidden) end();
  });
  diagnostics?.capability("输入", pointer ? "Pointer Events" : "Touch Events＋鼠标");
  return { cancel: end, dispose() {
    end();
    for (const remove of listeners) remove();
  } };
}

// src/texture-loader.mjs?v=420b31c4fd6e
function loadTextureWithRetry(THREE6, loader, url, { timeoutMs = 12e3, retries = 1, diagnostics } = {}) {
  const texture = new THREE6.Texture();
  const finish = diagnostics?.assetStart(url);
  const ready = new Promise((resolve, reject) => {
    let settled = false, attempt = 0;
    function load() {
      const current = ++attempt;
      let completed = false;
      function failed() {
        if (completed || settled) return;
        completed = true;
        clearTimeout(timer);
        if (current <= retries) {
          diagnostics?.note("重试图片：" + url.split("/").pop());
          load();
        } else {
          settled = true;
          const error = new Error("图片加载失败：" + url);
          finish?.(error);
          reject(error);
        }
      }
      const timer = setTimeout(failed, timeoutMs);
      const request = current === 1 ? url : url + (url.includes("?") ? "&" : "?") + "cat-retry=" + current;
      try {
        const requestTexture = loader.load(request, (imageTexture) => {
          if (completed || settled) {
            imageTexture.dispose();
            return;
          }
          completed = true;
          settled = true;
          clearTimeout(timer);
          texture.image = imageTexture.image;
          texture.needsUpdate = true;
          imageTexture.dispose();
          finish?.();
          resolve(texture);
        }, void 0, failed);
        if (requestTexture !== texture) requestTexture.dispose();
      } catch {
        failed();
      }
    }
    load();
  });
  ready.catch(() => {
  });
  return { texture, ready };
}

// src/cat-feedback.mjs?v=420b31c4fd6e
function catScaleForJumps(jumps, maxJumps) {
  return 0.68 + 0.3 * Math.max(0, Math.min(1, jumps / maxJumps));
}
function followCatScale(current, target, dt) {
  if (dt <= 0) return target;
  const rate = target > current ? 0.85 : 14;
  return target + (current - target) * Math.exp(-rate * dt);
}

// src/ad-config.mjs?v=420b31c4fd6e
var AD_CONFIG = Object.freeze({
  timeoutMs: 12e4,
  wechat: Object.freeze({ enabled: true, adUnitId: "" }),
  "taptap-h5": Object.freeze({ enabled: true, adUnitId: "1054324" })
});

// src/ad-video.mjs?v=420b31c4fd6e
function createVideoAdapter(api, config) {
  let ad = null, pending = null, destroyed = false;
  const supported = () => !destroyed && config.enabled === true && typeof config.adUnitId === "string" && config.adUnitId.trim().length > 0 && typeof api?.createRewardedVideoAd === "function";
  function finish(status) {
    if (!pending) return;
    const request = pending;
    pending = null;
    clearTimeout(request.timer);
    request.resolve({ status });
  }
  const onClose = (result) => finish(result?.isEnded === true ? "completed" : "cancelled");
  const onError = () => finish("failed");
  function cleanup() {
    ad?.offClose?.(onClose);
    ad?.offError?.(onError);
    ad?.destroy?.();
    ad = null;
  }
  function initialize() {
    if (ad) return;
    const instance = api.createRewardedVideoAd({ adUnitId: config.adUnitId.trim() });
    if (!instance || ["show", "load", "onClose", "onError"].some((name) => typeof instance[name] !== "function")) {
      instance?.destroy?.();
      throw new Error("Rewarded video API is incomplete");
    }
    ad = instance;
    ad.onClose(onClose);
    ad.onError(onError);
  }
  return {
    isAvailable: supported,
    async preload() {
      if (!supported()) return false;
      try {
        initialize();
        await ad.load();
        return true;
      } catch {
        return false;
      }
    },
    show() {
      if (!supported()) return Promise.resolve({ status: "unavailable" });
      if (pending) return Promise.resolve({ status: "busy" });
      try {
        initialize();
      } catch {
        cleanup();
        return Promise.resolve({ status: "failed" });
      }
      return new Promise((resolve) => {
        const request = { resolve, timer: null };
        pending = request;
        request.timer = setTimeout(() => {
          destroyed = true;
          finish("failed");
          cleanup();
        }, config.timeoutMs);
        Promise.resolve().then(() => ad.show()).catch(async () => {
          if (pending !== request) return;
          await ad.load();
          if (pending === request) await ad.show();
        }).catch(() => {
          if (pending === request) finish("failed");
        });
      });
    },
    destroy() {
      destroyed = true;
      finish("cancelled");
      cleanup();
    }
  };
}

// src/ad-wechat.mjs?v=420b31c4fd6e
function createWechatAdAdapter(wx, config) {
  return createVideoAdapter(wx, config);
}

// src/ad-taptap-h5.mjs?v=420b31c4fd6e
function createTaptapH5AdAdapter(tap, config) {
  const adapter = createVideoAdapter(tap, config);
  void adapter.preload();
  return adapter;
}

// src/ads.mjs?v=420b31c4fd6e
function createAdService({ runtime = globalThis, platform, api, config = runtime.__CAT_AD_CONFIG__ } = {}) {
  const detected = platform ?? (runtime.__CAT_PLATFORM__ === "taptap-h5" || runtime.document && runtime.tap ? "taptap-h5" : !runtime.document && runtime.wx && !runtime.tt ? "wechat" : "unsupported");
  const settings = {
    ...AD_CONFIG[detected],
    ...config?.[detected],
    timeoutMs: config?.timeoutMs ?? AD_CONFIG.timeoutMs
  };
  const adapter = detected === "wechat" ? createWechatAdAdapter(api ?? runtime.wx, settings) : detected === "taptap-h5" ? createTaptapH5AdAdapter(api ?? runtime.tap, settings) : null;
  return {
    platform: detected,
    isAvailable: () => adapter?.isAvailable() ?? false,
    showRewarded: () => adapter?.show() ?? Promise.resolve({ status: "unavailable" }),
    destroy: () => adapter?.destroy()
  };
}

// src/tap-services.mjs?v=420b31c4fd6e
var ARCHIVE_NAME = "cat-tower-best-record";
var LEADERBOARDS = {
  score: "so2knc1s4zz28ep6n0",
  // 开发者中心-游戏服务-排行榜：单局最高分
  depth: "8c7azipx059kz2dvx2"
  // 单局最深层数
};
var ACHIEVEMENTS = [
  // 下落层数：100 / 1,000 / 10,000 / 100,000 / 1,000,000 层
  { id: "fall_100", metric: "depth", threshold: 100 },
  { id: "fall_1000", metric: "depth", threshold: 1e3 },
  { id: "fall_10000", metric: "depth", threshold: 1e4 },
  { id: "fall_100000", metric: "depth", threshold: 1e5 },
  { id: "fall_1000000", metric: "depth", threshold: 1e6 },
  // 单局最高连吃：×10 / ×20 / ×30 / ×40 / ×50
  { id: "combo_10", metric: "bestCombo", threshold: 10 },
  { id: "combo_20", metric: "bestCombo", threshold: 20 },
  { id: "combo_30", metric: "bestCombo", threshold: 30 },
  { id: "combo_40", metric: "bestCombo", threshold: 40 },
  { id: "combo_50", metric: "bestCombo", threshold: 50 },
  // 单局得分：10,000 / 100,000 / 1,000,000 / 10,000,000 / 100,000,000
  { id: "score_10000", metric: "score", threshold: 1e4 },
  { id: "score_100000", metric: "score", threshold: 1e5 },
  { id: "score_1000000", metric: "score", threshold: 1e6 },
  { id: "score_10000000", metric: "score", threshold: 1e7 },
  { id: "score_100000000", metric: "score", threshold: 1e8 }
];
var SHARE_TEMPLATES = { record: "", achievement: "" };
var ARCHIVE_KEY = "cat-tower.cloud-archive.v1";
var UNLOCKED_KEY = "cat-tower.achievements.v1";
var ARCHIVE_FILE = "best-record.json";
var CLOUD_SAVE_INTERVAL_MS = 65e3;
var SCENE_INTERACTIVE = 7;
function safeStorage(runtime) {
  try {
    const s = runtime?.localStorage;
    if (typeof s?.getItem === "function" && typeof s?.setItem === "function") return s;
  } catch {
  }
  const map = /* @__PURE__ */ new Map();
  return {
    getItem: (key2) => map.has(key2) ? map.get(key2) : null,
    setItem: (key2, value) => {
      map.set(key2, String(value));
    },
    removeItem: (key2) => {
      map.delete(key2);
    }
  };
}
function loadJson(storage, key2) {
  try {
    return JSON.parse(storage.getItem(key2) || "null");
  } catch {
    return null;
  }
}
function createTapServices({
  runtime = globalThis,
  storage = safeStorage(runtime),
  leaderboards = LEADERBOARDS,
  achievements = ACHIEVEMENTS,
  shareTemplateId = "",
  shareTemplates = SHARE_TEMPLATES,
  onShareMoment = () => {
  },
  callbackTimeoutMs = 12e3,
  now = () => Date.now()
} = {}) {
  const api = runtime.tap;
  const supports = Object.freeze({
    login: typeof api?.login === "function",
    leaderboard: typeof api?.getLeaderboardManager === "function",
    cloudSave: typeof api?.getCloudSaveManager === "function" && typeof api?.getFileSystemManager === "function" && typeof api?.env?.USER_DATA_PATH === "string",
    achievement: typeof api?.createAchievementManager === "function",
    share: typeof api?.showShareboard === "function" && !!(shareTemplateId || shareTemplates.record || shareTemplates.achievement),
    sceneReport: typeof api?.reportScene === "function"
  });
  function invoke(object, name, options = {}) {
    return new Promise((resolve) => {
      try {
        object[name]({
          ...options,
          success: (result) => resolve(result ?? {}),
          fail: (err) => {
            console.warn(`tap ${name} 调用失败`, err);
            resolve(null);
          }
        });
      } catch (err) {
        console.warn(`tap ${name} 调用异常`, err);
        resolve(null);
      }
    });
  }
  function invokeWithCallback(manager, name, options = {}) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };
      const timer = setTimeout(() => {
        console.warn(`排行榜 ${name} 调用超时`);
        finish(null);
      }, callbackTimeoutMs);
      try {
        manager[name]({
          ...options,
          callback: {
            onSuccess: (result) => finish(result ?? {}),
            onFailure: (code, message) => {
              console.warn(`排行榜 ${name} 调用失败`, code, message);
              finish(null);
            }
          }
        });
      } catch (err) {
        console.warn(`排行榜 ${name} 调用异常`, err);
        finish(null);
      }
    });
  }
  let leaderboardManager = null;
  function getLeaderboardManager() {
    if (!supports.leaderboard) return null;
    if (!leaderboardManager) {
      try {
        leaderboardManager = api.getLeaderboardManager();
      } catch (err) {
        console.warn("获取排行榜管理器失败", err);
      }
    }
    return leaderboardManager;
  }
  let cloudSaveManager = null;
  function getCloudSaveManager() {
    if (!supports.cloudSave) return null;
    if (!cloudSaveManager) {
      try {
        cloudSaveManager = api.getCloudSaveManager();
      } catch (err) {
        console.warn("获取云存档管理器失败", err);
      }
    }
    return cloudSaveManager;
  }
  let achievementManager = null;
  let achievementListenerBound = false;
  const unlocked = new Set(loadJson(storage, UNLOCKED_KEY) || []);
  const inFlight = /* @__PURE__ */ new Set();
  const unlockRuns = /* @__PURE__ */ new Map();
  let runId = 0;
  const runAchievements = /* @__PURE__ */ new Set();
  function beginRun() {
    runId++;
    runAchievements.clear();
  }
  function getShareMoment(newRecord = false) {
    const kind = newRecord ? "record" : runAchievements.size ? "achievement" : null;
    const templateId = kind && (shareTemplates[kind] || shareTemplateId);
    return kind && templateId && supports.share ? { kind, templateId, achievementIds: [...runAchievements] } : null;
  }
  const persistUnlocked = () => {
    try {
      storage.setItem(UNLOCKED_KEY, JSON.stringify([...unlocked]));
    } catch {
    }
  };
  function ensureAchievementManager() {
    if (!supports.achievement) return null;
    if (!achievementManager) {
      try {
        achievementManager = api.createAchievementManager({ toastEnable: true });
      } catch (err) {
        console.warn("创建成就管理器失败", err);
        return null;
      }
    }
    if (!achievementListenerBound) {
      try {
        achievementManager.registerListener({
          // 解锁结果只通过监听器返回：成功后才写本地缓存，失败保留待下次重试。
          onAchievementSuccess: (code, achievement) => {
            const id = achievement?.achievementId;
            if (id && inFlight.has(id)) {
              const isNew = !unlocked.has(id);
              unlocked.add(id);
              inFlight.delete(id);
              persistUnlocked();
              if (isNew && unlockRuns.get(id) === runId) {
                runAchievements.add(id);
                onShareMoment();
              }
              unlockRuns.delete(id);
            }
          },
          onAchievementFailure: (id, code, msg) => {
            inFlight.delete(id);
            console.warn("成就操作失败", id, code, msg);
          }
        });
        achievementListenerBound = true;
      } catch (err) {
        console.warn("注册成就监听失败", err);
      }
    }
    return achievementManager;
  }
  function tryUnlock(id) {
    if (!id || unlocked.has(id) || inFlight.has(id)) return;
    const manager = ensureAchievementManager();
    if (!manager || !achievementListenerBound) return;
    inFlight.add(id);
    unlockRuns.set(id, runId);
    try {
      manager.unlockAchievement({ achievementId: id });
    } catch (err) {
      inFlight.delete(id);
      console.warn("解锁成就异常", id, err);
    }
  }
  function notifyProgress({ depth = 0, bestCombo = 0, score = 0 } = {}) {
    if (!supports.achievement) return;
    const metrics = { depth, bestCombo, score };
    for (const { id, metric, threshold } of achievements) {
      if (id && (metrics[metric] ?? 0) >= threshold) tryUnlock(id);
    }
  }
  function showAchievements() {
    const manager = ensureAchievementManager();
    if (!manager) return;
    try {
      manager.showAchievements();
    } catch (err) {
      console.warn("打开成就界面失败", err);
    }
  }
  function submitBestRecords(record) {
    const manager = getLeaderboardManager();
    if (!manager) return Promise.resolve(false);
    const scores = [
      leaderboards.score && { leaderboardId: leaderboards.score, score: Math.round(record.score || 0) },
      leaderboards.depth && { leaderboardId: leaderboards.depth, score: Math.round(record.depth || 0) }
    ].filter(Boolean);
    if (!scores.length) return Promise.resolve(false);
    return invokeWithCallback(manager, "submitScores", { scores }).then(() => true);
  }
  function openLeaderboard(which = "score") {
    const manager = getLeaderboardManager();
    const id = leaderboards[which];
    if (!manager || !id) return Promise.resolve(false);
    return invokeWithCallback(manager, "openLeaderboard", {
      leaderboardId: id,
      collection: "public"
      // 好友榜需要额外隐私授权，统一展示总榜
    }).then((res) => !!res);
  }
  let lastSaveAt = 0;
  let pendingRecord = null;
  let pendingTimer = null;
  const readArchiveCache = () => loadJson(storage, ARCHIVE_KEY);
  const writeArchiveCache = (info) => {
    try {
      if (info) storage.setItem(ARCHIVE_KEY, JSON.stringify(info));
      else storage.removeItem(ARCHIVE_KEY);
    } catch {
    }
  };
  function saveRecord(record) {
    if (!supports.cloudSave || !record) return Promise.resolve(false);
    const elapsed = now() - lastSaveAt;
    if (lastSaveAt && elapsed < CLOUD_SAVE_INTERVAL_MS) {
      pendingRecord = record;
      if (pendingTimer === null && typeof runtime?.setTimeout === "function") {
        pendingTimer = runtime.setTimeout(() => {
          pendingTimer = null;
          const pending = pendingRecord;
          pendingRecord = null;
          if (pending) return saveRecord(pending);
        }, Math.max(1e3, CLOUD_SAVE_INTERVAL_MS - elapsed));
      }
      return Promise.resolve(false);
    }
    const manager = getCloudSaveManager();
    if (!manager) return Promise.resolve(false);
    let fileSystem = null;
    try {
      fileSystem = api.getFileSystemManager();
    } catch (err) {
      console.warn("获取文件系统失败", err);
    }
    if (!fileSystem || typeof fileSystem.writeFile !== "function") return Promise.resolve(false);
    const filePath = `${api.env.USER_DATA_PATH}/${ARCHIVE_FILE}`;
    return invoke(fileSystem, "writeFile", { filePath, data: JSON.stringify(record), encoding: "utf8" }).then((written) => {
      if (!written) return false;
      const archiveMetaData = {
        name: ARCHIVE_NAME,
        summary: `best ${record.score || 0} pts · depth ${record.depth || 0}`,
        extra: JSON.stringify(record)
        // extra 随列表直接返回，恢复时无需再下载存档文件
      };
      const cached = readArchiveCache();
      if (cached?.uuid) {
        return invoke(manager, "updateArchive", { archiveUUID: cached.uuid, archiveMetaData, archiveFilePath: filePath }).then((res) => {
          if (!res) return false;
          lastSaveAt = now();
          if (res.fileId && res.fileId !== cached.fileId) writeArchiveCache({ ...cached, fileId: res.fileId });
          return true;
        });
      }
      return invoke(manager, "createArchive", { archiveMetaData, archiveFilePath: filePath }).then((res) => {
        if (!res?.uuid) return false;
        lastSaveAt = now();
        writeArchiveCache({ uuid: res.uuid, fileId: res.fileId });
        return true;
      });
    });
  }
  function restoreRecord(localRecord) {
    if (!supports.cloudSave) return Promise.resolve(null);
    const manager = getCloudSaveManager();
    if (!manager) return Promise.resolve(null);
    return invoke(manager, "getArchiveList", {}).then((res) => {
      const saves = Array.isArray(res?.saves) ? res.saves.filter((s) => s?.name === ARCHIVE_NAME && s.extra) : [];
      if (!saves.length) {
        if (readArchiveCache()) writeArchiveCache(null);
        return null;
      }
      saves.sort((a, b) => (b.modifiedTime || 0) - (a.modifiedTime || 0));
      const latest = saves[0];
      writeArchiveCache({ uuid: latest.uuid, fileId: latest.fileId });
      let cloud = null;
      try {
        cloud = JSON.parse(latest.extra);
      } catch {
      }
      if (!cloud || typeof cloud !== "object") return null;
      const score = Math.max(localRecord?.score || 0, Number(cloud.score) || 0);
      const depth = Math.max(localRecord?.depth || 0, Number(cloud.depth) || 0);
      return score > (localRecord?.score || 0) || depth > (localRecord?.depth || 0) ? { score, depth } : null;
    });
  }
  function init({ costTimeMs = 0 } = {}) {
    const tasks = [];
    if (supports.sceneReport) {
      tasks.push(invoke(api, "reportScene", {
        sceneId: SCENE_INTERACTIVE,
        costTime: Math.max(0, Math.round(costTimeMs))
      }));
    }
    if (supports.login) tasks.push(invoke(api, "login", {}));
    return Promise.all(tasks).then(() => true);
  }
  function share({ score = 0, depth = 0, newRecord } = {}) {
    const moment = newRecord === void 0 ? null : getShareMoment(newRecord);
    const templateId = moment?.templateId || (newRecord === void 0 ? shareTemplateId : "");
    if (!supports.share || !templateId) return Promise.resolve(false);
    return invoke(api, "showShareboard", {
      templateId,
      sceneParam: JSON.stringify(moment ? { score, depth, kind: moment.kind, achievementIds: moment.achievementIds } : { score, depth })
    }).then((res) => !!res);
  }
  function onGameOver({ record, newRecord = false, depth = 0, bestCombo = 0, score = 0 } = {}) {
    notifyProgress({ depth, bestCombo, score });
    if (!newRecord || !record) return Promise.resolve(false);
    return submitBestRecords(record).then(() => saveRecord(record));
  }
  return { supports, beginRun, getShareMoment, init, notifyProgress, onGameOver, openLeaderboard, showAchievements, share, restoreRecord };
}

// src/tapdb-client.mjs?v=420b31c4fd6e
var TAPDB_ENDPOINT = "https://e.tapdb.net/v2/event";
var DEVICE_KEY = "cat-tower.tapdb-device.v1";
function getOS(runtime) {
  const ua = runtime.navigator?.userAgent || "";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua) || /Mac/i.test(ua) && runtime.navigator?.maxTouchPoints > 1) return "iOS";
  if (/Mac/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  return null;
}
function createTapDbClient({ runtime = globalThis, config = {}, now = () => Date.now() } = {}) {
  let ready = false, initPromise = null, serial = Promise.resolve();
  let deviceId;
  const uuid = () => runtime.crypto.randomUUID();
  const clientId = typeof config.clientId === "string" ? config.clientId.trim() : "";
  const index = typeof config.index === "string" ? config.index.trim() : "";
  const project = index ? { index } : { client_id: clientId };
  const os = getOS(runtime);
  const enabled = !!(index || clientId) && !!os && typeof runtime.fetch === "function" && typeof runtime.crypto?.randomUUID === "function";
  function payload(name, properties) {
    return {
      ...project,
      device_id: deviceId,
      type: "track",
      name,
      properties: {
        os,
        app_version: config.appVersion || "1.0.0",
        channel: config.channel || "cat-tower-h5",
        timestamp: now(),
        event_uuid: uuid(),
        ...properties
      }
    };
  }
  async function send(event) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1e4);
    try {
      const response = await runtime.fetch(TAPDB_ENDPOINT, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        keepalive: true,
        // 实测接收端支持原始 JSON 文本并返回 ACAO:*；application/json 的预检被拒绝。
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(event),
        signal: controller.signal
      });
      const body = (await response.text()).trim();
      if (!response.ok || !["1", "", "ok", "success"].includes(body.toLowerCase())) {
        throw new Error(`TapDB 拒绝上报（${response.status}）：${body.slice(0, 160)}`);
      }
      return true;
    } finally {
      clearTimeout(timer);
    }
  }
  function init() {
    if (ready) return Promise.resolve(true);
    if (!enabled) return Promise.resolve(false);
    if (initPromise) return initPromise;
    initPromise = (async () => {
      const storage = runtime.localStorage;
      const saved = storage.getItem(DEVICE_KEY);
      deviceId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved || "") ? saved : uuid();
      storage.setItem(DEVICE_KEY, deviceId);
      await send(payload("device_login", {}));
      ready = true;
      return true;
    })().finally(() => {
      initPromise = null;
    });
    return initPromise;
  }
  function trackEvent(name, properties) {
    const event = ready ? payload(`#${name}`, Object.fromEntries(
      Object.entries(properties).map(([key2, value]) => [`#${key2}`, value])
    )) : null;
    if (!event) return Promise.reject(new Error("TapDB 设备尚未初始化"));
    const request = serial.then(() => send(event));
    serial = request.catch(() => {
    });
    return request;
  }
  return { enabled, init, trackEvent, get ready() {
    return ready;
  } };
}

// src/tapdb-config.mjs?v=420b31c4fd6e
var TAPDB_CONFIG = Object.freeze({
  clientId: "e7hqimu2rksanhucsa",
  appVersion: "1.0.0",
  channel: "cat-tower-h5"
});

// src/game-analytics.mjs?v=420b31c4fd6e
var ANALYTICS_EVENTS = Object.freeze({
  game_start: ["entry"],
  game_over: ["score", "depth", "best_combo", "reason"],
  eat_powerup: ["powerup_type", "score", "depth", "bonus_score", "jumps_added", "converted"],
  click_rewarded_ad: ["placement", "score", "depth"],
  rewarded_ad_result: ["placement", "score", "depth", "result"],
  revive_success: ["placement", "score", "depth"],
  click_leaderboard: ["entry", "leaderboard_type"],
  click_achievements: ["entry"],
  click_settings: ["entry"],
  change_setting: ["setting_name", "setting_value"],
  click_home: ["entry"],
  click_share: ["entry", "score", "depth"]
});
function createGameAnalytics({ runtime = globalThis, maxPending = 100, config = runtime.__CAT_TAPDB_CONFIG__ || TAPDB_CONFIG } = {}) {
  const queue = [];
  let warned = false;
  const isH5 = runtime.__CAT_PLATFORM__ === "taptap-h5";
  const debug = new URLSearchParams(runtime.location?.search || "").has("debug");
  const client = createTapDbClient({ runtime, config: isH5 && (!debug || config.allowDebug) ? config : {} });
  const getBridge = () => runtime.__CAT_ANALYTICS__ || client;
  async function init() {
    if (runtime.__CAT_ANALYTICS__) return flush();
    try {
      if (await client.init()) return flush();
    } catch (error) {
      console.warn("TapDB 初始化失败，业务事件暂存", error);
    }
    return false;
  }
  function flush() {
    const bridge = getBridge();
    if (bridge?.ready !== true || typeof bridge.trackEvent !== "function") return false;
    for (const { name, properties } of queue.splice(0)) {
      try {
        Promise.resolve(bridge.trackEvent(name, properties)).catch((error) => {
          console.warn("业务埋点上报失败", name, error);
        });
      } catch (error) {
        console.warn("业务埋点上报异常", name, error);
      }
    }
    return true;
  }
  function track(name, values = {}) {
    const fields = ANALYTICS_EVENTS[name];
    if (!Object.hasOwn(ANALYTICS_EVENTS, name)) return false;
    const properties = {};
    for (const field of fields) {
      const value = values[field];
      if (typeof value === "string") properties[field] = value.slice(0, 256);
      else if (typeof value === "boolean") properties[field] = value;
      else if (typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 9e15) properties[field] = value;
    }
    if (queue.length >= maxPending) queue.shift();
    queue.push({ name, properties });
    const flushed = flush();
    if (!flushed && client.enabled && !runtime.__CAT_ANALYTICS__) void init();
    if (!flushed && runtime.tap && !warned) {
      warned = true;
      console.warn("TapDB 尚未就绪，事件已暂存；请检查 Client ID、设备初始化和后台事件登记");
    }
    return true;
  }
  return { track, flush, init, get pendingCount() {
    return queue.length;
  } };
}

// src/revive.mjs?v=420b31c4fd6e
function createReviveController({ ads: ads2, canRevive, restore, onChange = () => {
} }) {
  let busy = false, status = "", generation = 0;
  const controller = {
    get busy() {
      return busy;
    },
    get status() {
      return status;
    },
    isAvailable: () => ads2.isAvailable() && canRevive(),
    invalidate() {
      generation++;
      status = "";
      onChange();
    },
    async request() {
      if (busy || !controller.isAvailable()) return false;
      busy = true;
      status = "loading";
      const current = generation;
      onChange();
      let result;
      try {
        result = await ads2.showRewarded();
      } catch {
        result = { status: "failed" };
      }
      busy = false;
      if (current !== generation) {
        onChange();
        return false;
      }
      status = result.status;
      const restored = result.status === "completed" && canRevive() && restore();
      if (result.status === "completed" && !restored) status = "failed";
      onChange();
      return !!restored;
    }
  };
  return controller;
}

// src/eat-effects.js?v=420b31c4fd6e
function createEatEffects(THREE6, scene2, towerRoot2, CONFIG, materials, getMouthWorldPosition2, createCanvas, onEat = () => {
}) {
  const TAU4 = Math.PI * 2;
  const effects = [];
  const cookieChunkGeo = new THREE6.IcosahedronGeometry(0.15, 0);
  const crumbGeo = new THREE6.SphereGeometry(0.045, 8, 6);
  const matCookie = materials.crumb, matCookieAlt = materials.bubble, matChip = materials.ivory;
  const chunkBuckets = /* @__PURE__ */ new Map();
  const chunkTransform = new THREE6.Object3D();
  const ringGeo = new THREE6.TorusGeometry(0.34, 0.03, 8, 32);
  const jellyBurstTexture = createBurstTexture(THREE6, createCanvas);
  function chunkBucket(geometry, material) {
    const key2 = `${geometry.id}:${material.id}`;
    if (!chunkBuckets.has(key2)) {
      const mesh = new THREE6.InstancedMesh(geometry, material, 512);
      mesh.count = 0;
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene2.add(mesh);
      chunkBuckets.set(key2, { mesh, count: 0 });
    }
    return chunkBuckets.get(key2);
  }
  function spawnJellyBurst(position, scale = 1.55) {
    const mat = new THREE6.SpriteMaterial({
      map: jellyBurstTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      opacity: 0.88
    });
    const sprite = new THREE6.Sprite(mat);
    sprite.position.copy(position);
    sprite.scale.set(scale, scale, 1);
    sprite.renderOrder = 15;
    scene2.add(sprite);
    effects.push({ kind: "burst", mesh: sprite, duration: 0.34, t: 0, initialScale: scale });
  }
  function spawnEatFragments2(layer) {
    onEat();
    const chunkCount = 28;
    for (let i = 0; i < chunkCount; i++) {
      const angle = i / chunkCount * TAU4 + layer.index % 7 * 0.13;
      const radius = 1 + i % 4 * 0.45 + Math.random() * 0.18;
      const local = new THREE6.Vector3(
        Math.sin(angle) * radius,
        layer.group.position.y + (Math.random() - 0.5) * 0.1,
        Math.cos(angle) * radius
      );
      const world = towerRoot2.localToWorld(local);
      const bucket = chunkBucket(
        i % 4 === 0 ? crumbGeo : cookieChunkGeo,
        i % 5 === 0 ? matChip : i % 2 ? matCookieAlt : matCookie
      );
      const scale = i % 4 === 0 ? 0.8 + Math.random() * 0.8 : 0.75 + Math.random() * 0.65;
      effects.push({
        bucket,
        start: world,
        kind: "chunk",
        lift: 0.36 + Math.random() * 0.48,
        orbitPhase: Math.random() * TAU4,
        orbitAmp: 0.14 + Math.random() * 0.2,
        spin: new THREE6.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12),
        rotation: new THREE6.Euler(Math.random() * TAU4, Math.random() * TAU4, Math.random() * TAU4),
        duration: 0.34 + Math.random() * 0.15,
        t: 0,
        initialScale: scale
      });
    }
    const mouth = getMouthWorldPosition2();
    const impact = new THREE6.Vector3(0, layer.group.position.y + 0.1, CONFIG.catZ);
    spawnJellyBurst(impact, 1.6);
    const ring = new THREE6.Mesh(
      ringGeo,
      new THREE6.MeshBasicMaterial({ color: 12255183, transparent: true, opacity: 0.9, depthWrite: false })
    );
    ring.position.copy(mouth);
    ring.rotation.x = Math.PI / 2;
    scene2.add(ring);
    effects.push({ kind: "ring", mesh: ring, duration: 0.24, t: 0 });
  }
  function disposeEffect(fx) {
    if (fx.kind === "chunk") return;
    scene2.remove(fx.mesh);
    if (fx.kind === "burst" || fx.kind === "ring") fx.mesh.material.dispose();
  }
  function updateEatAnimations(dt) {
    for (const bucket of chunkBuckets.values()) bucket.count = 0;
    const mouth = effects.length ? getMouthWorldPosition2() : null;
    for (let i = effects.length - 1; i >= 0; i--) {
      const fx = effects[i];
      fx.t += dt;
      const u = THREE6.MathUtils.clamp(fx.t / fx.duration, 0, 1);
      if (fx.kind === "burst") {
        const s2 = fx.initialScale * (0.72 + u * 0.72);
        fx.mesh.scale.set(s2, s2, 1);
        fx.mesh.material.opacity = (1 - u) * 0.88;
        if (u >= 1) {
          scene2.remove(fx.mesh);
          fx.mesh.material?.dispose?.();
          effects.splice(i, 1);
        }
        continue;
      }
      if (fx.kind === "ring") {
        fx.mesh.position.copy(mouth);
        const s2 = 1 + u * 1.8;
        fx.mesh.scale.setScalar(s2);
        fx.mesh.material.opacity = (1 - u) * 0.85;
        fx.mesh.rotation.z += dt * 4.5;
        if (u >= 1) {
          scene2.remove(fx.mesh);
          fx.mesh.material?.dispose?.();
          effects.splice(i, 1);
        }
        continue;
      }
      if (u >= 1) {
        effects.splice(i, 1);
        continue;
      }
      const eased = 1 - Math.pow(1 - u, 3);
      chunkTransform.position.copy(fx.start).lerp(mouth, eased);
      chunkTransform.position.x += Math.cos(fx.orbitPhase + u * 11) * (1 - u) * fx.orbitAmp;
      chunkTransform.position.z += Math.sin(fx.orbitPhase + u * 11) * (1 - u) * fx.orbitAmp;
      chunkTransform.position.y += Math.sin(u * Math.PI) * fx.lift;
      fx.rotation.x += fx.spin.x * dt;
      fx.rotation.y += fx.spin.y * dt;
      fx.rotation.z += fx.spin.z * dt;
      chunkTransform.rotation.copy(fx.rotation);
      const s = fx.initialScale * Math.max(0.04, 1 - u * 0.95);
      chunkTransform.scale.setScalar(s);
      chunkTransform.updateMatrix();
      fx.bucket.mesh.setMatrixAt(fx.bucket.count++, chunkTransform.matrix);
    }
    for (const bucket of chunkBuckets.values()) {
      bucket.mesh.count = bucket.count;
      bucket.mesh.visible = bucket.count > 0;
      if (bucket.count) bucket.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  return {
    spawn: spawnEatFragments2,
    update: updateEatAnimations,
    clear() {
      effects.forEach(disposeEffect);
      effects.length = 0;
      for (const bucket of chunkBuckets.values()) {
        bucket.count = 0;
        bucket.mesh.count = 0;
        bucket.mesh.visible = false;
      }
    },
    get count() {
      return effects.length;
    },
    get chunkDrawCalls() {
      return [...chunkBuckets.values()].filter((bucket) => bucket.mesh.visible).length;
    }
  };
}
function createBurstTexture(THREE6, createCanvas) {
  const canvas = createCanvas();
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 84);
  g.addColorStop(0, "#effff3e6");
  g.addColorStop(0.5, "#6dffa08c");
  g.addColorStop(1, "#55e98900");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  for (const [x, y, w, h, r, degrees] of [
    [48, 76, 34, 31, 8, -24],
    [164, 65, 37, 32, 9, 26],
    [49, 151, 40, 34, 9, 22],
    [164, 156, 39, 34, 9, -24],
    [108, 39, 36, 34, 9, 12],
    [108, 184, 36, 34, 9, -10]
  ]) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(degrees * Math.PI / 180);
    ctx.fillStyle = "#6bfa98";
    ctx.strokeStyle = "#e9fff0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    const nativeRoundRect = typeof ctx.roundRect === "function";
    globalThis.__CAT_STARTUP_DIAGNOSTICS__?.capability("圆角绘图", nativeRoundRect ? "原生圆角" : "基础圆弧");
    if (nativeRoundRect) {
      ctx.roundRect(-w / 2, -h / 2, w, h, r);
    } else {
      const left = -w / 2, top = -h / 2, right = w / 2, bottom = h / 2;
      ctx.moveTo(left + r, top);
      ctx.arcTo(right, top, right, bottom, r);
      ctx.arcTo(right, bottom, left, bottom, r);
      ctx.arcTo(left, bottom, left, top, r);
      ctx.arcTo(left, top, right, top, r);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = "#b9ffd0";
  for (const [x, y, r] of [[38, 126, 10], [218, 128, 11], [93, 92, 8], [157, 116, 7], [101, 166, 6], [151, 175, 8]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#fffad0";
  for (const [x, y, r] of [[128, 118, 22], [208, 121, 13], [56, 126, 13]]) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 - Math.PI / 2, d = i % 2 ? r * 0.32 : r;
      if (!i) ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
      else ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
    ctx.closePath();
    ctx.fill();
  }
  const texture = new THREE6.CanvasTexture(canvas);
  texture.colorSpace = THREE6.SRGBColorSpace;
  return texture;
}

// src/jelly-motion.mjs?v=420b31c4fd6e
var JELLY_CONTACT_TIME = Math.PI / 20;
function jellyCompression(time, strength) {
  if (time < 0 || time >= 0.9) return 0;
  return strength * Math.exp(-5.5 * time) * Math.sin(20 * time);
}

// src/game-config.mjs?v=420b31c4fd6e
var GAME_CONFIG = Object.freeze({
  initialJumps: 5,
  maxJumps: 5,
  layerGap: 2.2,
  platformRadius: 2.55,
  platformThickness: 0.56,
  pillarRadius: 1.02,
  catRadius: 0.31,
  catRadiusAtMax: 0.37,
  catZ: 2.05,
  maxPixelRatio: 1.5,
  transmissionResolutionScale: 0.5,
  gravity: -10.2,
  jumpVelocity: 5.25,
  landingPause: JELLY_CONTACT_TIME,
  dragTurnsPerScreen: 240 * Math.PI / 180,
  aheadLayers: 8,
  keepBehind: 3,
  breakthroughCombo: 5,
  smashBounceVelocity: 4.15
});

// src/camera-framing.mjs?v=420b31c4fd6e
var cameraDistance = Math.hypot(8.2, 20);
var cameraUpY = 20 / cameraDistance;
var cameraUpZ = -8.2 / cameraDistance;
var restingCatScreenY = 0.34;
function gameplayCameraTarget({ depth, radius, catY, viewHeight, catZ, layerGap, platformThickness }) {
  const restingY = -depth * layerGap + platformThickness / 2 + radius;
  const anchorY = Math.max(catY ?? restingY, restingY);
  const screenOffset = (0.5 - restingCatScreenY) * viewHeight;
  return anchorY - (screenOffset - catZ * cameraUpZ) / cameraUpY;
}
function followGameplayCamera(focusY, targetY, catY, previousCatY) {
  const descent = Math.min(0, catY - previousCatY);
  return Math.max(focusY + descent, Math.min(focusY, targetY));
}

// src/i18n.mjs?v=420b31c4fd6e
var STORAGE_KEY = "cat-tower.language.v1";
var STRINGS = {
  zh: {
    myCats: "我的猫猫",
    closeCats: "关闭我的猫猫",
    catUsing: "使用中",
    catOwned: "已拥有",
    catLocked: "未解锁",
    catUse: "使用这只",
    catUnlockGoal: "单局下落达到 100 层即可获得",
    catDefault: "初始拥有，陪你开启冒险",
    catProgressLabel: "单局最深层数",
    catProgress: "单局最深 {count} / 100 层",
    catUnlockAction: "下落 100 层解锁",
    catUnlocked: "解锁球球猫！回到「我的猫猫」即可使用",
    catOwnedHint: "已达成单局下落 100 层，永久拥有",
    catCollectionCount: "已拥有 {count} / {total}",
    catCharacter: "猫咪角色",
    catRound: "球球猫",
    catClassic: "经典橘猫",
    levelSuccessKicker: "甜 蜜 闯 关 成 功",
    levelBook: "甜点挑战册",
    levelHomeHint: "五关甜点旅程 · 收集星星",
    levelStarShort: "通关 ★ · 技巧 ★ · 不复活 ★",
    levelLocked: "待解锁",
    levelMode: "关卡挑战",
    endlessHint: "下方按钮：无尽挑战",
    chooseLevel: "选择关卡",
    levelName1: "奶油初旅",
    levelName2: "草莓转角",
    levelName3: "一口五层",
    levelName4: "泡泡护航",
    levelName5: "焦糖冲刺",
    levelGoal_bounce: "技巧目标：弹跳不超过 {count} 次",
    levelGoal_combo: "技巧目标：从缺口连续下落 {count} 层",
    levelGoal_shield: "技巧目标：拾取泡泡盾",
    levelGoal_burst: "技巧目标：拾取暴走爪",
    levelSummary: "已收集 {count} / {total} 颗星",
    continueLevel: "继续第 {count} 关",
    levelNumber: "第 {count} 关",
    levelStarHelp: "到达终点获得一星；完成技巧目标获得二星；再加上不复活获得三星。",
    nextLevel: "下一关",
    levelRetry: "重试本关",
    levelNoRevive: "未复活可获得三星",
    levelClear: "甜点到手，通关啦！",
    levelGroupClear: "第 1 组挑战完成！",
    levelClearText: "猫猫稳稳落盘啦！可以继续挑战，也可以重玩补齐星星。",
    revive: "看广告复活",
    adLoading: "广告加载中…",
    adCancelled: "看完广告才能复活哦",
    adFailed: "广告暂不可用，请稍后重试",
    adUnavailable: "当前平台暂不支持广告复活",
    title: "猫猫果冻塔",
    labTitle: "果冻材质小样 · 猫猫果冻塔",
    gameAria: "左右拖动旋转果冻塔",
    depth: "层数",
    jumps: "弹跳",
    score: "分数",
    combo: "连吃 ×{count}",
    guideKicker: "小爪爪，准备好了吗？",
    guideMain: "左右滑动，转动果冻塔",
    guideDetail: "找准缺口，让猫猫一路往下跳",
    guideReward: "连吃果冻，补充弹跳",
    guideSmash: "连坠满5层，可砸穿果冻。",
    resultKicker: "本 次 冒 险 结 束",
    starvedTitle: "没力气啦！",
    starvedText: "少空跳，多追连续缺口，吃掉果冻就能补充弹跳次数。",
    hazardTitle: "被毒果冻困住啦",
    hazardText: "黏住了小爪爪，跳不起来了…",
    resultDepth: "下降层数",
    resultCombo: "最高连吃",
    resultScore: "得分",
    depthValue: "{count} 层",
    restart: "再来一次",
    home: "返回首页",
    leaderboard: "排行榜",
    share: "分享",
    achievements: "成就",
    shareRecord: "分享新纪录",
    shareAchievement: "分享成就",
    newRecord: "🎉 打破新纪录！",
    newAchievement: "🏅 解锁 {count} 项新成就！",
    recordAndAchievement: "🎉 新纪录 · 解锁 {count} 项新成就！",
    leaderboardLoading: "正在打开排行榜…",
    leaderboardFailed: "排行榜暂时打不开，请稍后重试",
    homeAria: "猫猫果冻塔首页",
    homeTitleAlt: "猫猫果冻塔，越掉越甜，越深越惊喜",
    openSettings: "打开设置",
    start: "开始游戏",
    closeSettings: "关闭设置",
    bestRecord: "历史最高记录",
    bestScore: "最高分",
    bestDepth: "最深层数",
    settingsTitle: "游戏设置",
    settingsHelp: "左右滑动旋转果冻塔，让胖猫从缺口落下。穿过果冻可以补充弹跳次数，避开粉红色危险果冻。",
    settingsSmash: "连坠满5层后，下一次触碰可砸穿果冻，包括毒果冻。",
    language: "语言",
    homeMotion: "首页动画",
    sound: "游戏音效",
    done: "完成",
    loading: "正在进入果冻乐园……",
    plusOne: "+1 弹跳",
    smash: "砸碎！",
    powerupBurst: "暴走爪",
    powerupShield: "泡泡盾",
    powerupEnergy: "活力布丁",
    powerupBurstHint: "3秒内砸碎所有果冻，毒果冻也不怕！",
    powerupShieldHint: "抵挡一次毒果冻，并砸开脚下这一层。",
    powerupEnergyHint: "立即获得3000分。",
    powerupShieldBreak: "护盾挡住了！",
    powerupShieldBreakHint: "毒果冻砸开啦，继续冲！",
    powerupShieldDuplicate: "护盾已备好",
    powerupTime: "{seconds}秒",
    powerupCharge: "1次",
    powerupEnergyResult: "+{count} 弹跳",
    powerupScoreResult: "+{score} 分",
    powerupEnergyOverflow: "+{count} 弹跳 · +{score} 分",
    powerupHelp: "碰到悬浮甜点，马上获得道具！",
    materialGroup: "平台材质",
    materialSummary: "材质 · {name}",
    materialLabLink: "打开材质小样 ↗",
    materialSaved: "已记住选择",
    materialUrl: "本次选择已保存在页面地址中",
    presetJelly: "透明果冻",
    presetJellyDescription: "鲜亮青提 · 软糖猫爪",
    presetClassic: "原版糖块",
    presetClassicDescription: "保留原版，随时对照",
    presetPudding: "奶油布丁",
    presetPuddingDescription: "柔和奶绿 · 草莓粉",
    bootErrorTitle: "游戏加载失败",
    bootErrorText: "请检查网络连接与游戏资源是否完整，然后刷新页面重试。",
    errorDetails: "错误详情",
    startupTimeout: "游戏初始化超时，请检查网络后刷新页面重试。",
    loadTimeout: "{label} 加载超时",
    threeMissing: "模块缺少 Three.js 核心导出",
    assetError: "素材加载失败：{url}",
    labError: "小样加载失败：{error}。请通过 start.bat 启动后重试。",
    labBack: "‹ 返回游戏",
    labHeader: "猫猫果冻塔 / 材质小样",
    labPreviewAria: "果冻材质交互预览",
    labLive: "实时小样",
    labDrag: "左右拖动，看看不同角度的反光",
    labLoading: "正在准备果冻小样……",
    labReference: "素材参考",
    labSafe: "绿色果冻",
    labDanger: "毒果冻",
    labSafeAlt: "用户提供的绿色果冻参考素材",
    labDangerAlt: "带奶油白圆角叉号的毒果冻参考素材",
    labSpecimenAria: "查看的果冻类型",
    labEyebrow: "甜 品 研 究 室",
    labHeading1: "一层果冻，",
    labHeading2: "试试不同口感。",
    labIntro1: "先看清透感，再试试回弹。",
    labIntro2: "绿色是安全区，莓红色是毒果冻。",
    labClean: "干净背景",
    labSolo: "单块细看",
    labRotate: "自动旋转",
    labStack: "多层对照",
    labGrid: "格纹背景，看清透射",
    labBounce: "轻轻压一下 · 看回弹",
    labNoBounce: "毒果冻 · 不回弹",
    labApply: "应用到游戏 →",
    labStatus: "小样中的切换不会立即改变游戏。",
    labNote: "当前展示分块压缩回弹。局部凹陷与毒果冻包裹将在材质确定后继续细化。"
  },
  en: {
    catCollectionCount: "{count} / {total} owned",
    myCats: "My Cats",
    closeCats: "Close My Cats",
    catUsing: "In use",
    catOwned: "Owned",
    catLocked: "Locked",
    catUse: "Use this cat",
    catUnlockGoal: "Drop 100 levels in a single run to unlock",
    catDefault: "Your first adventure companion",
    catProgressLabel: "Deepest single run",
    catProgress: "Single-run best: {count} / 100",
    catUnlockAction: "Drop 100 levels to unlock",
    catUnlocked: "Qiuqiu Cat unlocked! Choose it in My Cats",
    catOwnedHint: "100 levels in one run reached. Yours forever!",
    catCharacter: "Cat character",
    catRound: "Qiuqiu Cat",
    catClassic: "Classic tabby",
    levelSuccessKicker: "SWEET VICTORY",
    levelBook: "Sweet adventure",
    levelHomeHint: "Five sweet challenges · Collect stars",
    levelStarShort: "Finish ★ · Skill ★ · No revive ★",
    levelLocked: "Locked",
    levelMode: "Level challenge",
    endlessHint: "Button below: Endless challenge",
    chooseLevel: "Choose level",
    levelName1: "Cream trail",
    levelName2: "Strawberry turns",
    levelName3: "Five in a row",
    levelName4: "Bubble escort",
    levelName5: "Caramel rush",
    levelGoal_bounce: "Goal: Use at most {count} bounces",
    levelGoal_combo: "Goal: Fall through {count} gaps in a row",
    levelGoal_shield: "Goal: Collect a bubble shield",
    levelGoal_burst: "Goal: Collect a burst paw",
    levelSummary: "{count} / {total} stars collected",
    continueLevel: "Continue level {count}",
    levelNumber: "Level {count}",
    levelStarHelp: "Finish for one star; complete the skill goal for two; also avoid reviving for three.",
    nextLevel: "Next level",
    levelRetry: "Retry level",
    levelNoRevive: "Avoid reviving for three stars",
    levelClear: "Sweet finish!",
    levelGroupClear: "First group complete!",
    levelClearText: "A happy landing! Keep going or replay to earn more stars.",
    revive: "Watch Ad to Revive",
    adLoading: "Loading ad…",
    adCancelled: "Finish the ad to revive",
    adFailed: "Ad unavailable. Please retry later.",
    adUnavailable: "Ad revival is unavailable",
    title: "Jelly Cat Tower",
    labTitle: "Jelly Lab · Jelly Cat Tower",
    gameAria: "Drag left or right to rotate the jelly tower",
    depth: "LEVEL",
    jumps: "BOUNCE",
    score: "SCORE",
    combo: "COMBO ×{count}",
    guideKicker: "Ready, little paws?",
    guideMain: "Swipe to spin the jelly tower",
    guideDetail: "Find the gaps and keep the cat falling",
    guideReward: "Eat jelly to gain a bounce",
    guideSmash: "Drop 5 levels in a row to smash jelly.",
    resultKicker: "ADVENTURE OVER",
    starvedTitle: "Out of bounces!",
    starvedText: "Find gaps quickly. Eat jelly to regain bounces.",
    hazardTitle: "Stuck in poison jelly!",
    hazardText: "Those sticky paws cannot jump now.",
    resultDepth: "Levels dropped",
    resultCombo: "Best combo",
    resultScore: "Score",
    depthValue: "{count}",
    restart: "Play Again",
    home: "Back to Home",
    leaderboard: "Leaderboard",
    share: "Share",
    achievements: "Achievements",
    shareRecord: "Share Record",
    shareAchievement: "Share Achievement",
    newRecord: "🎉 New personal best!",
    newAchievement: "🏅 {count} new achievements!",
    recordAndAchievement: "🎉 New best · {count} new achievements!",
    leaderboardLoading: "Opening leaderboard…",
    leaderboardFailed: "Could not open the leaderboard. Please retry.",
    homeAria: "Jelly Cat Tower home screen",
    homeTitleAlt: "Jelly Cat Tower — drop, bounce and snack",
    openSettings: "Open settings",
    start: "Start game",
    closeSettings: "Close settings",
    bestRecord: "PERSONAL BEST",
    bestScore: "BEST SCORE",
    bestDepth: "DEEPEST",
    settingsTitle: "Game Settings",
    settingsHelp: "Swipe left or right to spin the tower. Drop through gaps to regain bounces. Avoid the pink poison jelly.",
    settingsSmash: "Drop 5 levels in a row to charge a smash. Your next hit breaks through jelly, including poison jelly.",
    language: "Language",
    homeMotion: "Home animation",
    sound: "Game sounds",
    done: "Done",
    loading: "Entering Jelly Land…",
    plusOne: "+1 BOUNCE",
    smash: "SMASH!",
    powerupBurst: "Paw Frenzy",
    powerupShield: "Bubble Shield",
    powerupEnergy: "Energy Pudding",
    powerupBurstHint: "Smash every jelly for 3 seconds, including poison!",
    powerupShieldHint: "Block one poison hit and smash through that layer.",
    powerupEnergyHint: "Gain 3,000 points instantly.",
    powerupShieldBreak: "Shield saved you!",
    powerupShieldBreakHint: "Poison smashed. Keep going!",
    powerupShieldDuplicate: "Shield is ready",
    powerupTime: "{seconds}s",
    powerupCharge: "1 hit",
    powerupEnergyResult: "+{count} BOUNCES",
    powerupScoreResult: "+{score} POINTS",
    powerupEnergyOverflow: "+{count} BOUNCES · +{score} POINTS",
    powerupHelp: "Touch a floating treat to grab a powerup!",
    materialGroup: "Platform material",
    materialSummary: "Style · {name}",
    materialLabLink: "Open Jelly Lab ↗",
    materialSaved: "Selection saved",
    materialUrl: "Selection stored in the page URL",
    presetJelly: "Clear Jelly",
    presetJellyDescription: "Grape glow · candy paws",
    presetClassic: "Classic Candy",
    presetClassicDescription: "The original candy look",
    presetPudding: "Cream Pudding",
    presetPuddingDescription: "Soft green · strawberry pink",
    bootErrorTitle: "Game failed to load",
    bootErrorText: "Check your connection and game files, then reload.",
    errorDetails: "Error details",
    startupTimeout: "Game startup timed out. Please reload.",
    loadTimeout: "{label} timed out",
    threeMissing: "Three.js core exports are missing",
    assetError: "Failed to load asset: {url}",
    labError: "Jelly Lab failed to load: {error}. Please restart the local server and try again.",
    labBack: "‹ Back to Game",
    labHeader: "Jelly Cat Tower / Jelly Lab",
    labPreviewAria: "Interactive jelly material preview",
    labLive: "Live preview",
    labDrag: "Drag left or right to see the reflections",
    labLoading: "Preparing Jelly Lab…",
    labReference: "Art reference",
    labSafe: "Safe jelly",
    labDanger: "Poison jelly",
    labSafeAlt: "Original safe jelly art reference",
    labDangerAlt: "Poison jelly art reference with a cream rounded X",
    labSpecimenAria: "Choose jelly type",
    labEyebrow: "JELLY LAB",
    labHeading1: "One jelly layer,",
    labHeading2: "three sweet styles.",
    labIntro1: "Explore the shine and test the bounce.",
    labIntro2: "Green is safe; pink is poison.",
    labClean: "Clean background",
    labSolo: "Single piece",
    labRotate: "Auto rotate",
    labStack: "Compare layers",
    labGrid: "Grid background for refraction",
    labBounce: "Give it a bounce",
    labNoBounce: "Poison jelly · no bounce",
    labApply: "Use in Game →",
    labStatus: "Lab selections do not change the game until applied.",
    labNote: "This preview shows compression and bounce. Local dents and poison wrapping are still in development."
  }
};
function initialLocale() {
  const requested = new URLSearchParams(location.search).get("lang");
  if (requested === "zh" || requested === "en") return requested;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "zh" || stored === "en") return stored;
  } catch {
  }
  return /^zh\b/i.test(navigator.language) ? "zh" : "en";
}
var locale = initialLocale();
function t(key2, values = {}) {
  const template = STRINGS[locale][key2];
  if (template === void 0) throw new Error(`Missing ${locale} translation: ${key2}`);
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ""));
}
function applyTranslations() {
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  document.title = t(location.pathname.endsWith("material-lab.html") ? "labTitle" : "title");
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll("[data-i18n-aria]")) el.setAttribute("aria-label", t(el.dataset.i18nAria));
  for (const el of document.querySelectorAll("[data-i18n-alt]")) el.alt = t(el.dataset.i18nAlt);
  for (const el of document.querySelectorAll("[data-i18n-image]")) {
    const prefix = el.dataset.i18nImagePrefix ?? "home-";
    el.src = `./assets/${prefix}${el.dataset.i18nImage}${locale === "en" ? "-en" : ""}-game.png`;
  }
  const language = document.getElementById("languageSelect");
  if (language) language.value = locale;
  document.dispatchEvent(new CustomEvent("cat-language-change", { detail: { locale } }));
}
function setLocale(next) {
  if (next !== "zh" && next !== "en") throw new Error(`Unsupported language: ${next}`);
  locale = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
  }
  const url = new URL(location.href);
  if (url.searchParams.has("lang")) {
    url.searchParams.set("lang", next);
    history.replaceState(null, "", url);
  }
  applyTranslations();
}

// src/logic.mjs?v=420b31c4fd6e
var TAU = Math.PI * 2;
function normalizeAngle(a) {
  a %= TAU;
  return a < 0 ? a + TAU : a;
}
function angleInArc(angle, start, width) {
  const a = normalizeAngle(angle);
  const s = normalizeAngle(start);
  const d = normalizeAngle(a - s);
  return d <= width;
}
function platformSpans(data, maxSpan = Math.PI / 3) {
  if (data.blocks) return data.blocks.map((block) => ({ ...block }));
  const boundaries = [0, TAU];
  for (const arc of [...data.gaps, ...data.hazards]) {
    boundaries.push(normalizeAngle(arc.start), normalizeAngle(arc.start + arc.width));
  }
  const sorted = [...new Set(boundaries)].sort((a, b) => a - b);
  const runs = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i], width = sorted[i + 1] - start;
    if (width < 1e-8) continue;
    const mid = start + width / 2;
    const type = data.gaps.some((g) => angleInArc(mid, g.start, g.width)) ? "gap" : data.hazards.some((h) => angleInArc(mid, h.start, h.width)) ? "hazard" : "safe";
    const last2 = runs.at(-1);
    if (last2?.type === type) last2.width += width;
    else runs.push({ start, width, type });
  }
  if (runs.length > 1 && runs[0].type === runs.at(-1).type) {
    const first = runs.shift();
    runs.at(-1).width += first.width;
  }
  return runs.flatMap((run) => {
    const count = run.type === "gap" ? 1 : Math.ceil(run.width / maxSpan);
    return Array.from({ length: count }, (_, i) => ({
      start: normalizeAngle(run.start + run.width * i / count),
      width: run.width / count,
      type: run.type
    }));
  });
}
var GameRules = class {
  constructor({ initialJumps = 5, maxJumps = 5 } = {}) {
    this.initialJumps = initialJumps;
    this.maxJumps = maxJumps;
    this.reset();
  }
  reset() {
    this.jumps = this.initialJumps;
    this.score = 0;
    this.depth = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.alive = true;
    this.deathReason = null;
    this.fullBonus = 0;
  }
  bounce() {
    if (!this.alive) return false;
    if (this.jumps <= 0) {
      this.starve();
      return false;
    }
    this.jumps -= 1;
    return true;
  }
  passLayer() {
    if (!this.alive) return;
    this.depth += 1;
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const mult = this.combo >= 5 ? 10 : this.combo === 4 ? 7 : this.combo === 3 ? 4 : this.combo === 2 ? 2 : 1;
    this.score += 10 * mult;
    if (this.jumps < this.maxJumps) {
      this.jumps += 1;
    } else {
      this.fullBonus += 1;
      this.score += 25 * this.combo;
    }
  }
  land() {
    if (!this.alive) return;
    this.combo = 0;
  }
  revive() {
    if (this.alive) return false;
    this.alive = true;
    this.deathReason = null;
    this.jumps = Math.min(this.initialJumps, this.maxJumps);
    this.combo = 0;
    return true;
  }
  starve() {
    if (!this.alive) return;
    this.alive = false;
    this.deathReason = "starved";
  }
  hitHazard() {
    if (!this.alive) return;
    this.alive = false;
    this.deathReason = "hazard";
  }
};
var SeededRandom = class {
  constructor(seed = Date.now() >>> 0) {
    this.state = seed >>> 0 || 305419896;
  }
  next() {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 4294967296;
  }
  range(min, max) {
    return min + (max - min) * this.next();
  }
  int(min, maxInclusive) {
    return Math.floor(this.range(min, maxInclusive + 1));
  }
  chance(p) {
    return this.next() < p;
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
};
function gapWidthForDepth(depth, rng) {
  let minDeg = 60, maxDeg = 75;
  if (depth >= 80) [minDeg, maxDeg] = [35, 45];
  else if (depth >= 40) [minDeg, maxDeg] = [40, 50];
  else if (depth >= 20) [minDeg, maxDeg] = [45, 60];
  else if (depth >= 10) [minDeg, maxDeg] = [50, 65];
  return rng.range(minDeg, maxDeg) * Math.PI / 180;
}
function hazardRatioForDepth(depth) {
  if (depth < 8) return 0;
  if (depth < 20) return 0.06;
  if (depth < 40) return 0.1;
  if (depth < 60) return 0.15;
  if (depth < 80) return 0.19;
  return 0.23;
}
var LayerGenerator = class {
  constructor(seed = 12345) {
    this.rng = new SeededRandom(seed);
    this.chainRemaining = 0;
    this.chainAngle = 0;
    this.prevGapAngle = 0;
  }
  _maybeStartChain(depth) {
    if (this.chainRemaining > 0) return;
    const r = this.rng.next();
    let len = 0;
    if (r < 0.02) len = 5;
    else if (r < 0.07) len = 4;
    else if (r < 0.19) len = 3;
    else if (r < 0.44) len = 2;
    if (depth < 8 && len > 2) len = 2;
    if (len) {
      this.chainRemaining = len;
      this.chainAngle = normalizeAngle(this.prevGapAngle + this.rng.range(-0.25, 0.25));
    }
  }
  create(depth, lowJumps = false) {
    this._maybeStartChain(depth);
    let width = gapWidthForDepth(depth, this.rng);
    if (lowJumps) width += 10 * Math.PI / 180;
    let primaryAngle;
    let chain = false;
    if (this.chainRemaining > 0) {
      chain = true;
      this.chainAngle = normalizeAngle(this.chainAngle + this.rng.range(-0.23, 0.23));
      primaryAngle = this.chainAngle;
      this.chainRemaining--;
    } else {
      primaryAngle = normalizeAngle(this.prevGapAngle + this.rng.range(-1.5, 1.5));
    }
    this.prevGapAngle = primaryAngle;
    const gaps = [{ start: normalizeAngle(primaryAngle - width / 2), width }];
    if (depth > 20 && this.rng.chance(0.25)) {
      const w2 = width * this.rng.range(0.65, 0.9);
      const center2 = normalizeAngle(primaryAngle + this.rng.range(1.6, 3.6));
      gaps.push({ start: normalizeAngle(center2 - w2 / 2), width: w2 });
    }
    let hazardRatio = hazardRatioForDepth(depth);
    if (lowJumps) hazardRatio *= 0.7;
    const blocks = platformSpans({ gaps, hazards: [] });
    const solid = blocks.filter((b) => b.type === "safe");
    const largest = Math.max(...solid.map((b) => b.width));
    const candidates = solid.filter((b) => Math.abs(b.width - largest) < 1e-8);
    const count = hazardRatio > 0 ? Math.min(
      candidates.length,
      solid.length - 1,
      Math.max(1, Math.round(hazardRatio * TAU / largest))
    ) : 0;
    for (let i = 0; i < count; i++) {
      const index = this.rng.int(0, candidates.length - 1);
      candidates.splice(index, 1)[0].type = "hazard";
    }
    const hazards = blocks.filter((b) => b.type === "hazard").map(({ start, width: width2 }) => ({ start, width: width2 }));
    return { depth, gaps, hazards, blocks, chain, primaryAngle, width };
  }
};

// src/canvas-paths.mjs?v=420b31c4fd6e
var reported = /* @__PURE__ */ new Set();
function ellipsePath(ctx, x, y, rx, ry, rotation, start, end, anticlockwise = false) {
  const native = typeof ctx.ellipse === "function";
  const mode = native ? "原生椭圆" : "基础圆弧变换";
  if (!reported.has(mode)) {
    reported.add(mode);
    globalThis.__CAT_STARTUP_DIAGNOSTICS__?.capability("椭圆绘图", mode);
  }
  if (native) {
    ctx.ellipse(x, y, rx, ry, rotation, start, end, anticlockwise);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(rx, ry);
  ctx.arc(0, 0, 1, start, end, anticlockwise);
  ctx.restore();
}

// src/classic-material.js?v=420b31c4fd6e
var THREE = globalThis.__THREE__;
function createClassicMaterial(danger = false) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(danger ? "#f52280" : "#74ef8a") },
      uBody: { value: new THREE.Color(danger ? "#a80043" : "#069b53") },
      uGlow: { value: new THREE.Color(danger ? "#ffc1df" : "#e0ffb2") }
    },
    vertexShader: `
      varying vec3 vLocal;
      varying vec3 vLocalNormal;
      varying vec3 vNormalView;
      varying vec3 vEye;
      void main() {
        vLocal = position;
        vLocalNormal = normal;
        vNormalView = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vEye = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uBody;
      uniform vec3 uGlow;
      varying vec3 vLocal;
      varying vec3 vLocalNormal;
      varying vec3 vNormalView;
      varying vec3 vEye;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      void main() {
        vec3 n = normalize(vNormalView);
        vec3 eye = normalize(vEye);
        float facing = clamp(dot(n, eye), 0.0, 1.0);
        float rim = pow(1.0 - facing, 2.7);
        float height = smoothstep(-.30, .30, vLocal.y);
        vec3 color = mix(uBody, uTop, height * .78);
        vec3 light = normalize(vec3(-.55, .8, .8));
        float diffuse = max(0.0, dot(n, light));
        color *= .77 + diffuse * .34;
        color = mix(color, uGlow, rim * .48);
        // Curved edges catch narrow white softbox highlights.
        vec3 reflected = reflect(-eye, n);
        float strip = pow(max(0.0, 1.0 - abs(reflected.x + .42) * 4.0), 12.0);
        float strip2 = pow(max(0.0, 1.0 - abs(reflected.x - .72) * 7.0), 14.0);
        float spec = pow(max(0.0, dot(n, normalize(light + eye))), 85.0);
        color += vec3(1.0, 1.0, .89) * (spec * .95 + (strip * .9 + strip2 * .6) * (.35 + rim));
        // A stable surface pattern, attached to the geometry as the tower turns.
        bool onTop = vLocal.y > .245;
        float radial = abs(dot(normalize(vLocalNormal.xz), normalize(vLocal.xz)));
        vec2 sideUV = radial > .7 ? vec2(atan(vLocal.x, vLocal.z) * 2.55, vLocal.y) : vec2(length(vLocal.xz), vLocal.y);
        vec2 uv = onTop ? vLocal.xz * 4.3 : sideUV * 4.3;
        vec2 cell = floor(uv);
        float seed = hash(cell);
        vec2 center = vec2(.2 + .6 * seed, .2 + .6 * hash(cell + 41.0));
        vec2 delta = fract(uv) - center;
        float radius = .045 + .24 * seed * seed;
        float d = length(delta);
        float edge = 1.0 - smoothstep(.012, .037, abs(d - radius));
        float inside = 1.0 - smoothstep(radius - .025, radius, d);
        float shine = 1.0 - smoothstep(.008, .043, length(delta - vec2(-radius * .37, radius * .44)));
        float visible = step(.43, seed);
        color = mix(color, color * .70, inside * visible * .19);
        color += uGlow * visible * (edge * .22 + shine * .60);
        if (onTop) {
          float diagonal = dot(vLocal.xz, vec2(.8, .6));
          float lacquer = exp(-pow((diagonal - .65) / .14, 2.0)) * .20
                        + exp(-pow((diagonal + .30) / .04, 2.0)) * .15;
          color += vec3(.85, 1.0, .8) * lacquer;
        }
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `
  });
}

// src/candy-jelly-material.js?v=420b31c4fd6e
var THREE2 = globalThis.__THREE__;
function createCandyJellyMaterial(config, danger = false) {
  const material = new THREE2.MeshPhysicalMaterial({
    color: danger ? "#f51775" : "#36ef46",
    metalness: 0,
    roughness: 0.012,
    transmission: 0.91,
    thickness: config.platformThickness * 0.55,
    ior: 1.22,
    attenuationColor: danger ? "#760025" : "#10c535",
    attenuationDistance: danger ? 0.17 : 0.44,
    clearcoat: 0.8,
    clearcoatRoughness: 0.035,
    envMapIntensity: 1.15
  });
  material.userData.platformStyle = "candy-jelly";
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `attribute vec3 candyCoord; varying vec3 vCandy;
${shader.vertexShader}`.replace("#include <begin_vertex>", "#include <begin_vertex>\nvCandy = candyCoord;");
    shader.fragmentShader = `varying vec3 vCandy;
${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `
      #include <color_fragment>
      float centerDepth = (1.0 - pow(abs(vCandy.x), 3.0)) * (1.0 - pow(abs(vCandy.z), 3.0));
      diffuseColor.rgb *= mix(vec3(1.0), vec3(${danger ? ".62, .30, .68" : ".38, 1.0, .42"}), centerDepth * .62);
    `);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <transmission_fragment>",
      THREE2.ShaderChunk.transmission_fragment.replace(
        "material.thickness = thickness;",
        "material.thickness = thickness * (.38 + centerDepth * .92);"
      )
    );
    if (!danger) {
      shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>", `
        float topTint = smoothstep(.55, .95, vCandy.y) * (.45 + centerDepth * .55);
        outgoingLight *= mix(vec3(1.0), vec3(.15, 1.0, .10), topTint * .9);
        #include <opaque_fragment>
      `);
    }
  };
  material.customProgramCacheKey = () => `volume-jelly-v3-${danger}`;
  return material;
}
function createAirPocketMaterial(danger = false) {
  return new THREE2.ShaderMaterial({
    uniforms: {
      body: { value: new THREE2.Color(danger ? "#c50958" : "#2ed447") },
      lightColor: { value: new THREE2.Color(danger ? "#ff92bc" : "#e6ffa3") }
    },
    vertexShader: `
      varying vec3 bubbleNormal;
      varying vec3 bubbleEye;
      void main() {
        vec4 p = vec4(position, 1.0);
        vec3 n = normal;
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
          n = mat3(instanceMatrix) * n;
        #endif
        vec4 mv = modelViewMatrix * p;
        bubbleNormal = normalize(normalMatrix * n);
        bubbleEye = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 body, lightColor;
      varying vec3 bubbleNormal, bubbleEye;
      void main() {
        vec3 n = normalize(bubbleNormal);
        float facing = max(0.0, dot(n, normalize(bubbleEye)));
        float rim = pow(1.0 - facing, 2.2);
        float upperReflection = pow(max(0.0, dot(n, normalize(vec3(-.45,.65,.75)))), 42.0);
        float lowerReflection = pow(max(0.0, dot(n, normalize(vec3(.48,-.68,.5)))), 65.0);
        vec3 color = body * (.65 + .35 * n.y);
        color = mix(color, lightColor, rim * .8);
        color += vec3(1.0) * upperReflection * 2.5 + lightColor * lowerReflection * 1.2;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
}

// src/platform-materials.js?v=420b31c4fd6e
var THREE3 = globalThis.__THREE__;
var STORAGE_KEY2 = "cat-tower.platform-material.v1";
var FIXED_JELLY = globalThis.__CAT_FIXED_JELLY__ === true;
var DEFAULT_PLATFORM_PRESET = "jelly";
var PLATFORM_PRESETS = Object.freeze([
  {
    id: "jelly",
    label: "透明果冻",
    description: "鲜亮青提 · 软糖猫爪",
    bubbles: true,
    rim: false,
    surfaceBubbles: false,
    flatPaw: false,
    flatDangerMark: true,
    candyDetails: true,
    rebound: 0.16,
    create: (config) => ({ safe: createCandyJellyMaterial(config), danger: createCandyJellyMaterial(config, true) })
  },
  {
    id: "classic",
    label: "原版糖块",
    description: "保留原版，随时对照",
    bubbles: false,
    rim: true,
    surfaceBubbles: true,
    flatPaw: true,
    flatDangerMark: true,
    rebound: 0.035,
    create: () => ({ safe: createClassicMaterial(), danger: createClassicMaterial(true) })
  },
  {
    id: "pudding",
    label: "奶油布丁",
    description: "柔和奶绿 · 草莓粉",
    bubbles: false,
    rim: false,
    surfaceBubbles: false,
    flatPaw: true,
    flatDangerMark: true,
    rebound: 0.1,
    create: () => {
      const base = { roughness: 0.3, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.16, envMapIntensity: 0.7 };
      return {
        safe: new THREE3.MeshPhysicalMaterial({ ...base, color: "#c4ee92" }),
        danger: new THREE3.MeshPhysicalMaterial({ ...base, color: "#ea5380" })
      };
    }
  }
]);
function readPlatformPreset(fallback = DEFAULT_PLATFORM_PRESET) {
  if (FIXED_JELLY) return DEFAULT_PLATFORM_PRESET;
  try {
    const id = localStorage.getItem(STORAGE_KEY2);
    return PLATFORM_PRESETS.some((p) => p.id === id) ? id : fallback;
  } catch {
    return fallback;
  }
}
function savePlatformPreset(id) {
  if (!PLATFORM_PRESETS.some((p) => p.id === id)) throw new Error(`Unknown platform material: ${id}`);
  try {
    localStorage.setItem(STORAGE_KEY2, id);
    return true;
  } catch {
    return false;
  }
}
function createPlatformMaterials(config) {
  const cache = /* @__PURE__ */ new Map();
  let selected = PLATFORM_PRESETS.find((p) => p.id === readPlatformPreset());
  function pair() {
    if (!cache.has(selected.id)) cache.set(selected.id, selected.create(config));
    return cache.get(selected.id);
  }
  function apply(root) {
    const materials = pair();
    root.traverse((object) => {
      const role = object.userData.platformRole;
      if (role) object.material = materials[role];
      const decoration = object.userData.platformDecoration;
      if (decoration) object.visible = !!selected[decoration];
    });
  }
  return {
    get id() {
      return selected.id;
    },
    get preset() {
      return selected;
    },
    get current() {
      return pair();
    },
    apply,
    select(id, root) {
      if (FIXED_JELLY) id = DEFAULT_PLATFORM_PRESET;
      const next = PLATFORM_PRESETS.find((p) => p.id === id);
      if (!next) throw new Error(`Unknown platform material: ${id}`);
      selected = next;
      if (root) apply(root);
      return pair();
    },
    dispose() {
      for (const pair2 of cache.values()) {
        pair2.safe.dispose();
        pair2.danger.dispose();
      }
      cache.clear();
    }
  };
}

// src/game-assets.mjs?v=420b31c4fd6e
var GAME_ASSETS = Object.freeze({
  levelButton: "./assets/level-candy-button-game.png",
  levelVictory: "./assets/level-victory-cat-game.png",
  world: "./assets/world-hd.png",
  column: "./assets/column-hd.png",
  idle: "./assets/cat-idle-game.png",
  fall: "./assets/cat-fall-game.png",
  eat: "./assets/cat-eat-game.png",
  fail: "./assets/cat-fail-game.png",
  hud: "./assets/ui-hud-game.png",
  depth: "./assets/ui-depth-game.png",
  bounce: "./assets/ui-bounce-game.png",
  score: "./assets/star-game.png",
  result: "./assets/ui-results-game.png",
  homeTitle: "./assets/home-title-game.png",
  homeStart: "./assets/home-start-game.png",
  homeSettings: "./assets/home-settings-game.png",
  homeJellySafe: "./assets/home-jelly-safe-game.png",
  homeJellyDanger: "./assets/home-jelly-danger-game.png",
  dangerMark: "./assets/jelly-danger-mark.png",
  powerupBurst: "./assets/powerup-burst.png",
  powerupShield: "./assets/powerup-shield.png",
  powerupEnergy: "./assets/powerup-energy.png"
});
var CAT_SOURCES = Object.freeze({
  idle: GAME_ASSETS.idle,
  fall: GAME_ASSETS.fall,
  eat: GAME_ASSETS.eat,
  squash: GAME_ASSETS.idle,
  fail: GAME_ASSETS.fail
});

// src/visuals.js?v=420b31c4fd6e
var THREE4 = globalThis.__THREE__;
var TAU2 = Math.PI * 2;
function canvasTexture(width, height, paint) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext("2d"), width, height);
  const texture = new THREE4.CanvasTexture(canvas);
  texture.colorSpace = THREE4.SRGBColorSpace;
  return texture;
}
function createArt(renderer2, scene2, config, loadTexture) {
  const studio = new THREE4.Scene();
  studio.background = new THREE4.Color(0.1, 0.22, 0.12);
  const panels = [];
  for (const [position, size, brightness] of [
    [[-4, 4, 3], [2.5, 5], 7],
    [[4, 2, 1], [0.7, 4], 5],
    [[0, 4, -7], [5, 3], 4],
    [[-1, 0, -5], [3, 3], 2]
  ]) {
    const panel = new THREE4.Mesh(
      new THREE4.PlaneGeometry(...size),
      new THREE4.MeshBasicMaterial({ color: new THREE4.Color(brightness, brightness, brightness * 0.94) })
    );
    panel.position.set(...position);
    panel.lookAt(0, 0, 0);
    studio.add(panel);
    panels.push(panel);
  }
  const pmrem = new THREE4.PMREMGenerator(renderer2);
  const environment = pmrem.fromScene(studio, 0.025, 0.1, 50);
  scene2.environment = environment.texture;
  for (const panel of panels) {
    panel.geometry.dispose();
    panel.material.dispose();
  }
  pmrem.dispose();
  const physical = (color, extra = {}) => new THREE4.MeshPhysicalMaterial({
    color,
    roughness: 0.19,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.1,
    ...extra
  });
  const platformMaterials = createPlatformMaterials(config);
  const materials = {
    ivory: physical(16772556),
    bubble: physical(11993017, { roughness: 0.08, envMapIntensity: 1.8 }),
    redBubble: physical(16736405, { roughness: 0.08, envMapIntensity: 1.8 }),
    rim: new THREE4.MeshBasicMaterial({ color: 14679996, transparent: true, opacity: 0.66 }),
    redRim: new THREE4.MeshBasicMaterial({ color: 16755149, transparent: true, opacity: 0.68 }),
    crumb: physical(5565240)
  };
  const inclusions = { safe: createAirPocketMaterial(false), danger: createAirPocketMaterial(true) };
  const pawTexture = canvasTexture(256, 256, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 55, 0, 210);
    gradient.addColorStop(0, "#eaffbc");
    gradient.addColorStop(1, "#86ed5a");
    ctx.fillStyle = gradient;
    ctx.strokeStyle = "#eaffdf";
    ctx.lineWidth = 5;
    for (const [x, y, rx, ry, rot] of [[128, 160, 52, 37, 0], [66, 109, 20, 26, -0.45], [104, 78, 20, 27, -0.15], [150, 78, 20, 27, 0.15], [189, 109, 20, 26, 0.45]]) {
      ctx.beginPath();
      ellipsePath(ctx, x, y, rx, ry, rot, 0, TAU2);
      ctx.fill();
      ctx.stroke();
    }
  });
  const dangerMarkTexture = loadTexture(GAME_ASSETS.dangerMark);
  const markMaterial = (map) => new THREE4.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const pawMat = markMaterial(pawTexture);
  const dangerMarkMat = new THREE4.MeshBasicMaterial({
    map: dangerMarkTexture,
    transparent: true,
    alphaTest: 0.025,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1
  });
  const sphere = new THREE4.SphereGeometry(1, 12, 8);
  const markGeo = new THREE4.PlaneGeometry(0.66, 0.66);
  const dummy = new THREE4.Object3D();
  const pawSphere = new THREE4.SphereGeometry(1, 24, 16);
  const pawReliefMaterial = physical("#8aef64", {
    roughness: 0.1,
    transmission: 0.55,
    thickness: 0.13,
    ior: 1.36,
    envMapIntensity: 1,
    attenuationColor: "#4bda2b",
    attenuationDistance: 0.8
  });
  const padShape = new THREE4.Shape();
  padShape.moveTo(-0.22, -0.1);
  padShape.bezierCurveTo(-0.34, -0.04, -0.17, 0.16, -0.06, 0.19);
  padShape.bezierCurveTo(-0.02, 0.22, 0.04, 0.22, 0.08, 0.18);
  padShape.bezierCurveTo(0.17, 0.12, 0.32, -0.04, 0.23, -0.12);
  padShape.bezierCurveTo(0.18, -0.18, 0.09, -0.1, 0, -0.1);
  padShape.bezierCurveTo(-0.08, -0.1, -0.18, -0.18, -0.22, -0.1);
  const padGeometry = new THREE4.ExtrudeGeometry(padShape, {
    depth: 0.025,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.025,
    bevelSegments: 4,
    curveSegments: 16
  });
  padGeometry.rotateX(-Math.PI / 2);
  const pawParts = [
    [padGeometry, 0, 0.027, 0.105, 1, 1, 1],
    ...[
      [-0.23, 0.04, -0.1, 0.08, 0.057, 0.1],
      [-0.085, 0.05, -0.22, 0.087, 0.06, 0.105],
      [0.085, 0.05, -0.22, 0.087, 0.06, 0.105],
      [0.23, 0.04, -0.1, 0.08, 0.057, 0.1]
    ].map((shape) => [pawSphere, ...shape])
  ];
  const pawReliefGeometry = new THREE4.BufferGeometry();
  const pawAttributes = { position: [], normal: [], uv: [] };
  for (const [source, x, y, z, sx, sy, sz] of pawParts) {
    dummy.position.set(x, y, z);
    dummy.scale.set(sx, sy, sz);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    const piece = (source.index ? source.toNonIndexed() : source.clone()).applyMatrix4(dummy.matrix);
    for (const name of Object.keys(pawAttributes)) pawAttributes[name].push(piece.getAttribute(name).array);
    piece.dispose();
  }
  for (const [name, arrays] of Object.entries(pawAttributes)) {
    const merged = new Float32Array(arrays.reduce((count, array) => count + array.length, 0));
    let offset = 0;
    for (const array of arrays) {
      merged.set(array, offset);
      offset += array.length;
    }
    pawReliefGeometry.setAttribute(name, new THREE4.BufferAttribute(merged, name === "uv" ? 2 : 3));
  }
  padGeometry.dispose();
  pawSphere.dispose();
  pawReliefGeometry.computeBoundingSphere();
  const glintTexture = canvasTexture(128, 128, (ctx) => {
    const glow = ctx.createRadialGradient(64, 64, 2, 64, 64, 61);
    glow.addColorStop(0, "#ffffdf");
    glow.addColorStop(0.15, "#f4ffb6c0");
    glow.addColorStop(1, "#eaff7700");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "#ffffef";
    ctx.beginPath();
    ctx.moveTo(64, 7);
    ctx.quadraticCurveTo(69, 57, 117, 64);
    ctx.quadraticCurveTo(69, 69, 64, 121);
    ctx.quadraticCurveTo(59, 69, 11, 64);
    ctx.quadraticCurveTo(59, 57, 64, 7);
    ctx.fill();
  });
  const glintMaterial = new THREE4.SpriteMaterial({ map: glintTexture, transparent: true, depthWrite: false, toneMapped: false });
  function jellyGeometry(start, width) {
    const inner = config.pillarRadius + 0.035;
    const outer = config.platformRadius;
    const middle = (inner + outer) / 2;
    const radialWidth = outer - inner;
    const visualThickness = config.platformThickness * 1.22;
    const centerOffset = (visualThickness - config.platformThickness) / 2;
    const arcLength = Math.max(0.025, (width - Math.min(0.035, width * 0.12)) * middle);
    const half = new THREE4.Vector3(radialWidth / 2, visualThickness / 2, arcLength / 2);
    const radius = Math.min(0.16, arcLength * 0.22);
    const geometry = new THREE4.BoxGeometry(radialWidth, visualThickness, arcLength, 8, 6, 20).toNonIndexed();
    const positions = geometry.attributes.position;
    const candyCoords = new Float32Array(positions.count * 3);
    const p = new THREE4.Vector3(), core = new THREE4.Vector3(), delta = new THREE4.Vector3();
    for (let i = 0; i < positions.count; i++) {
      p.fromBufferAttribute(positions, i);
      core.set(
        THREE4.MathUtils.clamp(p.x, -half.x + radius, half.x - radius),
        THREE4.MathUtils.clamp(p.y, -half.y + radius, half.y - radius),
        THREE4.MathUtils.clamp(p.z, -half.z + radius, half.z - radius)
      );
      delta.copy(p).sub(core).normalize().multiplyScalar(radius);
      p.copy(core).add(delta);
      candyCoords.set([p.x / half.x, p.y / half.y, p.z / half.z], i * 3);
      const r = middle + p.x;
      const angle = start + width / 2 - p.z / middle;
      const crown = 0.024 * ((p.x / half.x) ** 2 + (p.z / half.z) ** 2);
      const y = p.y - centerOffset - Math.sign(p.y) * crown * (Math.abs(p.y) / half.y) ** 3;
      positions.setXYZ(i, Math.sin(angle) * r, y, Math.cos(angle) * r);
    }
    geometry.computeVertexNormals();
    geometry.setAttribute("candyCoord", new THREE4.BufferAttribute(candyCoords, 3));
    const normalSums = /* @__PURE__ */ new Map();
    const keyOf = (i) => [positions.getX(i), positions.getY(i), positions.getZ(i)].map((n) => Math.round(n * 1e4)).join(",");
    for (let i = 0; i < positions.count; i++) {
      const key2 = keyOf(i);
      const sum = normalSums.get(key2) || new THREE4.Vector3();
      sum.add(new THREE4.Vector3().fromBufferAttribute(geometry.attributes.normal, i));
      normalSums.set(key2, sum);
    }
    for (let i = 0; i < positions.count; i++) {
      const n = normalSums.get(keyOf(i)).normalize();
      geometry.attributes.normal.setXYZ(i, n.x, n.y, n.z);
    }
    return geometry;
  }
  const finishDishMaterial = new THREE4.MeshPhysicalMaterial({ color: 16773851, roughness: 0.35 });
  const finishRimMaterial = new THREE4.MeshPhysicalMaterial({ color: 16753871, roughness: 0.35 });
  function createPlatform(data, index) {
    const group = new THREE4.Group();
    const rng2 = new SeededRandom(index * 7919 + 812);
    const segments = [];
    for (const span of platformSpans(data)) {
      if (span.type === "gap") continue;
      const danger = span.type === "hazard";
      const part = new THREE4.Group();
      part.userData.span = span;
      const mesh = new THREE4.Mesh(jellyGeometry(span.start, span.width), platformMaterials.current[danger ? "danger" : "safe"]);
      mesh.userData.ownedGeometry = true;
      mesh.userData.platformRole = danger ? "danger" : "safe";
      part.add(mesh);
      const count = Math.max(2, Math.floor(span.width * 20));
      const bubbles = new THREE4.InstancedMesh(sphere, danger ? materials.redBubble : materials.bubble, count);
      for (let i = 0; i < count; i++) {
        const angle = span.start + span.width * rng2.range(0.12, 0.88);
        const size = rng2.range(0.022, 0.067);
        const top = i % 3 === 0;
        const radius = top ? rng2.range(config.pillarRadius + 0.2, config.platformRadius - 0.15) : config.platformRadius - 0.01;
        dummy.position.set(Math.sin(angle) * radius, top ? config.platformThickness / 2 + 5e-3 : rng2.range(-0.16, 0.13), Math.cos(angle) * radius);
        dummy.rotation.set(0, angle, 0);
        dummy.scale.set(size, top ? size * 0.3 : size, top ? size : size * 0.25);
        dummy.updateMatrix();
        bubbles.setMatrixAt(i, dummy.matrix);
      }
      bubbles.userData.instanced = true;
      bubbles.userData.platformDecoration = "surfaceBubbles";
      part.add(bubbles);
      const inclusionCount = Math.max(3, Math.floor(span.width * 24));
      const inside = new THREE4.InstancedMesh(sphere, inclusions[danger ? "danger" : "safe"], inclusionCount);
      for (let i = 0; i < inclusionCount; i++) {
        const a = span.start + span.width * rng2.range(0.2, 0.8);
        const size = i % 4 === 0 ? rng2.range(0.075, 0.14) : rng2.range(0.018, 0.052);
        const r = i % 3 === 1 ? config.platformRadius - size * 0.45 : rng2.range(config.pillarRadius + 0.25, config.platformRadius - 0.25);
        const y = i % 3 === 0 ? config.platformThickness / 2 - size * 0.5 : rng2.range(-0.2, 0.1);
        dummy.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(size);
        dummy.updateMatrix();
        inside.setMatrixAt(i, dummy.matrix);
      }
      inside.userData.instanced = true;
      inside.userData.platformDecoration = "bubbles";
      part.add(inside);
      const points = [];
      const inset = Math.min(0.05, span.width * 0.18);
      for (let j = 0; j <= 24; j++) {
        const a = span.start + inset + (span.width - inset * 2) * j / 24;
        points.push(new THREE4.Vector3(Math.sin(a) * (config.platformRadius - 0.043), config.platformThickness / 2 - 0.025, Math.cos(a) * (config.platformRadius - 0.043)));
      }
      const rim = new THREE4.Mesh(new THREE4.TubeGeometry(new THREE4.CatmullRomCurve3(points), 24, 0.019, 5, false), danger ? materials.redRim : materials.rim);
      rim.userData.ownedGeometry = true;
      rim.userData.platformDecoration = "rim";
      part.add(rim);
      if (span.width > 0.22) {
        const mark = new THREE4.Mesh(markGeo, danger ? dangerMarkMat : pawMat);
        const a = span.start + span.width / 2;
        const r = (config.pillarRadius + config.platformRadius) / 2;
        mark.rotation.set(-Math.PI / 2, 0, danger ? -a + Math.PI / 2 : -a);
        mark.position.set(Math.sin(a) * r, config.platformThickness / 2 + 8e-3, Math.cos(a) * r);
        const scale = Math.min(1, span.width / 0.42);
        mark.scale.setScalar(scale);
        mark.userData.platformDecoration = danger ? "flatDangerMark" : "flatPaw";
        part.add(mark);
        if (!danger) {
          const relief = new THREE4.Mesh(pawReliefGeometry, pawReliefMaterial);
          relief.userData.platformDecoration = "candyDetails";
          relief.position.copy(mark.position);
          relief.rotation.y = a;
          relief.scale.setScalar(Math.min(1.2, span.width / 0.55));
          part.add(relief);
        }
        if (span.width > 0.5) {
          const star = new THREE4.Sprite(glintMaterial);
          const angle = span.start + span.width * 0.83;
          star.position.set(
            Math.sin(angle) * (config.platformRadius - 0.13),
            config.platformThickness / 2 + 0.055,
            Math.cos(angle) * (config.platformRadius - 0.13)
          );
          star.scale.setScalar(0.25);
          star.userData.platformDecoration = "candyDetails";
          part.add(star);
        }
      }
      group.add(part);
      segments.push(part);
    }
    platformMaterials.apply(group);
    if (data.finish) {
      const dish = new THREE4.Mesh(new THREE4.CylinderGeometry(config.platformRadius + 0.22, config.platformRadius + 0.3, 0.16, 48), finishDishMaterial);
      dish.position.y = -0.36;
      dish.userData.ownedGeometry = true;
      group.add(dish);
      const rim = new THREE4.Mesh(new THREE4.TorusGeometry(config.platformRadius + 0.12, 0.1, 8, 48), finishRimMaterial);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.12;
      rim.userData.ownedGeometry = true;
      group.add(rim);
    }
    return { group, segments };
  }
  const columnTexture = loadTexture("./assets/column-hd.png");
  const columnMat = new THREE4.MeshBasicMaterial({ map: columnTexture, toneMapped: false });
  columnMat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `
      #include <map_fragment>
      diffuseColor = vec4(mix(vec3(1.0, .77, .46), diffuseColor.rgb, diffuseColor.a), 1.0);
    `);
  };
  const columnGeo = new THREE4.CylinderGeometry(config.pillarRadius, config.pillarRadius, config.layerGap + 6e-3, 64);
  const cp = columnGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    columnGeo.attributes.uv.setXY(
      i,
      0.5 + 0.18 * cp.getX(i) / config.pillarRadius,
      1 - (680 + (config.layerGap / 2 - cp.getY(i)) / config.layerGap * 480) / 1672
    );
  }
  function createColumn(index) {
    const group = new THREE4.Group();
    group.position.y = -index * config.layerGap;
    const body = new THREE4.Mesh(columnGeo, columnMat);
    body.position.y = -config.layerGap / 2;
    group.add(body);
    if (index === 0) {
      const cap = new THREE4.Mesh(columnCapGeo, materials.ivory);
      cap.position.y = 0.012;
      group.add(cap);
      const rim = new THREE4.Mesh(columnRimGeo, materials.ivory);
      rim.position.y = 0.025;
      group.add(rim);
    }
    return group;
  }
  const columnCapGeo = new THREE4.CylinderGeometry(config.pillarRadius, config.pillarRadius, 0.04, 64);
  const columnRimGeo = new THREE4.TorusGeometry(config.pillarRadius - 0.03, 0.055, 10, 64);
  columnRimGeo.rotateX(Math.PI / 2);
  const contactRingGeo = new THREE4.TorusGeometry(0.34, 0.065, 10, 40);
  contactRingGeo.rotateX(Math.PI / 2);
  function createPoisonContact() {
    const group = new THREE4.Group();
    const ring = new THREE4.Mesh(contactRingGeo, materials.redBubble);
    ring.scale.set(1.25, 1, 0.8);
    group.add(ring);
    for (let i = 0; i < 5; i++) {
      const a = i * TAU2 / 5;
      const bubble = new THREE4.Mesh(sphere, materials.redBubble);
      bubble.scale.setScalar(0.035 + i % 2 * 0.024);
      bubble.position.set(Math.cos(a) * 0.45, 0.025, Math.sin(a) * 0.28);
      group.add(bubble);
    }
    return group;
  }
  const sparkleTexture = canvasTexture(64, 64, (ctx) => {
    const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    glow.addColorStop(0, "#ffffff");
    glow.addColorStop(0.2, "#fffbd1");
    glow.addColorStop(1, "rgba(255,247,176,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#fffef0";
    ctx.beginPath();
    ctx.moveTo(32, 4);
    ctx.quadraticCurveTo(35, 29, 59, 32);
    ctx.quadraticCurveTo(35, 35, 32, 60);
    ctx.quadraticCurveTo(29, 35, 5, 32);
    ctx.quadraticCurveTo(29, 29, 32, 4);
    ctx.fill();
  });
  const sparkles = new THREE4.Group();
  const rng = new SeededRandom(128);
  for (let i = 0; i < 22; i++) {
    const star = new THREE4.Sprite(new THREE4.SpriteMaterial({ map: sparkleTexture, transparent: true, depthWrite: false, toneMapped: false }));
    star.position.set(rng.range(-2.7, 2.7), rng.range(-7, 6), rng.range(1.5, 3));
    star.userData.phase = rng.range(0, TAU2);
    star.userData.size = rng.range(0.09, 0.23);
    sparkles.add(star);
  }
  scene2.add(sparkles);
  function animate(time, focusY) {
    sparkles.position.y = focusY;
    for (const star of sparkles.children) {
      const pulse2 = 0.45 + 0.55 * Math.sin(time * 1.7 + star.userData.phase) ** 4;
      star.scale.setScalar(star.userData.size * pulse2);
      star.material.opacity = pulse2 * 0.85;
    }
  }
  return {
    materials,
    platformMaterials,
    createPlatform,
    createColumn,
    createPoisonContact,
    animate,
    setSparklesVisible(visible) {
      sparkles.visible = visible;
    }
  };
}
function disposePlatform(group) {
  group.traverse((object) => {
    if (object.userData.ownedGeometry) object.geometry.dispose();
    if (object.userData.instanced) object.dispose();
  });
  group.removeFromParent();
}
function setVisibleTowerLayers(platforms, columns, focusY, reach) {
  for (const collection of [platforms, columns]) {
    for (const item of collection.values()) {
      const group = item.group || item;
      group.visible = Math.abs(group.position.y - focusY) <= reach;
    }
  }
}

// src/world-background.js?v=420b31c4fd6e
function createWorldBackground(scene2, loadTexture) {
  const texture = loadTexture(GAME_ASSETS.world);
  scene2.background = texture;
  let lastAspect = 0;
  return function resizeBackground2(aspect) {
    const image = texture.image;
    if (!image?.width || lastAspect === aspect) return;
    lastAspect = aspect;
    const ratio = image.width / image.height / aspect;
    texture.repeat.set(Math.min(1, 1 / ratio), Math.min(1, ratio));
    texture.offset.set((1 - texture.repeat.x) / 2, (1 - texture.repeat.y) / 2);
    texture.updateMatrix();
  };
}

// src/material-switcher.js?v=420b31c4fd6e
var presetName = (id) => t(`preset${id[0].toUpperCase()}${id.slice(1)}`);
function mountMaterialSwitcher(art2, root, parent) {
  if (globalThis.__CAT_FIXED_JELLY__ === true) return;
  const panel = document.createElement("details");
  panel.className = "material-switcher";
  const summary = document.createElement("summary");
  panel.appendChild(summary);
  const options = document.createElement("div");
  options.className = "material-menu";
  options.setAttribute("role", "group");
  options.setAttribute("aria-label", t("materialGroup"));
  panel.appendChild(options);
  let saveState = null;
  function refresh() {
    summary.textContent = t("materialSummary", { name: presetName(art2.platformMaterials.id) });
    options.setAttribute("aria-label", t("materialGroup"));
    if (saveState !== null) summary.title = t(saveState ? "materialSaved" : "materialUrl");
    for (const button of options.querySelectorAll("button")) {
      button.textContent = presetName(button.dataset.preset);
      button.setAttribute("aria-pressed", String(button.dataset.preset === art2.platformMaterials.id));
    }
    link.textContent = t("materialLabLink");
  }
  const requested = new URLSearchParams(location.search).get("material");
  if (PLATFORM_PRESETS.some((p) => p.id === requested)) art2.platformMaterials.select(requested, root);
  for (const preset of PLATFORM_PRESETS) {
    const button = document.createElement("button");
    button.dataset.preset = preset.id;
    button.textContent = presetName(preset.id);
    button.addEventListener("click", () => {
      art2.platformMaterials.select(preset.id, root);
      const saved = savePlatformPreset(preset.id);
      saveState = saved;
      const url = new URL(location.href);
      url.searchParams.set("material", preset.id);
      history.replaceState(null, "", url);
      refresh();
      panel.open = false;
    });
    options.appendChild(button);
  }
  const link = document.createElement("a");
  link.href = "./material-lab.html";
  link.textContent = t("materialLabLink");
  options.appendChild(link);
  refresh();
  document.addEventListener("cat-language-change", refresh);
  parent.appendChild(panel);
}

// src/cat-characters.mjs?v=420b31c4fd6e
var CAT_CHOICE_KEY = "cat-tower.character.v1";
var CAT_COLLECTION_KEY = "cat-tower.cat-collection.v1";
var ROUND_UNLOCK_DEPTH = 100;
var roundPath = (name) => `./assets/cats/round/${name}-game.png`;
var CAT_CHARACTERS = Object.freeze({
  classic: Object.freeze({ id: "classic", nameKey: "catClassic", unlockDepth: 0, sources: CAT_SOURCES, victory: GAME_ASSETS.levelVictory }),
  round: Object.freeze({ id: "round", nameKey: "catRound", unlockDepth: ROUND_UNLOCK_DEPTH, sources: Object.freeze({
    idle: roundPath("cat-idle"),
    fall: roundPath("cat-fall"),
    eat: roundPath("cat-eat"),
    squash: roundPath("cat-squash"),
    fail: roundPath("cat-fail")
  }), victory: roundPath("level-victory-cat") })
});
var CHARACTER_ASSET_PATHS = Object.freeze([...new Set(Object.values(CAT_CHARACTERS).flatMap((character) => [...Object.values(character.sources), character.victory]))]);
function resolveCatId(value) {
  return value === "round" ? "round" : "classic";
}
var validDepth = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;
function readObject(read, key2) {
  try {
    const value = read(key2);
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}
function loadCatChoice(read, bestDepth = 0) {
  try {
    const id = resolveCatId(read(CAT_CHOICE_KEY));
    return validDepth(bestDepth) >= CAT_CHARACTERS[id].unlockDepth ? id : "classic";
  } catch {
    return "classic";
  }
}
function saveCatChoice(write, id, bestDepth = 0) {
  const resolved = resolveCatId(id);
  const selected = validDepth(bestDepth) >= CAT_CHARACTERS[resolved].unlockDepth ? resolved : "classic";
  try {
    write(CAT_CHOICE_KEY, selected);
  } catch {
  }
  return selected;
}
function createCatCollection(read, write, bestDepth = 0) {
  let depth = Math.min(ROUND_UNLOCK_DEPTH, Math.max(
    validDepth(bestDepth),
    validDepth(readObject(read, CAT_COLLECTION_KEY)?.depth),
    validDepth(readObject(read, "cat-tower.best-record.v1")?.depth)
  ));
  let selected = loadCatChoice(read, depth);
  const persist = () => {
    try {
      write(CAT_COLLECTION_KEY, JSON.stringify({ depth }));
    } catch {
    }
  };
  persist();
  saveCatChoice(write, selected, depth);
  return {
    get selected() {
      return selected;
    },
    get depth() {
      return depth;
    },
    owns(id) {
      return !!CAT_CHARACTERS[id] && depth >= CAT_CHARACTERS[id].unlockDepth;
    },
    recordDepth(value) {
      const next = Math.min(ROUND_UNLOCK_DEPTH, Math.max(depth, validDepth(value)));
      if (next === depth) return false;
      const unlocked = depth < ROUND_UNLOCK_DEPTH && next >= ROUND_UNLOCK_DEPTH;
      depth = next;
      persist();
      return unlocked;
    },
    select(id) {
      if (!this.owns(id)) return false;
      selected = saveCatChoice(write, id, depth);
      return true;
    }
  };
}
var roundFeet = Object.freeze({
  idle: 49 / 512,
  fall: 34 / 512,
  eat: 33 / 512,
  fail: 55 / 512,
  squash: 47 / 512
});
function catOriginY(id, pose) {
  return id === "round" ? roundFeet[pose] ?? roundFeet.idle : 0.065;
}
function catDeformation(id, squash2, falling, pulse2 = 0) {
  const round = id === "round";
  return {
    x: (1 + pulse2 + squash2 * (round ? 0.02 : 0.12)) * (falling && !round ? 0.96 : 1),
    y: (1 + pulse2 * 0.55 - squash2 * (round ? 0.03 : 0.18)) * (falling && !round ? 1.04 : 1)
  };
}
function catMouthUV(id) {
  return id === "round" ? { x: 0.515, y: 0.74 } : null;
}

// src/game-sounds.mjs?v=420b31c4fd6e
var GAME_SOUNDS = Object.freeze({
  ...Object.fromEntries(["combo", "low", "hazard", "starved"].map((name) => [name, `./assets/sfx/${name}.wav`])),
  jump: "./assets/sfx/jump.wav",
  land: "./assets/sfx/land-soft.wav",
  eat: "./assets/sfx/pop-cogitollc-1.wav",
  smash: "./assets/sfx/pop-cogitollc-1.wav",
  pickup: "./assets/sfx/pickup-energy-chime-fast.wav"
});
function createWebSounds() {
  const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
  const diagnostics = globalThis.__CAT_STARTUP_DIAGNOSTICS__;
  let context = null, enabled = true, failures = 0, resuming = false;
  const buffers = /* @__PURE__ */ new Map();
  function note(message) {
    diagnostics?.note("音频：" + message);
  }
  diagnostics?.capability("音频", AudioContext ? "等待手势解锁" : "无接口，静音运行");
  const sourceData = new Map(Object.entries(GAME_SOUNDS).map(([name, url]) => [
    name,
    Promise.resolve().then(() => fetch(url, { cache: "no-cache" }).then((response) => {
      if (!response.ok) throw new Error(`音效加载失败：${url}`);
      return response.arrayBuffer();
    })).catch(() => {
      note("音效资源不可用 " + name);
      return null;
    })
  ]));
  function decode(bytes) {
    return new Promise((resolve, reject) => {
      try {
        const result = context.decodeAudioData(bytes.slice(0), resolve, reject);
        if (result && typeof result.then === "function") result.then(resolve, reject);
      } catch (error) {
        reject(error);
      }
    });
  }
  function unlock() {
    if (!enabled || !AudioContext || failures >= 3) return;
    try {
      if (!context) {
        context = new AudioContext({ latencyHint: "interactive" });
        for (const [name, data] of sourceData) data.then((bytes) => bytes && decode(bytes)).then((buffer) => {
          if (buffer) buffers.set(name, buffer);
        }).catch(() => note("音效解码失败 " + name));
      }
      if (context.state === "running") {
        diagnostics?.capability("音频", "Web Audio");
        return;
      }
      if (resuming) return;
      const result = context.resume();
      if (result && typeof result.then === "function") {
        resuming = true;
        result.then(() => {
          resuming = false;
          diagnostics?.capability("音频", "Web Audio");
        }, () => {
          resuming = false;
          failures++;
          note("恢复失败，本次操作继续");
        });
      } else diagnostics?.capability("音频", "Web Audio 旧接口");
    } catch {
      failures++;
      note("解锁失败，本次操作继续");
    }
  }
  return {
    unlock,
    setEnabled(value) {
      enabled = !!value;
      if (enabled) unlock();
    },
    play(name) {
      if (!enabled || !context || context.state !== "running") return;
      const buffer = buffers.get(name);
      if (!buffer) return;
      try {
        const source = context.createBufferSource();
        const gain = context.createGain();
        gain.gain.value = 0.6;
        source.buffer = buffer;
        source.connect(gain).connect(context.destination);
        source.start();
      } catch {
        note("播放失败 " + name);
      }
    }
  };
}

// src/powerups.mjs?v=420b31c4fd6e
var POWERUP_TYPES = Object.freeze(["burst", "shield", "energy"]);
var POWERUP_CONFIG = Object.freeze({
  duration: 3,
  energyScore: 3e3,
  burstRefreshCap: 6,
  spawnMin: 5,
  spawnMax: 8,
  pickupHeight: 1.05,
  pickupVerticalRadius: 0.6,
  pickupAngleRadius: 0.28,
  catCenterOffset: 0.45
});
function restoreJumps(rules2, amount) {
  if (!rules2 || !Number.isFinite(rules2.jumps) || !Number.isFinite(rules2.maxJumps) || !Number.isFinite(rules2.score)) return null;
  const jumpsAdded = Math.min(amount, Math.max(0, rules2.maxJumps - rules2.jumps));
  const bonusScore = (amount - jumpsAdded) * 50;
  rules2.jumps += jumpsAdded;
  rules2.score += bonusScore;
  return { jumpsAdded, bonusScore };
}
var PowerupState = class {
  constructor() {
    this.reset();
  }
  reset() {
    this.burstRemaining = 0;
    this.shieldCharges = 0;
    this.burstLandingReady = false;
  }
  get bursting() {
    return this.burstRemaining > 0;
  }
  get shielded() {
    return this.shieldCharges > 0;
  }
  tick(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const wasBursting = this.bursting;
    this.burstRemaining = Math.max(0, this.burstRemaining - dt);
    if (wasBursting && !this.bursting) this.burstLandingReady = true;
  }
  collect(type, rules2) {
    if (!POWERUP_TYPES.includes(type) || rules2?.alive === false) return null;
    let jumpsAdded = 0, bonusScore = 0, converted = false;
    if (type === "burst") {
      this.burstLandingReady = false;
      this.burstRemaining = Math.min(
        POWERUP_CONFIG.burstRefreshCap,
        this.burstRemaining + POWERUP_CONFIG.duration
      );
    } else if (type === "shield" && !this.shielded) {
      this.shieldCharges = 1;
    } else if (type === "energy") {
      if (!rules2 || !Number.isFinite(rules2.score)) return null;
      bonusScore = POWERUP_CONFIG.energyScore;
      rules2.score += bonusScore;
    } else {
      converted = true;
      const restoration = restoreJumps(rules2, 2);
      if (!restoration) return null;
      ({ jumpsAdded, bonusScore } = restoration);
    }
    return {
      type,
      burstRemaining: this.burstRemaining,
      shieldCharges: this.shieldCharges,
      jumpsAdded,
      bonusScore,
      converted
    };
  }
  consumeBurstLanding() {
    const ready = this.burstLandingReady;
    this.burstLandingReady = false;
    return ready;
  }
  absorbHazard() {
    if (!this.shielded) return false;
    this.shieldCharges = 0;
    return true;
  }
  snapshot() {
    return {
      burstRemaining: this.burstRemaining,
      shieldCharges: this.shieldCharges,
      bursting: this.bursting,
      shielded: this.shielded
    };
  }
};
var PowerupGenerator = class {
  constructor(seed = 12345) {
    this.rng = new SeededRandom(seed >>> 0 ^ 2654435769);
    this.nextDepth = 14 + POWERUP_CONFIG.spawnMin;
    this.lastType = null;
  }
  create(layerData) {
    const depth = layerData?.depth;
    if (!Number.isInteger(depth) || depth < 0) return null;
    const introType = depth === 4 ? "energy" : depth === 8 ? "shield" : depth === 14 ? "burst" : null;
    if (!introType && (depth < 14 || depth < this.nextDepth)) return null;
    const blocks = platformSpans(layerData);
    const safe = blocks.filter((block2) => block2.type === "safe");
    const hazard = blocks.filter((block2) => block2.type === "hazard");
    const types = POWERUP_TYPES.filter((type2) => type2 !== this.lastType && (type2 === "energy" ? safe.length : hazard.length));
    const type = introType || (types.length ? this.rng.pick(types) : null);
    if (depth >= 14) this.nextDepth = depth + this.rng.int(POWERUP_CONFIG.spawnMin, POWERUP_CONFIG.spawnMax);
    if (!type) return null;
    const candidates = type === "energy" ? safe : hazard;
    if (!candidates.length) return null;
    const block = this.rng.pick(candidates);
    this.lastType = type;
    return { type, angle: normalizeAngle(block.start + block.width / 2), layer: depth };
  }
};
function powerupInReach(pickup, localAngle, prevY, currentY, layerTopY2) {
  if (!pickup || ![pickup.angle, localAngle, prevY, currentY, layerTopY2].every(Number.isFinite) || currentY > prevY) return false;
  const angleDistance = Math.abs(normalizeAngle(localAngle - pickup.angle + Math.PI) - Math.PI);
  if (angleDistance > POWERUP_CONFIG.pickupAngleRadius) return false;
  const pickupY = layerTopY2 + POWERUP_CONFIG.pickupHeight;
  const prevCenter = prevY + POWERUP_CONFIG.catCenterOffset;
  const currentCenter = currentY + POWERUP_CONFIG.catCenterOffset;
  return prevCenter >= pickupY - POWERUP_CONFIG.pickupVerticalRadius && currentCenter <= pickupY + POWERUP_CONFIG.pickupVerticalRadius;
}

// src/charged-cat-effect.js?v=420b31c4fd6e
function createChargedCatEffect(THREE6, { texture, spriteMaterial, catSprite, glowMap }) {
  const group = new THREE6.Group();
  group.name = "charged-cat-energy";
  const geometries = [];
  const ribbonMap = texture((ctx) => {
    const fill2 = ctx.createLinearGradient(0, 0, 0, 256);
    for (const [stop, color] of [
      [0, "#d7558700"],
      [0.17, "#ed6698bb"],
      [0.36, "#ff98c4f5"],
      [0.48, "#fff4ed"],
      [0.56, "#ffffff"],
      [0.72, "#ffc0cddd"],
      [1, "#e55e9300"]
    ]) fill2.addColorStop(stop, color);
    ctx.fillStyle = fill2;
    ctx.fillRect(0, 0, 256, 256);
  });
  const pawMap = texture((ctx) => {
    ctx.shadowColor = "#e870a6";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#fff4ec";
    for (const [x, y, radius] of [[80, 87, 23], [126, 66, 24], [172, 91, 23]]) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(76, 159);
    ctx.bezierCurveTo(77, 111, 114, 101, 128, 126);
    ctx.bezierCurveTo(152, 103, 182, 135, 180, 163);
    ctx.bezierCurveTo(177, 192, 137, 174, 128, 177);
    ctx.bezierCurveTo(111, 181, 76, 190, 76, 159);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffadcd";
    for (const [x, y] of [[80, 87], [126, 66], [172, 91]]) {
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ellipsePath(ctx, 128, 155, 25, 19, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  const pearlMap = texture((ctx) => {
    const fill2 = ctx.createRadialGradient(111, 104, 5, 128, 128, 82);
    fill2.addColorStop(0, "#ffffff");
    fill2.addColorStop(0.35, "#fff3f0");
    fill2.addColorStop(0.68, "#ffc6dae6");
    fill2.addColorStop(1, "#e75c9500");
    ctx.fillStyle = fill2;
    ctx.fillRect(0, 0, 256, 256);
  });
  const halo = new THREE6.Sprite(spriteMaterial(glowMap, { depthTest: false, color: "#ff80b7" }));
  halo.name = "soft-body-light";
  halo.renderOrder = 3;
  halo.position.y = 0.16;
  group.add(halo);
  const outlines = ["vec3(1.0, 0.38, 0.62)", "vec3(1.0, 0.97, 0.94)"].map((color, i) => {
    const material = spriteMaterial(catSprite.material.map, { depthTest: false, alphaTest: 0.025 });
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        "#include <map_fragment>\n diffuseColor.rgb = " + color + ";"
      );
    };
    material.customProgramCacheKey = () => "charged-cat-outline-" + i;
    const sprite = new THREE6.Sprite(material);
    sprite.name = "elastic-cat-outline";
    sprite.center.copy(catSprite.center);
    sprite.renderOrder = 4;
    group.add(sprite);
    return sprite;
  });
  const worldPosition = new THREE6.Vector3(), worldScale = new THREE6.Vector3();
  const segments = 40;
  const ribbons = Array.from({ length: 6 }, (_, i) => {
    const geometry = new THREE6.BufferGeometry();
    geometries.push(geometry);
    const positions = new Float32Array((segments + 1) * 6);
    const uv = new Float32Array((segments + 1) * 4), indices = [];
    for (let j = 0; j <= segments; j++) {
      uv.set([j / segments, 0, j / segments, 1], j * 4);
      if (j < segments) indices.push(j * 2, j * 2 + 1, j * 2 + 2, j * 2 + 1, j * 2 + 3, j * 2 + 2);
    }
    geometry.setAttribute("position", new THREE6.BufferAttribute(positions, 3).setUsage(THREE6.DynamicDrawUsage));
    geometry.setAttribute("uv", new THREE6.BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    const material = new THREE6.MeshBasicMaterial({
      map: ribbonMap,
      transparent: true,
      side: THREE6.DoubleSide,
      depthTest: false,
      depthWrite: false,
      toneMapped: false
    });
    const mesh = new THREE6.Mesh(geometry, material);
    mesh.name = "flowing-candy-ribbon";
    mesh.renderOrder = 4;
    mesh.frustumCulled = false;
    mesh.onBeforeRender = (_renderer, _scene, camera2) => {
      mesh.quaternion.copy(camera2.quaternion);
      mesh.updateMatrixWorld();
    };
    group.add(mesh);
    return { mesh, positions, side: i % 2 ? 1 : -1, phase: Math.floor(i / 2) / 3 };
  });
  const paws = Array.from({ length: 4 }, () => {
    const sprite = new THREE6.Sprite(spriteMaterial(pawMap, { depthTest: false }));
    sprite.name = "rising-paw";
    sprite.renderOrder = 4;
    group.add(sprite);
    return sprite;
  });
  const pearls = Array.from({ length: 8 }, () => {
    const sprite = new THREE6.Sprite(spriteMaterial(pearlMap, { depthTest: false }));
    sprite.name = "candy-pearl";
    sprite.renderOrder = 4;
    group.add(sprite);
    return sprite;
  });
  function path(t2, side, time, phase) {
    return {
      x: side * (0.52 + Math.sin(t2 * Math.PI) * 0.28 + Math.sin(t2 * 9 - time * 6 + phase) * 0.12),
      y: -0.65 + t2 * 1.53 + Math.sin(t2 * 8 - time * 5 + phase) * 0.06
    };
  }
  return {
    group,
    update(elapsed, time) {
      const bodyScale = THREE6.MathUtils.clamp(catSprite.scale.x / 1.5, 0.72, 1.35);
      const entrance = Math.sin(Math.min(elapsed / 0.32, 1) * Math.PI / 2);
      group.scale.setScalar(bodyScale * (0.86 + entrance * 0.14));
      halo.scale.set(1.7 + Math.sin(time * 7) * 0.16, 1.95 + Math.sin(time * 7) * 0.12, 1);
      halo.material.opacity = 0.24 + Math.sin(time * 7) * 0.07;
      group.updateWorldMatrix(true, false);
      catSprite.getWorldPosition(worldPosition);
      catSprite.getWorldScale(worldScale);
      group.worldToLocal(worldPosition);
      for (let i = 0; i < outlines.length; i++) {
        const expand = i === 0 ? 1.085 + Math.sin(time * 8) * 0.022 : 1.037 + Math.sin(time * 8) * 7e-3;
        outlines[i].material.map = catSprite.material.map;
        outlines[i].material.rotation = catSprite.material.rotation;
        outlines[i].material.opacity = entrance * (i === 0 ? 0.7 : 0.9);
        outlines[i].position.copy(worldPosition);
        outlines[i].scale.copy(worldScale).divideScalar(group.scale.x).multiplyScalar(expand);
        outlines[i].position.y -= (outlines[i].scale.y - worldScale.y / group.scale.x) * (0.5 - catSprite.center.y);
      }
      for (const ribbon of ribbons) {
        const head = (elapsed * 0.82 + ribbon.phase) % 1 * 1.86 - 0.32;
        for (let j = 0; j <= segments; j++) {
          const along = j / segments;
          const t2 = THREE6.MathUtils.clamp(head - 0.58 + along * 0.58, 0, 1);
          const center = path(t2, ribbon.side, time, ribbon.phase * 6);
          const before = path(Math.max(0, t2 - 5e-3), ribbon.side, time, ribbon.phase * 6);
          const after = path(Math.min(1, t2 + 5e-3), ribbon.side, time, ribbon.phase * 6);
          const dx = after.x - before.x, dy = after.y - before.y;
          const length = Math.hypot(dx, dy) || 1;
          const edgeFade = Math.sqrt(Math.max(0, Math.sin(t2 * Math.PI)));
          const width = edgeFade * Math.pow(Math.sin(along * Math.PI), 0.7) * (0.22 + 0.075 * Math.sin(time * 7 + t2 * 8));
          ribbon.positions.set([
            center.x - dy / length * width,
            center.y + dx / length * width,
            0,
            center.x + dy / length * width,
            center.y - dx / length * width,
            0
          ], j * 6);
        }
        ribbon.mesh.geometry.attributes.position.needsUpdate = true;
        ribbon.mesh.material.opacity = entrance * 0.92;
      }
      for (let i = 0; i < paws.length; i++) {
        const progress = (elapsed * 0.62 + i * 0.25) % 1, side = i % 2 ? 1 : -1;
        const point = path(progress, side, time, i);
        paws[i].position.set(point.x + side * 0.12, point.y, 0.01);
        const size = 0.2 + Math.sin(progress * Math.PI) * 0.16;
        const squash2 = Math.sin(time * 9 + i) * 0.12;
        paws[i].scale.set(size * (1 + squash2), size * (1 - squash2), 1);
        paws[i].material.rotation = side * (0.2 + Math.sin(time * 4 + i) * 0.28);
        paws[i].material.opacity = Math.sin(progress * Math.PI) * entrance;
      }
      for (let i = 0; i < pearls.length; i++) {
        const progress = (elapsed * 1.16 + i / pearls.length) % 1, side = i % 2 ? 1 : -1;
        pearls[i].position.set(
          side * (0.68 + Math.sin(progress * Math.PI) * 0.34 + Math.sin(time * 5 + i) * 0.08),
          -0.65 + progress * 1.6,
          0.01
        );
        const size = (0.085 + i % 3 * 0.025) * (0.6 + Math.sin(progress * Math.PI) * 0.9);
        pearls[i].scale.set(size, size * (1.25 + Math.sin(time * 8 + i) * 0.2), 1);
        pearls[i].material.opacity = Math.sin(progress * Math.PI) * entrance;
      }
    },
    dispose() {
      group.removeFromParent();
      for (const { mesh } of ribbons) mesh.material.dispose();
      for (const geometry of geometries) geometry.dispose();
    }
  };
}

// src/powerup-art.js?v=420b31c4fd6e
var TAU3 = Math.PI * 2;
function createPowerupArt(THREE6, createCanvas = () => document.createElement("canvas"), loadTexture) {
  const textures = [];
  const materials = [];
  const auras = [];
  const colors = { burst: "#ff9a32", shield: "#63d9f4", energy: "#ffd967" };
  function texture(paint) {
    const canvas = createCanvas();
    canvas.width = canvas.height = 384;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Powerup art requires a 2D canvas");
    ctx.scale(1.5, 1.5);
    paint(ctx);
    const map = new THREE6.CanvasTexture(canvas);
    map.colorSpace = THREE6.SRGBColorSpace;
    textures.push(map);
    return map;
  }
  function spriteMaterial(map, extra = {}) {
    const material = new THREE6.SpriteMaterial({
      map,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      ...extra
    });
    materials.push(material);
    return material;
  }
  function circle(ctx, x, y, radius, fill2, stroke, lineWidth = 5) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU3);
    ctx.fillStyle = fill2;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }
  function sparkle(ctx, x, y, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.quadraticCurveTo(x + size * 0.2, y - size * 0.2, x + size, y);
    ctx.quadraticCurveTo(x + size * 0.2, y + size * 0.2, x, y + size);
    ctx.quadraticCurveTo(x - size * 0.2, y + size * 0.2, x - size, y);
    ctx.quadraticCurveTo(x - size * 0.2, y - size * 0.2, x, y - size);
    ctx.fill();
  }
  const imageLoader = loadTexture ? null : new THREE6.TextureLoader();
  const iconSources = {
    burst: GAME_ASSETS.powerupBurst,
    shield: GAME_ASSETS.powerupShield,
    energy: GAME_ASSETS.powerupEnergy
  };
  const iconMaterials = Object.fromEntries(Object.entries(iconSources).map(([type, path]) => {
    const map = loadTexture ? loadTexture(path) : imageLoader.load(path);
    map.colorSpace = THREE6.SRGBColorSpace;
    if (!loadTexture) textures.push(map);
    return [type, spriteMaterial(map, { alphaTest: 0.025 })];
  }));
  const glowMap = texture((ctx) => {
    const fill2 = ctx.createRadialGradient(128, 128, 25, 128, 128, 126);
    fill2.addColorStop(0, "#ffffff88");
    fill2.addColorStop(0.55, "#ffffff35");
    fill2.addColorStop(1, "#ffffff00");
    ctx.fillStyle = fill2;
    ctx.fillRect(0, 0, 256, 256);
  });
  const glowMaterials = Object.fromEntries(Object.keys(colors).map((type) => [type, spriteMaterial(glowMap, { color: colors[type], opacity: 0.35 })]));
  function createPickup(type, angle, config) {
    if (!iconMaterials[type]) throw new Error(`Unknown powerup type: ${type}`);
    const group = new THREE6.Group();
    group.position.set(
      Math.sin(angle) * config.catZ,
      config.platformThickness / 2 + POWERUP_CONFIG.pickupHeight,
      Math.cos(angle) * config.catZ
    );
    group.userData.powerupType = type;
    group.userData.powerupBaseY = group.position.y;
    group.userData.powerupPhase = angle * 2;
    const glow = new THREE6.Sprite(glowMaterials[type]);
    glow.scale.setScalar(1.18);
    group.add(glow);
    const icon = new THREE6.Sprite(iconMaterials[type]);
    icon.scale.setScalar(0.94);
    icon.position.z = 0.012;
    group.add(icon);
    return group;
  }
  function animatePickup(node, time) {
    const phase = node.userData.powerupPhase || 0;
    node.position.y = node.userData.powerupBaseY + Math.sin(time * 3.3 + phase) * 0.035;
    node.scale.setScalar(1 + Math.sin(time * 4.5 + phase) * 0.045);
    glowMaterials[node.userData.powerupType].opacity = 0.35 + Math.sin(time * 3) * 0.08;
  }
  const shieldMap = texture((ctx) => {
    const fill2 = ctx.createRadialGradient(128, 128, 82, 128, 128, 118);
    fill2.addColorStop(0, "#86e9ff00");
    fill2.addColorStop(0.78, "#7cdfff25");
    fill2.addColorStop(0.94, "#9ff0ff88");
    fill2.addColorStop(1, "#6bdfff00");
    circle(ctx, 128, 128, 118, fill2);
    ctx.strokeStyle = "#b8f7ff";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(128, 128, 113, 0, TAU3);
    ctx.stroke();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(128, 128, 104, Math.PI * 1.05, Math.PI * 1.34);
    ctx.stroke();
    sparkle(ctx, 205, 47, 9, "#fff");
  });
  const burstMap = texture((ctx) => {
    ctx.lineCap = "round";
    for (const [x, top, bottom, width] of [
      [28, 76, 215, 8],
      [46, 103, 232, 5],
      [228, 68, 209, 8],
      [209, 116, 238, 5]
    ]) {
      const fill2 = ctx.createLinearGradient(0, top, 0, bottom);
      fill2.addColorStop(0, "#fff1a200");
      fill2.addColorStop(0.45, "#ffcb60d9");
      fill2.addColorStop(1, "#fff5ce");
      ctx.strokeStyle = fill2;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }
    ctx.strokeStyle = "#ffbb65";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ellipsePath(ctx, 128, 218, 77, 18, 0, 0, TAU3);
    ctx.stroke();
    sparkle(ctx, 38, 55, 12, "#fff5c4");
    sparkle(ctx, 220, 41, 9, "#fff5c4");
  });
  const flashMap = texture((ctx) => {
    ctx.strokeStyle = "#fff9d2";
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.arc(128, 128, 102, 0, TAU3);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const angle = i * TAU3 / 8;
      sparkle(ctx, 128 + Math.cos(angle) * 106, 128 + Math.sin(angle) * 106, 7, "#fff");
    }
  });
  function createAura(parent, catSprite) {
    catSprite.renderOrder = 5;
    const group = new THREE6.Group();
    group.position.y = 0.42;
    parent.add(group);
    const shield = new THREE6.Sprite(spriteMaterial(shieldMap, { depthTest: false, opacity: 0.86 }));
    const burst = new THREE6.Sprite(spriteMaterial(burstMap, { depthTest: false, opacity: 0.95 }));
    const flash = new THREE6.Sprite(spriteMaterial(flashMap, { depthTest: false, opacity: 0 }));
    const readyEffect = createChargedCatEffect(THREE6, { texture, spriteMaterial, catSprite, glowMap });
    const breakthrough = readyEffect.group;
    shield.scale.set(1.6, 1.76, 1);
    burst.scale.set(1.77, 1.84, 1);
    shield.renderOrder = burst.renderOrder = 6;
    flash.renderOrder = 7;
    group.add(shield, burst, breakthrough, flash);
    let wasBurst = false, wasShield = false, wasReady = false, flashStarted = -Infinity, readyStarted = -Infinity;
    group.visible = shield.visible = burst.visible = breakthrough.visible = flash.visible = false;
    const aura = {
      group,
      breakthrough,
      disposeReady: () => readyEffect.dispose(),
      update(state2, time, hasReady = false) {
        const hasBurst = state2.burstRemaining > 0;
        const hasShield = state2.shieldCharges > 0;
        if (hasReady && !wasReady) readyStarted = time;
        if (hasBurst && !wasBurst || hasShield && !wasShield) {
          flashStarted = time;
          flash.material.color.set(hasBurst && !wasBurst ? "#ffcf79" : "#99eeff");
        }
        wasBurst = hasBurst;
        wasShield = hasShield;
        wasReady = hasReady;
        const pulse2 = Math.sin(time * 5) * 0.025;
        shield.visible = hasShield;
        burst.visible = hasBurst;
        breakthrough.visible = hasReady;
        if (hasReady) readyEffect.update(Math.max(0, time - readyStarted), time);
        shield.scale.set(1.6 + pulse2, 1.76 + pulse2, 1);
        burst.material.opacity = 0.8 + Math.sin(time * 16) * 0.12;
        const progress = (time - flashStarted) / 0.34;
        flash.visible = progress >= 0 && progress < 1;
        if (flash.visible) {
          flash.scale.setScalar(1.35 + progress * 0.85);
          flash.material.opacity = (1 - progress) * 0.86;
        }
        group.visible = hasBurst || hasShield || hasReady || flash.visible;
      },
      clear() {
        wasBurst = wasShield = wasReady = false;
        flashStarted = readyStarted = -Infinity;
        group.visible = shield.visible = burst.visible = breakthrough.visible = flash.visible = false;
      }
    };
    auras.push(aura);
    return aura;
  }
  return {
    createPickup,
    animatePickup,
    createAura,
    dispose() {
      for (const aura of auras) {
        aura.disposeReady();
        aura.group.removeFromParent();
      }
      for (const material of materials) material.dispose();
      for (const map of textures) map.dispose();
    }
  };
}

// src/levels.mjs?v=420b31c4fd6e
var LEVELS = Object.freeze([
  { id: 1, name: "奶油初旅", layers: 8, goal: "bounce", target: 3 },
  { id: 2, name: "草莓转角", layers: 12, goal: "bounce", target: 4 },
  { id: 3, name: "一口五层", layers: 14, goal: "combo", target: 5 },
  { id: 4, name: "泡泡护航", layers: 16, goal: "shield", target: 1 },
  { id: 5, name: "焦糖冲刺", layers: 20, goal: "burst", target: 1 }
].map((level) => Object.freeze(level)));
var LevelGenerator = class {
  constructor(level) {
    this.level = level;
  }
  create(depth) {
    if (depth === this.level.layers) {
      return { depth, gaps: [], hazards: [], blocks: platformSpans({ gaps: [], hazards: [] }), primaryAngle: 0, finish: true };
    }
    const { id } = this.level;
    const chain = (id === 3 || id === 5) && depth >= 3 && depth <= 7;
    const center = normalizeAngle(chain ? 0.8 : Math.sin(depth * 0.8 + id) * (id === 1 ? 0.3 : id === 2 ? 1.05 : 1.25));
    const width = (id === 1 ? 95 : id === 2 ? 85 : 75) * Math.PI / 180;
    const gaps = [{ start: normalizeAngle(center - width / 2), width }];
    const blocks = platformSpans({ gaps, hazards: [] });
    if (id >= 2 && depth >= 4 && !chain && depth % 3 === 1) {
      blocks.find((block) => block.type === "safe").type = "hazard";
    }
    const hazards = blocks.filter((block) => block.type === "hazard").map(({ start, width: width2 }) => ({ start, width: width2 }));
    return { depth, gaps, hazards, blocks, primaryAngle: center, width, chain };
  }
  pickup(data) {
    const type = this.level.id === 4 && data.depth === 4 ? "shield" : this.level.id === 5 && data.depth === 10 ? "burst" : null;
    if (!type) return null;
    const block = data.blocks.find((block2) => block2.type === "hazard");
    return block ? { type, angle: normalizeAngle(block.start + block.width / 2), layer: data.depth } : null;
  }
};
function levelStars(level, run) {
  if (!run.won) return 0;
  const goal = level.goal === "bounce" ? run.bounces <= level.target : level.goal === "combo" ? run.bestCombo >= level.target : run.pickups[level.goal] >= level.target;
  return 1 + Number(goal) + Number(goal && !run.revived);
}
function sanitizeProgress(saved) {
  return { stars: LEVELS.map((_, i) => Number.isInteger(saved?.stars?.[i]) ? Math.min(3, Math.max(0, saved.stars[i])) : 0) };
}
function unlockedLevel(progress) {
  const first = progress.stars.findIndex((stars) => stars === 0);
  return first < 0 ? LEVELS.length : first + 1;
}

// src/main.js
var THREE5 = globalThis.__THREE__;
if (!THREE5) throw new Error(t("threeMissing"));
var activeLevel = null;
var levelRun = { won: false, revived: false, bounces: 0, bestCombo: 0, pickups: { shield: 0, burst: 0 } };
var LEVEL_KEY = "cat-tower.levels.v1";
var levelProgress;
try {
  levelProgress = sanitizeProgress(JSON.parse(localStorage.getItem(LEVEL_KEY)));
} catch {
  levelProgress = sanitizeProgress(null);
}
var levelPanel = document.getElementById("levelPanel");
function goalText(level) {
  return t(`levelGoal_${level.goal}`, { count: level.target });
}
function renderLevels() {
  const list = document.getElementById("levelList");
  list.textContent = "";
  const next = unlockedLevel(levelProgress);
  for (const level of LEVELS) {
    const stars = levelProgress.stars[level.id - 1], locked = level.id > next;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `level-choice level-flavor-${level.id}${level.id === next ? " current" : ""}${locked ? " locked" : ""}`;
    button.disabled = locked;
    button.dataset.level = level.id;
    const icon = level.id === 4 ? "powerup-shield" : level.id === 5 ? "powerup-burst" : level.id === 3 ? "star-game" : "ui-depth-game";
    button.innerHTML = `<span class="level-number">${level.id}</span><img class="level-choice-icon" src="./assets/${icon}.png" alt="" />
      <span class="level-choice-copy"><strong>${t("levelName" + level.id)}</strong><small>${goalText(level)}</small></span>
      <span class="level-choice-end"><span class="level-layer-tag">${level.layers} ${t("depth")}</span><span class="level-mini-stars">${starImages(stars)}</span></span>
      ${locked ? '<span class="level-lock" aria-hidden="true">' + t("levelLocked") + "</span>" : ""}`;
    button.setAttribute("aria-label", `${t("levelNumber", { count: level.id })} ${t("levelName" + level.id)}, ${stars}/3, ${goalText(level)}`);
    button.addEventListener("click", () => startLevel(level));
    list.appendChild(button);
  }
  document.querySelector("#continueLevelBtn span").textContent = t("continueLevel", { count: next });
  document.getElementById("levelSummary").textContent = t("levelSummary", {
    count: levelProgress.stars.reduce((a, b) => a + b, 0),
    total: LEVELS.length * 3
  });
}
function starImages(count) {
  return [0, 1, 2].map((i) => `<img class="${i < count ? "earned" : "empty"}" style="--star-order:${i}" src="./assets/star-game.png" alt="${i < count ? "★" : "☆"}" />`).join("");
}
function startLevel(level) {
  activeLevel = level;
  levelPanel.classList.add("hidden");
  homeScreen.inert = false;
  sounds.unlock();
  stopHomeDemo();
  homeScreen.hidden = true;
  frameEl.classList.remove("at-home");
  frameEl.classList.add("in-level");
  resetGame();
  analytics.track("game_start", { entry: "level", level_id: level.id });
}
function openLevels() {
  renderLevels();
  levelPanel.classList.remove("hidden");
  homeScreen.inert = true;
  document.querySelector("#continueLevelBtn span").textContent = t("continueLevel", { count: unlockedLevel(levelProgress) });
  document.getElementById("continueLevelBtn").focus();
}
function closeLevels() {
  levelPanel.classList.add("hidden");
  homeScreen.inert = false;
  document.getElementById("levelBtn").focus();
}
document.getElementById("levelBtn").addEventListener("click", openLevels);
document.getElementById("closeLevelsBtn").addEventListener("click", closeLevels);
document.getElementById("continueLevelBtn").addEventListener("click", () => startLevel(LEVELS[unlockedLevel(levelProgress) - 1]));
document.getElementById("nextLevelBtn").addEventListener("click", () => {
  if (activeLevel && levelRun.won && activeLevel.id < LEVELS.length) startLevel(LEVELS[activeLevel.id]);
});
document.getElementById("resultLevelsBtn").addEventListener("click", () => {
  document.getElementById("homeBtn").click();
  openLevels();
});
levelPanel.addEventListener("click", (event) => {
  if (event.target === levelPanel) closeLevels();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !levelPanel.classList.contains("hidden")) closeLevels();
});
var gameEl = document.getElementById("game");
var frameEl = document.getElementById("phoneFrame");
var debugMode = new URLSearchParams(location.search).has("debug");
var homeScreen = document.getElementById("homeScreen");
var settingsPanel = document.getElementById("settingsPanel");
var settingsBtn = document.getElementById("settingsBtn");
var closeSettingsBtn = document.getElementById("closeSettingsBtn");
var settingsDoneBtn = document.getElementById("settingsDoneBtn");
var sounds = createWebSounds();
var hud = {
  depth: document.getElementById("depth"),
  jumps: document.getElementById("jumps"),
  score: document.getElementById("score"),
  jumpBox: document.getElementById("jumpBox"),
  combo: document.getElementById("combo"),
  toast: document.getElementById("toast"),
  gameOver: document.getElementById("gameOver"),
  deathEmoji: document.getElementById("deathEmoji"),
  deathTitle: document.getElementById("deathTitle"),
  deathText: document.getElementById("deathText"),
  finalDepth: document.getElementById("finalDepth"),
  finalCombo: document.getElementById("finalCombo"),
  finalScore: document.getElementById("finalScore"),
  restartBtn: document.getElementById("restartBtn"),
  reviveBtn: document.getElementById("reviveBtn"),
  reviveAction: document.getElementById("reviveAction"),
  adStatus: document.getElementById("adStatus"),
  tapActions: document.getElementById("tapActions"),
  homeTapActions: document.getElementById("homeTapActions"),
  homeTapStatus: document.getElementById("homeTapStatus"),
  leaderboardBtn: document.getElementById("leaderboardBtn"),
  shareBtn: document.getElementById("shareBtn"),
  achievementsBtn: document.getElementById("achievementsBtn"),
  powerups: document.getElementById("powerupHud"),
  burstBuff: document.getElementById("burstBuff"),
  burstTime: document.getElementById("burstBuffTime"),
  shieldBuff: document.getElementById("shieldBuff"),
  shieldTime: document.getElementById("shieldBuffTime")
};
var BEST_RECORD_KEY = "cat-tower.best-record.v1";
var homeRecordScore = document.getElementById("homeRecordScore");
var homeRecordDepth = document.getElementById("homeRecordDepth");
function loadBestRecord() {
  try {
    const saved = JSON.parse(localStorage.getItem(BEST_RECORD_KEY));
    return {
      score: Number.isSafeInteger(saved?.score) && saved.score >= 0 ? saved.score : 0,
      depth: Number.isSafeInteger(saved?.depth) && saved.depth >= 0 ? saved.depth : 0
    };
  } catch {
    return { score: 0, depth: 0 };
  }
}
var bestRecord = loadBestRecord();
var runBrokeRecord = false;
function renderBestRecord() {
  homeRecordScore.textContent = String(bestRecord.score);
  homeRecordDepth.textContent = String(bestRecord.depth);
}
function updateBestRecord() {
  if (activeLevel) return;
  recordCatDepth(rules.depth);
  const score = Math.max(bestRecord.score, rules.score);
  const depth = Math.max(bestRecord.depth, rules.depth);
  if (score === bestRecord.score && depth === bestRecord.depth) return;
  bestRecord = { score, depth };
  runBrokeRecord = true;
  renderBestRecord();
  try {
    localStorage.setItem(BEST_RECORD_KEY, JSON.stringify(bestRecord));
  } catch {
  }
}
renderBestRecord();
var tapServices = createTapServices({ onShareMoment: () => renderShareMoment() });
var analytics = createGameAnalytics();
void analytics.init();
tapServices.restoreRecord(bestRecord).then((merged) => {
  if (!merged) return;
  const score = Math.max(bestRecord.score, merged.score);
  const depth = Math.max(bestRecord.depth, merged.depth);
  if (score === bestRecord.score && depth === bestRecord.depth) return;
  bestRecord = { score, depth };
  recordCatDepth(depth, false);
  try {
    localStorage.setItem(BEST_RECORD_KEY, JSON.stringify(bestRecord));
  } catch {
  }
  renderBestRecord();
});
var scene = new THREE5.Scene();
scene.background = null;
scene.fog = new THREE5.Fog(15334143, 28, 52);
var initialW = Math.max(gameEl.clientWidth, 320);
var initialH = Math.max(gameEl.clientHeight, 568);
var camera = new THREE5.OrthographicCamera(-3.25, 3.25, 5.78, -5.78, 0.1, 100);
var renderer = new THREE5.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, GAME_CONFIG.maxPixelRatio));
renderer.setSize(initialW, initialH, false);
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE5.PCFSoftShadowMap;
renderer.outputColorSpace = THREE5.SRGBColorSpace;
renderer.toneMapping = THREE5.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.setClearColor(16777215, 0);
gameEl.appendChild(renderer.domElement);
var hemi = new THREE5.HemisphereLight(16775661, 11980008, 0.85);
scene.add(hemi);
var key = new THREE5.DirectionalLight(16774886, 2.4);
key.position.set(-5, 9, 7);
key.castShadow = false;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -8;
key.shadow.camera.right = 8;
key.shadow.camera.top = 8;
key.shadow.camera.bottom = -8;
scene.add(key);
var fill = new THREE5.DirectionalLight(12839679, 0.8);
fill.position.set(6, 4, -3);
scene.add(fill);
var towerRoot = new THREE5.Group();
scene.add(towerRoot);
var textureLoader = new THREE5.TextureLoader();
var artLoads = [];
function loadArtTexture(url) {
  const { texture: tex, ready } = loadTextureWithRetry(
    THREE5,
    textureLoader,
    url,
    { diagnostics: globalThis.__CAT_STARTUP_DIAGNOSTICS__ }
  );
  artLoads.push(ready);
  tex.colorSpace = THREE5.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}
var art = createArt(renderer, scene, GAME_CONFIG, loadArtTexture);
var resizeBackground = createWorldBackground(scene, loadArtTexture);
mountMaterialSwitcher(art, towerRoot, frameEl);
renderer.transmissionResolutionScale = GAME_CONFIG.transmissionResolutionScale;
var pillarRoot = new THREE5.Group();
scene.add(pillarRoot);
var pillarModules = /* @__PURE__ */ new Map();
function ensurePillarModules() {
  const depth = currentDepth();
  const start = Math.max(0, depth - GAME_CONFIG.keepBehind - 3);
  const end = depth + GAME_CONFIG.aheadLayers + 1;
  for (let i = start; i <= end; i++) {
    if (!pillarModules.has(i)) {
      const module = art.createColumn(i);
      pillarRoot.add(module);
      pillarModules.set(i, module);
    }
  }
  for (const [i, group] of pillarModules) {
    if (i < start || i > end) {
      pillarRoot.remove(group);
      pillarModules.delete(i);
    }
  }
}
function clearPillarModules() {
  pillarRoot.clear();
  pillarModules.clear();
}
var catCollection = createCatCollection((key2) => localStorage.getItem(key2), (key2, value) => localStorage.setItem(key2, value), bestRecord.depth);
var characterId = catCollection.selected;
var catTextureCache = /* @__PURE__ */ new Map();
var catTextureSets = Object.fromEntries(Object.values(CAT_CHARACTERS).map((character) => [
  character.id,
  Object.fromEntries(Object.entries(character.sources).map(([key2, url]) => {
    if (!catTextureCache.has(url)) catTextureCache.set(url, loadArtTexture(url));
    return [key2, catTextureCache.get(url)];
  }))
]));
var catTextures = catTextureSets[characterId];
function createCat() {
  const root = new THREE5.Group();
  root.position.set(0, 0, GAME_CONFIG.catZ);
  scene.add(root);
  const visual = new THREE5.Sprite(new THREE5.SpriteMaterial({
    map: catTextures.idle,
    transparent: true,
    alphaTest: 0.025,
    depthWrite: false,
    toneMapped: false
  }));
  visual.center.set(0.5, catOriginY(characterId, "idle"));
  root.add(visual);
  const mouthAnchor = new THREE5.Object3D();
  mouthAnchor.position.set(0, 0.48, 0.12);
  root.add(mouthAnchor);
  const shadow = new THREE5.Mesh(new THREE5.CircleGeometry(0.34, 32), new THREE5.MeshBasicMaterial({
    color: 2458705,
    transparent: true,
    opacity: 0.16,
    depthWrite: false
  }));
  shadow.rotation.x = -Math.PI / 2;
  root.add(shadow);
  return { root, visual, mouthAnchor, shadow, currentTexture: "idle", eatTimer: 0 };
}
function setCatTexture(name) {
  if (cat.currentTexture === name) return;
  cat.currentTexture = name;
  cat.visual.material.map = catTextures[name];
  cat.visual.center.y = catOriginY(characterId, name);
}
var cat = createCat();
var catPanel = document.getElementById("catPanel");
var myCatsBtn = document.getElementById("myCatsBtn");
var closeCatsBtn = document.getElementById("closeCatsBtn");
var useCatBtn = document.getElementById("useCatBtn");
var previewCatId = characterId;
var catUnlockTimer;
var catPanelArt = new Image();
catPanelArt.src = "./assets/ui/cat-collection/candy-panel-v2.webp";
var catPanelArtReady = typeof catPanelArt.decode === "function" ? catPanelArt.decode().catch(() => {
}) : new Promise((resolve) => {
  if (catPanelArt.complete) resolve();
  else catPanelArt.onload = catPanelArt.onerror = resolve;
});
function applyCatChoice(id) {
  if (!catCollection.select(id)) return;
  characterId = catCollection.selected;
  catTextures = catTextureSets[characterId];
  const pose = cat.currentTexture;
  cat.currentTexture = "";
  setCatTexture(pose);
  document.querySelector(".result-cat").src = CAT_CHARACTERS[characterId].sources.fail;
  document.querySelector(".loader-cat").src = CAT_CHARACTERS[characterId].sources.idle;
  renderCats();
  scheduleFrame(true);
}
function renderCats() {
  const character = CAT_CHARACTERS[previewCatId];
  const owned = catCollection.owns(previewCatId), using = previewCatId === characterId;
  document.getElementById("homeCatAvatar").src = CAT_CHARACTERS[characterId].sources.idle;
  const ownedCount = Object.keys(CAT_CHARACTERS).filter((id) => catCollection.owns(id)).length;
  const totalCount = Object.keys(CAT_CHARACTERS).length;
  document.getElementById("catOwnedCount").textContent = `${ownedCount}/${totalCount}`;
  document.getElementById("catCollectionCount").textContent = t("catCollectionCount", { count: ownedCount, total: totalCount });
  catPanel.dataset.state = using ? "using" : owned ? "owned" : "locked";
  document.getElementById("catPreview").src = character.sources.idle;
  document.getElementById("catPreviewName").textContent = t(character.nameKey);
  document.getElementById("catPreviewState").textContent = t(using ? "catUsing" : owned ? "catOwned" : "catLocked");
  document.getElementById("catRequirement").textContent = t(character.unlockDepth ? owned ? "catOwnedHint" : "catUnlockGoal" : "catDefault");
  const progress = document.getElementById("catUnlockProgress");
  progress.hidden = owned;
  progress.value = catCollection.depth;
  const progressText = document.getElementById("catProgressText");
  progressText.hidden = owned;
  progressText.textContent = t("catProgress", { count: catCollection.depth });
  useCatBtn.disabled = !owned || using;
  useCatBtn.textContent = t(using ? "catUsing" : owned ? "catUse" : "catUnlockAction");
  const list = document.getElementById("catList");
  for (const entry of Object.values(CAT_CHARACTERS)) {
    let button = list.querySelector(`[data-cat="${entry.id}"]`);
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.dataset.cat = entry.id;
      const img = document.createElement("img");
      img.src = entry.sources.idle;
      img.alt = "";
      button.append(img, document.createElement("strong"), document.createElement("small"));
      list.append(button);
      button.addEventListener("click", () => {
        previewCatId = entry.id;
        renderCats();
      });
    }
    const unlocked = catCollection.owns(entry.id), selected = entry.id === characterId;
    button.className = `cat-choice${entry.id === previewCatId ? " previewing" : ""}${unlocked ? "" : " locked"}`;
    button.setAttribute("aria-pressed", String(entry.id === previewCatId));
    button.querySelector("strong").textContent = t(entry.nameKey);
    button.querySelector("small").textContent = (unlocked ? "" : "🔒 ") + t(selected ? "catUsing" : unlocked ? "catOwned" : "catLocked");
  }
}
function recordCatDepth(depth, notify = true) {
  const previous = catCollection.depth;
  const unlocked = catCollection.recordDepth(depth);
  if (unlocked || previous !== catCollection.depth && !catPanel.classList.contains("hidden")) renderCats();
  if (unlocked && notify) {
    const notice = document.getElementById("catUnlockNotice");
    notice.textContent = t("catUnlocked");
    notice.hidden = false;
    clearTimeout(catUnlockTimer);
    catUnlockTimer = setTimeout(() => {
      notice.hidden = true;
    }, 4500);
  }
}
myCatsBtn.addEventListener("click", async () => {
  myCatsBtn.setAttribute("aria-busy", "true");
  await catPanelArtReady;
  myCatsBtn.removeAttribute("aria-busy");
  previewCatId = characterId;
  renderCats();
  catPanel.classList.remove("hidden");
  homeScreen.inert = true;
  closeCatsBtn.focus();
});
function closeCats() {
  catPanel.classList.add("hidden");
  homeScreen.inert = false;
  myCatsBtn.focus();
  scheduleFrame(true);
}
closeCatsBtn.addEventListener("click", closeCats);
catPanel.addEventListener("click", (event) => {
  if (event.target === catPanel) closeCats();
});
useCatBtn.addEventListener("click", () => {
  applyCatChoice(previewCatId);
  closeCats();
});
document.addEventListener("keydown", (event) => {
  if (catPanel.classList.contains("hidden")) return;
  if (event.key === "Escape") closeCats();
  if (event.key === "Tab") {
    const buttons = [...catPanel.querySelectorAll("button:not(:disabled)")];
    const first = buttons[0], last2 = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last2.focus();
    } else if (!event.shiftKey && document.activeElement === last2) {
      event.preventDefault();
      first.focus();
    }
  }
});
document.querySelector(".loader-cat").src = CAT_CHARACTERS[characterId].sources.idle;
renderCats();
var powerupArt = createPowerupArt(THREE5, () => document.createElement("canvas"), loadArtTexture);
var powerupAura = powerupArt.createAura(cat.root, cat.visual);
var powers = new PowerupState();
var rules = new GameRules({ initialJumps: GAME_CONFIG.initialJumps, maxJumps: GAME_CONFIG.maxJumps });
var HOME_DEMO_DROP_RANGES = [[3, 5], [1, 3], [5, 8]];
var homeDemo = {
  active: false,
  motion: true,
  assetsReady: false,
  depth: 0,
  seed: 12648430,
  cycle: 0,
  stage: 0,
  mode: "falling",
  dropsRemaining: 0,
  landingTimer: 0,
  poisonHold: 0
};
function homeDemoDropCount(stage) {
  const [min, max] = HOME_DEMO_DROP_RANGES[stage];
  return min + Math.floor(Math.random() * (max - min + 1));
}
function setHomeDemoStage(stage) {
  homeDemo.stage = stage;
  homeDemo.dropsRemaining = stage < HOME_DEMO_DROP_RANGES.length ? homeDemoDropCount(stage) : 0;
}
function currentDepth() {
  return homeDemo.active ? homeDemo.depth : rules.depth;
}
var generator = new LayerGenerator((Date.now() ^ 659918) >>> 0);
var powerupGenerator = new PowerupGenerator(generator.rng.state);
var layers = /* @__PURE__ */ new Map();
var eatEffects = createEatEffects(
  THREE5,
  scene,
  towerRoot,
  GAME_CONFIG,
  art.materials,
  getMouthWorldPosition,
  () => document.createElement("canvas"),
  () => {
    cat.eatTimer = Math.max(cat.eatTimer, 0.26);
  }
);
function makeLayer(index) {
  const data = generator.create(Math.max(0, index), rules.jumps <= 2);
  const { group, segments } = art.createPlatform(data, index);
  group.position.y = -index * GAME_CONFIG.layerGap;
  towerRoot.add(group);
  const layer = { index, data, group, segments, eaten: false };
  if (!homeDemo.active) {
    layer.pickup = activeLevel ? generator.pickup(data) : powerupGenerator.create(data);
    if (layer.pickup) {
      layer.pickupVisual = powerupArt.createPickup(layer.pickup.type, layer.pickup.angle, GAME_CONFIG);
      group.add(layer.pickupVisual);
    }
  }
  layers.set(index, layer);
  return layer;
}
function ensureLayers() {
  const depth = currentDepth();
  const start = Math.max(0, depth);
  const end = activeLevel && !homeDemo.active ? Math.min(activeLevel.layers, depth + GAME_CONFIG.aheadLayers) : depth + GAME_CONFIG.aheadLayers;
  for (let i = start; i <= end; i++) {
    if (!layers.has(i)) makeLayer(i);
  }
  for (const [i, layer] of layers) {
    if (i < depth - GAME_CONFIG.keepBehind) {
      disposePlatform(layer.group);
      layers.delete(i);
    }
  }
}
function clearLayers() {
  for (const layer of layers.values()) disposePlatform(layer.group);
  layers.clear();
}
function localAngleUnderCat() {
  return normalizeAngle(-towerRoot.rotation.y);
}
function getCatRadius() {
  const t2 = THREE5.MathUtils.clamp(rules.jumps / GAME_CONFIG.maxJumps, 0, 1);
  return THREE5.MathUtils.lerp(GAME_CONFIG.catRadius * 0.83, GAME_CONFIG.catRadiusAtMax, t2);
}
function targetCatScale() {
  return catScaleForJumps(rules.jumps, GAME_CONFIG.maxJumps);
}
function layerTopY(layer) {
  const part = partUnderCat(layer);
  return layer.group.position.y + GAME_CONFIG.platformThickness / 2 * (part?.scale.y ?? 1) + (part?.position.y ?? 0);
}
function partUnderCat(layer) {
  const angle = localAngleUnderCat();
  return layer.segments.find((part) => angleInArc(angle, part.userData.span.start, part.userData.span.width));
}
function compressJelly(layer, speed) {
  const part = partUnderCat(layer);
  if (part) part.userData.spring = { time: 0, strength: THREE5.MathUtils.clamp(0.23 + Math.abs(speed) * 0.018, 0.28, 0.43) };
}
function updateJellyMotion(dt) {
  for (const layer of layers.values()) for (const part of layer.segments) {
    const spring = part.userData.spring;
    if (!spring) continue;
    spring.time += dt;
    const compression = jellyCompression(spring.time, spring.strength);
    part.scale.set(1 + compression * 0.1, 1 - compression, 1 + compression * 0.1);
    part.position.y = -compression * GAME_CONFIG.platformThickness * 0.72;
    if (spring.time >= 0.9) delete part.userData.spring;
  }
}
function platformStatus(layer) {
  const angle = localAngleUnderCat();
  if (layer.data.gaps.some((g) => angleInArc(angle, g.start, g.width))) return "gap";
  if (layer.data.hazards.some((h) => angleInArc(angle, h.start, h.width))) return "hazard";
  return "safe";
}
function showCombo(n) {
  if (n < 2) return;
  hud.combo.dataset.kind = "combo";
  hud.combo.dataset.count = String(n);
  hud.combo.textContent = t("combo", { count: n });
  hud.combo.classList.remove("show");
  void hud.combo.offsetWidth;
  hud.combo.classList.add("show");
}
function spawnPlusOne() {
  const el = document.createElement("div");
  el.className = "plus-one";
  el.textContent = t("plusOne");
  el.dataset.i18n = "plusOne";
  frameEl.appendChild(el);
  el.addEventListener("animationend", () => el.remove(), { once: true });
}
var pulse = 0;
var squash = 0;
var displayedCatScale = targetCatScale();
var deadShown = false;
var gameOverTimer;
var poisonSink = null;
var state = "idle";
var vy = 0;
var landingTimer = 0;
var landedLayer = null;
var firstInput = false;
var smashReady = false;
var smashLayer = null;
var smashTimer = 0;
var smashBaseY = 0;
function resetHomeDemoScene() {
  clearTimeout(gameOverTimer);
  if (poisonSink) {
    poisonSink.contact.removeFromParent();
    poisonSink = null;
  }
  rules.reset();
  powers.reset();
  powerupAura.clear();
  homeDemo.cycle += 1;
  generator = new LayerGenerator((homeDemo.seed ^ Math.imul(homeDemo.cycle, 2654435769)) >>> 0);
  clearLayers();
  clearPillarModules();
  eatEffects.clear();
  frameEl.querySelectorAll(".plus-one, .powerup-reward").forEach((el) => el.remove());
  hud.combo.classList.remove("show");
  hud.gameOver.classList.add("hidden");
  homeDemo.depth = 0;
  homeDemo.mode = "falling";
  homeDemo.landingTimer = 0;
  homeDemo.poisonHold = 0;
  setHomeDemoStage(0);
  towerRoot.rotation.y = 0;
  pulse = 0;
  squash = 0;
  vy = -0.8;
  state = "homeDemo";
  landedLayer = null;
  smashReady = false;
  smashLayer = null;
  cat.eatTimer = 0;
  cat.root.rotation.set(0, 0, 0);
  ensureLayers();
  ensurePillarModules();
  const firstLayer = layers.get(0);
  const startY = (firstLayer ? layerTopY(firstLayer) : 0) + getCatRadius() + 1.35;
  cat.root.position.set(0, startY, GAME_CONFIG.catZ);
  cat.visual.scale.setScalar(targetCatScale() * 1.5);
  cat.visual.position.y = -getCatRadius() + 0.08;
  cat.shadow.visible = false;
  setCatTexture("fall");
  cameraFocusY = cat.root.position.y - 1.45;
}
function startHomeDemo() {
  if (!homeDemo.assetsReady || !homeDemo.motion || homeScreen.hidden) return;
  homeDemo.active = true;
  resetHomeDemoScene();
  frameEl.classList.add("home-demo-running");
  homeScreen.classList.add("home-demo-ready");
  scheduleFrame(true);
}
function stopHomeDemo() {
  homeDemo.active = false;
  frameEl.classList.remove("home-demo-running");
  homeScreen.classList.remove("home-demo-ready");
}
function homeDemoSpan(layer, type) {
  return platformSpans(layer.data).filter((span) => span.type === type).sort((a, b) => b.width - a.width)[0] || null;
}
function homeDemoTargetType(layer) {
  if (homeDemo.stage >= HOME_DEMO_DROP_RANGES.length) {
    return layer.data.hazards.length ? "hazard" : "gap";
  }
  return homeDemo.dropsRemaining > 0 ? "gap" : "safe";
}
function homeDemoTargetRotation(layer, type) {
  if (type === "gap") return -layer.data.primaryAngle;
  const span = homeDemoSpan(layer, type);
  return span ? -(span.start + span.width / 2) : -layer.data.primaryAngle;
}
function beginHomeDemoPoison(layer, impactSpeed) {
  towerRoot.rotation.y = homeDemoTargetRotation(layer, "hazard");
  cat.root.position.y = layerTopY(layer) + getCatRadius();
  compressJelly(layer, impactSpeed);
  vy = 0;
  homeDemo.mode = "poison";
  homeDemo.poisonHold = 0;
  cat.eatTimer = 0;
  pulse = 0;
  squash = 0;
  const contact = art.createPoisonContact();
  contact.position.set(cat.root.position.x, layerTopY(layer) + 0.018, GAME_CONFIG.catZ);
  scene.add(contact);
  poisonSink = { startY: cat.root.position.y, elapsed: 0, depth: 0.48, contact, layer: layer.index };
}
function updateHomeDemoPoison(dt) {
  if (!poisonSink) {
    resetHomeDemoScene();
    return;
  }
  homeDemo.poisonHold += dt;
  poisonSink.elapsed = Math.min(0.85, poisonSink.elapsed + dt);
  const t2 = poisonSink.elapsed / 0.85;
  const eased = t2 * t2 * (3 - 2 * t2);
  cat.root.position.y = poisonSink.startY - poisonSink.depth * eased;
  poisonSink.contact.scale.setScalar(0.8 + 0.2 * eased);
  cat.visual.material.rotation = -0.1;
  cat.shadow.visible = false;
  setCatTexture(t2 >= 1 ? "fail" : "fall");
  if (homeDemo.poisonHold >= 1.65) resetHomeDemoScene();
}
function updateHomeDemo(dt) {
  if (!homeDemo.active || !homeDemo.motion) return;
  if (homeDemo.mode === "poison") {
    updateHomeDemoPoison(dt);
    return;
  }
  const layer = layers.get(homeDemo.depth);
  const radius = getCatRadius();
  if (!layer) return;
  const targetType = homeDemoTargetType(layer);
  const targetRotation = homeDemoTargetRotation(layer, targetType);
  const rotationDelta = Math.atan2(
    Math.sin(targetRotation - towerRoot.rotation.y),
    Math.cos(targetRotation - towerRoot.rotation.y)
  );
  towerRoot.rotation.y += rotationDelta * (1 - Math.exp(-7.2 * dt));
  if (homeDemo.mode === "landed") {
    cat.root.position.y = layerTopY(layer) + radius;
    homeDemo.landingTimer -= dt;
    if (homeDemo.landingTimer <= 0) {
      setHomeDemoStage(homeDemo.stage + 1);
      homeDemo.mode = "bouncing";
      vy = GAME_CONFIG.jumpVelocity;
      pulse = -0.08;
    }
  } else {
    const prevBottom = cat.root.position.y - radius;
    vy = Math.max(-9.5, vy + GAME_CONFIG.gravity * dt);
    cat.root.position.y += vy * dt;
    const currBottom = cat.root.position.y - radius;
    const nominalTop = layer.group.position.y + GAME_CONFIG.platformThickness / 2;
    if (vy < 0 && prevBottom >= nominalTop && currBottom <= nominalTop) {
      towerRoot.rotation.y = targetRotation;
      if (targetType === "gap") {
        layer.eaten = true;
        cat.eatTimer = Math.max(cat.eatTimer, 0.28);
        pulse = Math.max(pulse, 0.12);
        spawnEatFragments(layer);
        disposePlatform(layer.group);
        layers.delete(layer.index);
        homeDemo.depth += 1;
        if (homeDemo.stage < HOME_DEMO_DROP_RANGES.length) {
          homeDemo.dropsRemaining = Math.max(0, homeDemo.dropsRemaining - 1);
        }
        homeDemo.mode = "falling";
      } else if (targetType === "hazard") {
        beginHomeDemoPoison(layer, vy);
      } else {
        const impactSpeed = vy;
        cat.root.position.y = layerTopY(layer) + radius;
        vy = 0;
        homeDemo.mode = "landed";
        homeDemo.landingTimer = GAME_CONFIG.landingPause;
        squash = 1;
        compressJelly(layer, impactSpeed);
      }
    }
  }
  if (homeDemo.mode === "poison") return;
  const isFalling = homeDemo.mode !== "landed" && vy < -0.8;
  const base = targetCatScale();
  pulse *= Math.pow(0.035, dt);
  squash *= Math.pow(25e-4, dt);
  cat.eatTimer = Math.max(0, cat.eatTimer - dt);
  const deformation = catDeformation(characterId, squash, isFalling, pulse);
  const sx = base * deformation.x;
  const sy = base * deformation.y;
  const follow = dt ? 1 - Math.exp(-14 * dt) : 1;
  cat.visual.scale.x = THREE5.MathUtils.lerp(cat.visual.scale.x, 1.5 * sx, follow);
  cat.visual.scale.y = THREE5.MathUtils.lerp(cat.visual.scale.y, 1.5 * sy, follow);
  cat.visual.scale.z = 1;
  cat.visual.position.y = -radius + 0.08;
  cat.visual.material.rotation = isFalling ? Math.sin(performance.now() * 8e-3) * 0.035 : 0;
  cat.visual.rotation.z = THREE5.MathUtils.lerp(
    cat.visual.rotation.z,
    isFalling ? Math.sin(performance.now() * 0.01) * 0.035 : 0,
    1 - Math.exp(-9 * dt)
  );
  cat.shadow.visible = false;
  if (homeDemo.mode === "landed" && squash > 0.18) setCatTexture("squash");
  else if (cat.eatTimer > 0) setCatTexture("eat");
  else if (isFalling) setCatTexture("fall");
  else setCatTexture("idle");
}
function updateHUD() {
  hud.depth.textContent = activeLevel && !homeDemo.active ? `${rules.depth}/${activeLevel.layers}` : String(rules.depth);
  const objective = document.getElementById("levelObjective");
  objective.hidden = !activeLevel || homeDemo.active;
  if (activeLevel) {
    document.getElementById("levelHudTitle").textContent = t("levelName" + activeLevel.id);
    document.getElementById("levelHudCount").textContent = `${rules.depth} / ${activeLevel.layers}`;
    document.getElementById("levelProgressFill").style.width = `${Math.min(100, rules.depth / activeLevel.layers * 100)}%`;
    const goalMet = levelStars(activeLevel, { ...levelRun, won: true }) >= 2;
    document.getElementById("levelHudGoal").textContent = `${goalMet ? "✓ " : ""}${goalText(activeLevel)}`;
    objective.classList.toggle("goal-complete", goalMet);
  }
  hud.jumps.textContent = `× ${rules.jumps}`;
  hud.score.textContent = String(rules.score);
  hud.jumpBox.classList.toggle("warning", rules.jumps <= 2 && rules.alive);
  updatePowerupHUD();
}
function updatePowerupHUD() {
  const active = rules.alive && !homeDemo.active;
  hud.burstBuff.hidden = !active || !powers.bursting;
  hud.shieldBuff.hidden = !active || !powers.shielded;
  hud.powerups.hidden = hud.burstBuff.hidden && hud.shieldBuff.hidden;
  hud.burstTime.textContent = t("powerupTime", { seconds: powers.burstRemaining.toFixed(1) });
  hud.burstBuff.style.setProperty("--remaining", Math.min(1, powers.burstRemaining / 3));
  hud.shieldTime.textContent = t("powerupCharge");
}
function spawnPowerupReward(event) {
  const el = document.createElement("div");
  el.className = "powerup-reward";
  for (const [key2, values, visible] of [
    ["powerupEnergyResult", { count: event.jumpsAdded }, event.jumpsAdded > 0],
    ["powerupScoreResult", { score: event.bonusScore }, event.bonusScore > 0]
  ]) {
    if (!visible) continue;
    const row = document.createElement("span");
    row.dataset.rewardKey = key2;
    row.dataset.rewardValues = JSON.stringify(values);
    row.textContent = t(key2, values);
    el.appendChild(row);
  }
  if (!el.childElementCount) return;
  frameEl.appendChild(el);
  el.addEventListener("animationend", () => el.remove(), { once: true });
}
function collectLayerPowerup(layer, prevY, currentY) {
  if (!layer.pickup || !rules.alive || !firstInput) return;
  const top = layer.group.position.y + GAME_CONFIG.platformThickness / 2;
  if (!powerupInReach(layer.pickup, localAngleUnderCat(), prevY, currentY, top)) return;
  const event = powers.collect(layer.pickup.type, rules);
  if (!event) return;
  if (activeLevel && event.type in levelRun.pickups) levelRun.pickups[event.type]++;
  analytics.track("eat_powerup", {
    powerup_type: event.type,
    score: rules.score,
    depth: rules.depth,
    bonus_score: event.bonusScore,
    jumps_added: event.jumpsAdded,
    converted: event.converted
  });
  layer.pickup = null;
  layer.pickupVisual.removeFromParent();
  layer.pickupVisual = null;
  spawnPowerupReward(event);
  sounds.play("pickup");
  pulse = 0.05;
  updateBestRecord();
  updateHUD();
}
function powerBreakLayer(layer, shield = false) {
  beginEat(layer, true);
  pulse = Math.min(0.08, pulse + 0.035);
  squash = 0.65;
  landedLayer = null;
  state = "bouncing";
  if (vy >= 0) vy = -0.2;
}
function consumeBounce() {
  if (!rules.bounce()) {
    state = "starved";
    sounds.play("starved");
    showGameOver("starved");
    return false;
  }
  sounds.play("jump");
  if (activeLevel) levelRun.bounces++;
  if (rules.jumps === 2) sounds.play("low");
  updateHUD();
  pulse = -0.08;
  vy = GAME_CONFIG.jumpVelocity;
  state = "bouncing";
  landedLayer = null;
  return true;
}
function landOn(layer) {
  sounds.play("land");
  cleanupLayersAbove(layer.index);
  compressJelly(layer, vy);
  landedLayer = layer;
  cat.root.position.y = layerTopY(layer) + getCatRadius();
  vy = 0;
  rules.land();
  state = "landed";
  landingTimer = GAME_CONFIG.landingPause;
  squash = 1;
  updateHUD();
}
function getMouthWorldPosition() {
  const p = new THREE5.Vector3();
  const mouth = catMouthUV(characterId);
  if (mouth) {
    cat.visual.getWorldPosition(p);
    const offset = new THREE5.Vector3(
      (mouth.x - cat.visual.center.x) * cat.visual.scale.x,
      (mouth.y - cat.visual.center.y) * cat.visual.scale.y,
      0.08
    );
    return p.add(offset.applyQuaternion(camera.quaternion));
  }
  cat.mouthAnchor.getWorldPosition(p);
  return p;
}
function cleanupLayersAbove(landedIndex) {
  const stale = [...layers.values()].filter((l) => l.index < landedIndex && !l.eaten).sort((a, b) => a.index - b.index);
  for (const layer of stale) {
    layer.eaten = true;
    spawnEatFragments(layer);
    disposePlatform(layer.group);
    layers.delete(layer.index);
  }
}
function spawnEatFragments(layer) {
  eatEffects.spawn(layer);
}
function beginEat(layer, powerBreak = false) {
  if (layer.eaten) return;
  layer.eaten = true;
  rules.passLayer();
  if (activeLevel && !powerBreak) levelRun.bestCombo = Math.max(levelRun.bestCombo, rules.combo);
  sounds.play(powerBreak ? "smash" : "eat");
  if (rules.combo === 3 || rules.combo === GAME_CONFIG.breakthroughCombo) sounds.play("combo");
  if (!powerBreak && rules.combo === GAME_CONFIG.breakthroughCombo) smashReady = true;
  pulse = Math.min(0.045, pulse + 0.015);
  updateBestRecord();
  if (!activeLevel) tapServices.notifyProgress({ depth: rules.depth, bestCombo: rules.bestCombo, score: rules.score });
  spawnPlusOne();
  showCombo(rules.combo);
  updateHUD();
  spawnEatFragments(layer);
  disposePlatform(layer.group);
  layers.delete(layer.index);
}
function startLandingSmash(layer) {
  if (layer.eaten || !smashReady && !powers.burstLandingReady) return;
  powers.consumeBurstLanding();
  sounds.play("land");
  smashReady = false;
  smashLayer = layer;
  compressJelly(layer, vy);
  smashBaseY = layerTopY(layer) + getCatRadius();
  cat.root.position.y = smashBaseY;
  vy = 0;
  state = "smashCharge";
  smashTimer = 0.1;
  squash = 1.25;
  rules.land();
  updateHUD();
}
function resolveLandingSmash() {
  const layer = smashLayer;
  if (!layer || layer.eaten) {
    smashLayer = null;
    state = "bouncing";
    vy = GAME_CONFIG.smashBounceVelocity;
    return;
  }
  layer.eaten = true;
  sounds.play("smash");
  rules.passLayer();
  updateBestRecord();
  if (!activeLevel) tapServices.notifyProgress({ depth: rules.depth, bestCombo: rules.bestCombo, score: rules.score });
  spawnPlusOne();
  spawnEatFragments(layer);
  disposePlatform(layer.group);
  layers.delete(layer.index);
  rules.land();
  pulse = Math.min(0.09, pulse + 0.05);
  squash = 0.75;
  hud.combo.dataset.kind = "smash";
  hud.combo.textContent = t("smash");
  hud.combo.classList.remove("show");
  void hud.combo.offsetWidth;
  hud.combo.classList.add("show");
  updateHUD();
  smashLayer = null;
  smashTimer = 0;
  state = "bouncing";
  vy = GAME_CONFIG.smashBounceVelocity;
  cat.root.position.y = smashBaseY + 0.035;
}
function hitHazard(layer) {
  if (!rules.alive || levelRun.won) return;
  if (powers.bursting || powers.absorbHazard()) {
    powerBreakLayer(layer, !powers.bursting);
    return;
  }
  sounds.play("hazard");
  cat.root.position.y = layerTopY(layer) + getCatRadius();
  rules.hitHazard();
  state = "hazardSinking";
  vy = 0;
  dragging = false;
  const contact = art.createPoisonContact();
  contact.position.set(cat.root.position.x, layerTopY(layer) + 0.018, GAME_CONFIG.catZ);
  scene.add(contact);
  poisonSink = { startY: cat.root.position.y, elapsed: 0, depth: 0.48, contact, layer: layer.index };
  cat.eatTimer = 0;
  pulse = 0;
  squash = 0;
  updateHUD();
}
var ads = createAdService();
var revival = createReviveController({
  ads: {
    isAvailable: ads.isAvailable,
    async showRewarded() {
      const context = { placement: "revive", score: rules.score, depth: rules.depth };
      analytics.track("click_rewarded_ad", context);
      let result;
      try {
        result = await ads.showRewarded();
      } catch {
        result = { status: "failed" };
      }
      analytics.track("rewarded_ad_result", { ...context, result: result.status });
      return result;
    }
  },
  canRevive: () => !rules.alive && deadShown && homeScreen.hidden,
  restore: () => {
    const restored = reviveGame();
    if (restored && activeLevel) levelRun.revived = true;
    if (restored) analytics.track("revive_success", { placement: "revive", score: rules.score, depth: rules.depth });
    return restored;
  },
  onChange: () => {
    if (hud.reviveBtn) renderRevive();
  }
});
if (tapServices.supports.leaderboard && hud.leaderboardBtn) {
  hud.leaderboardBtn.hidden = false;
  hud.leaderboardBtn.addEventListener("click", async () => {
    if (hud.leaderboardBtn.disabled) return;
    analytics.track("click_leaderboard", { entry: "home", leaderboard_type: "score" });
    const status = hud.homeTapStatus;
    const showStatus = (key2) => {
      status.textContent = key2 ? t(key2) : "";
      if (key2) status.dataset.i18n = key2;
      else delete status.dataset.i18n;
    };
    hud.leaderboardBtn.disabled = true;
    hud.leaderboardBtn.setAttribute("aria-busy", "true");
    showStatus("leaderboardLoading");
    try {
      showStatus(await tapServices.openLeaderboard("score") ? "" : "leaderboardFailed");
    } catch {
      showStatus("leaderboardFailed");
    } finally {
      hud.leaderboardBtn.disabled = false;
      hud.leaderboardBtn.removeAttribute("aria-busy");
    }
  });
}
if (tapServices.supports.share && hud.shareBtn) {
  hud.shareBtn.addEventListener("click", () => {
    analytics.track("click_share", { entry: "result", score: rules.score, depth: rules.depth });
    void tapServices.share({ score: rules.score, depth: rules.depth, newRecord: runBrokeRecord });
  });
}
if (tapServices.supports.achievement && hud.achievementsBtn) {
  hud.achievementsBtn.hidden = false;
  hud.achievementsBtn.addEventListener("click", () => {
    analytics.track("click_achievements", { entry: "home" });
    tapServices.showAchievements();
  });
}
if (hud.tapActions) {
  hud.tapActions.hidden = true;
}
if (hud.homeTapActions) {
  const available = tapServices.supports.leaderboard || tapServices.supports.achievement;
  hud.homeTapActions.hidden = !available;
  homeScreen.classList.toggle("with-tap-services", available);
}
function renderRevive() {
  const available = revival.isAvailable();
  hud.reviveAction.hidden = !available;
  hud.reviveBtn.hidden = !available;
  hud.reviveBtn.disabled = revival.busy;
  hud.reviveBtn.setAttribute("aria-label", t(revival.busy ? "adLoading" : "revive"));
  hud.reviveBtn.setAttribute("aria-busy", String(revival.busy));
  hud.restartBtn.disabled = revival.busy;
  document.getElementById("homeBtn").disabled = revival.busy;
  const message = { loading: "adLoading", cancelled: "adCancelled", failed: "adFailed", unavailable: "adUnavailable" }[revival.status];
  hud.adStatus.textContent = available && message ? t(message) : "";
  hud.gameOver.classList.toggle("with-revive", available);
}
function reviveGame() {
  const layer = layers.get(rules.depth);
  const safe = layer && platformSpans(layer.data).find((span) => span.type === "safe");
  if (!safe || !rules.revive()) return false;
  clearTimeout(gameOverTimer);
  poisonSink?.contact.removeFromParent();
  poisonSink = null;
  towerRoot.rotation.y = -(safe.start + safe.width / 2);
  towerRoot.updateMatrixWorld(true);
  landedLayer = layer;
  state = "landed";
  landingTimer = 1;
  vy = 0;
  deadShown = false;
  dragging = false;
  smashReady = false;
  smashLayer = null;
  smashTimer = 0;
  powers.reset();
  powerupAura.clear();
  pulse = squash = cat.eatTimer = 0;
  cat.root.position.y = layerTopY(layer) + getCatRadius();
  cat.visual.material.rotation = 0;
  setCatTexture("idle");
  hud.gameOver.classList.add("hidden");
  hud.combo.classList.remove("show");
  updateHUD();
  scheduleFrame(true);
  return true;
}
function renderShareMoment() {
  const moment = tapServices.getShareMoment(runBrokeRecord);
  const visible = !activeLevel && deadShown && !!moment;
  if (hud.tapActions) hud.tapActions.hidden = !visible;
  if (hud.shareBtn) {
    hud.shareBtn.hidden = !visible;
    const label = hud.shareBtn.querySelector("[data-i18n]");
    if (label && moment) {
      label.dataset.i18n = moment.kind === "record" ? "shareRecord" : "shareAchievement";
      label.textContent = t(label.dataset.i18n);
    }
  }
  const summary = document.getElementById("shareMomentSummary");
  if (summary) {
    summary.hidden = !visible;
    summary.textContent = moment ? t(
      moment.kind === "record" ? moment.achievementIds.length ? "recordAndAchievement" : "newRecord" : "newAchievement",
      { count: moment.achievementIds.length }
    ) : "";
  }
}
function renderGameOver(reason) {
  renderShareMoment();
  renderRevive();
  hud.finalDepth.textContent = t("depthValue", { count: rules.depth });
  hud.finalCombo.textContent = `×${rules.bestCombo}`;
  hud.finalScore.textContent = String(rules.score);
  const kicker = document.querySelector(".result-kicker");
  kicker.dataset.i18n = activeLevel && levelRun.won ? "levelSuccessKicker" : "resultKicker";
  kicker.textContent = t(kicker.dataset.i18n);
  document.getElementById("nextLevelBtn").hidden = !activeLevel || !levelRun.won || activeLevel.id === LEVELS.length;
  document.getElementById("resultLevelsBtn").hidden = !activeLevel;
  const stars = document.getElementById("levelResult");
  stars.hidden = !activeLevel;
  hud.restartBtn.querySelector("span").textContent = t(activeLevel ? "levelRetry" : "restart");
  if (activeLevel) {
    const count = levelStars(activeLevel, levelRun);
    stars.dataset.stars = String(count);
    stars.innerHTML = `<span class="level-award-stars">${starImages(count)}</span><span class="level-award-copy">${goalText(activeLevel)}${count === 2 ? " · " + t("levelNoRevive") : ""}</span>`;
    hud.tapActions.hidden = true;
    document.getElementById("shareMomentSummary").hidden = true;
  }
  if (reason === "win") {
    hud.deathTitle.textContent = t(activeLevel.id === LEVELS.length ? "levelGroupClear" : "levelClear");
    hud.deathText.textContent = t("levelClearText");
    hud.reviveAction.hidden = true;
    document.querySelector(".result-cat").src = CAT_CHARACTERS[characterId].victory;
    return;
  }
  document.querySelector(".result-cat").src = CAT_CHARACTERS[characterId].sources.fail;
  if (reason === "hazard") {
    hud.deathEmoji.textContent = "🙀";
    hud.deathTitle.textContent = t("hazardTitle");
    hud.deathText.textContent = t("hazardText");
  } else {
    hud.deathEmoji.textContent = "😿";
    hud.deathTitle.textContent = t("starvedTitle");
    hud.deathText.textContent = t("starvedText");
  }
}
function showGameOver(reason) {
  if (deadShown) return;
  deadShown = true;
  updatePowerupHUD();
  hud.gameOver.dataset.reason = reason;
  gameOverTimer = setTimeout(() => {
    renderGameOver(reason);
    hud.gameOver.classList.remove("hidden");
  }, reason === "hazard" ? 500 : 560);
  analytics.track("game_over", {
    reason,
    score: rules.score,
    depth: rules.depth,
    best_combo: rules.bestCombo
  });
  if (!activeLevel) tapServices.onGameOver({
    record: bestRecord,
    newRecord: runBrokeRecord,
    depth: rules.depth,
    bestCombo: rules.bestCombo,
    score: rules.score
  });
}
function resetGame() {
  revival.invalidate();
  clearTimeout(gameOverTimer);
  if (poisonSink) {
    poisonSink.contact.removeFromParent();
    poisonSink = null;
  }
  hud.gameOver.dataset.mode = activeLevel ? "level" : "endless";
  rules.reset();
  levelRun = { won: false, revived: false, bounces: 0, bestCombo: 0, pickups: { shield: 0, burst: 0 } };
  powers.reset();
  powerupAura.clear();
  landedLayer = null;
  const seed = (Date.now() ^ Math.random() * 4294967295 >>> 0) >>> 0;
  generator = activeLevel ? new LevelGenerator(activeLevel) : new LayerGenerator(seed);
  powerupGenerator = new PowerupGenerator(seed);
  clearLayers();
  clearPillarModules();
  eatEffects.clear();
  frameEl.querySelectorAll(".plus-one, .powerup-reward").forEach((el) => el.remove());
  hud.combo.classList.remove("show");
  towerRoot.rotation.y = 0;
  cat.root.position.set(0, GAME_CONFIG.platformThickness / 2 + getCatRadius(), GAME_CONFIG.catZ);
  cat.root.rotation.set(0, 0, 0);
  displayedCatScale = targetCatScale();
  cat.visual.scale.set(1.5 * displayedCatScale, 1.5 * displayedCatScale, 1);
  cat.eatTimer = 0;
  setCatTexture("idle");
  deadShown = false;
  runBrokeRecord = false;
  tapServices.beginRun();
  renderShareMoment();
  smashReady = false;
  smashLayer = null;
  smashTimer = 0;
  smashBaseY = 0;
  pulse = 0;
  squash = 0;
  state = "ready";
  firstInput = false;
  hud.toast.classList.remove("hide");
  vy = 0;
  landingTimer = 0.34;
  ensureLayers();
  ensurePillarModules();
  towerRoot.rotation.y = -layers.get(0).data.primaryAngle + 0.95;
  previousCameraCatY = cat.root.position.y;
  cameraFocusY = gameplayCameraFocus();
  hud.gameOver.classList.add("hidden");
  updateHUD();
  scheduleFrame(true);
}
hud.restartBtn.addEventListener("click", () => {
  analytics.track("game_start", { entry: "restart" });
  resetGame();
});
hud.reviveBtn.addEventListener("click", () => {
  void revival.request();
});
document.getElementById("languageSelect").addEventListener("change", (event) => {
  analytics.track("change_setting", { setting_name: "language", setting_value: event.target.value });
  setLocale(event.target.value);
});
document.addEventListener("cat-language-change", () => {
  renderLevels();
  updateHUD();
  renderCats();
  if (hud.combo.dataset.kind === "combo") hud.combo.textContent = t("combo", { count: hud.combo.dataset.count });
  else if (hud.combo.dataset.kind === "smash") hud.combo.textContent = t("smash");
  if (!hud.gameOver.classList.contains("hidden")) renderGameOver(hud.gameOver.dataset.reason);
  updatePowerupHUD();
  for (const row of frameEl.querySelectorAll("[data-reward-key]")) {
    row.textContent = t(row.dataset.rewardKey, JSON.parse(row.dataset.rewardValues));
  }
});
document.getElementById("soundToggle").addEventListener("change", (event) => {
  analytics.track("change_setting", { setting_name: "sound", setting_value: event.target.checked ? "on" : "off" });
  sounds.setEnabled(event.target.checked);
});
function closeSettings() {
  settingsPanel.classList.add("hidden");
  homeScreen.inert = false;
  settingsBtn.focus();
}
settingsBtn.addEventListener("click", () => {
  analytics.track("click_settings", { entry: "home" });
  settingsPanel.classList.remove("hidden");
  homeScreen.inert = true;
  closeSettingsBtn.focus();
});
closeSettingsBtn.addEventListener("click", closeSettings);
settingsDoneBtn.addEventListener("click", closeSettings);
settingsPanel.addEventListener("click", (event) => {
  if (event.target === settingsPanel) closeSettings();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !settingsPanel.classList.contains("hidden")) closeSettings();
});
var homeMotionToggle = document.getElementById("homeMotionToggle");
homeMotionToggle.addEventListener("change", (event) => {
  analytics.track("change_setting", { setting_name: "home_motion", setting_value: event.target.checked ? "on" : "off" });
  homeDemo.motion = event.target.checked;
  homeScreen.classList.toggle("no-motion", !event.target.checked);
  if (event.target.checked) startHomeDemo();
  else stopHomeDemo();
});
document.getElementById("startBtn").addEventListener("click", () => {
  activeLevel = null;
  frameEl.classList.remove("in-level");
  analytics.track("game_start", { entry: "home" });
  sounds.unlock();
  stopHomeDemo();
  homeScreen.hidden = true;
  frameEl.classList.remove("at-home");
  resetGame();
});
document.getElementById("homeBtn").addEventListener("click", () => {
  analytics.track("click_home", { entry: "result" });
  revival.invalidate();
  activeLevel = null;
  frameEl.classList.remove("in-level");
  document.getElementById("levelObjective").hidden = true;
  hud.gameOver.classList.add("hidden");
  homeScreen.hidden = false;
  frameEl.classList.add("at-home");
  if (frameHandle !== null) cancelAnimationFrame(frameHandle);
  frameHandle = null;
  if (homeDemo.motion) startHomeDemo();
  document.getElementById("startBtn").focus();
});
function collisionStep(prevY, currentY, prevRadius) {
  if (!rules.alive || state === "landed" || vy >= 0) return;
  const prevBottomY = prevY - prevRadius;
  for (const layer of layers.values()) {
    if (layer.eaten) continue;
    collectLayerPowerup(layer, prevY, currentY);
    const radius = getCatRadius();
    const currBottomY = currentY - radius;
    const top = layerTopY(layer);
    if (!(prevBottomY >= top && currBottomY <= top)) continue;
    if (layer.data.finish) {
      cat.root.position.y = top + radius;
      vy = 0;
      state = "levelWon";
      dragging = false;
      levelRun.won = true;
      const stars = levelStars(activeLevel, levelRun);
      levelProgress.stars[activeLevel.id - 1] = Math.max(stars, levelProgress.stars[activeLevel.id - 1]);
      try {
        localStorage.setItem(LEVEL_KEY, JSON.stringify(levelProgress));
      } catch {
      }
      powers.reset();
      smashReady = false;
      sounds.play("combo");
      showGameOver("win");
      return;
    }
    const status = platformStatus(layer);
    if (status === "gap") {
      beginEat(layer);
      continue;
    }
    if (powers.bursting) {
      powerBreakLayer(layer);
      continue;
    }
    if (smashReady || powers.burstLandingReady) {
      startLandingSmash(layer);
      return;
    }
    if (status === "hazard") {
      hitHazard(layer);
      if (!rules.alive || levelRun.won) return;
      continue;
    }
    cat.root.position.y = top + radius;
    landOn(layer);
    return;
  }
}
function updateCat(dt) {
  if (rules.alive && firstInput) powers.tick(dt);
  updatePowerupHUD();
  if (state === "landed") {
    if (landedLayer && !landedLayer.eaten) {
      collectLayerPowerup(landedLayer, cat.root.position.y, cat.root.position.y);
      const status = platformStatus(landedLayer);
      if (powers.bursting && status !== "gap") {
        powerBreakLayer(landedLayer);
      } else if (status === "gap") {
        beginEat(landedLayer);
        landedLayer = null;
        state = "bouncing";
        vy = -0.2;
      } else if (powers.burstLandingReady || status === "hazard" && smashReady) {
        startLandingSmash(landedLayer);
        landedLayer = null;
      } else if (status === "hazard") {
        cat.root.position.y = layerTopY(landedLayer) + getCatRadius();
        hitHazard(landedLayer);
        landedLayer = null;
      } else cat.root.position.y = layerTopY(landedLayer) + getCatRadius();
    }
    if (state === "landed") {
      landingTimer -= dt;
      if (landingTimer <= 0) consumeBounce();
    }
  } else if (state === "starved" && landedLayer && !landedLayer.eaten) {
    cat.root.position.y = layerTopY(landedLayer) + getCatRadius();
  } else if (state === "smashCharge" && rules.alive) {
    smashTimer -= dt;
    cat.root.position.y = smashLayer ? layerTopY(smashLayer) + getCatRadius() : smashBaseY;
    if (smashTimer <= 0) resolveLandingSmash();
  } else if (state === "bouncing" && rules.alive) {
    const prevY = cat.root.position.y;
    const prevRadius = getCatRadius();
    vy += GAME_CONFIG.gravity * dt;
    cat.root.position.y += vy * dt;
    collisionStep(prevY, cat.root.position.y, prevRadius);
  } else if (state === "hazardSinking") {
    poisonSink.elapsed = Math.min(0.85, poisonSink.elapsed + dt);
    const t2 = poisonSink.elapsed / 0.85;
    const eased = t2 * t2 * (3 - 2 * t2);
    cat.root.position.y = poisonSink.startY - poisonSink.depth * eased;
    poisonSink.contact.scale.setScalar(0.8 + 0.2 * eased);
    vy = 0;
    if (t2 >= 1) {
      state = "hazardStuck";
      showGameOver("hazard");
    }
  }
  const isFalling = state === "bouncing" && vy < -0.8;
  const targetBaseScale = targetCatScale();
  displayedCatScale = followCatScale(displayedCatScale, targetBaseScale, dt);
  const base = displayedCatScale;
  pulse *= Math.pow(0.035, dt);
  squash *= Math.pow(25e-4, dt);
  cat.eatTimer = Math.max(0, cat.eatTimer - dt);
  const deformation = catDeformation(characterId, squash, isFalling, pulse);
  const sx = base * deformation.x;
  const sy = base * deformation.y;
  const shapeFollow = dt ? 1 - Math.exp(-14 * dt) : 1;
  cat.visual.scale.x = THREE5.MathUtils.lerp(cat.visual.scale.x, 1.5 * sx, shapeFollow);
  cat.visual.scale.y = THREE5.MathUtils.lerp(cat.visual.scale.y, 1.5 * sy, shapeFollow);
  cat.visual.scale.z = 1;
  cat.visual.position.y = -getCatRadius() + 0.08;
  cat.visual.material.rotation = isFalling ? Math.sin(performance.now() * 8e-3) * 0.035 : 0;
  if (state === "ready") {
    cat.visual.position.y += Math.sin(performance.now() * 25e-4) * 0.055;
  }
  let ground = null;
  for (const layer of layers.values()) {
    if (!layer.eaten && layerTopY(layer) <= cat.root.position.y && (!ground || layer.index < ground.index)) ground = layer;
  }
  cat.shadow.visible = !!ground && platformStatus(ground) !== "gap";
  if (ground) {
    cat.shadow.position.y = layerTopY(ground) - cat.root.position.y + 0.014;
    cat.shadow.scale.setScalar(Math.max(0.4, 1 - (cat.root.position.y - layerTopY(ground)) * 0.22));
  }
  if (state === "levelWon") {
    setCatTexture("eat");
  } else if (poisonSink) {
    setCatTexture("fall");
    cat.visual.material.rotation = -0.1;
    cat.shadow.visible = false;
  } else if (!rules.alive || state === "starved") {
    setCatTexture("fail");
  } else if (state === "smashCharge" || state === "landed" && squash > 0.18) {
    setCatTexture("squash");
  } else if (cat.eatTimer > 0) {
    setCatTexture("eat");
  } else if (isFalling) {
    setCatTexture("fall");
  } else {
    setCatTexture("idle");
  }
  const tilt = isFalling ? Math.sin(performance.now() * 0.01) * 0.035 : 0;
  cat.visual.rotation.z = THREE5.MathUtils.lerp(cat.visual.rotation.z, tilt, 1 - Math.exp(-9 * dt));
  cat.shadow.material.opacity = THREE5.MathUtils.lerp(
    cat.shadow.material.opacity,
    isFalling ? 0.08 : 0.16,
    1 - Math.exp(-8 * dt)
  );
}
var cameraFocusY = 0;
var previousCameraCatY = 0;
function gameplayCameraFocus() {
  return gameplayCameraTarget({
    ...GAME_CONFIG,
    depth: rules.depth,
    radius: getCatRadius(),
    catY: cat.root.position.y,
    viewHeight: camera.top - camera.bottom
  });
}
function updateCamera(dt) {
  if (homeDemo.active) {
    const anchorY = poisonSink ? poisonSink.startY : cat.root.position.y;
    const targetY = anchorY - 1.45;
    const speed = targetY < cameraFocusY ? 7 : 1.6;
    cameraFocusY = THREE5.MathUtils.lerp(cameraFocusY, targetY, 1 - Math.exp(-speed * dt));
    cameraFocusY = Math.min(cameraFocusY, targetY + 0.75);
  } else {
    cameraFocusY = followGameplayCamera(
      cameraFocusY,
      gameplayCameraFocus(),
      cat.root.position.y,
      previousCameraCatY
    );
  }
  previousCameraCatY = cat.root.position.y;
  camera.position.set(0, cameraFocusY + 8.2, 20);
  camera.lookAt(0, cameraFocusY, 0);
  setVisibleTowerLayers(
    layers,
    pillarModules,
    cameraFocusY,
    camera.top * 1.1 + GAME_CONFIG.layerGap + GAME_CONFIG.platformThickness
  );
  art.animate(performance.now() / 1e3, cameraFocusY);
  resizeBackground(gameEl.clientWidth / Math.max(1, gameEl.clientHeight));
}
var dragging = false;
var pointerX = 0;
function pointerDown(e) {
  if (!rules.alive || levelRun.won) return false;
  sounds.unlock();
  dragging = true;
  pointerX = e.clientX;
  if (!firstInput) {
    firstInput = true;
    state = "landed";
    landingTimer = 0.12;
    hud.toast.classList.add("hide");
  }
}
function pointerMove(e) {
  if (!dragging || !rules.alive || levelRun.won) return;
  const dx = e.clientX - pointerX;
  pointerX = e.clientX;
  const sensitivity = GAME_CONFIG.dragTurnsPerScreen / Math.max(gameEl.clientWidth, 320);
  towerRoot.rotation.y += dx * sensitivity;
}
function pointerUp(e) {
  dragging = false;
}
var dragInput = bindDragInput(renderer.domElement, { onStart: pointerDown, onMove: pointerMove, onEnd: pointerUp, diagnostics: globalThis.__CAT_STARTUP_DIAGNOSTICS__ });
var frameHandle = null;
var frameLoopReady = false;
var renderedFrames = 0;
var last = performance.now();
var nativeActive = globalThis.CatAndroidLifecycle?.active ?? true;
function scheduleFrame(resetTime = false) {
  const homeBlocked = frameEl.classList.contains("at-home") && !homeDemo.active;
  if (!catPanel.classList.contains("hidden")) return;
  if (!frameLoopReady || document.hidden || !nativeActive || homeBlocked || frameHandle !== null) return;
  if (resetTime) last = performance.now();
  frameHandle = requestAnimationFrame(frame);
}
function resize() {
  const previousTargetY = gameplayCameraFocus();
  const w = Math.max(gameEl.clientWidth, 1);
  const h = Math.max(gameEl.clientHeight, 1);
  const viewWidth = Math.max(6.25, 10.5 * w / h);
  camera.left = -viewWidth / 2;
  camera.right = viewWidth / 2;
  camera.top = viewWidth * h / w / 2;
  camera.bottom = -camera.top;
  camera.updateProjectionMatrix();
  if (!homeDemo.active) cameraFocusY += gameplayCameraFocus() - previousTargetY;
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(devicePixelRatio, GAME_CONFIG.maxPixelRatio));
  scheduleFrame(true);
}
addEventListener("resize", resize);
if (typeof ResizeObserver === "function") {
  new ResizeObserver(resize).observe(frameEl);
} else globalThis.__CAT_STARTUP_DIAGNOSTICS__?.capability("尺寸监听", "窗口 resize 回退");
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (frameHandle !== null) cancelAnimationFrame(frameHandle);
    frameHandle = null;
  } else scheduleFrame(true);
});
globalThis.CatAndroidLifecycle = {
  active: nativeActive,
  setActive(active) {
    nativeActive = !!active;
    this.active = nativeActive;
    if (!nativeActive) {
      dragInput.cancel();
      dragging = false;
      if (frameHandle !== null) cancelAnimationFrame(frameHandle);
      frameHandle = null;
    } else scheduleFrame(true);
  }
};
function frame(now) {
  frameHandle = null;
  if (!catPanel.classList.contains("hidden")) return;
  const dt = Math.min(Math.max((now - last) / 1e3, 0), 1 / 30);
  last = now;
  ensureLayers();
  ensurePillarModules();
  updateJellyMotion(dt);
  if (homeDemo.active) updateHomeDemo(dt);
  else updateCat(dt);
  const effectTime = now / 1e3;
  powerupAura.update(
    !homeDemo.active && rules.alive ? powers : { burstRemaining: 0, shieldCharges: 0 },
    effectTime,
    !homeDemo.active && rules.alive && (smashReady || state === "smashCharge" || powers.burstLandingReady)
  );
  for (const layer of layers.values()) {
    if (layer.pickupVisual) powerupArt.animatePickup(layer.pickupVisual, effectTime);
  }
  eatEffects.update(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
  renderedFrames++;
  if (!deadShown || eatEffects.count > 0) scheduleFrame();
}
resize();
resetGame();
updateCat(0);
updateCamera(0);
if (debugMode) {
  globalThis.__GAME_DEBUG__ = {
    rules,
    layers,
    towerRoot,
    cat,
    renderer,
    camera,
    resetGame,
    powers,
    config: GAME_CONFIG,
    step(dt) {
      updateJellyMotion(dt);
      updateCat(dt);
      ensureLayers();
      updateCamera(dt);
    },
    render() {
      const time = performance.now() / 1e3;
      powerupAura.update(
        rules.alive ? powers : {},
        time,
        rules.alive && (smashReady || state === "smashCharge" || powers.burstLandingReady)
      );
      for (const layer of layers.values()) {
        if (layer.pickupVisual) powerupArt.animatePickup(layer.pickupVisual, time);
      }
      renderer.render(scene, camera);
    },
    aimPickup() {
      const next = layers.get(rules.depth);
      if (!next?.pickup) return false;
      towerRoot.rotation.y = -next.pickup.angle;
      return true;
    },
    get state() {
      return state;
    },
    get vy() {
      return vy;
    },
    alignGap() {
      const next = [...layers.values()].filter((l) => !l.eaten).sort((a, b) => a.index - b.index)[0];
      if (next) towerRoot.rotation.y = -next.data.primaryAngle;
    },
    aimAt(type) {
      const next = [...layers.values()].filter((l) => !l.eaten).sort((a, b) => a.index - b.index)[0];
      const span = next && platformSpans(next.data).find((s) => s.type === type);
      if (span) towerRoot.rotation.y = -(span.start + span.width / 2);
      return !!span;
    },
    snapshot() {
      return {
        state,
        characterId,
        catCollectionDepth: catCollection.depth,
        roundOwned: catCollection.owns("round"),
        catPose: cat.currentTexture,
        depth: rules.depth,
        jumps: rules.jumps,
        frames: renderedFrames,
        objects: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        effects: eatEffects.count,
        effectDrawCalls: eatEffects.chunkDrawCalls,
        catBaseScale: displayedCatScale,
        smashReady,
        breakthroughVisible: powerupAura.breakthrough.visible,
        powerups: powers.snapshot(),
        pickups: [...layers.values()].filter((l) => l.pickup).length
      };
    }
  };
}
frameLoopReady = true;
homeDemo.assetsReady = true;
if (!homeScreen.hidden && homeDemo.motion) startHomeDemo();
await Promise.all(artLoads);
tapServices.init({ costTimeMs: Math.round(performance.now()) });
analytics.flush();
globalThis.dispatchEvent(new Event("cat-game-ready"));
