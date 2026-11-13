/* =========================================================
   成长档案 v5 · timeline.js（视图层）
   成长时间轴：按年月分组倒序展示经历，点击复用经历详情
   - 只读数据，不写入 IndexedDB
   - 删除经历后通过详情回调刷新时间轴
   ========================================================= */
import { icon } from '../../icons.js';
import { esc } from '../../utils.js';
import { state } from '../../state.js';
import { CATEGORY_MAP } from '../../config.js';
import { toast } from '../components/toast.js';
import { timelineService } from '../../services/timeline.js';
import { showExperienceDetail } from './experiences.js';

// 单条经历卡片（复用经历页卡片样式，左侧色条取分类颜色）
function renderCard(item, yearMap) {
  const category = CATEGORY_MAP[item.category] || {
    name: '其他经历',
    color: '#94a3b8'
  };

  const yearName = yearMap[item.yearId] || '未关联学年';

  return `
    <article class="item exp-item"
             data-id="${esc(item.id)}"
             style="--exp-color:${esc(category.color)}">
      <div class="row1">
        <div style="min-width:0;flex:1">
          <div class="exp-card-top">
            <span class="chip">${esc(category.name)}</span>
            <span class="exp-year">${esc(yearName)}</span>
          </div>
          <div class="name">${esc(item.title)}</div>
        </div>
        <span class="date">${esc(item._day || '日期未知')}</span>
      </div>

      ${item.summary ? `
        <div class="note">${esc(item.summary)}</div>
      ` : ''}
    </article>
  `;
}

// 一个月份分组（月份标记点在轴线上，使用内联样式，不新增 CSS）
function renderMonthGroup(group, yearMap) {
  const isUnknown = group.key === 'unknown';
  const dotColor = isUnknown ? 'var(--text-faint)' : 'var(--primary)';
  const cards = group.items.map((item) => renderCard(item, yearMap)).join('');

  return `
    <div style="margin-bottom:18px">
      <div style="display:flex;align-items:center;gap:8px;margin:0 0 10px">
        <span style="width:10px;height:10px;border-radius:50%;flex:0 0 auto;
                     margin-left:-17px;background:${dotColor}"></span>
        <strong style="font-size:13px">${esc(group.label)}</strong>
        <span style="font-size:11.5px;color:var(--text-faint)">${group.count} 条</span>
      </div>
      ${cards}
    </div>
  `;
}

// 竖向轴线 + 全部分组
function renderTimeline(months, yearMap) {
  const groups = months.map((m) => renderMonthGroup(m, yearMap)).join('');

  return `
    <div style="position:relative;padding-left:18px">
      <div style="position:absolute;left:4px;top:8px;bottom:8px;width:2px;
                  background:var(--line);border-radius:2px"></div>
      ${groups}
    </div>
  `;
}

function renderEmpty() {
  return `
    <div class="empty">
      <div class="emoji">${icon('timeline')}</div>
      <p><b>还没有可以展示的经历</b><br>
      先去「经历」页记录第一条成长经历吧。</p>
    </div>
  `;
}

export async function render() {
  const el = document.querySelector('#view-timeline');
  if (!el) return;

  let data;

  try {
    data = await timelineService.build(state.currentYear);
  } catch (e) {
    console.error('[成长档案 v5] 时间轴加载失败：', e);
    el.innerHTML = '<div class="empty"><div class="emoji">' + icon('timeline') + '</div>'
      + '<p>时间轴加载失败<br><span style="font-size:12px">' + esc(e.message) + '</span></p></div>';
    return;
  }

  const yearMap = {};
  (data.years || []).forEach((y) => { yearMap[y.id] = y.name; });

  if (!data.total) {
    el.innerHTML = renderEmpty();
    return;
  }

  const monthCount = data.months.filter((m) => m.key !== 'unknown').length;
  const scopeLabel = state.currentYear === 'all' ? '全部学年' : (state.currentYearName || '全部学年');

  const invalidTip = data.invalidCount
    ? '<p class="muted" style="text-align:left;padding:0 0 14px">有 ' + data.invalidCount
      + ' 条经历的日期缺失或无效，已归入「日期未知」。</p>'
    : '';

  el.innerHTML = `
    <div class="exp-page">
      <div class="exp-heading">
        <div>
          <h2>成长时间轴</h2>
          <p>按时间回顾你的大学足迹</p>
        </div>
      </div>

      <div class="card">
        <div class="card-title">时间轴概览
          <span class="hint">${esc(scopeLabel)} · 共 ${data.total} 条 · ${monthCount} 个月</span>
        </div>
        ${invalidTip}
      </div>

      ${renderTimeline(data.months, yearMap)}
    </div>
  `;

  // 卡片点击：复用经历详情，删除成功后回调刷新时间轴本身
  const itemsById = {};
  data.months.forEach((m) => {
    m.items.forEach((item) => { itemsById[item.id] = item; });
  });

  el.querySelectorAll('.exp-item').forEach((card) => {
    card.addEventListener('click', () => {
      const item = itemsById[card.dataset.id];
      if (!item) return;

      showExperienceDetail(item, yearMap, render).catch((e) => {
        console.error('[成长档案 v5] 打开经历详情失败：', e);
        toast('打开详情失败：' + e.message);
      });
    });
  });
}
