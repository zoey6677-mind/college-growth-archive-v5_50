/* =========================================================
   成长档案 v5 · toast.js
   轻提示（纯 UI）
   ========================================================= */

let timer = null;

export function toast(msg) {
  const t = document.querySelector('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(timer);
  timer = setTimeout(function () { t.classList.add('hidden'); }, 1800);
}
