/* =========================================================
   成长档案 v5 · image.js
   相册图片读取 + canvas 压缩（纯工具，无 IndexedDB 依赖）
   ========================================================= */

// 读取图片文件并压缩（最长边 maxDim，JPEG quality），回调返回 dataURL
export function fileToCompressedDataURL(file, maxDim, quality, cb) {
  if (!file || !/^image\//.test(file.type)) { cb(null); return; }
  const reader = new FileReader();
  reader.onload = function () {
    const img = new Image();
    img.onload = function () {
      try {
        const w = img.width, h = img.height;
        const scale = Math.min(1, maxDim / Math.max(w, h));
        const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = cw; canvas.height = ch;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        cb(canvas.toDataURL('image/jpeg', quality));
      } catch (e) { cb(null); }
    };
    img.onerror = function () { cb(null); };
    img.src = reader.result;
  };
  reader.onerror = function () { cb(null); };
  reader.readAsDataURL(file);
}
