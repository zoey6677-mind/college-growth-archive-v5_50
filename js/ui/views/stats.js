/* =========================================================
   成长档案 v5 · stats.js（视图层）
   数据统计：四个 KPI、六大分类占比、各学年分布
   - 数据全部来自 statsService.overview(state.currentYear)（真实 IndexedDB，不写死数字）
   - 统计口径统一按「当前学年筛选范围」：分类与学年分布均由当前范围的 exps 计算
   - 复用 .exp-page / .stat-grid / .card / .bar-row 等已有样式，不新增 CSS
   ========================================================= */
import { icon } from '../../icons.js';
import { esc } from '../../utils.js';
import { CATEGORIES, CATEGORY_MAP } from '../../config.js';
import { state } from '../../state.js';
import { statsService } from '../../services/stats.js';

/**
 * 单个条形行。
 * @param {string} name   左侧名称
 * @param {number} count  右侧数量
 * @param {number} width  进度条宽度百分比 0-100
 * @param {string} color  进度条颜色
 * @param {number} nameWidth 名称列宽度（px）
 * @param {number|null} pct   可选的百分比文案（null 表示不显示）
 */
function barRow(name, count, width, color, nameWidth, pct) {
  const pctHtml = (pct == null)
    ? ''
    : '<span style="width:40px;flex:0 0 auto;text-align:right;font-size:12px;'
      + 'color:var(--text-faint)">' + pct + '%</span>';

  return '<div class="bar-row">'
    + '<span class="name" style="width:' + nameWidth + 'px">' + esc(name) + '</span>'
    + '<div class="bar-track"><div class="bar-fill" style="width:' + width
    + '%;background:' + esc(color) + '"></div></div>'
    + '<span class="val">' + count + '</span>'
    + pctHtml
    + '</div>';
}

// 是否为 config 中真实定义的分类（用 hasOwnProperty，避免 'constructor'/'toString' 等原型键误判）
function isKnownCategory(key) {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(CATEGORY_MAP, key);
}

// 按当前范围的经历统计分类数量（不依赖 overview().byCategory 的范围语义）
// 计数容器用 Object.create(null)：避免构造器/原型键（constructor、toString、__proto__）干扰计数
function categoryStats(exps) {
  const counts = Object.create(null);
  CATEGORIES.forEach((c) => { counts[c.key] = 0; });

  const unknown = Object.create(null);

  exps.forEach((e) => {
    const key = e.category;
    if (isKnownCategory(key)) {
      counts[key]++;
    } else {
      const label = (key == null || key === '') ? '（未填写）' : String(key);
      unknown[label] = (unknown[label] || 0) + 1;
    }
  });

  const unknownKeys = Object.keys(unknown);
  const unknownTotal = unknownKeys.reduce((s, k) => s + unknown[k], 0);

  return { counts, unknownKeys, unknownTotal };
}

// 四个 KPI 卡片
function kpiGrid(total, competitionCount, yearCount, avg) {
  return '<div class="stat-grid">'
    + '<div class="stat"><div class="num">' + total + '</div>'
    + '<div class="lbl">经历总数</div></div>'
    + '<div class="stat"><div class="num gold">' + competitionCount + '</div>'
    + '<div class="lbl">竞赛获奖</div></div>'
    + '<div class="stat"><div class="num">' + yearCount + '</div>'
    + '<div class="lbl">有记录学年数</div></div>'
    + '<div class="stat"><div class="num">' + avg + '</div>'
    + '<div class="lbl">平均每学年</div></div>'
    + '</div>';
}

// 六大分类占比卡（未知分类聚合成一行兜底，不丢弃任何记录）
function categoryCard(exps, total) {
  const { counts, unknownKeys, unknownTotal } = categoryStats(exps);

  let rows = CATEGORIES.map((c) => {
    const n = counts[c.key] || 0;
    const pct = total ? Math.round((n / total) * 100) : 0;
    return barRow(c.name, n, pct, c.color, 74, pct);
  }).join('');

  if (unknownTotal > 0) {
    const pct = total ? Math.round((unknownTotal / total) * 100) : 0;
    rows += barRow('其他／未知分类', unknownTotal, pct, '#94a3b8', 96, pct);
  }

  const unknownNote = (unknownTotal > 0)
    ? '<p class="muted" style="text-align:left;margin:6px 0 0;font-size:12px">'
      + '未识别的分类值：' + esc(unknownKeys.join('、'))
      + '（共 ' + unknownTotal + ' 条，已计入上方「其他／未知分类」）</p>'
    : '';

  return '<div class="card">'
    + '<div class="card-title">六大分类占比'
    + '<span class="hint">共 ' + total + ' 条</span></div>'
    + rows
    + unknownNote
    + '</div>';
}

// 各学年分布卡（按当前范围统计；切到单学年时其余学年为 0）
function yearCard(years, exps) {
  if (!years.length && !exps.length) {
    return '<div class="card">'
      + '<div class="card-title">各学年分布</div>'
      + '<p class="muted">还没有学年，请到「我的」页添加。</p>'
      + '</div>';
  }

  // 当前范围内的学年计数（含已删除学年与未关联学年的兜底）
  // 用 Object.create(null)：特殊字符串 yearId 不会与原型属性冲突
  const byYear = Object.create(null);
  let noYear = 0;

  exps.forEach((e) => {
    if (e.yearId == null || e.yearId === '') {
      noYear++;
    } else {
      byYear[e.yearId] = (byYear[e.yearId] || 0) + 1;
    }
  });

  const knownIds = Object.create(null);
  const rowsData = years.map((y) => {
    knownIds[y.id] = true;
    return { name: y.name, count: byYear[y.id] || 0 };
  });

  // 经历里出现但 years 中已不存在（如导入残留、学年被删）
  Object.keys(byYear).forEach((id) => {
    if (!knownIds[id]) rowsData.push({ name: '未知学年（已删除）', count: byYear[id] });
  });

  if (noYear > 0) rowsData.push({ name: '未关联学年', count: noYear });

  const max = Math.max(1, ...rowsData.map((r) => r.count));

  const rows = rowsData.map((r) => {
    const width = Math.round((r.count / max) * 100);
    return barRow(r.name, r.count, width, '#c084fc', 96, null);
  }).join('');

  return '<div class="card">'
    + '<div class="card-title">各学年分布'
    + '<span class="hint">按当前范围统计</span></div>'
    + rows
    + '</div>';
}

// 空数据提示（KPI 仍照常显示，不隐藏整页）
function emptyGuide(hasYears, scopeLabel) {
  const title = hasYears ? '当前范围内还没有经历' : '还没有任何数据';
  const desc = hasYears
    ? '「' + scopeLabel + '」下还没有成长记录，点右下角「＋」或到「经历」页新增第一条吧。'
    : '先去「经历」页记录第一条成长经历，统计会自动生成。';

  return '<div class="empty-guide">'
    + '<div class="emoji">' + icon('stats') + '</div>'
    + '<p><b>' + esc(title) + '</b>' + esc(desc) + '</p>'
    + '</div>';
}

export async function render() {
  const el = document.querySelector('#view-stats');
  if (!el) return;

  let d;

  try {
    d = await statsService.overview(state.currentYear);
  } catch (e) {
    el.innerHTML = '<div class="empty"><div class="emoji">' + icon('stats') + '</div>'
      + '<p>统计数据加载失败<br><span style="font-size:12px">' + esc(e.message) + '</span></p></div>';
    return;
  }

  const exps = d.exps || [];
  const total = exps.length;
  const scopeLabel = state.currentYear === 'all'
    ? '全部学年'
    : (state.currentYearName || '全部学年');

  const { counts } = categoryStats(exps);
  const competitionCount = counts.competition || 0;

  // 有记录学年数：当前范围内出现过的不同 yearId（排除空值）
  // 用 Set 去重：'__proto__'、'constructor' 等字符串 yearId 也能正确计数
  const yearIds = new Set();
  exps.forEach((e) => {
    if (e.yearId != null && e.yearId !== '') yearIds.add(e.yearId);
  });
  const yearCount = yearIds.size;

  // 平均每学年：分母为 0 时显示 0
  const avg = yearCount ? (total / yearCount).toFixed(1) : '0';

  const head = '<div class="exp-heading">'
    + '<div><h2>数据统计</h2>'
    + '<p>当前范围：' + esc(scopeLabel) + ' · 共 ' + total + ' 条经历</p></div>'
    + '</div>';

  const tip = '<p class="muted" style="text-align:left;margin:-6px 0 14px;font-size:12px">'
    + '可在顶栏切换学年，查看单个学年的统计。</p>';

  const body = (total === 0)
    ? emptyGuide((d.years || []).length > 0, scopeLabel)
    : categoryCard(exps, total) + yearCard(d.years || [], exps);

  el.innerHTML = '<div class="exp-page">'
    + head
    + kpiGrid(total, competitionCount, yearCount, avg)
    + tip
    + body
    + '</div>';
}
