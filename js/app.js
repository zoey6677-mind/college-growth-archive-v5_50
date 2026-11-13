
/* =========================================================
   成长档案 v5 · app.js
   应用入口：初始化数据库、绑定导航/学年切换、
   注册 Service Worker、保存经历及附件
   ========================================================= */

import { $, $$, esc } from './utils.js';
import { icon } from './icons.js';
import { showView } from './ui/router.js';
import { toast } from './ui/components/toast.js';
import { openSheet, closeSheet } from './ui/components/sheet.js';
import { store } from './services/store.js';
import { state } from './state.js';
import { renderExperienceForm, getCategoryFields } from './ui/components/form.js';
import { setupPhotoField } from './ui/components/photo.js';

// 视图渲染
import { render as renderOverview, setQuickAddHandler } from './ui/views/overview.js';
import { render as renderExperiences } from './ui/views/experiences.js';
import { render as renderStats } from './ui/views/stats.js';
import { render as renderTimeline } from './ui/views/timeline.js';
import { render as renderProfile } from './ui/views/profile.js';

const RENDERERS = {
  overview: renderOverview,
  experiences: renderExperiences,
  stats: renderStats,
  timeline: renderTimeline,
  profile: renderProfile
};

const NAV_ICON_MAP = {
  overview: 'overview',
  experiences: 'experiences',
  stats: 'stats',
  timeline: 'timeline',
  profile: 'profile'
};

let ready = false;
// 当前表单中的临时附件，用于统一释放预览资源
let activeAttachmentFiles = [];

function releaseAttachmentPreviews() {
  // activeAttachmentFiles 里保存的是「照片」「证书」两个分组数组，
  // 附件是用户选择时才 push 进去的，直接遍历拿到的是数组本身而不是附件对象，
  // previewUrl 永远读不到；释放前先拍平成扁平的文件数组。
  const files = [].concat(...activeAttachmentFiles);

  files.forEach(file => {
    if (file.previewUrl) {
      URL.revokeObjectURL(file.previewUrl);
      file.previewUrl = '';
    }
  });

  activeAttachmentFiles = [];
}

async function switchTo(name) {
  showView(name);
  const renderer = RENDERERS[name];

  if (renderer) {
    try {
      await renderer();
    } catch (e) {
      console.error('[成长档案 v5] 渲染视图 ' + name + ' 失败：', e);
      toast('页面加载失败：' + e.message);
    }
  }
}

function bindNav() {
  Object.keys(NAV_ICON_MAP).forEach(function (v) {
    const el = $('.nav-btn[data-view="' + v + '"] .nav-ico');
    if (el) el.innerHTML = icon(NAV_ICON_MAP[v]);
  });

  $$('.nav-btn').forEach(function (b) {
    b.onclick = function () {
      switchTo(b.dataset.view);
    };
  });
}

function bindSheet() {
  $('#sheetClose').onclick = function () {
    releaseAttachmentPreviews();
    closeSheet();
  };

  $('#sheet').addEventListener('click', function (e) {
    if (e.target === $('#sheet')) {
      releaseAttachmentPreviews();
      closeSheet();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      releaseAttachmentPreviews();
      closeSheet();
    }
  });
}
// 新增经历：初始化附件组件、保存经历和附件
// FAB 与概览「快速新增」共用同一套表单/附件/校验/保存逻辑，afterView 决定保存后停留在哪个视图
let openExperienceSheet = null;

async function bindFab() {
  openExperienceSheet = async function (afterView) {
    // 已有弹层打开时直接返回，避免重复初始化导致正在填写的表单被重置
    const sheet = $('#sheet');
    if (sheet && !sheet.classList.contains('hidden')) return;

    if (!ready) {
      toast('数据仍在加载，请稍候');
      return;
    }

    let years;

    try {
      years = await store.years.list();
    } catch (e) {
      toast('读取学年失败：' + e.message);
      return;
    }

    const selectedYear = years.some(y => y.id === state.currentYear)
      ? state.currentYear
      : (years[0] ? years[0].id : '');

    openSheet(
      '新增成长经历',
      renderExperienceForm('campus', years, selectedYear)
    );

    const form = $('#experience-form');
    const categorySelect = $('#form-category');
    const extraFields = $('#category-extra-fields');

    if (!form || !categorySelect || !extraFields) {
      toast('表单加载失败，请检查 form.js');
      return;
    }

    // 暂存用户选择的附件
    const photoFiles = [];
    const certificateFiles = [];

    // 注意：此处两个数组都还是空的，附件会在用户选择时被 push 进来，
    // 所以只能存两个分组数组的引用（活引用），不能在这里 concat 成一份（那样永远是空数组）。
    // 释放时由 releaseAttachmentPreviews() 拍平后逐个 revoke。
    activeAttachmentFiles = [photoFiles, certificateFiles];

    try {
      setupPhotoField(
        'photo-input',
        'photo-preview',
        photoFiles,
        9,
        {
          type: 'photo',
          compress: true
        }
      );

      setupPhotoField(
        'certificate-input',
        'certificate-preview',
        certificateFiles,
        5,
        {
          type: 'certificate',
          compress: false
        }
      );
    } catch (e) {
      console.error('[成长档案 v5] 附件组件初始化失败：', e);
      toast('附件组件初始化失败：' + e.message);
      return;
    }

    // 防止附件保存失败后再次创建重复经历
    let savedRecord = null;

    // 切换分类时动态更新专属字段
    categorySelect.addEventListener('change', function () {
      extraFields.innerHTML = getCategoryFields(categorySelect.value);
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();

      const submitButton = form.querySelector('button[type="submit"]');

      if (submitButton) submitButton.disabled = true;

      try {
        // 第一次提交时保存经历
        if (!savedRecord) {
          const formData = new FormData(form);
          const data = Object.fromEntries(formData.entries());

          // 如果尚无学年，则先创建学年
          if (!data.yearId) {
            const yearName = String(data.newYearName || '').trim();

            if (!yearName) {
              toast('请填写学年名称');
              return;
            }

            const newYear = await store.years.add({
              name: yearName
            });

            data.yearId = newYear.id;
          }

          delete data.newYearName;

          // 志愿服务时长转换为数字
          if (data.hours !== undefined && data.hours !== '') {
            data.hours = Number(data.hours);

            if (!Number.isFinite(data.hours) || data.hours < 0) {
              toast('志愿服务时长必须是有效的非负数字');
              return;
            }
          }

          // 日期范围检查
          if (data.endDate && data.endDate < data.date) {
            toast('结束日期不能早于开始日期');
            return;
          }

          savedRecord = await store.experiences.add(data);
        }

        // 保存照片和证书
        const allFiles = [...photoFiles, ...certificateFiles];
        let failedCount = 0;

        for (const file of allFiles) {
          // 已经成功保存的附件不重复写入
          if (file.saved) continue;

          try {
            await store.addAttachment({
              experienceId: savedRecord.id,
              type: file.type,
              name: file.name,
              mimeType: file.mimeType,
              blob: file.blob
            });

            file.saved = true;
          } catch (e) {
            failedCount++;
            console.error('[成长档案 v5] 附件保存失败：', file.name, e);
          }
        }

        if (failedCount > 0) {
          toast(
            '经历已保存，但有 ' + failedCount +
            ' 个附件保存失败，请再次点击保存重试'
          );
          return;
        }

        // 释放本地预览 URL
        allFiles.forEach(file => {
          if (file.previewUrl) {
            URL.revokeObjectURL(file.previewUrl);
          }
        });

        // 概览快速新增：新经历若不在「当前筛选学年」内，则同步筛选与顶栏标签，保证概览统计能看到该条
        // 注意：表单里新建的学年不在打开表单时读取的 years 数组中，需按 id 重新读取，避免名称回退成「全部学年」
        if (afterView === 'overview' && state.currentYear !== 'all' && savedRecord.yearId !== state.currentYear) {
          let target = years.find(function (y) { return y.id === savedRecord.yearId; });

          if (!target) {
            try {
              target = await store.years.get(savedRecord.yearId);
            } catch (e) {
              console.error('[成长档案 v5] 读取学年名称失败：', e);
            }
          }

          state.currentYear = savedRecord.yearId;
          state.currentYearName = (target && target.name) || '该学年';
          $('#yearSwitchLabel').textContent = state.currentYearName;
        }

        closeSheet();
        toast('经历和附件保存成功');

        await switchTo(afterView || 'experiences');

      } catch (e) {
        console.error('[成长档案 v5] 保存经历失败：', e);
        toast('保存失败：' + e.message);
      } finally {
        if (submitButton && submitButton.isConnected) {
          submitButton.disabled = false;
        }
      }
    });
  };

  $('#fab').onclick = function () {
    return openExperienceSheet('experiences');
  };
}

// 学年切换
async function openYearSwitch() {
  if (!ready) {
    toast('数据加载中，请稍候');
    return;
  }

  let years;

  try {
    years = await store.years.list();
  } catch (e) {
    toast('读取学年失败：' + e.message);
    return;
  }

  const rows = [];

  rows.push(
    '<div class="opt-row" data-year="all">' +
    '<div><div>全部学年</div><div class="sub">查看所有经历</div></div>' +
    (state.currentYear === 'all' ? '<span class="check">✓</span>' : '') +
    '</div>'
  );

  years.forEach(function (y) {
    rows.push(
      '<div class="opt-row" data-year="' + esc(y.id) + '">' +
      '<div><div>' + esc(y.name) + '</div><div class="sub">' +
      esc(y.label || '') + '</div></div>' +
      (state.currentYear === y.id ? '<span class="check">✓</span>' : '') +
      '</div>'
    );
  });

  if (!years.length) {
    rows.push(
      '<div class="opt-row"><div class="sub">' +
      '还没有学年，请到「我的」页添加</div></div>'
    );
  }

  openSheet('选择学年', rows.join(''));

  $('#sheetBody').querySelectorAll('.opt-row[data-year]').forEach(function (row) {
    row.onclick = function () {
      const yid = row.dataset.year;

      state.currentYear = yid;
      state.currentYearName = (yid === 'all')
        ? '全部学年'
        : ((years.find(y => y.id === yid) || {}).name || '全部学年');

      $('#yearSwitchLabel').textContent = state.currentYearName;

      closeSheet();
      switchTo(state.currentView);
    };
  });
}

function bindYearSwitch() {
  $('#yearSwitchBtn').onclick = openYearSwitch;
}

async function init() {
  bindNav();
  bindSheet();
  bindFab();
  bindYearSwitch();

  // 注入概览「快速新增」入口：复用同一套新增经历流程，保存后停留在概览并重渲染统计
  if (openExperienceSheet) {
    setQuickAddHandler(function () {
      return openExperienceSheet('overview');
    });
  }

  try {
    await store.init();
    ready = true;
  } catch (e) {
    console.error('[成长档案 v5] 数据库初始化失败：', e);
    toast('数据初始化失败：' + e.message);
  }

  await switchTo('overview');

  console.log('[成长档案 v5] 已启动，数据层已接入。');
}

// 注册 Service Worker
// 注意：init() 内部已有 await（打开数据库、渲染首屏），load 事件可能早已触发，
// 因此不能再监听 load，必须在模块层直接注册，否则会永久错过注册时机。
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[成长档案 v5] 当前环境不支持 Service Worker，离线能力不可用');
    return;
  }

  // 显式 scope：与 sw.js 所在目录保持一致，避免依赖默认推断
  navigator.serviceWorker.register('sw.js', { scope: './' }).then(function (reg) {
    console.log('[成长档案 v5] Service Worker 注册成功，scope =', reg.scope);
  }).catch(function (err) {
    // 不静默吞掉：失败必须留痕，否则离线失效将无从排查
    console.error('[成长档案 v5] Service Worker 注册失败：', err);
  });
}

init();
registerServiceWorker();
