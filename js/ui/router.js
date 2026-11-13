/* =========================================================
   成长档案 v5 · router.js
   轻量视图切换：控制 .view 显隐 + 顶栏标题（纯 UI，不涉及渲染内容）
   ========================================================= */
import { $, $$ } from '../utils.js';
import { VIEW_TITLES } from '../config.js';
import { state } from '../state.js';

export function showView(name) {
  state.currentView = name;

  $$('.nav-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.view === name); });
  $$('.view').forEach(function (v) { v.classList.remove('active'); });

  const v = $('#view-' + name);
  if (v) v.classList.add('active');

  const t = VIEW_TITLES[name] || VIEW_TITLES.overview;
  $('#pageTitle').textContent = t.title;
  $('#pageSub').textContent = t.sub;

  return name;
}

export function currentView() {
  return state.currentView;
}
