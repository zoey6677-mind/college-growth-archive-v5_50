/* =========================================================
   成长档案 v5 · utils.js
   通用工具函数（无副作用，无业务依赖）
   ========================================================= */

// DOM 快捷查询
export function $(s, r) { return (r || document).querySelector(s); }
export function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

// 生成唯一 id（时间戳 + 随机后缀）
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// HTML 转义，防止 XSS
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 格式化日期（YYYY/MM/DD）
export function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }); }
  catch (e) { return String(d); }
}

/**
 * 严格校验 YYYY-MM-DD，且必须是真实存在的日历日期。
 * 拒绝 2025-02-30、2025-04-31、2025-02-29（非闰年）等被 Date 自动归一的日期。
 * 说明：用 setFullYear 设置完整年份，避免 new Date(y, ...) 把 0–99 当作 1900–1999；
 * 全程本地时间构造，不受 UTC 偏移影响。
 */
export function isValidISODate(s) {
  if (typeof s !== 'string') return false;

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);

  if (mo < 1 || mo > 12 || d < 1) return false;

  const dt = new Date(2000, 0, 1);
  dt.setFullYear(y, mo - 1, d);

  // 回读比较：Date 会把 2025-02-30 归一成 2025-03-02，此时年月日对不上即判无效
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

// 触发浏览器下载
export function download(filename, text, mime) {
  const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

// 深拷贝（用于表单编辑时的快照）
export function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
