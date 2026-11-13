/* =========================================================
   成长档案 v5 · Service Worker
   缓存版本号管理：改动资源清单时递增 CACHE_VERSION，
   activate 阶段自动清理旧版本缓存，避免用户一直看到旧版。
   ========================================================= */
const CACHE_VERSION = 'v5-3';
const CACHE = 'growth-archive-' + CACHE_VERSION;
// 清理旧缓存时只认这个前缀：同源（如 Live Server 的 127.0.0.1:5500）下可能还有别的项目的缓存
const CACHE_PREFIX = 'growth-archive-';

// 明确、可维护的静态资源缓存清单（v5 采用 ES Modules，多文件）
const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'assets/css/base.css',
  'assets/css/layout.css',
  'assets/css/components.css',
  'assets/css/charts.css',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'js/app.js',
  'js/config.js',
  'js/icons.js',
  'js/utils.js',
  'js/state.js',
  'js/db/db.js',
  'js/db/schema.js',
  'js/db/migration.js',
  'js/models/year.js',
  'js/models/experience.js',
  'js/services/store.js',
  'js/services/stats.js',
  'js/services/timeline.js',
  'js/services/backup.js',
  'js/services/image.js',
  'js/ui/router.js',
  'js/ui/views/overview.js',
  'js/ui/views/experiences.js',
  'js/ui/views/stats.js',
  'js/ui/views/timeline.js',
  'js/ui/views/profile.js',
  'js/ui/components/sheet.js',
  'js/ui/components/form.js',
  'js/ui/components/photo.js',
  'js/ui/components/toast.js',
  'js/ui/charts/donut.js',
  'js/ui/charts/bars.js'
];

// 非关键资源：图标缺失只影响安装图标，不影响页面离线渲染，
// 允许失败但必须告警并出现在失败清单里
const NON_CRITICAL = [
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png'
];

function isCritical(url) {
  return NON_CRITICAL.indexOf(url) === -1;
}

// 当前 scope 下 index.html 的绝对地址；导航兜底按绝对地址匹配，避免相对路径歧义
function indexUrl() {
  return new URL('index.html', self.registration.scope).href;
}

// 把相对清单规范化为「绝对地址」清单：
// 1) 全部按 scope 解析，fetch 与 cache.put 使用同一个绝对地址；
// 2) './' 与 'index.html' 指向同一份文档，统一收敛到 indexUrl()，
//    保证导航回退时用的键就是预缓存写入的键，不会出现"缓存了却匹配不到"。
function assetList() {
  const indexKey = indexUrl();
  const seen = Object.create(null);
  const list = [];

  ASSETS.forEach(function (url) {
    const abs = (url === './' || url === 'index.html')
      ? indexKey
      : new URL(url, self.registration.scope).href;

    if (seen[abs]) return;
    seen[abs] = true;
    list.push({ url: abs, source: url });
  });

  return list;
}

// 判断是否为「网络优先」资源（页面/样式/脚本/清单，保证更新立即可见）
// 导航请求在 fetch 事件里单独处理，不进入这里
function isNetworkFirst(req) {
  const path = new URL(req.url).pathname;
  return path.endsWith('.html') || path.endsWith('.css') ||
         path.endsWith('.js') || path.endsWith('.json');
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const assets = assetList();
    const ok = [];
    const failed = [];
    const failedCritical = [];

    // 逐条缓存：addAll 是原子的，一个资源失败会导致整份清单都不写入，
    // 这里改为逐条加载，既能定位到具体路径，也不会被单个资源拖垮
    await Promise.all(assets.map(async (item) => {
      const abs = item.url;

      try {
        // fetch 与 cache.put 使用同一个绝对地址，避免相对路径按不同 base 解析
        const res = await fetch(abs, { cache: 'reload' });
        if (!res || !res.ok) throw new Error('HTTP ' + (res ? res.status : 'no response'));
        await cache.put(abs, res);
        ok.push(abs);
      } catch (err) {
        failed.push({ url: abs, reason: (err && err.message) ? err.message : String(err) });
        // 关键性按清单里的原始相对路径判断，不受绝对化影响
        if (isCritical(item.source)) failedCritical.push(abs);
      }
    }));

    console.log('[SW ' + CACHE_VERSION + '] 预缓存成功 ' + ok.length + '/' + assets.length + '：', ok);
    if (failed.length) {
      console.warn('[SW ' + CACHE_VERSION + '] 预缓存失败 ' + failed.length + ' 项：', failed);
    }

    // 关键资源缺失会让离线页面残缺或白屏，必须让安装失败，
    // 而不是"看起来装好了、实际不可用"
    if (failedCritical.length) {
      throw new Error('[SW ' + CACHE_VERSION + '] 关键资源缓存失败：' + failedCritical.join(', '));
    }

    // 预缓存完成后再接管，避免激活过早导致页面拿到空缓存
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    // 只删「本应用前缀 + 非当前版本」的缓存，绝不动同源其他项目的缓存
    const stale = keys.filter((k) => k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE);
    await Promise.all(stale.map((k) => caches.delete(k)));
    if (stale.length) {
      console.log('[SW ' + CACHE_VERSION + '] 已清理旧版本缓存：', stale);
    }
    // 缓存就绪并清理完毕后再接管现有页面
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  // 导航请求：网络优先，离线回退当前版本 CACHE 里的 index.html
  if (e.request.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(e.request);
        if (res && res.ok) {
          const copy = res.clone();
          // 固定写入 index.html 的绝对地址键，避免 ?query 撑出无数条缓存
          caches.open(CACHE).then((c) => c.put(indexUrl(), copy)).catch(() => {});
        }
        return res;
      } catch (err) {
        // 只查当前版本缓存，不使用全局 caches.match，避免命中同源其他项目的缓存
        const cache = await caches.open(CACHE);

        // 导航失败一律回退 index.html：单入口应用，不按原 URL 做二次匹配
        const fallback = await cache.match(indexUrl());
        if (fallback) return fallback;

        // 当前版本缓存也没有时给出明确提示页，而不是让浏览器抛网络错误
        return new Response(
          '<!DOCTYPE html><html lang="zh-CN"><meta charset="utf-8">' +
          '<title>离线</title><p style="font-family:sans-serif;padding:24px;line-height:1.7">' +
          '当前处于离线状态，且本地缓存不可用，请联网后重试。</p></html>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    })());
    return;
  }

  if (isNetworkFirst(e.request)) {
    // 网络优先：拿最新；失败（离线）才回落当前版本缓存
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.open(CACHE).then((c) =>
        c.match(e.request, { ignoreSearch: true }).then((hit) => hit || c.match(indexUrl()))
      ))
    );
  } else {
    // 图标等静态资源：缓存优先 + 后台更新（只读当前版本缓存）
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(e.request);

      const net = fetch(e.request).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached || Response.error());

      return cached || net;
    })());
  }
});
