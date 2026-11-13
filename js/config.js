/* =========================================================
   成长档案 v5 · config.js
   六大分类定义、枚举、颜色映射等业务常量（纯配置，无副作用）
   ========================================================= */

// 六大经历分类
export const CATEGORIES = [
  { key: 'campus',       name: '校园活动', icon: 'activity',    color: '#f472b6' },
  { key: 'competition',  name: '竞赛获奖', icon: 'award',       color: '#f59e0b' },
  { key: 'volunteer',    name: '志愿服务', icon: 'volunteer',   color: '#10b981' },
  { key: 'practice',     name: '社会实践', icon: 'practice',    color: '#0ea5e9' },
  { key: 'research',     name: '学术科研', icon: 'research',    color: '#7c3aed' },
  { key: 'studentwork',  name: '学生工作', icon: 'studentwork', color: '#f97316' }
];

// 按 key 快速取分类
export const CATEGORY_MAP = CATEGORIES.reduce((m, c) => { m[c.key] = c; return m; }, {});

// 各分类的专属字段（用于后续表单与数据校验，本次仅作为配置保留）
export const CATEGORY_FIELDS = {
  campus:      ['organizer', 'role'],
  competition: ['grade', 'level', 'organizer', 'certificate'],
  volunteer:   ['organizer', 'hours', 'content'],
  practice:    ['organizer', 'role', 'location'],
  research:    ['researchType', 'status', 'level', 'link'],
  studentwork: ['organization', 'position', 'period', 'duties']
};

// 获奖等级 / 竞赛级别（保留自 v4）
export const AWARD_GRADES = ['特等奖', '一等奖', '二等奖', '三等奖', '优秀奖', '参与奖'];
export const AWARD_LEVELS = ['国际级', '国家级', '省级', '市级', '校级', '院级'];

// 学术科研类型
export const RESEARCH_TYPES = ['论文', '项目', '专利', '其他'];

// 等级颜色
export const GRADE_COLOR = {
  '特等奖': '#f59e0b', '一等奖': '#ef4444', '二等奖': '#f97316',
  '三等奖': '#eab308', '优秀奖': '#10b981', '参与奖': '#64748b'
};

// 级别颜色
export const LEVEL_COLOR = {
  '国际级': '#7c3aed', '国家级': '#4f6ef7', '省级': '#0ea5e9',
  '市级': '#10b981', '校级': '#f59e0b', '院级': '#94a3b8'
};

// 视图标题与副标题
export const VIEW_TITLES = {
  overview:     { title: '概览',   sub: '我的大学成长足迹' },
  experiences:  { title: '经历',   sub: '六类成长经历一览' },
  stats:        { title: '统计',   sub: '成长数据可视化' },
  timeline:     { title: '时间轴', sub: '按时间回顾成长' },
  profile:      { title: '我的',   sub: '设置与数据' }
};
