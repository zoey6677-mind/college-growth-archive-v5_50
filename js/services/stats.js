/* =========================================================
   成长档案 v5 · stats.js
   职责：统计计算（真实数据，全部来自 IndexedDB）
   本阶段仅实现概览首页所需统计，深度统计留待后续开发。
   ========================================================= */
import { store } from './store.js';
import { CATEGORIES } from '../config.js';

/**
 * 概览首页统计。
 * - yearId 传入具体学年 id 时：总数 / 六分类 / 最近新增按该学年过滤；
 * - 传入 'all' 或省略时统计全部；
 * - 各学年分布 byYear 始终为全量（用于横向对比）。
 */
async function overview(yearId) {
  const [years, exps] = await Promise.all([
    store.years.list(),
    store.experiences.list({})
  ]);

  const filterYear = yearId && yearId !== 'all' ? yearId : null;
  const scoped = filterYear ? exps.filter((e) => e.yearId === filterYear) : exps;

  // 六分类计数（含 0，顺序与 config 一致）
  const byCategory = {};
  CATEGORIES.forEach((c) => { byCategory[c.key] = 0; });
  scoped.forEach((e) => {
    if (byCategory[e.category] == null) byCategory[e.category] = 0;
    byCategory[e.category]++;
  });

  // 各学年经历数量（全量，不随筛选变化）
  const byYear = {};
  years.forEach((y) => { byYear[y.id] = 0; });
  exps.forEach((e) => {
    if (e.yearId != null) {
      if (byYear[e.yearId] == null) byYear[e.yearId] = 0;
      byYear[e.yearId]++;
    }
  });

  // 最近新增（日期倒序，同日期按创建时间倒序，取前 5）
  const recent = scoped.slice().sort((a, b) => {
    const da = a.date || '';
    const db = b.date || '';
    if (da === db) return (b.createdAt || 0) - (a.createdAt || 0);
    return da < db ? 1 : -1;
  }).slice(0, 5);

  return { total: scoped.length, byCategory, byYear, recent, years, exps: scoped };
}

// 六分类分布（全量）
async function byCategory() {
  const exps = await store.experiences.list({});
  const map = {};
  CATEGORIES.forEach((c) => { map[c.key] = 0; });
  exps.forEach((e) => {
    if (map[e.category] == null) map[e.category] = 0;
    map[e.category]++;
  });
  return map;
}

export const statsService = { overview, byCategory };
