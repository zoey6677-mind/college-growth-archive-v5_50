
/* =========================================================
   成长档案 v5 · experiences.js
   六大分类经历列表、筛选、搜索及附件详情展示
   ========================================================= */

import { store } from '../../services/store.js';
import { state } from '../../state.js';
import { CATEGORIES, CATEGORY_MAP } from '../../config.js';
import { icon } from '../../icons.js';
import { $, esc, fmtDate } from '../../utils.js';
import { openSheet, closeSheet, onSheetClose } from '../components/sheet.js';
import { toast } from '../components/toast.js';

let activeCategory = 'all';
let searchKeyword = '';

// 详情页附件预览地址（Blob URL），统一登记便于释放，避免内存累积
let activeAttachmentUrls = [];

function releaseAttachmentUrls() {
  activeAttachmentUrls.forEach(function (url) {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {
      // 释放失败不影响功能
    }
  });
  activeAttachmentUrls = [];
}

function getCategoryName(key) {
  return CATEGORY_MAP[key] ? CATEGORY_MAP[key].name : '其他经历';
}

function matchesKeyword(item, keyword) {
  if (!keyword) return true;

  const text = [
    item.title,
    item.summary,
    item.organizer,
    item.role,
    item.grade,
    item.level,
    item.content,
    item.location,
    item.researchType,
    item.status,
    item.organization,
    item.position,
    item.duties
  ].join(' ').toLowerCase();

  return text.includes(keyword.toLowerCase());
}

function renderCategoryButtons(items) {
  const counts = {};

  CATEGORIES.forEach((c) => {
    counts[c.key] = items.filter(
      (item) => item.category === c.key
    ).length;
  });

  const total = items.length;

  return `
    <div class="exp-category-grid">
      <button class="exp-category ${activeCategory === 'all' ? 'active' : ''}"
              data-category="all">
        <span class="exp-category-name">全部经历</span>
        <span class="exp-category-count">${total}</span>
      </button>

      ${CATEGORIES.map((c) => `
        <button class="exp-category ${activeCategory === c.key ? 'active' : ''}"
                data-category="${esc(c.key)}"
                style="--category-color:${c.color}">
          <span class="exp-category-icon">${icon(c.icon)}</span>
          <span class="exp-category-name">${esc(c.name)}</span>
          <span class="exp-category-count">${counts[c.key]}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function renderExperienceCard(item, yearMap) {
  const category = CATEGORY_MAP[item.category] || {
    name: '其他经历',
    color: '#94a3b8'
  };

  const yearName = yearMap[item.yearId] || '未关联学年';

  return `
    <article class="item exp-item"
             data-id="${esc(item.id)}"
             style="--exp-color:${category.color}">
      <div class="row1">
        <div style="min-width:0;flex:1">
          <div class="exp-card-top">
            <span class="chip">${esc(category.name)}</span>
            <span class="exp-year">${esc(yearName)}</span>
          </div>
          <div class="name">${esc(item.title)}</div>
        </div>
        <span class="date">${esc(fmtDate(item.date))}</span>
      </div>

      ${item.summary ? `
        <div class="note">${esc(item.summary)}</div>
      ` : ''}

      ${item.endDate ? `
        <div class="meta">结束日期：${esc(fmtDate(item.endDate))}</div>
      ` : ''}

      <div class="exp-card-footer">
        <span>查看详情</span>
        <span class="exp-arrow">›</span>
      </div>
    </article>
  `;
}

function renderEmpty() {
  return `
    <div class="empty">
      <div class="emoji">${icon('experiences')}</div>
      <p><b>还没有找到相关经历</b><br>
      可以尝试切换分类、学年或修改搜索关键词。</p>
    </div>
  `;
}

// 渲染附件区域
function renderAttachments(attachments) {
  if (!attachments.length) {
    return `
      <div class="exp-attachments-empty">暂无附件</div>
    `;
  }

  const images = attachments.filter(
    (item) => item.mimeType && item.mimeType.startsWith('image/')
  );

  const files = attachments.filter(
    (item) => !item.mimeType || !item.mimeType.startsWith('image/')
  );

  const imageHtml = images.map((item) => {
    const url = URL.createObjectURL(item.blob);
    activeAttachmentUrls.push(url);

    return `
      <a class="exp-attachment-image"
         href="${url}"
         target="_blank"
         rel="noopener"
         title="${esc(item.name)}">
        <img src="${url}" alt="${esc(item.name)}">
        <span>${esc(item.name)}</span>
      </a>
    `;
  }).join('');

  const fileHtml = files.map((item) => {
    const url = URL.createObjectURL(item.blob);
    activeAttachmentUrls.push(url);

    return `
      <a class="exp-attachment-file"
         href="${url}"
         target="_blank"
         rel="noopener">
        <span class="exp-attachment-file-icon">PDF</span>
        <span>${esc(item.name)}</span>
        <span>打开</span>
      </a>
    `;
  }).join('');

  return `
    ${imageHtml ? `
      <div class="exp-attachment-grid">
        ${imageHtml}
      </div>
    ` : ''}

    ${fileHtml ? `
      <div class="exp-attachment-files">
        ${fileHtml}
      </div>
    ` : ''}
  `;
}

// 显示经历详情
// onDeleted 可选：删除成功后的刷新回调（默认刷新经历列表；时间轴传入自身 render）
export async function showExperienceDetail(item, yearMap, onDeleted) {
  // 释放上一次详情残留的预览地址（此时上一次弹层已关闭）
  releaseAttachmentUrls();

  const category = CATEGORY_MAP[item.category] || {
    name: '其他经历'
  };

  const fields = [
    ['所属分类', category.name],
    ['所属学年', yearMap[item.yearId] || '未关联学年'],
    ['开始日期', item.date ? fmtDate(item.date) : '未填写'],
    ['结束日期', item.endDate ? fmtDate(item.endDate) : '未填写'],
    ['组织单位', item.organizer],
    ['参与角色', item.role],
    ['获奖等级', item.grade],
    ['竞赛级别', item.level],
    ['证书说明', item.certificate],
    ['志愿时长', item.hours != null ? item.hours + ' 小时' : ''],
    ['活动内容', item.content],
    ['活动地点', item.location],
    ['科研类型', item.researchType],
    ['项目状态', item.status],
    ['项目链接', item.link],
    ['所属组织', item.organization],
    ['担任职位', item.position],
    ['任职周期', item.period],
    ['主要职责', item.duties]
  ];

  const fieldHtml = fields
    .filter((field) => field[1])
    .map((field) => `
      <div class="exp-detail-row">
        <span>${esc(field[0])}</span>
        <strong>${esc(field[1])}</strong>
      </div>
    `).join('');

  let attachments = [];

  try {
    attachments = await store.getAttachments(item.id);
  } catch (e) {
    console.error('[成长档案 v5] 读取附件失败：', e);
    toast('附件读取失败：' + e.message);
  }

  openSheet('经历详情', `
    <div class="exp-detail">
      <h2>${esc(item.title)}</h2>

      <div class="exp-detail-summary">
        ${esc(item.summary || '暂无经历描述')}
      </div>

      <div class="exp-detail-fields">
        ${fieldHtml}
      </div>

      <div class="exp-detail-attachments">
        <h3>照片与证书</h3>
        ${renderAttachments(attachments)}
      </div>

      <button id="expDeleteBtn" class="btn btn-danger" type="button"
              style="margin-top:20px">删除经历</button>
    </div>
  `);

  // 关闭弹层（✕ / 遮罩 / Esc）时统一释放附件预览地址
  // 删除成功路径已自行释放一次，这里再次调用时数组为空，属于 no-op
  onSheetClose(releaseAttachmentUrls);

  bindDeleteAction(item, onDeleted);
}

// 详情页删除经历：数据库删除与列表刷新分开处理，避免误报
// onDeleted 未传时回退为刷新经历列表（保持原有行为）
function bindDeleteAction(item, onDeleted) {
  const btn = document.getElementById('expDeleteBtn');
  if (!btn) return;

  let busy = false;

  btn.onclick = async function () {
    if (busy) return;

    if (!confirm('确定删除经历「' + item.title + '」吗？\n关联的照片和证书附件将一并删除，此操作不可恢复。')) {
      return;
    }

    busy = true;
    btn.disabled = true;

    // 第 1 步：删除经历（级联删除关联附件，由 experienceModel 单事务保证）
    try {
      await store.experiences.remove(item.id);
    } catch (e) {
      // 数据库删除失败：弹层保留，恢复按钮，明确提示原因
      console.error('[成长档案 v5] 删除经历失败：', e);
      toast('删除失败：' + e.message);
      busy = false;
      btn.disabled = false;
      return;
    }

    // 到此数据库已删除成功，后续任何异常都不能提示「删除失败」
    releaseAttachmentUrls();
    closeSheet();

    // 第 2 步：刷新来源视图（失败时单独提示，不影响删除结果）
    // 未传回调时默认刷新经历列表，保证经历页行为不变
    const refresh = typeof onDeleted === 'function' ? onDeleted : render;

    try {
      await refresh();
      toast('经历「' + item.title + '」已删除');
    } catch (e) {
      console.error('[成长档案 v5] 删除成功但列表刷新失败：', e);
      toast('删除成功，但列表刷新失败，请刷新页面');
    }
  };
}

export async function render() {
  const el = $('#view-experiences');
  if (!el) return;

  el.innerHTML = `
    <div class="exp-page">
      <div class="exp-heading">
        <div>
          <h2>我的成长经历</h2>
          <p>记录大学期间的每一份收获</p>
        </div>
      </div>

      <div id="exp-category-area"></div>

      <div class="exp-search-wrap">
        <input id="exp-search"
               class="exp-search"
               type="search"
               placeholder="搜索经历名称、描述或单位..."
               value="${esc(searchKeyword)}">
      </div>

      <div class="exp-result-heading">
        <strong id="exp-result-title">全部经历</strong>
        <span id="exp-result-count"></span>
      </div>

      <div id="exp-list"></div>
    </div>
  `;

  const [allItems, years] = await Promise.all([
    store.experiences.list(),
    store.years.list()
  ]);

  const yearMap = {};

  years.forEach((year) => {
    yearMap[year.id] = year.name;
  });

  // 分类计数与列表使用同一批数据：按当前学年收敛
  const scopeItems = (state.currentYear && state.currentYear !== 'all')
    ? allItems.filter((item) => item.yearId === state.currentYear)
    : allItems;

  const categoryArea = $('#exp-category-area', el);
  const listArea = $('#exp-list', el);
  const resultTitle = $('#exp-result-title', el);
  const resultCount = $('#exp-result-count', el);
  const searchInput = $('#exp-search', el);

  categoryArea.innerHTML = renderCategoryButtons(scopeItems);

  function updateList() {
    let filtered = allItems.slice();

    if (activeCategory !== 'all') {
      filtered = filtered.filter(
        (item) => item.category === activeCategory
      );
    }

    if (state.currentYear && state.currentYear !== 'all') {
      filtered = filtered.filter(
        (item) => item.yearId === state.currentYear
      );
    }

    filtered = filtered.filter((item) =>
      matchesKeyword(item, searchKeyword)
    );

    filtered.sort((a, b) => {
      return String(b.date || '').localeCompare(
        String(a.date || '')
      );
    });

    const categoryName = activeCategory === 'all'
      ? '全部经历'
      : getCategoryName(activeCategory);

    resultTitle.textContent = categoryName;
    resultCount.textContent = `共 ${filtered.length} 条`;

    listArea.innerHTML = filtered.length
      ? filtered.map((item) => renderExperienceCard(item, yearMap)).join('')
      : renderEmpty();

    listArea.querySelectorAll('.exp-item').forEach((card) => {
      card.addEventListener('click', () => {
        const item = filtered.find(
          (entry) => entry.id === card.dataset.id
        );

        if (item) {
          showExperienceDetail(item, yearMap).catch((e) => {
            console.error('[成长档案 v5] 打开经历详情失败：', e);
            toast('打开详情失败：' + e.message);
          });
        }
      });
    });
  }

  function bindCategoryButtons() {
    categoryArea.querySelectorAll('[data-category]').forEach((button) => {
      button.addEventListener('click', () => {
        activeCategory = button.dataset.category;
        categoryArea.innerHTML = renderCategoryButtons(scopeItems);
        bindCategoryButtons();
        updateList();
      });
    });
  }

  bindCategoryButtons();

  searchInput.addEventListener('input', () => {
    searchKeyword = searchInput.value.trim();
    updateList();
  });

  updateList();
}
