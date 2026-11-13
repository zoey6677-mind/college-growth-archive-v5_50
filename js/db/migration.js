/* =========================================================
   成长档案 v5 · migration.js
   职责：v4 localStorage → IndexedDB 一键迁移
   ========================================================= */

import { db, reqP } from './db.js';
import { uid } from '../utils.js';

// v4 的 localStorage 键（迁移源，只读，不删除、不覆盖）
export const V4_STORE_KEY = 'collegeRecordData.v1';
export const V4_YEAR_KEY = 'collegeRecordYearFilter.v1';

// meta 中的迁移完成标记
const MIGRATED_KEY = 'migratedFromV4';

/**
 * v4 activities.type → 六大分类映射规则
 */
function mapActivityType(type) {
  const t = String(type || '');
  if (/志愿/.test(t)) return 'volunteer';
  if (/实践|实习|调研/.test(t)) return 'practice';
  if (/竞赛|比赛|科创/.test(t)) return 'competition';
  if (/科研|论文|课题|专利/.test(t)) return 'research';
  if (/学生工作|学生会|班委|干部|干事/.test(t)) return 'studentwork';
  return 'campus';
}

// dataURL → Blob（供照片 / 证书入库）
function dataURLToBlob(dataURL) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataURL);
  if (!m) throw new Error('无效的 dataURL');
  const mime = m[1] || 'image/jpeg';
  const isBase64 = !!m[2];
  const data = m[3];
  if (isBase64) {
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { blob: new Blob([bytes], { type: mime }), mime };
  }
  return { blob: new Blob([decodeURIComponent(data)], { type: mime }), mime };
}

// v4 activity → v5 experience
function activityToExperience(a) {
  if (!a || a.id == null) return null;
  return {
    id: String(a.id),
    category: mapActivityType(a.type),
    title: a.name || '未命名活动',
    date: a.date || '',
    endDate: null,
    yearId: a.yearId || null,
    summary: a.note || '',
    organizer: a.organizer || '',
    role: a.role || '',
    createdAt: a.createdAt || Date.now(),
    updatedAt: Date.now()
  };
}

// v4 award → v5 experience（competition）
function awardToExperience(w) {
  if (!w || w.id == null) return null;
  return {
    id: String(w.id),
    category: 'competition',
    title: w.name || '未命名奖项',
    date: w.date || '',
    endDate: null,
    yearId: w.yearId || null,
    summary: w.note || '',
    grade: w.grade || '',
    level: w.level || '',
    organizer: w.organizer || '',
    certificate: w.certificate || '',
    createdAt: w.createdAt || Date.now(),
    updatedAt: Date.now()
  };
}

// 在事务内把一组 dataURL 附件写入 attachments store
async function writeAttachments(stores, experienceId, type, list, label) {
  if (!Array.isArray(list) || !list.length) return 0;
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const src = list[i];
    // 空值 / 非 dataURL 跳过（不算错误）
    if (!src || typeof src !== 'string' || src.indexOf('data:') !== 0) continue;
    let parsed;
    try {
      parsed = dataURLToBlob(src);
    } catch (e) {
      throw new Error('附件转换失败（' + label + ' 第 ' + (i + 1) + ' 项）：' + e.message);
    }
    await reqP(stores.attachments.put({
      id: uid(),
      experienceId,
      type,
      blob: parsed.blob,
      mimeType: parsed.mime,
      name: label + '-' + (i + 1),
      createdAt: Date.now()
    }));
    n++;
  }
  return n;
}

/**
 * 执行 v4 → v5 迁移（幂等，可安全重复调用）。
 * 返回结果对象：
 *  { migrated: boolean, reason: 'already'|'no-source'|'target-not-empty'|null, ...stats }
 */
export async function migrateFromV4() {
  await db.open();

  // 1. 已迁移过 → 直接跳过
  const marker = await db.get('meta', MIGRATED_KEY);
  if (marker && marker.value) {
    return { migrated: false, reason: 'already' };
  }

  // 2. 无 v4 源数据 → 无需迁移（不写标记，避免覆盖后续真实数据）
  const raw = localStorage.getItem(V4_STORE_KEY);
  if (!raw) {
    return { migrated: false, reason: 'no-source' };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error('v4 数据解析失败：' + e.message);
  }

  // 3. 目标库已有数据 → 防止覆盖 / 重复，跳过迁移
  const [existingYears, existingExps] = await Promise.all([
    db.getAll('years'),
    db.getAll('experiences')
  ]);
  if (existingYears.length || existingExps.length) {
    return { migrated: false, reason: 'target-not-empty' };
  }

  const years = Array.isArray(data.years) ? data.years : [];
  const activities = Array.isArray(data.activities) ? data.activities : [];
  const awards = Array.isArray(data.awards) ? data.awards : [];

  const now = Date.now();
  let attachmentCount = 0;

  // 4. 单事务写入（任一环节失败则整体回滚，不写标记）
  await db.transaction(
    ['years', 'experiences', 'attachments', 'meta'],
    'readwrite',
    async (stores) => {
      // 学年（保留原 id，按数组顺序补 sortOrder）
      for (let i = 0; i < years.length; i++) {
        const y = years[i];
        if (!y || y.id == null) continue;
        await reqP(stores.years.put({
          id: String(y.id),
          name: y.name || '',
          label: y.label || '',
          sortOrder: i,
          createdAt: now,
          updatedAt: now
        }));
      }

      // 活动 → 经历 + 照片附件
      for (const a of activities) {
        const exp = activityToExperience(a);
        if (!exp) continue;
        await reqP(stores.experiences.put(exp));
        attachmentCount += await writeAttachments(stores, exp.id, 'photo', a.photos, '照片');
      }

      // 获奖 → 经历（competition）+ 证书附件
      for (const w of awards) {
        const exp = awardToExperience(w);
        if (!exp) continue;
        await reqP(stores.experiences.put(exp));
        attachmentCount += await writeAttachments(stores, exp.id, 'certificate', w.certImages, '证书');
      }

      // 迁移成功标记（全部成功后写入）
      await reqP(stores.meta.put({ key: MIGRATED_KEY, value: true, migratedAt: now }));
    }
  );

  // 原始 localStorage 保留不删，作为备份
  return {
    migrated: true,
    reason: null,
    years: years.length,
    experiences: activities.length + awards.length,
    attachments: attachmentCount
  };
}
