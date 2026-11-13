/* =========================================================
   成长档案 v5 · icons.js
   内联 SVG 图标集（圆润线性风格，颜色跟随 currentColor）
   ========================================================= */

const ICONS = {
  // 底部导航
  overview: '<path d="M12 3.5l1.9 5.4 5.6 1.1-5.6 1.9L12 17.3l-1.9-5.4L4.5 10l5.6-1.1z"/>'
          + '<circle cx="18.6" cy="17.6" r="1.3" fill="currentColor" stroke="none"/>'
          + '<circle cx="5.4" cy="17.6" r="1.3" fill="currentColor" stroke="none"/>',
  experiences: '<rect x="4" y="4" width="7" height="7" rx="1.8"/>'
          + '<rect x="13" y="4" width="7" height="7" rx="1.8"/>'
          + '<rect x="4" y="13" width="7" height="7" rx="1.8"/>'
          + '<rect x="13" y="13" width="7" height="7" rx="1.8"/>',
  stats: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  timeline: '<circle cx="12" cy="12" r="8.5"/>'
          + '<path d="M12 7.5V12l3 2"/>',
  profile: '<circle cx="12" cy="8" r="3.6"/>'
         + '<path d="M5.5 20a6.5 6.5 0 0113 0"/>'
         + '<circle cx="17.8" cy="5.2" r="1.4" fill="currentColor" stroke="none"/>',

  // 六大分类
  activity: '<rect x="4" y="5.5" width="16" height="14.5" rx="3.2"/>'
          + '<path d="M4 9.5h16M8 3.5v4M16 3.5v4"/>'
          + '<path d="M12 16.8s-2.6-1.6-2.6-3.3c0-.9.7-1.6 1.5-1.6.5 0 .9.2 1.1.6.2-.4.6-.6 1.1-.6.8 0 1.5.7 1.5 1.6 0 1.7-2.6 3.3-2.6 3.3z" fill="currentColor" stroke="none"/>',
  award: '<path d="M8 4.5h8V8a4 4 0 01-8 0V4.5z"/>'
       + '<path d="M8 6.5H5a3 3 0 003.5 3M16 6.5h3a3 3 0 01-3.5 3"/>'
       + '<path d="M12 12v3.2M9.5 19.5h5M10.5 15.6h3v3.9h-3z"/>'
       + '<circle cx="12" cy="7" r="1.1" fill="currentColor" stroke="none"/>',
  volunteer: '<path d="M12 20s-6.5-3.8-6.5-8a3.6 3.6 0 016.5-2.2A3.6 3.6 0 0118.5 12c0 4.2-6.5 8-6.5 8z"/>',
  practice: '<rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/>'
          + '<path d="M9 7.5V6a2 2 0 012-2h2a2 2 0 012 2v1.5M3.5 13h17"/>',
  research: '<path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5z"/>'
          + '<path d="M4 5.5v15M9 7h7M9 10.5h5"/>',
  studentwork: '<circle cx="9" cy="8" r="3.2"/>'
          + '<path d="M3.5 19a5.5 5.5 0 0111 0M16 5.2a3.2 3.2 0 010 5.6M17.5 19a5.5 5.5 0 00-2.5-4.6"/>',

  // 通用
  camera: '<rect x="3" y="7" width="18" height="13" rx="3.2"/>'
        + '<path d="M8.5 7l1.4-2h4.2l1.4 2"/>'
        + '<circle cx="12" cy="13.5" r="3.6"/>'
        + '<circle cx="12" cy="13.5" r="1.3" fill="currentColor" stroke="none"/>'
        + '<circle cx="17" cy="10.2" r=".9" fill="currentColor" stroke="none"/>',
  folder: '<path d="M4 7.5a2 2 0 012-2h3l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2z"/>'
        + '<path d="M9.5 13.5h5"/>',
  doc: '<path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4"/><path d="M9.5 12.5h5M9.5 16h5"/>',
  disk: '<path d="M5 4.5h11l3 3v12a1 1 0 01-1 1H5a1 1 0 01-1-1v-15a1 1 0 011-1z"/>'
      + '<path d="M8 4.5v5h7v-5M8 14.5h8V19H8z"/>',
  import: '<path d="M12 4v10M8 11l4 3 4-3"/><path d="M5 19h14"/>',
  trash: '<path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13"/><path d="M10.5 11v5M13.5 11v5"/>'
};

// 生成 SVG 字符串
export function icon(name, cls) {
  return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none"'
    + ' stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'
    + ' aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
}

export default ICONS;
