
/* =========================================================
   成长档案 v5 · form.js
   六大分类动态经历表单 + 照片和证书附件
   ========================================================= */

import {
  CATEGORIES,
  AWARD_GRADES,
  AWARD_LEVELS,
  RESEARCH_TYPES
} from '../../config.js';
import { esc } from '../../utils.js';

const FIELD_CONFIG = {
  organizer: {
    label: '组织单位',
    type: 'text',
    placeholder: '请输入组织或主办单位'
  },
  role: {
    label: '参与角色',
    type: 'text',
    placeholder: '例如：参与者、负责人'
  },
  grade: {
    label: '获奖等级',
    type: 'select',
    options: AWARD_GRADES
  },
  level: {
    label: '竞赛或项目级别',
    type: 'select',
    options: AWARD_LEVELS
  },
  certificate: {
    label: '证书说明',
    type: 'text',
    placeholder: '例如：优秀奖证书'
  },
  hours: {
    label: '志愿服务时长（小时）',
    type: 'number',
    placeholder: '请输入服务时长'
  },
  content: {
    label: '活动或服务内容',
    type: 'textarea',
    placeholder: '请描述主要活动内容'
  },
  location: {
    label: '活动地点',
    type: 'text',
    placeholder: '请输入活动地点'
  },
  researchType: {
    label: '科研类型',
    type: 'select',
    options: RESEARCH_TYPES
  },
  status: {
    label: '项目状态',
    type: 'text',
    placeholder: '例如：进行中、已结项'
  },
  link: {
    label: '项目链接',
    type: 'url',
    placeholder: 'https://'
  },
  organization: {
    label: '所属组织',
    type: 'text',
    placeholder: '例如：学生会、社团'
  },
  position: {
    label: '担任职位',
    type: 'text',
    placeholder: '请输入担任职位'
  },
  period: {
    label: '任职周期',
    type: 'text',
    placeholder: '例如：2025.09—2026.06'
  },
  duties: {
    label: '主要职责',
    type: 'textarea',
    placeholder: '请描述主要工作职责'
  }
};

function renderField(key) {
  const config = FIELD_CONFIG[key];
  if (!config) return '';

  let control = '';

  if (config.type === 'select') {
    control = `
      <select name="${key}">
        <option value="">请选择</option>
        ${config.options.map(option => `
          <option value="${esc(option)}">${esc(option)}</option>
        `).join('')}
      </select>
    `;
  } else if (config.type === 'textarea') {
    control = `
      <textarea name="${key}" rows="3"
        placeholder="${esc(config.placeholder)}"></textarea>
    `;
  } else {
    control = `
      <input name="${key}" type="${config.type}"
        ${config.type === 'number' ? 'min="0" step="0.5"' : ''}
        placeholder="${esc(config.placeholder)}">
    `;
  }

  return `
    <div class="field">
      <label>${esc(config.label)}</label>
      ${control}
    </div>
  `;
}

function renderAttachmentFields() {
  return `
    <div class="attachment-section">
      <div class="field">
        <label>活动照片</label>
        <input
          id="photo-input"
          type="file"
          accept="image/*"
          multiple
        >
        <div class="opt">最多选择 9 张图片，保存时自动压缩。</div>
        <div id="photo-preview" class="photo-preview-grid"></div>
      </div>

      <div class="field">
        <label>证书及其他材料</label>
        <input
          id="certificate-input"
          type="file"
          accept="image/*,application/pdf"
          multiple
        >
        <div class="opt">支持图片和 PDF，最多选择 5 个文件。</div>
        <div id="certificate-preview" class="photo-preview-grid"></div>
      </div>
    </div>
  `;
}

export function renderExperienceForm(category, years, selectedYear) {
  const currentCategory = CATEGORIES.some(c => c.key === category)
    ? category
    : CATEGORIES[0].key;

  const categoryOptions = CATEGORIES.map(c => `
    <option value="${c.key}"
      ${c.key === currentCategory ? 'selected' : ''}>
      ${esc(c.name)}
    </option>
  `).join('');

  const yearOptions = years.map(year => `
    <option value="${esc(year.id)}"
      ${year.id === selectedYear ? 'selected' : ''}>
      ${esc(year.name)}
    </option>
  `).join('');

  const categoryFields = getCategoryFields(currentCategory);

  return `
    <form id="experience-form">

      <div class="field">
        <label>经历分类 *</label>
        <select name="category" id="form-category" required>
          ${categoryOptions}
        </select>
      </div>

      <div class="field">
        <label>经历名称 *</label>
        <input name="title" type="text"
          placeholder="请输入经历名称" maxlength="100" required>
      </div>

      <div class="field">
        <label>所属学年 *</label>
        ${
          years.length
            ? `<select name="yearId" required>${yearOptions}</select>`
            : `
              <input name="newYearName" type="text"
                placeholder="例如：2025-2026学年" required>
              <div class="opt">当前还没有学年，保存时会自动创建这个学年。</div>
            `
        }
      </div>

      <div class="field">
        <label>开始日期 *</label>
        <input name="date" type="date" required
          value="${new Date().toLocaleDateString('en-CA')}">
      </div>

      <div class="field">
        <label>结束日期</label>
        <input name="endDate" type="date">
      </div>

      <div id="category-extra-fields">
        ${categoryFields}
      </div>

      <div class="field">
        <label>经历描述</label>
        <textarea name="summary" rows="4"
          placeholder="记录这段经历的收获、成果或感想"></textarea>
      </div>

      ${renderAttachmentFields()}

      <button class="btn btn-primary" type="submit" style="width:100%">
        保存经历
      </button>

    </form>
  `;
}

export function getCategoryFields(category) {
  const categoryConfig = {
    campus: ['organizer', 'role'],
    competition: ['grade', 'level', 'organizer', 'certificate'],
    volunteer: ['organizer', 'hours', 'content'],
    practice: ['organizer', 'role', 'location'],
    research: ['researchType', 'status', 'level', 'link'],
    studentwork: ['organization', 'position', 'period', 'duties']
  };

  return (categoryConfig[category] || [])
    .map(renderField)
    .join('');
}
