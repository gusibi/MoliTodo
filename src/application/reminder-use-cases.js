const {
  normalizeIntervalMinutes,
  parseTimeOfDay,
  normalizeWeekdays,
  computeNextRunAt,
  getAnchorMinutes
} = require('../domain/services/reminder-schedule');
const { withTransaction } = require('../infrastructure/persistence/with-transaction');

const ALERT_TYPES = new Set(['water', 'stand', 'eyes']);
const ACTIVITY_TYPE_BY_RULE = Object.freeze({ water: 'water', stand: 'sun' });
const TICK_TOLERANCE_MS = 90 * 1000;
const SNOOZE_MS = 10 * 60 * 1000;
const MAX_SNOOZES = 2;
const OCCURRENCE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function toDate(value, fieldName = '时间') {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`${fieldName} 不是有效时间`);
  }
  return date;
}

function normalizeType(type) {
  if (!ALERT_TYPES.has(type)) {
    throw new Error('提醒类型只能是 water、stand 或 eyes');
  }
  return type;
}

function normalizeAnchorMode(mode) {
  if (mode !== 'created' && mode !== 'hour') {
    throw new Error('anchorMode 只能是 created 或 hour');
  }
  return mode;
}

function normalizeWindow(start, end) {
  const startMinutes = parseTimeOfDay(start, 'windowStart');
  const endMinutes = parseTimeOfDay(end, 'windowEnd');
  if (startMinutes >= endMinutes) {
    throw new Error('提醒窗口必须 start < end');
  }
}

function normalizePauseUntil(value) {
  if (value === null || value === undefined || value === '') return null;
  return toDate(value, 'pauseUntil').toISOString();
}

/**
 * 健康提醒应用用例。
 * tick 只返回 PopupIntent，不负责实际弹窗；respond 负责状态流转与成长写入。
 */
class ReminderUseCases {
  constructor({ db, clock, reminderRepository, toolsUseCases }) {
    this.db = db;
    this.clock = clock;
    this.reminderRepository = reminderRepository;
    this.toolsUseCases = toolsUseCases;
  }

  async createRule(input = {}) {
    const type = normalizeType(input.type);
    const intervalMinutes = normalizeIntervalMinutes(input.intervalMinutes);
    const anchorMode = normalizeAnchorMode(input.anchorMode || 'created');
    const windowStart = input.windowStart;
    const windowEnd = input.windowEnd;
    normalizeWindow(windowStart, windowEnd);
    const weekdays = normalizeWeekdays(input.weekdays);
    const enabled = input.enabled === undefined ? 1 : (input.enabled ? 1 : 0);
    const pauseUntil = normalizePauseUntil(input.pauseUntil);
    const now = this.clock.now();
    const nowIso = now.toISOString();
    const anchorMinutes = getAnchorMinutes(anchorMode, now, this.clock);

    const nextRunAt = computeNextRunAt({
      intervalMinutes,
      anchorMode,
      anchorMinutes,
      weekdays,
      windowStart,
      windowEnd,
      pauseUntil
    }, now, this.clock);

    return this.reminderRepository.insertRule({
      type,
      intervalMinutes,
      anchorMode,
      anchorMinutes,
      weekdays,
      windowStart,
      windowEnd,
      enabled,
      pauseUntil,
      nextRunAt: nextRunAt ? nextRunAt.toISOString() : null,
      createdAt: nowIso,
      updatedAt: nowIso
    });
  }

  async updateRule(ruleId, updates = {}) {
    const existing = await this.reminderRepository.findRuleById(ruleId);
    if (!existing) {
      throw new Error('提醒规则不存在');
    }

    const type = updates.type === undefined ? existing.type : normalizeType(updates.type);
    const intervalMinutes = updates.intervalMinutes === undefined
      ? existing.intervalMinutes
      : normalizeIntervalMinutes(updates.intervalMinutes);
    const anchorMode = updates.anchorMode === undefined
      ? existing.anchorMode
      : normalizeAnchorMode(updates.anchorMode);
    const windowStart = updates.windowStart === undefined ? existing.windowStart : updates.windowStart;
    const windowEnd = updates.windowEnd === undefined ? existing.windowEnd : updates.windowEnd;
    normalizeWindow(windowStart, windowEnd);
    const weekdays = updates.weekdays === undefined
      ? existing.weekdays
      : normalizeWeekdays(updates.weekdays);
    const enabled = updates.enabled === undefined
      ? existing.enabled
      : (updates.enabled ? 1 : 0);
    const pauseUntil = updates.pauseUntil === undefined
      ? existing.pauseUntil
      : normalizePauseUntil(updates.pauseUntil);

    const now = this.clock.now();
    const nowIso = now.toISOString();
    const anchorReset = updates.intervalMinutes !== undefined || updates.anchorMode !== undefined;
    const anchorMinutes = anchorReset
      ? getAnchorMinutes(anchorMode, now, this.clock)
      : existing.anchorMinutes;

    const schedulingTouched = [
      'intervalMinutes',
      'anchorMode',
      'windowStart',
      'windowEnd',
      'weekdays',
      'enabled',
      'pauseUntil'
    ].some((key) => Object.prototype.hasOwnProperty.call(updates, key));

    let nextRunAt = existing.nextRunAt;
    if (schedulingTouched) {
      const next = computeNextRunAt({
        intervalMinutes,
        anchorMode,
        anchorMinutes,
        weekdays,
        windowStart,
        windowEnd,
        pauseUntil
      }, now, this.clock);
      nextRunAt = next ? next.toISOString() : null;
    }

    return this.reminderRepository.updateRule({
      id: ruleId,
      type,
      intervalMinutes,
      anchorMode,
      anchorMinutes,
      weekdays,
      windowStart,
      windowEnd,
      enabled,
      pauseUntil,
      nextRunAt,
      updatedAt: nowIso
    });
  }

  async tick(now = this.clock.now()) {
    const instant = toDate(now, 'now');
    const nowIso = instant.toISOString();

    return withTransaction(this.db, async () => {
      const dueRules = await this.reminderRepository.listDueRules(nowIso);
      const intents = [];

      for (const rule of dueRules) {
        const scheduledAt = rule.nextRunAt;
        const scheduledInstant = new Date(scheduledAt);
        const lateMs = instant.getTime() - scheduledInstant.getTime();

        if (lateMs <= TICK_TOLERANCE_MS) {
          let occurrence = await this.reminderRepository.findOccurrenceByRuleAndScheduled(
            rule.id,
            scheduledAt
          );
          if (!occurrence) {
            occurrence = await this.reminderRepository.insertOccurrence({
              ruleId: rule.id,
              scheduledAt,
              status: 'pending',
              localDate: this.clock.localDate(scheduledInstant),
              createdAt: nowIso
            });
          }
          if (occurrence.status === 'pending') {
            intents.push({ rule, occurrence, scheduledAt });
          }
        }

        const next = computeNextRunAt(rule, instant, this.clock);
        await this.reminderRepository.updateNextRunAt(
          rule.id,
          next ? next.toISOString() : null,
          nowIso
        );
      }

      const snoozedDue = await this.reminderRepository.listSnoozedDue(nowIso);
      for (const occurrence of snoozedDue) {
        const revived = await this.reminderRepository.updateOccurrence({
          id: occurrence.id,
          status: 'pending'
        });
        const rule = await this.reminderRepository.findRuleById(occurrence.ruleId);
        intents.push({ rule, occurrence: revived, scheduledAt: revived.scheduledAt });
      }

      const cutoff = new Date(instant.getTime() - OCCURRENCE_RETENTION_MS).toISOString();
      const cleaned = await this.reminderRepository.deleteOccurrencesBefore(cutoff);

      return {
        now: nowIso,
        intents,
        dueRuleCount: dueRules.length,
        cleaned
      };
    });
  }

  async expireOccurrence(occurrenceId, now = this.clock.now()) {
    const instant = toDate(now, 'now');
    const nowIso = instant.toISOString();

    return withTransaction(this.db, async () => {
      const occurrence = await this.reminderRepository.findOccurrenceById(occurrenceId);
      if (!occurrence || occurrence.status !== 'pending') {
        return { updated: false, occurrence };
      }
      const updated = await this.reminderRepository.updateOccurrence({
        id: occurrence.id,
        status: 'expired',
        respondedAt: nowIso
      });
      return { updated: true, occurrence: updated };
    });
  }

  async respond(occurrenceId, action, now = this.clock.now()) {
    if (!['confirm', 'snooze', 'skip'].includes(action)) {
      throw new Error('响应动作只能是 confirm、snooze 或 skip');
    }
    const instant = toDate(now, 'now');
    const nowIso = instant.toISOString();

    return withTransaction(this.db, async () => {
      const occurrence = await this.reminderRepository.findOccurrenceById(occurrenceId);
      if (!occurrence) {
        throw new Error('提醒实例不存在');
      }

      if (action === 'confirm' && occurrence.status === 'confirmed') {
        return {
          updated: false,
          duplicate: true,
          occurrence,
          activity: null
        };
      }
      if (occurrence.status !== 'pending') {
        throw new Error('提醒实例当前不可响应');
      }

      const rule = await this.reminderRepository.findRuleById(occurrence.ruleId);
      if (!rule) {
        throw new Error('提醒规则不存在');
      }

      if (action === 'snooze') {
        if (occurrence.snoozeCount >= MAX_SNOOZES) {
          throw new Error('最多稍后两次');
        }
        const snoozedUntil = new Date(instant.getTime() + SNOOZE_MS);
        const updated = await this.reminderRepository.updateOccurrence({
          id: occurrence.id,
          status: 'snoozed',
          snoozedUntil: snoozedUntil.toISOString(),
          snoozeCount: occurrence.snoozeCount + 1
        });
        const next = computeNextRunAt(rule, snoozedUntil, this.clock);
        await this.reminderRepository.updateNextRunAt(
          rule.id,
          next ? next.toISOString() : null,
          nowIso
        );
        return { updated: true, duplicate: false, occurrence: updated, activity: null };
      }

      if (action === 'skip') {
        const updated = await this.reminderRepository.updateOccurrence({
          id: occurrence.id,
          status: 'skipped',
          respondedAt: nowIso
        });
        return { updated: true, duplicate: false, occurrence: updated, activity: null };
      }

      const updated = await this.reminderRepository.updateOccurrence({
        id: occurrence.id,
        status: 'confirmed',
        respondedAt: nowIso
      });

      let activity = null;
      const activityType = ACTIVITY_TYPE_BY_RULE[rule.type];
      if (activityType) {
        activity = await this.toolsUseCases.recordActivityInTransaction({
          type: activityType,
          dedupeKey: `health:${occurrence.id}:confirmed`,
          sourceType: 'reminder',
          sourceId: String(occurrence.id),
          occurredAt: nowIso
        });
      }

      return { updated: true, duplicate: false, occurrence: updated, activity };
    });
  }
}

module.exports = ReminderUseCases;
