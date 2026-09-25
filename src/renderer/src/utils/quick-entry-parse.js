/**
 * 快速录入的自然语言日期解析（Quick Entry Parse）
 *
 * 参考 Things Quick Entry 的 When 输入：在标题里混写「明天下午3点」这类表达时，
 * 解析出安排时间并以 chip 预览，创建时从标题中剥离已匹配词。
 *
 * 覆盖一个务实的中文白名单，不做通用 NLP：
 * - 日期：今天/今日、明天/明日、后天、大后天、N天后、周X/星期X/礼拜X、下周X、下下周X、M月D日/号
 * - 时间：HH:MM、X点、X点半、X点XX分，可带 早上/上午/中午/下午/傍晚/晚上/凌晨 前缀
 * - 日期与时间可任意组合（「明天下午3点」「周四的早上9点」「9月25日 14:00」）
 *
 * 只解析到日期不解析到时间时，沿用 TaskComposer「任意时间」的语义写 00:00。
 * 纯函数，不依赖运行时状态；ESM 导出，node:test 以 require(esm) 直接单测（同 today-agenda.js）。
 */

const WEEKDAY_MAP = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 };

const DATE_PATTERNS = [
  { re: /大后天|大後天/, kind: 'offset', value: 3 },
  { re: /(?<![0-9])([0-9]+)\s*天(?:后|後|之后|之後)/, kind: 'nDaysLater' },
  { re: /下下(周|星期|礼拜)([一二三四五六日天])/, kind: 'weekday', weekShift: 2 },
  { re: /下(周|星期|礼拜)([一二三四五六日天])/, kind: 'weekday', weekShift: 1 },
  { re: /(?<!下)(周|星期|礼拜)([一二三四五六日天])/, kind: 'weekday', weekShift: 0 },
  { re: /今天|今日/, kind: 'offset', value: 0 },
  { re: /明天|明日/, kind: 'offset', value: 1 },
  { re: /后天|後天/, kind: 'offset', value: 2 },
  { re: /([0-9]{1,2})月([0-9]{1,2})[日号]/, kind: 'monthDay' }
];

const TIME_PATTERN = /(早上|上午|中午|下午|傍晚|晚上|夜里|凌晨)?\s*([0-9]{1,2})([:：]|点半|点|时)(?:\s*([0-9]{1,2})\s*分?)?/;

function startOfDay(now) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function resolveWeekday(now, weekday, weekShift) {
  const base = startOfDay(now);
  const currentWeekday = base.getDay();
  let diff = (weekday - currentWeekday + 7) % 7;
  if (weekShift >= 1) {
    // 下周X：从本周对齐点直接加整周，避免「本周未到周X」时被理解成本周
    diff += 7 * weekShift;
  } else if (diff === 0) {
    // 今天正是周X：口语里的「周X」指下一个
    diff = 7;
  }
  base.setDate(base.getDate() + diff);
  return base;
}

function resolveMonthDay(now, month, day) {
  const candidate = new Date(now.getFullYear(), month - 1, day);
  if (candidate < startOfDay(now)) {
    return new Date(now.getFullYear() + 1, month - 1, day);
  }
  return candidate;
}

function matchDate(text, now) {
  for (const pattern of DATE_PATTERNS) {
    const match = pattern.re.exec(text);
    if (!match) continue;

    let date = null;
    if (pattern.kind === 'offset') {
      date = startOfDay(now);
      date.setDate(date.getDate() + pattern.value);
    } else if (pattern.kind === 'nDaysLater') {
      const days = Number(match[1]);
      if (days <= 0 || days > 365) continue;
      date = startOfDay(now);
      date.setDate(date.getDate() + days);
    } else if (pattern.kind === 'weekday') {
      const weekday = WEEKDAY_MAP[match[2]];
      if (weekday === undefined) continue;
      date = resolveWeekday(now, weekday, pattern.weekShift);
    } else if (pattern.kind === 'monthDay') {
      const month = Number(match[1]);
      const day = Number(match[2]);
      if (month < 1 || month > 12 || day < 1 || day > 31) continue;
      date = resolveMonthDay(now, month, day);
    }
    if (date) return { date, matched: match[0] };
  }
  return null;
}

function matchTime(text) {
  const match = TIME_PATTERN.exec(text);
  if (!match) return null;

  const period = match[1] || null;
  const separator = match[3];
  const minuteText = match[4];
  const isColon = separator === ':' || separator === '：';

  let hour = Number(match[2]);
  let minute = null;

  if (separator === '点半') {
    minute = 30;
  } else if (isColon) {
    minute = minuteText !== undefined ? Number(minuteText) : 0;
    if (minute > 59) return null;
  } else if (minuteText !== undefined) {
    minute = Number(minuteText);
    if (minute > 59) return null;
  }

  if (period === '下午' || period === '傍晚' || period === '晚上' || period === '夜里') {
    if (hour < 12) hour += 12;
  } else if (period === '中午') {
    hour = 12;
  } else if (period === '早上' || period === '上午' || period === '凌晨') {
    if (hour === 12) hour = 0;
  }

  // 无冒号无时段的「X点/时」按 24 小时制校验（如「25点」无效）
  if (!isColon && !period && hour > 23) return null;
  if (hour > 23) return null;

  return { hour, minute: minute ?? 0, matched: match[0].trim() };
}

function stripSpan(content, span) {
  // 连接词「的」紧贴被剥离词时一并去掉（「周四的早上9点」→「」而非「的」）
  return content
    .split(`的${span}`)
    .join(' ')
    .split(`${span}的`)
    .join(' ')
    .split(span)
    .join(' ');
}

/**
 * 解析快速录入文本。
 * @param {string} text 用户输入
 * @param {Date} [now]
 * @returns {{ content: string, date: Date|null, hasTime: boolean, matchedText: string }}
 *   content 为剥离日期/时间词后的标题；未解析出日期时 date 为 null、content 等于原文。
 */
function parseQuickEntry(text, now = new Date()) {
  const input = (text || '').trim();
  if (!input) return { content: input, date: null, hasTime: false, matchedText: '' };

  const dateMatch = matchDate(input, now);
  const timeMatch = matchTime(input);

  let date = null;
  const matchedSpans = [];
  if (dateMatch) {
    date = dateMatch.date;
    matchedSpans.push(dateMatch.matched);
  }
  if (timeMatch) {
    matchedSpans.push(timeMatch.matched);
    if (!dateMatch) {
      // 孤立时间（「15:00 开会」）落到今天
      date = startOfDay(now);
    }
    date.setHours(timeMatch.hour, timeMatch.minute, 0, 0);
  }
  if (!date) return { content: input, date: null, hasTime: false, matchedText: '' };

  let content = input;
  for (const span of matchedSpans) {
    content = stripSpan(content, span);
  }
  content = content.replace(/\s+/g, ' ').trim();
  if (!content) content = input;

  return {
    content,
    date,
    hasTime: Boolean(timeMatch),
    matchedText: matchedSpans.join(' ')
  };
}

export { parseQuickEntry };
