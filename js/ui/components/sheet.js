/* =========================================================
   成长档案 v5 · sheet.js
   底部弹层（纯 UI 开合）
   ========================================================= */
import { $ } from '../../utils.js';

// 关闭清理钩子：任何关闭入口（✕ / 遮罩 / Esc / 业务代码）最终都会经过 closeSheet
// 只在需要释放资源（如详情页的附件预览 Blob URL）时才注册，执行一次后自动清除
let closeHandler = null;

/**
 * 注册「本次弹层关闭时」的一次性清理回调（传非函数可取消）
 * @param {Function|null} fn
 */
export function onSheetClose(fn) {
  closeHandler = typeof fn === 'function' ? fn : null;
}

export function openSheet(title, bodyHtml) {
  // 新弹层打开时丢弃上一个弹层遗留的回调，避免旧回调作用到新弹层
  closeHandler = null;

  $('#sheetTitle').textContent = title;
  $('#sheetBody').innerHTML = bodyHtml;
  $('#sheet').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

export function closeSheet() {
  $('#sheet').classList.add('hidden');
  document.body.style.overflow = '';

  // 先隐藏再清理：避免预览图在弹层可见时先变成裂图
  const handler = closeHandler;
  closeHandler = null; // 先摘掉再执行，防止回调内部再次 closeSheet 造成递归

  if (handler) {
    try {
      handler();
    } catch (e) {
      // 清理失败不能阻止弹层关闭，也不能把异常抛给调用方
      console.error('[成长档案 v5] 弹层关闭清理失败：', e);
    }
  }
}
