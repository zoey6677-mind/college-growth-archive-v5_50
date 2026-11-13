/* =========================================================
   成长档案 v5 · schema.js
   数据库结构统一定义（库名、版本、四 object store、索引）
   说明：本文件是数据库结构的唯一权威来源，db.js 依此建库，
        避免结构定义散落各处导致不一致。
   ========================================================= */

// 数据库名与版本（结构变更时递增 DB_VERSION，触发 onupgradeneeded 升级）
export const DB_NAME = 'growth-archive';
export const DB_VERSION = 1;

/*
 * 四个 object store 定义：
 *  - keyPath      主键路径
 *  - indexes      索引列表，每项 { name, keyPath, unique }
 *    keyPath 为数组时表示复合索引
 */
export const STORES = {
  // 学年
  years: {
    keyPath: 'id',
    indexes: [
      { name: 'sortOrder', keyPath: 'sortOrder', unique: false }
    ]
  },

  // 六大分类经历（统一一张表，category 区分）
  experiences: {
    keyPath: 'id',
    indexes: [
      { name: 'yearId', keyPath: 'yearId', unique: false },
      { name: 'category', keyPath: 'category', unique: false },
      { name: 'date', keyPath: 'date', unique: false },
      { name: 'category_date', keyPath: ['category', 'date'], unique: false }
    ]
  },

  // 附件（照片 / 证书，Blob 存储）
  attachments: {
    keyPath: 'id',
    indexes: [
      { name: 'experienceId', keyPath: 'experienceId', unique: false },
      { name: 'type', keyPath: 'type', unique: false }
    ]
  },

  // 元数据（数据库版本、迁移状态、应用设置等）
  meta: {
    keyPath: 'key',
    indexes: []
  }
};

// 六大分类枚举（与 config.js 的 CATEGORIES 保持一致，供数据校验使用）
export const VALID_CATEGORIES = [
  'campus',       // 校园活动
  'competition',  // 竞赛获奖
  'volunteer',    // 志愿服务
  'practice',     // 社会实践
  'research',     // 学术科研
  'studentwork'   // 学生工作
];
