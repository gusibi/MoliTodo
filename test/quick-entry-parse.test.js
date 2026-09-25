const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { parseQuickEntry } = require('../src/renderer/src/utils/quick-entry-parse');

// 固定「现在」：2026-09-24（周四）10:00 本地时间
const NOW = new Date(2026, 8, 24, 10, 0, 0);

function at(month, day, hour = 0, minute = 0) {
  return new Date(2026, month - 1, day, hour, minute, 0, 0);
}

describe('无日期表达时不解析', () => {
  test('纯文本保持原样', () => {
    const result = parseQuickEntry('买牛奶', NOW);
    assert.equal(result.date, null);
    assert.equal(result.content, '买牛奶');
    assert.equal(result.hasTime, false);
  });

  test('普通数字与量词不会被当成时间', () => {
    assert.equal(parseQuickEntry('买3个苹果', NOW).date, null);
    assert.equal(parseQuickEntry('第3章 内容整理', NOW).date, null);
  });

  test('无时段的非法小时不解析', () => {
    assert.equal(parseQuickEntry('25点出发', NOW).date, null);
  });

  test('空输入', () => {
    assert.equal(parseQuickEntry('', NOW).date, null);
  });
});

describe('相对日期词', () => {
  test('明天', () => {
    const result = parseQuickEntry('明天交报告', NOW);
    assert.deepEqual(result.date, at(9, 25));
    assert.equal(result.content, '交报告');
  });

  test('今天', () => {
    const result = parseQuickEntry('今天买书', NOW);
    assert.deepEqual(result.date, at(9, 24));
    assert.equal(result.content, '买书');
  });

  test('后天 / 大后天', () => {
    assert.deepEqual(parseQuickEntry('后天体检', NOW).date, at(9, 26));
    assert.deepEqual(parseQuickEntry('大后天搬家', NOW).date, at(9, 27));
  });

  test('N天后', () => {
    const result = parseQuickEntry('3天后取快递', NOW);
    assert.deepEqual(result.date, at(9, 27));
    assert.equal(result.content, '取快递');
  });

  test('本周已过的周X 指下一个', () => {
    // 今天周四，「周三」指下周三 9-30
    assert.deepEqual(parseQuickEntry('周三提交', NOW).date, at(9, 30));
  });

  test('本周未到的周X 在本周', () => {
    assert.deepEqual(parseQuickEntry('周五晚上8点健身', NOW).date, at(9, 25, 20, 0));
  });

  test('周天', () => {
    assert.deepEqual(parseQuickEntry('周天的安排', NOW).date, at(9, 27));
  });

  test('下周X 不落到本周', () => {
    assert.deepEqual(parseQuickEntry('下周一开会', NOW).date, at(10, 5));
    assert.deepEqual(parseQuickEntry('下周三提交', NOW).date, at(10, 7));
  });

  test('下下周X', () => {
    assert.deepEqual(parseQuickEntry('下下周二复盘', NOW).date, at(10, 13));
  });

  test('M月D日：今年未到用今年', () => {
    assert.deepEqual(parseQuickEntry('9月25日 14:00', NOW).date, at(9, 25, 14, 0));
  });

  test('M月D日：已过用明年', () => {
    assert.deepEqual(parseQuickEntry('1月20日年报', NOW).date, new Date(2027, 0, 20));
  });
});

describe('时间表达', () => {
  test('24 小时制 HH:MM', () => {
    const result = parseQuickEntry('15:00 站会', NOW);
    assert.deepEqual(result.date, at(9, 24, 15, 0));
    assert.equal(result.hasTime, true);
    assert.equal(result.content, '站会');
  });

  test('无日期的时间落到今天', () => {
    const result = parseQuickEntry('晚上8点跑步', NOW);
    assert.deepEqual(result.date, at(9, 24, 20, 0));
    assert.equal(result.content, '跑步');
  });

  test('X点半', () => {
    const result = parseQuickEntry('明天9点半刷牙', NOW);
    assert.deepEqual(result.date, at(9, 25, 9, 30));
  });

  test('X点XX分', () => {
    const result = parseQuickEntry('明天9点30分刷牙', NOW);
    assert.deepEqual(result.date, at(9, 25, 9, 30));
  });

  test('中午 / 凌晨', () => {
    assert.deepEqual(parseQuickEntry('12点半吃饭', NOW).date, at(9, 24, 12, 30));
    assert.deepEqual(parseQuickEntry('凌晨1点写日记', NOW).date, at(9, 24, 1, 0));
  });

  test('组合：日期+时段+时间', () => {
    const result = parseQuickEntry('明天下午3点开会', NOW);
    assert.deepEqual(result.date, at(9, 25, 15, 0));
    assert.equal(result.content, '开会');
    assert.equal(result.hasTime, true);
  });

  test('组合：周X+连接词+时间', () => {
    const result = parseQuickEntry('周四的早上9点写周报', NOW);
    assert.deepEqual(result.date, at(10, 1, 9, 0));
    assert.equal(result.content, '写周报');
  });
});

describe('剥离与回退', () => {
  test('只输入日期时标题回退为原文', () => {
    const result = parseQuickEntry('明天', NOW);
    assert.deepEqual(result.date, at(9, 25));
    assert.equal(result.content, '明天');
  });

  test('正文中的「的」不被误删', () => {
    const result = parseQuickEntry('明天更新公司的官网', NOW);
    assert.equal(result.content, '更新公司的官网');
  });

  test('标题词序打乱也能解析', () => {
    const result = parseQuickEntry('和 15:00 客户开会 明天', NOW);
    assert.deepEqual(result.date, at(9, 25, 15, 0));
    assert.equal(result.content, '和 客户开会');
  });
});
