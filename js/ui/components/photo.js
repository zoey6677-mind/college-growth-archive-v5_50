
/* =========================================================
   成长档案 v5 · photo.js
   职责：照片 / 证书选择、压缩、预览和移除
   ========================================================= */

import { fileToCompressedDataURL } from '../../services/image.js';
import { esc } from '../../utils.js';

// DataURL 转 Blob
function dataURLToBlob(dataURL) {
  const parts = dataURL.split(',');
  const mime = parts[0].match(/:(.*?);/)[1];
  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}

// 图片压缩 Promise 封装
function compressImage(file) {
  return new Promise((resolve, reject) => {
    fileToCompressedDataURL(file, 1600, 0.82, (dataURL) => {
      if (!dataURL) {
        reject(new Error('图片压缩失败'));
        return;
      }

      try {
        resolve(dataURLToBlob(dataURL));
      } catch (e) {
        reject(e);
      }
    });
  });
}

// 渲染已选择的文件
function renderFiles(grid, arr) {
  const cards = arr.map((item, index) => {
    const preview = item.mimeType.startsWith('image/')
      ? `<img src="${item.previewUrl}" alt="${esc(item.name)}">`
      : `<a class="photo-file-link"
             href="${item.previewUrl}"
             target="_blank"
             rel="noopener">查看 PDF</a>`;

    return `
      <div class="photo-preview-item">
        ${preview}
        <div class="photo-preview-name">${esc(item.name)}</div>
        <button type="button"
                class="photo-remove-btn"
                data-remove-index="${index}">
          移除
        </button>
      </div>
    `;
  }).join('');

  grid.innerHTML = cards + (grid.dataset.message
    ? `<div class="photo-message">${esc(grid.dataset.message)}</div>`
    : '');
}

/**
 * 初始化附件选择组件
 *
 * @param {string} inputId 文件选择框 ID
 * @param {string} gridId 预览区域 ID
 * @param {Array} arr 暂存附件的数组
 * @param {number} max 最多允许选择的文件数量
 * @param {Object} options 配置：type、compress
 */
export function setupPhotoField(
  inputId,
  gridId,
  arr,
  max,
  options = {}
) {
  const input = document.getElementById(inputId);
  const grid = document.getElementById(gridId);

  if (!input || !grid || !Array.isArray(arr)) {
    throw new Error('[photo] 附件组件初始化失败');
  }

  const type = options.type || 'photo';
  const shouldCompress = options.compress === true;
  const maxCount = Number.isInteger(max) && max > 0 ? max : 9;

  input.multiple = true;

  input.accept = type === 'certificate'
    ? 'image/*,application/pdf'
    : 'image/*';

  // 文件选择
  input.addEventListener('change', async function () {
    const files = Array.from(input.files || []);
    grid.dataset.message = '';

    if (!files.length) return;

    input.disabled = true;

    try {
      for (const file of files) {
        if (arr.length >= maxCount) {
          grid.dataset.message = `最多只能选择 ${maxCount} 个文件`;
          break;
        }

        const isImage = file.type.startsWith('image/');
        const isPdf = file.type === 'application/pdf';

        if (type === 'certificate' ? (!isImage && !isPdf) : !isImage) {
          grid.dataset.message = `不支持的文件类型：${file.name}`;
          continue;
        }

        try {
          const blob = shouldCompress && isImage
            ? await compressImage(file)
            : file.slice(0, file.size, file.type);

          const mimeType = blob.type || file.type;
          const previewUrl = URL.createObjectURL(blob);

          arr.push({
            blob,
            name: file.name,
            mimeType,
            type,
            previewUrl
          });
        } catch (e) {
          grid.dataset.message = `${file.name} 处理失败`;
          console.error('[photo] 文件处理失败：', e);
        }
      }
    } finally {
      input.disabled = false;
      input.value = '';
      renderFiles(grid, arr);
    }
  });

  // 移除暂存文件
  grid.addEventListener('click', function (event) {
    const button = event.target.closest('[data-remove-index]');
    if (!button) return;

    const index = Number(button.dataset.removeIndex);

    if (!Number.isInteger(index) || index < 0 || index >= arr.length) {
      return;
    }

    URL.revokeObjectURL(arr[index].previewUrl);
    arr.splice(index, 1);

    grid.dataset.message = '';
    renderFiles(grid, arr);
  });

  renderFiles(grid, arr);

  return arr;
}
