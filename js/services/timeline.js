/* =========================================================
   成长档案 v5 · timeline.js（服务层）
   职责：时间轴数据组装（只读，不写入数据库）
   - 按本地学年筛选经历
   - 严格校验日期（真实日历日期），缺失/非法归入「日期未知」
   - 按年月分组，月份倒序、组内日期倒序、同日按 createdAt 与 id 兜底
   ========================================================= */
import { store } from './store.js';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(n) {
  return String(n).padStart(2, '0');
}

/**
 * 严格解析 YYYY-MM-DD。
 * 除格式外还校验是真实存在的日历日期（拒绝 2025-02-30、2025-13-01 等）。
 * 解析失败返回 null（调用方归入「日期未知」）。
 */
function parseDateParts(value) {
  if (typeof value !== 'string') return null;

  const m = DATE_RE.exec(value);
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);

  if (mo < 1 || mo > 12 || d < 1) return null;

  // 用 setFullYear 设置完整年份：避免 new Date(y, ...) 把 0–99 视为 1900–1999
  // 仍为本地时间构造，避免 UTC 偏移造成跨日
  const dt = new Date(2000, 0, 1);
  dt.setFullYear(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
    return null;
  }

  return {
    y,
    mo,
    d,
    monthKey: y + '-' + pad(mo),
    day: pad(mo) + '-' + pad(d),
    ts: dt.getTime()
  };
}

// 未知日期组的排序：createdAt 倒序 → id 倒序（保证顺序稳定）
function byCreatedAtDesc(a, b) {
  const ca = Number(a.createdAt) || 0;
  const cb = Number(b.createdAt) || 0;
  if (ca !== cb) return cb - ca;
  return String(b.id).localeCompare(String(a.id));
}

/**
 * 组装时间轴数据（纯读取）。
 * @param {'all'|string} yearId 当前筛选学年，'all' 或省略表示全部
 * @returns {{total:number, invalidCount:number, months:Array}}
 *   months 已按年月倒序，「日期未知」组固定排在最后
 */
async function build(yearId) {
  const [years, exps] = await Promise.all([
    store.years.list(),
    store.experiences.list({})
  ]);

  const filterYear = yearId && yearId !== 'all' ? yearId : null;
  const scoped = filterYear
    ? exps.filter((e) => e.yearId === filterYear)
    : exps.slice();

  const groupMap = new Map();
  const unknown = [];

  scoped.forEach((e) => {
    const parts = parseDateParts(e.date);

    if (!parts) {
      // 缺失 / 空串 / 非法日期：保留记录，归入「日期未知」
      unknown.push(e);
      return;
    }

    const existed = groupMap.get(parts.monthKey);
    if (existed) {
      existed.push({ item: e, parts });
    } else {
      groupMap.set(parts.monthKey, [{ item: e, parts }]);
    }
  });

  const months = Array.from(groupMap.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0)) // 年月倒序
    .map(([key, list]) => {
      list.sort((x, y) => {
        if (x.parts.ts !== y.parts.ts) return y.parts.ts - x.parts.ts; // 日期倒序
        return byCreatedAtDesc(x.item, y.item);                          // 同日稳定排序
      });

      return {
        key,
        label: Number(key.slice(0, 4)) + '年' + Number(key.slice(5, 7)) + '月',
        count: list.length,
        items: list.map((x) => Object.assign({}, x.item, { _day: x.parts.day }))
      };
    });

  unknown.sort(byCreatedAtDesc);

  if (unknown.length) {
    months.push({
      key: 'unknown',
      label: '日期未知',
      count: unknown.length,
      items: unknown.map((e) => Object.assign({}, e, { _day: '' }))
    });
  }

  return {
    total: scoped.length,
    invalidCount: unknown.length,
    months,
    years
  };
}

export const timelineService = { build };
