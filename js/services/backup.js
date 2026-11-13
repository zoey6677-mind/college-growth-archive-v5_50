/* =========================================================
   成长档案 v5 · backup.js
   职责：JSON 数据导出 / 导入 / 校验
   - 导出：years + experiences + attachments（Blob 转 Base64 dataURL）
   - 导入：结构校验 + 引用校验，合并（跳过同 id）/ 覆盖（清空后写入）
   - 写入统一走 db.transaction 多 store 事务，保证一致性
   注意：本模块不直接操作 UI；「覆盖前确认」由调用方（profile 页）负责。
   ========================================================= */

import { db, reqP } from '../db/db.js';
import { VALID_CATEGORIES } from '../db/schema.js';
import { download, isValidISODate } from '../utils.js';

const BACKUP_APP_ID = 'college-growth-archive';
const BACKUP_VERSION = 1;

// ---------- Blob <-> dataURL 转换 ----------

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    if (!(blob instanceof Blob)) {
      reject(new Error('附件数据不是 Blob'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('附件读取失败'));
    reader.readAsDataURL(blob);
  });
}

function dataURLToBlob(dataURL) {
  if (typeof dataURL !== 'string' || dataURL.indexOf('data:') !== 0) {
    throw new Error('附件编码不是有效的 dataURL');
  }
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataURL);
  if (!m) throw new Error('dataURL 格式无效');
  const mime = m[1] || 'application/octet-stream';
  if (!m[2]) throw new Error('附件未使用 Base64 编码');
  const bin = atob(m[3]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// ---------- 内部工具 ----------

function pad(n) { return String(n).padStart(2, '0'); }

function timestamp() {
  const d = new Date();
  return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate())
    + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
}

// ---------- 导出 ----------

/**
 * 导出全部数据为可下载的 JSON 备份文件。
 * 返回 { years, experiences, attachments, skippedAttachments, filename }
 */
async function exportJSON() {
  const [years, experiences, attachments] = await Promise.all([
    db.getAll('years'),
    db.getAll('experiences'),
    db.getAll('attachments')
  ]);

  const exportedAttachments = [];
  let skippedAttachments = 0;

  for (const a of attachments) {
    try {
      const data = await blobToDataURL(a.blob);
      exportedAttachments.push({
        id: String(a.id),
        experienceId: String(a.experienceId),
        type: a.type === 'certificate' ? 'certificate' : 'photo',
        name: a.name || '未命名附件',
        mimeType: a.mimeType || (a.blob && a.blob.type) || '',
        data,
        createdAt: a.createdAt || Date.now()
      });
    } catch (e) {
      // 单个附件损坏不阻断整体导出，记录数量并在结果中提示
      skippedAttachments++;
      console.warn('[backup] 导出时跳过无效附件：', a && a.name, e);
    }
  }

  const payload = {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      years: years.length,
      experiences: experiences.length,
      attachments: exportedAttachments.length
    },
    years,
    experiences,
    attachments: exportedAttachments
  };

  const filename = 'growth-archive-backup-' + timestamp() + '.json';
  download(filename, JSON.stringify(payload), 'application/json');

  return {
    years: years.length,
    experiences: experiences.length,
    attachments: exportedAttachments.length,
    skippedAttachments,
    filename
  };
}

// ---------- 导入校验 ----------

/**
 * 校验备份文件顶层结构。不通过则抛出带明确原因的错误。
 */
function validateBackupStructure(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('备份文件内容不是有效的 JSON 对象');
  }
  if (data.app !== BACKUP_APP_ID) {
    throw new Error('这不是本应用的备份文件（缺少应用标识 ' + BACKUP_APP_ID + '）');
  }
  if (data.version !== BACKUP_VERSION) {
    throw new Error('备份版本不支持：文件版本 ' + data.version + '，当前支持版本 ' + BACKUP_VERSION);
  }
  ['years', 'experiences', 'attachments'].forEach((k) => {
    if (!Array.isArray(data[k])) {
      throw new Error('备份缺少必要的数据段：' + k);
    }
  });
}

/**
 * 逐条校验并规范化备份数据。
 * mode === 'merge' 时，yearId 允许指向数据库中已有的学年；
 * mode === 'replace' 时，yearId 必须指向备份内的学年。
 */
async function normalizeBackupData(data, mode) {
  const problems = [];

  // 学年
  const yearMap = {};
  const years = [];
  data.years.forEach((y, i) => {
    if (!y || y.id == null || !String(y.name || '').trim()) {
      problems.push('第 ' + (i + 1) + ' 条学年记录缺少 id 或名称');
      return;
    }
    const id = String(y.id);
    if (yearMap[id]) {
      problems.push('备份中存在重复学年 id：' + id);
      return;
    }
    yearMap[id] = true;
    years.push({
      id,
      name: String(y.name).trim(),
      label: y.label != null ? String(y.label) : '',
      sortOrder: Number.isFinite(Number(y.sortOrder)) ? Number(y.sortOrder) : i + 1,
      createdAt: y.createdAt || Date.now(),
      updatedAt: y.updatedAt || Date.now()
    });
  });

  // 经历
  const validCats = VALID_CATEGORIES;
  const experienceMap = {};
  const experiences = [];
  for (let i = 0; i < data.experiences.length; i++) {
    const e = data.experiences[i];
    if (!e || e.id == null) {
      problems.push('第 ' + (i + 1) + ' 条经历缺少 id');
      continue;
    }
    const id = String(e.id);
    if (experienceMap[id]) {
      problems.push('备份中存在重复经历 id：' + id);
      continue;
    }
    if (!validCats.includes(e.category)) {
      problems.push('经历「' + (e.title || id) + '」分类无效：' + e.category);
      continue;
    }
    if (!String(e.title || '').trim()) {
      problems.push('经历 ' + id + ' 缺少名称');
      continue;
    }
    if (!isValidISODate(String(e.date == null ? '' : e.date))) {
      problems.push('经历「' + (e.title || id) + '」日期无效：' + e.date);
      continue;
    }
    // 结束日期可留空；填写时同样必须是真实存在的日期，且不得早于开始日期
    const endDate = e.endDate == null ? '' : String(e.endDate);
    if (endDate) {
      if (!isValidISODate(endDate)) {
        problems.push('经历「' + (e.title || id) + '」结束日期无效：' + e.endDate);
        continue;
      }
      if (endDate < String(e.date)) {
        problems.push('经历「' + (e.title || id) + '」结束日期早于开始日期：' + e.endDate);
        continue;
      }
    }
    const yearId = e.yearId != null ? String(e.yearId) : '';
    if (!yearMap[yearId]) {
      if (mode === 'replace' || !yearId) {
        problems.push('经历「' + (e.title || id) + '」关联的学年不存在');
        continue;
      }
      // merge 模式下允许指向数据库中已有的学年，此处异步检查
      const dbYear = await db.get('years', yearId);
      if (!dbYear) {
        problems.push('经历「' + (e.title || id) + '」关联的学年不存在（备份和当前数据库中均未找到）');
        continue;
      }
    }
    experienceMap[id] = true;
    experiences.push(e);
  }

  // 附件
  const attachments = [];
  let invalidAttachments = 0;
  for (const raw of data.attachments) {
    try {
      if (!raw || raw.id == null || raw.experienceId == null) {
        throw new Error('缺少 id 或 experienceId');
      }
      const id = String(raw.id);
      const experienceId = String(raw.experienceId);
      if (!experienceMap[experienceId]) {
        throw new Error('关联的经历不存在');
      }
      const type = raw.type === 'certificate' ? 'certificate' : 'photo';
      const blob = dataURLToBlob(raw.data);
      attachments.push({
        id,
        experienceId,
        type,
        name: raw.name || '未命名附件',
        mimeType: raw.mimeType || blob.type || '',
        blob,
        createdAt: raw.createdAt || Date.now()
      });
    } catch (err) {
      invalidAttachments++;
      console.warn('[backup] 导入时跳过无效附件：', raw && raw.name, err.message);
    }
  }

  if (problems.length) {
    throw new Error('备份数据校验未通过：\n- ' + problems.slice(0, 8).join('\n- ')
      + (problems.length > 8 ? '\n…等共 ' + problems.length + ' 个问题' : ''));
  }

  if (!years.length && !experiences.length && mode === 'replace') {
    throw new Error('备份中没有任何数据，拒绝执行覆盖导入');
  }

  return { years, experiences, attachments, invalidAttachments };
}

// ---------- 导入 ----------

/**
 * 导入备份文件。
 * @param {File} file 用户选择的 JSON 备份文件
 * @param {'merge'|'replace'} mode merge=合并（同 id 跳过）；replace=覆盖（清空后写入，调用方必须先向用户确认）
 * @returns 导入统计 { mode, years, experiences, attachments, skipped..., invalidAttachments }
 */
async function importJSON(file, mode) {
  if (mode !== 'merge' && mode !== 'replace') {
    throw new Error('导入模式必须是 merge（合并）或 replace（覆盖）');
  }
  if (!file) throw new Error('未选择备份文件');

  let data;
  try {
    data = JSON.parse(await file.text());
  } catch (e) {
    throw new Error('备份文件解析失败，请确认选择的是 JSON 备份文件');
  }

  validateBackupStructure(data);
  const clean = await normalizeBackupData(data, mode);

  // 写入阶段：统一走多 store 事务保证一致性；附件 Blob 已在事务外转换完毕
  const result = await db.transaction(
    ['years', 'experiences', 'attachments'],
    'readwrite',
    async (stores) => {
      const stat = {
        years: 0, experiences: 0, attachments: 0,
        skippedYears: 0, skippedExperiences: 0, skippedAttachments: 0
      };

      if (mode === 'replace') {
        await reqP(stores.years.clear());
        await reqP(stores.experiences.clear());
        await reqP(stores.attachments.clear());
      }

      for (const y of clean.years) {
        if (mode === 'merge' && (await reqP(stores.years.get(y.id)))) {
          stat.skippedYears++;
          continue;
        }
        await reqP(stores.years.put(y));
        stat.years++;
      }

      for (const e of clean.experiences) {
        if (mode === 'merge' && (await reqP(stores.experiences.get(e.id)))) {
          stat.skippedExperiences++;
          continue;
        }
        await reqP(stores.experiences.put(e));
        stat.experiences++;
      }

      for (const a of clean.attachments) {
        if (mode === 'merge' && (await reqP(stores.attachments.get(a.id)))) {
          stat.skippedAttachments++;
          continue;
        }
        await reqP(stores.attachments.put(a));
        stat.attachments++;
      }

      return stat;
    }
  );

  result.mode = mode;
  result.invalidAttachments = clean.invalidAttachments;
  return result;
}

export const backupService = { exportJSON, importJSON };
