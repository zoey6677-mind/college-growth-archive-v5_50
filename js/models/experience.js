/* =========================================================
   成长档案 v5 · experience.js
   职责：六分类经历通用 CRUD + 数据校验
   ========================================================= */

import { db, reqP } from '../db/db.js';
import { CATEGORY_MAP, CATEGORY_FIELDS } from '../config.js';
import { uid, isValidISODate } from '../utils.js';

// 通用字段 + 六分类专属字段（白名单，用于规范化写入，避免落库无关字段）
const COMMON_FIELDS = ['category', 'title', 'date', 'endDate', 'yearId', 'summary'];
const EXTRA_FIELDS = [
  'organizer', 'role', 'grade', 'level', 'certificate',
  'hours', 'content', 'location', 'researchType', 'status', 'link',
  'organization', 'position', 'period', 'duties'
];

/**
 * 同步校验经历字段。
 * 返回错误信息字符串；通过返回 null。
 * 注意：yearId 是否真实存在属引用校验，在 add/update 中异步检查。
 */
export function validateExperience(data) {
  if (!data || typeof data !== 'object') return '经历数据无效';

  const cat = data.category;
  if (!CATEGORY_MAP[cat]) return '无效的经历分类：' + cat;

  if (!data.title || !String(data.title).trim()) return '名称不能为空';

  if (!data.date) return '日期不能为空';
  if (!isValidISODate(String(data.date))) {
    return '请输入真实存在的日期（如 2025-02-28）';
  }

  // 结束日期可留空；填写时同样必须是真实存在的日期，且不得早于开始日期
  if (data.endDate) {
    if (!isValidISODate(String(data.endDate))) {
      return '结束日期无效（如 2025-06-30）';
    }
    if (String(data.endDate) < String(data.date)) {
      return '结束日期不能早于开始日期';
    }
  }

  if (!data.yearId) return '请选择关联学年';

  return null;
}

// 规范化：仅保留传入的非空字段，标题去首尾空格
function normalize(data) {
  const out = {};
  COMMON_FIELDS.forEach((k) => {
    if (data[k] != null) out[k] = data[k];
  });
  EXTRA_FIELDS.forEach((k) => {
    if (data[k] != null) out[k] = data[k];
  });
  if (data.title != null) out.title = String(data.title).trim();
  return out;
}

// 校验 yearId 是否真实存在
async function assertYearExists(yearId) {
  const year = await db.get('years', yearId);
  if (!year) throw new Error('关联的学年不存在');
  return year;
}

async function list(filter) {
  const all = await db.getAll('experiences');
  const f = filter || {};
  let result = all;

  if (f.category) result = result.filter((e) => e.category === f.category);
  if (f.yearId && f.yearId !== 'all') result = result.filter((e) => e.yearId === f.yearId);
  if (Array.isArray(f.yearIds)) result = result.filter((e) => f.yearIds.indexOf(e.yearId) >= 0);
  if (f.q) {
    const q = String(f.q).toLowerCase();
    result = result.filter((e) => String(e.title || '').toLowerCase().indexOf(q) >= 0);
  }

  // 默认按日期倒序（新 → 旧）
  result = result.slice().sort((a, b) => {
    const da = a.date || '', db = b.date || '';
    if (da === db) return 0;
    return da < db ? 1 : -1;
  });
  return result;
}

async function get(id) {
  return db.get('experiences', id);
}

async function add(data) {
  const err = validateExperience(data);
  if (err) throw new Error(err);
  await assertYearExists(data.yearId);

  const now = Date.now();
  const record = Object.assign({ summary: '' }, normalize(data), {
    id: uid(),
    createdAt: now,
    updatedAt: now
  });
  await db.put('experiences', record);
  return record;
}

async function update(id, data) {
  const existing = await db.get('experiences', id);
  if (!existing) throw new Error('经历不存在');

  // 用传入数据覆盖已有字段，再整体校验
  const merged = Object.assign({}, existing, normalize(data), { id: existing.id, createdAt: existing.createdAt });
  const err = validateExperience(merged);
  if (err) throw new Error(err);
  await assertYearExists(merged.yearId);

  merged.updatedAt = Date.now();
  await db.put('experiences', merged);
  return merged;
}

// 删除经历，并级联删除其关联附件（同一事务保证一致性）
async function remove(id) {
  const existing = await db.get('experiences', id);
  if (!existing) throw new Error('经历不存在');

  const atts = await db.getByIndex('attachments', 'experienceId', id);
  await db.transaction(['experiences', 'attachments'], 'readwrite', async (stores) => {
    for (const a of atts) {
      await reqP(stores.attachments.delete(a.id));
    }
    await reqP(stores.experiences.delete(id));
  });
  return true;
}

export const experienceModel = {
  list,
  get,
  add,
  update,
  remove,
  validate: validateExperience
};
