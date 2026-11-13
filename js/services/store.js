
import { db } from '../db/db.js';
import { yearModel } from '../models/year.js';
import { experienceModel } from '../models/experience.js';
import { migrateFromV4 } from '../db/migration.js';
import { uid } from '../utils.js';

async function init() {
  await db.open();
  await migrateFromV4();
}

// 读取某条经历的全部附件
async function getAttachments(experienceId) {
  return db.getByIndex(
    'attachments',
    'experienceId',
    experienceId
  );
}

// 保存附件
async function addAttachment(data) {
  if (!data || !data.experienceId) {
    throw new Error('附件缺少关联经历');
  }

  if (!data.blob || !(data.blob instanceof Blob)) {
    throw new Error('附件文件数据无效');
  }

  const experience = await experienceModel.get(data.experienceId);

  if (!experience) {
    throw new Error('关联的经历不存在');
  }

  const record = {
    id: uid(),
    experienceId: data.experienceId,
    type: data.type || 'photo',
    name: data.name || '未命名附件',
    mimeType: data.mimeType || data.blob.type || '',
    blob: data.blob,
    createdAt: Date.now()
  };

  await db.add('attachments', record);

  return record;
}

// 删除指定附件
async function removeAttachment(id) {
  const attachment = await db.get('attachments', id);

  if (!attachment) {
    throw new Error('附件不存在');
  }

  await db.del('attachments', id);

  return true;
}

// 读取元数据
async function getMeta(key) {
  return db.get('meta', key);
}

// 保存元数据
async function setMeta(key, value) {
  return db.put('meta', {
    key,
    value,
    updatedAt: Date.now()
  });
}

export const store = {
  init,
  db,
  years: yearModel,
  experiences: experienceModel,
  getAttachments,
  addAttachment,
  removeAttachment,
  getMeta,
  setMeta
};
