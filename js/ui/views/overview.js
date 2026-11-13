/* =========================================================
   成长档案 v5 · overview.js
   概览视图：当前学年、经历总数、六分类数量、最近新增、各学年分布
   所有统计来自真实 IndexedDB 数据（statsService.overview）
   ========================================================= */
import { icon } from '../../icons.js';
import { esc } from '../../utils.js';
import { statsService } from '../../services/stats.js';
import { CATEGORIES } from '../../config.js';
import { state } from '../../state.js';
import { toast } from '../components/toast.js';

// 快速新增的处理函数由 app.js 注入（新增经历流程在 app.js，避免 overview ⇄ app 循环依赖）
let quickAddHandler = null;

export function setQuickAddHandler(fn) {
  quickAddHandler = typeof fn === 'function' ? fn : null;
}

// 六分类网格
function catGrid(byCategory) {
  const items = CATEGORIES.map((c) => {
    const n = byCategory[c.key] || 0;
    return '<div class="cat">'
      + '<span class="cat-ico" style="color:' + c.color + '">' + icon(c.icon) + '</span>'
      + '<span class="cat-name">' + esc(c.name) + '</span>'
      + '<span class="cat-num">' + n + '</span>'
      + '</div>';
  }).join('');
  return '<div class="cat-grid">' + items + '</div>';
}

// 各学年经历数量（横向条形，复用 charts.css 的 bar-row）
function yearBars(years, byYear) {
  if (!years.length) {
    return '<p class="muted">还没有学年，请到「我的」页添加。</p>';
  }
  const max = Math.max(1, ...years.map((y) => byYear[y.id] || 0));
  const rows = years.map((y) => {
    const n = byYear[y.id] || 0;
    const pct = Math.round((n / max) * 100);
    return '<div class="bar-row">'
      + '<span class="name">' + esc(y.name) + '</span>'
      + '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>'
      + '<span class="val">' + n + '</span>'
      + '</div>';
  }).join('');
  return rows;
}

// 最近新增列表
function recentList(recent) {
  if (!recent.length) {
    return '<p class="muted">暂无经历，点击右下角「＋」开始记录。</p>';
  }
  const rows = recent.map((e) => {
    const c = CATEGORIES.find((x) => x.key === e.category);
    const color = c ? c.color : 'var(--primary)';
    const icn = c ? c.icon : 'activity';
    return '<div class="mini-item">'
      + '<span class="mini-ico" style="color:' + color + '">' + icon(icn) + '</span>'
      + '<div class="mini-body">'
      + '<div class="mini-name">' + esc(e.title) + '</div>'
      + '<div class="mini-meta">' + esc(c ? c.name : '') + ' · ' + esc(e.date || '') + '</div>'
      + '</div>'
      + '</div>';
  }).join('');
  return '<div class="mini-list">' + rows + '</div>';
}

export async function render() {
  const el = document.querySelector('#view-overview');
  if (!el) return;

  let d;
  try {
    d = await statsService.overview(state.currentYear);
  } catch (e) {
    el.innerHTML = '<div class="empty"><div class="emoji">' + icon('overview') + '</div>'
      + '<p>统计数据加载失败<br><span style="font-size:12px">' + esc(e.message) + '</span></p></div>';
    return;
  }

  const yearName = state.currentYearName || '全部学年';

  const hero = '<div class="card hero">'
    + '<div class="hero-top">'
    + '<div class="hero-info">'
    + '<div class="hero-year">当前学年 · ' + esc(yearName) + '</div>'
    + '<div class="hero-total">经历总数 <b>' + d.total + '</b> 条</div>'
    + '</div>'
    + '<button id="ovAddBtn" class="btn-quick" type="button">＋ 快速新增</button>'
    + '</div>'
    + '</div>';

  const catCard = '<div class="card">'
    + '<div class="card-title">分类概览 <span class="hint">共 ' + d.total + ' 条</span></div>'
    + catGrid(d.byCategory)
    + '</div>';

  const yearCard = '<div class="card">'
    + '<div class="card-title">各学年经历</div>'
    + yearBars(d.years, d.byYear)
    + '</div>';

  const recentCard = '<div class="card">'
    + '<div class="card-title">最近新增</div>'
    + recentList(d.recent)
    + '</div>';

  // 空库友好提示：既无学年也无经历
  let emptyGuide = '';
  if (!d.years.length && d.total === 0) {
    emptyGuide = '<div class="empty-guide">'
      + '<div class="emoji">' + icon('overview') + '</div>'
      + '<p><b>这里还空空的</b>'
      + '还没有任何成长记录，点击「快速新增」记录你的第一段经历吧。</p>'
      + '</div>';
  }

  el.innerHTML = hero + (emptyGuide ? emptyGuide : (catCard + yearCard + recentCard));

  // 快速新增入口：调用 app.js 注入的新增经历流程（与右下角 FAB 同一套表单）
  const addBtn = el.querySelector('#ovAddBtn');
  if (addBtn) {
    addBtn.onclick = function () {
      if (quickAddHandler) {
        quickAddHandler();
        return;
      }
      toast('新增入口尚未就绪，请稍候重试');
    };
  }
}
