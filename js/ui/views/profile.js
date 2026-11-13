/* =========================================================
   成长档案 v5 · profile.js
   我的 / 设置视图
   学年管理：新增、重命名、删除（含经历迁移），全部沿用
   yearModel 现有 API 与删除保护规则，不直接操作 IndexedDB。
   数据备份：正式导出 / 合并导入 / 覆盖恢复，数据处理全部由
   backupService 完成，本文件只负责 UI 与确认流程。
   ========================================================= */
import { icon } from '../../icons.js';
import { store } from '../../services/store.js';
import { backupService } from '../../services/backup.js';
import { state } from '../../state.js';
import { esc } from '../../utils.js';
import { openSheet, closeSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';

// ---------- 内部工具 ----------

// 重命名按钮的行内样式（复用 .del-y 的布局方式，不新增 CSS 类）
const RENAME_BTN_STYLE = 'color:var(--primary);font-size:13px;background:none;border:none;cursor:pointer;padding:0;';

// 更新顶栏学年显示（当前筛选学年变化时调用）
function syncYearLabel() {
  const label = document.getElementById('yearSwitchLabel');
  if (label) label.textContent = state.currentYearName;
}

// 当前筛选学年重置为「全部学年」
function resetYearFilter() {
  state.currentYear = 'all';
  state.currentYearName = '全部学年';
  syncYearLabel();
}

// 学年表单（新增 / 重命名共用）
function yearFormHtml(name, label) {
  return `
    <form id="year-form">
      <div class="field">
        <label>学年名称 *</label>
        <input name="name" type="text" placeholder="例如：2025-2026学年"
               maxlength="30" required value="${esc(name || '')}">
      </div>
      <div class="field">
        <label>备注</label>
        <input name="label" type="text" placeholder="选填，例如：大三"
               maxlength="30" value="${esc(label || '')}">
      </div>
      <button class="btn btn-primary" type="submit">保存</button>
    </form>
  `;
}

function bindYearForm(onSubmit) {
  const form = document.getElementById('year-form');
  if (!form) return;

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    const data = Object.fromEntries(new FormData(form).entries());

    try {
      await onSubmit(String(data.name || '').trim(), String(data.label || '').trim());
      closeSheet();
      render();
    } catch (e) {
      // 保留弹层，方便用户修改后重试；错误来自 yearModel（空名 / 同名等）
      toast(e.message);
    }
  });
}

// ---------- 学年列表 ----------

function renderYearRows(years, countByYear) {
  if (!years.length) {
    return '<p class="muted">还没有学年，点击下方按钮添加第一个学年。</p>';
  }

  return years.map((y) => {
    const n = countByYear[y.id] || 0;
    const sub = [y.label, n + ' 条经历'].filter(Boolean).join(' · ');

    return `
      <div class="opt-row" data-id="${esc(y.id)}">
        <div style="min-width:0">
          <div>${esc(y.name)}</div>
          <div class="sub">${esc(sub)}</div>
        </div>
        <div style="display:flex;gap:14px;align-items:center;flex:0 0 auto">
          <button type="button" data-rename-id="${esc(y.id)}"
                  style="${RENAME_BTN_STYLE}">重命名</button>
          <button type="button" class="del-y" data-del-id="${esc(y.id)}">删除</button>
        </div>
      </div>
    `;
  }).join('');
}

// ---------- 新增学年 ----------

function openAddYearSheet() {
  openSheet('新增学年', yearFormHtml('', ''));

  bindYearForm(async function (name, label) {
    await store.years.add({ name, label });
    toast('学年「' + name + '」已添加');
  });
}

// ---------- 重命名学年 ----------

function openRenameSheet(year) {
  openSheet('重命名学年', yearFormHtml(year.name, year.label));

  bindYearForm(async function (name, label) {
    await store.years.rename(year.id, { name, label });

    // 重命名的是当前筛选学年时，同步顶栏显示（id 不变，经历关联不受影响）
    if (state.currentYear === year.id) {
      state.currentYearName = name;
      syncYearLabel();
    }

    toast('学年已重命名为「' + name + '」');
  });
}

// ---------- 删除学年（含经历迁移） ----------

// 安全刷新：渲染失败不产生未捕获的 Promise rejection
function renderSafely() {
  return Promise.resolve().then(function () { return render(); }).catch(function (e) {
    console.error('[成长档案 v5] 刷新「我的」页面失败：', e);
    toast('页面刷新失败：' + e.message);
  });
}

// 有经历时：先迁移到目标学年，迁移成功后才删除原学年
function openMigrateSheet(year, movedCount) {
  const others = [];
  // 目标学年列表在这里实时读取，避免使用过期数据
  return store.years.list().then(async function (years) {
    years.forEach(function (y) {
      if (y.id !== year.id) others.push(y);
    });

    const rows = others.map(function (y) {
      return `
        <div class="opt-row" data-year="${esc(y.id)}">
          <div><div>${esc(y.name)}</div>
          <div class="sub">将 ${movedCount} 条经历迁移到「${esc(y.name)}」</div></div>
        </div>
      `;
    }).join('');

    const noneTip = others.length
      ? ''
      : '<p class="muted">没有其他学年可作为迁移目标。<br>请先新增一个学年，或直接删除这些经历后再删除本学年。</p>';

    openSheet('迁移「' + year.name + '」的经历', rows + noneTip);

    // busy 标志：迁移/删除进行中禁止再次点击任何目标学年选项
    let busy = false;

    document.getElementById('sheetBody').querySelectorAll('.opt-row[data-year]').forEach(function (row) {
      row.onclick = async function () {
        if (busy) return;
        busy = true;

        try {
          const targetId = row.dataset.year;

          // 第 1 步：确认目标学年真实存在（防止弹层中的列表过期）
          let target = null;
          try {
            target = await store.years.get(targetId);
          } catch (e) {
            toast('读取目标学年失败：' + e.message);
            return;
          }
          if (!target) {
            toast('目标学年不存在，请重试');
            return;
          }

          // 第 2 步：迁移前二次确认（明确条数、原学年、目标学年）
          if (!confirm('即将把「' + year.name + '」下的 ' + movedCount + ' 条经历\n全部迁移到「' + target.name + '」。\n\n迁移完成后原学年将被删除，确定继续吗？')) {
            return;
          }

          // 第 3 步：迁移经历（yearModel 单事务保证一致性）
          let moved = 0;
          try {
            moved = await store.years.migrateExperiences(year.id, target.id);
          } catch (e) {
            // 迁移本身失败：原学年与经历都保持原状；恢复可操作状态，保留弹层
            toast('迁移失败：' + e.message);
            return;
          }

          // 到这里迁移已成功；无论删除成败，都刷新页面反映最新数据
          try {
            // 第 4 步：删除原学年（仍受 yearModel 删除保护约束）
            await store.years.remove(year.id);
          } catch (e) {
            if (state.currentYear === year.id) resetYearFilter();
            closeSheet();
            renderSafely();
            toast('经历已迁移，但原学年删除失败：' + e.message);
            return;
          }

          if (state.currentYear === year.id) resetYearFilter();

          toast('已迁移 ' + moved + ' 条经历到「' + target.name + '」，学年已删除');
          closeSheet();
          renderSafely();
        } finally {
          // 所有提前 return 的失败路径（读取失败 / 取消确认 / 迁移失败）
          // 都在此恢复可操作状态；成功路径弹层已关闭，重置无害
          busy = false;
        }
      };
    });
  }).catch(function (e) {
    // 读取学年列表失败：明确提示，不打开迁移弹层
    toast('读取学年列表失败：' + e.message);
  });
}

// ---------- 数据备份与恢复 ----------

// 备份弹层的 HTML（复用现有按钮/说明样式，不新增 CSS）
function backupSheetHtml() {
  return `
    <p class="muted">备份包含全部学年、经历和照片/证书附件，文件仅保存在本机，请勿上传到公开仓库。</p>
    <button id="bkExport" class="btn btn-primary" type="button">导出 JSON 备份</button>
    <p class="muted" style="margin-top:14px">合并导入：保留现有数据，同 id 记录跳过。<br>覆盖恢复：清空当前全部数据后写入备份，不可恢复。</p>
    <button id="bkMerge" class="btn btn-line" type="button" style="margin-top:8px">合并导入</button>
    <button id="bkReplace" class="btn btn-danger" type="button" style="margin-top:8px">覆盖恢复</button>
    <input id="bkFile" type="file" accept="application/json,.json" hidden>
  `;
}

// 禁用 / 恢复弹层内三个操作按钮（导入期间防重复提交）
function setBackupButtonsDisabled(disabled) {
  ['bkExport', 'bkMerge', 'bkReplace'].forEach(function (id) {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = disabled;
  });
}

// 导入成功的提示文案（数量全部来自 importJSON 真实返回值）
function importResultToast(result) {
  let msg = '导入完成：新增学年 ' + result.years
    + '、经历 ' + result.experiences
    + '、附件 ' + result.attachments;

  if (result.mode === 'merge') {
    msg += '（跳过学年 ' + result.skippedYears
      + '、经历 ' + result.skippedExperiences
      + '、附件 ' + result.skippedAttachments + '）';
  }
  if (result.invalidAttachments > 0) {
    msg += '；' + result.invalidAttachments + ' 个无效附件已跳过';
  }
  return msg;
}

// 合并导入成功后：当前筛选学年仍存在则保留，否则重置为「全部学年」
async function keepYearFilterIfValid() {
  if (state.currentYear === 'all') return;
  try {
    const y = await store.years.get(state.currentYear);
    if (!y) resetYearFilter();
  } catch (e) {
    resetYearFilter();
  }
}

// 统一的导入执行流程：文件选定后才禁用按钮，失败保留弹层
async function runImport(file, mode) {
  if (!file) return; // 用户取消文件选择：静默返回，不算错误

  setBackupButtonsDisabled(true);
  try {
    const result = await backupService.importJSON(file, mode);

    if (mode === 'replace') {
      // 覆盖恢复后原学年 id 必然失效，强制重置筛选
      resetYearFilter();
    } else {
      await keepYearFilterIfValid();
    }

    closeSheet();
    toast(importResultToast(result));
    renderSafely();
  } catch (e) {
    // 导入失败：保留弹层，显示具体原因，零写入由 backup.js 事务保证
    toast('导入失败：' + e.message);
  } finally {
    setBackupButtonsDisabled(false);
  }
}

// 触发文件选择（选择前清空 value，确保可重复选择同一文件）
function pickBackupFile(mode) {
  const input = document.getElementById('bkFile');
  if (!input) return;
  input.value = '';
  input.onchange = function () {
    const file = input.files && input.files[0];
    input.onchange = null;
    runImport(file, mode);
  };
  try {
    input.click();
  } catch (e) {
    // 打开文件选择器失败：清理 onchange，避免残留监听，并提示原因
    input.onchange = null;
    toast('无法打开文件选择器：' + e.message);
  }
}

function openBackupSheet() {
  openSheet('数据备份与恢复', backupSheetHtml());

  // 导出：直接调用 backupService.exportJSON()（内部完成文件生成与下载）
  document.getElementById('bkExport').onclick = async function () {
    setBackupButtonsDisabled(true);
    try {
      const result = await backupService.exportJSON();
      let msg = '导出完成：学年 ' + result.years
        + '、经历 ' + result.experiences
        + '、附件 ' + result.attachments
        + '（' + result.filename + '）';
      if (result.skippedAttachments > 0) {
        msg += '；' + result.skippedAttachments + ' 个损坏附件已跳过';
      }
      toast(msg);
    } catch (e) {
      toast('导出失败：' + e.message);
    } finally {
      setBackupButtonsDisabled(false);
    }
  };

  // 合并导入：直接进入文件选择（busy 在文件选定后才置位）
  document.getElementById('bkMerge').onclick = function () {
    pickBackupFile('merge');
  };

  // 覆盖恢复：先强警告确认，取消则不打开文件选择器
  document.getElementById('bkReplace').onclick = function () {
    if (!confirm('⚠️ 覆盖恢复将清空当前全部学年、经历和附件，\n并用备份文件替换，此操作不可恢复。\n\n建议先「导出 JSON 备份」留存。\n\n确定继续吗？')) {
      return;
    }
    pickBackupFile('replace');
  };
}

function confirmDeleteYear(year, expCount) {
  if (expCount > 0) {
    // 删除保护：学年下有经历时进入迁移流程（沿用 year.js 确认的规则）
    openMigrateSheet(year, expCount);
    return;
  }

  if (!confirm('确定删除学年「' + year.name + '」吗？\n该学年下没有经历，此操作不可恢复。')) {
    return;
  }

  store.years.remove(year.id).then(function () {
    if (state.currentYear === year.id) resetYearFilter();
    toast('学年「' + year.name + '」已删除');
    render();
  }).catch(function (e) {
    toast('删除失败：' + e.message);
  });
}

// ---------- 页面渲染 ----------

export async function render() {
  const el = document.querySelector('#view-profile');
  if (!el) return;

  let years = [];
  let exps = [];

  try {
    [years, exps] = await Promise.all([
      store.years.list(),
      store.experiences.list({})
    ]);
  } catch (e) {
    el.innerHTML = '<div class="empty"><div class="emoji">' + icon('profile') + '</div>'
      + '<p>数据加载失败<br><span style="font-size:12px">' + esc(e.message) + '</span></p></div>';
    return;
  }

  // 一次查询本地计数，避免逐学年 countByIndex
  const countByYear = {};
  exps.forEach(function (e) {
    if (e.yearId != null) countByYear[e.yearId] = (countByYear[e.yearId] || 0) + 1;
  });

  el.innerHTML = `
    <div class="card">
      <div class="card-title">学年管理 <span class="hint">共 ${years.length} 个学年</span></div>
      <div id="year-list">${renderYearRows(years, countByYear)}</div>
      <button id="pfAddYear" class="btn btn-primary" type="button" style="margin-top:12px">＋ 新增学年</button>
    </div>

    <div class="menu">
      <button type="button" class="menu-item" id="pfBackupEntry">
        <span class="mi-ico">${icon('disk')}</span>
        <span>数据备份与恢复
          <span class="mi-sub">导出 / 导入 JSON 备份</span>
        </span>
        <span class="mi-arrow">›</span>
      </button>
    </div>

    <div class="about">成长档案 v5 · 数据保存在本机浏览器 IndexedDB 中</div>
  `;

  // 新增学年
  document.getElementById('pfAddYear').onclick = openAddYearSheet;

  // 备份入口：打开正式备份弹层
  document.getElementById('pfBackupEntry').onclick = openBackupSheet;

  // 重命名 / 删除
  el.querySelectorAll('[data-rename-id]').forEach(function (btn) {
    btn.onclick = function () {
      const year = years.find(function (y) { return y.id === btn.dataset.renameId; });
      if (year) openRenameSheet(year);
    };
  });

  el.querySelectorAll('[data-del-id]').forEach(function (btn) {
    btn.onclick = function () {
      const year = years.find(function (y) { return y.id === btn.dataset.delId; });
      if (year) confirmDeleteYear(year, countByYear[year.id] || 0);
    };
  });
}
