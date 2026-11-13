/* =========================================================
   成长档案 v5 · year.js
   职责：学年 CRUD + 删除关联保护 + 关联经历迁移
   ========================================================= */

import { db, reqP } from '../db/db.js';
import { uid } from '../utils.js';

/**
 * 删除学年规则（已确认）：
 * 1. 学年下存在经历时，默认禁止直接删除；
 * 2. 提供「将关联经历迁移到其他学年」的功能；
 * 3. 迁移成功后才允许删除原学年；
 * 4. 不允许未经用户明确确认就连带删除经历。
 */

// 列出全部学年（按 sortOrder 升序，其次按创建时间）
async function list() {
  const years = await db.getAll('years');
  years.sort((a, b) =>
    (a.sortOrder || 0) - (b.sortOrder || 0) ||
    (a.createdAt || 0) - (b.createdAt || 0)
  );
  return years;
}

async function get(id) {
  return db.get('years', id);
}

// 新增学年（校验名称必填、去重）
async function add(data) {
  const name = data && String(data.name || '').trim();
  if (!name) throw new Error('学年名称不能为空');

  const all = await list();
  if (all.some((y) => y.name === name)) {
    throw new Error('已存在同名学年「' + name + '」');
  }

  const maxSort = all.reduce((m, y) => Math.max(m, y.sortOrder || 0), 0);
  const now = Date.now();
  const record = {
    id: uid(),
    name,
    label: (data && data.label != null) ? String(data.label).trim() : '',
    sortOrder: (data && data.sortOrder != null) ? Number(data.sortOrder) : maxSort + 1,
    createdAt: now,
    updatedAt: now
  };
  await db.put('years', record);
  return record;
}

// 重命名 / 修改标签（校验名称必填、去重）
async function rename(id, data) {
  const existing = await db.get('years', id);
  if (!existing) throw new Error('学年不存在');

  const name = data && String(data.name || '').trim();
  if (!name) throw new Error('学年名称不能为空');

  const all = await list();
  if (all.some((y) => y.id !== id && y.name === name)) {
    throw new Error('已存在同名学年「' + name + '」');
  }

  existing.name = name;
  if (data && data.label != null) existing.label = String(data.label).trim();
  existing.updatedAt = Date.now();
  await db.put('years', existing);
  return existing;
}

// 统计某学年下的经历数量（供删除保护判断）
async function countExperiences(yearId) {
  return db.countByIndex('experiences', 'yearId', yearId);
}

/**
 * 将原学年（fromYearId）的全部经历迁移到目标学年（toYearId）。
 * 在单个事务内完成，保证一致性；返回迁移条数。
 */
async function migrateExperiences(fromYearId, toYearId) {
  if (!fromYearId || !toYearId) throw new Error('请指定原学年和目标学年');
  if (fromYearId === toYearId) throw new Error('原学年与目标学年不能相同');

  const from = await db.get('years', fromYearId);
  if (!from) throw new Error('原学年不存在');
  const to = await db.get('years', toYearId);
  if (!to) throw new Error('目标学年不存在');

  const now = Date.now();
  return db.transaction(['experiences'], 'readwrite', async (stores) => {
    const exps = await reqP(stores.experiences.index('yearId').getAll(fromYearId));
    for (const e of exps) {
      e.yearId = toYearId;
      e.updatedAt = now;
      await reqP(stores.experiences.put(e));
    }
    return exps.length;
  });
}

/**
 * 删除学年。
 * 默认禁止直接删除仍有经历的学年；仅当该学年下经历数为 0 时才删除。
 */
async function remove(id) {
  const existing = await db.get('years', id);
  if (!existing) throw new Error('学年不存在');

  const count = await countExperiences(id);
  if (count > 0) {
    throw new Error('该学年下还有 ' + count + ' 条经历，请先迁移到其他学年或删除这些经历');
  }
  await db.del('years', id);
  return true;
}

export const yearModel = {
  list,
  get,
  add,
  rename,
  countExperiences,
  migrateExperiences,
  remove
};
