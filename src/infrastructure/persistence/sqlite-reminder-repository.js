/**
 * 健康提醒规则与实例仓储。
 * 调度状态全部落 DB，进程内不保存 per-rule 定时器。
 */
class SqliteReminderRepository {
  constructor(db) {
    this.db = db;
  }

  async insertRule({
    type,
    intervalMinutes,
    anchorMode,
    anchorMinutes,
    weekdays = [],
    windowStart,
    windowEnd,
    enabled = 1,
    pauseUntil = null,
    nextRunAt = null,
    createdAt,
    updatedAt
  }) {
    const result = await this.db.run(
      `INSERT INTO reminder_rules (
        type, interval_minutes, anchor_mode, anchor_minutes, weekdays,
        window_start, window_end, enabled, pause_until, next_run_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        type,
        intervalMinutes,
        anchorMode,
        anchorMinutes,
        JSON.stringify(weekdays || []),
        windowStart,
        windowEnd,
        enabled,
        pauseUntil,
        nextRunAt,
        createdAt,
        updatedAt
      ]
    );
    return this.findRuleById(result.lastID);
  }

  async findRuleById(ruleId) {
    const row = await this.db.get('SELECT * FROM reminder_rules WHERE id = ?', [ruleId]);
    return row ? this.rowToRule(row) : null;
  }

  async listRules() {
    const rows = await this.db.all('SELECT * FROM reminder_rules ORDER BY id ASC');
    return rows.map((row) => this.rowToRule(row));
  }

  async listDueRules(nowIso) {
    const rows = await this.db.all(
      `SELECT * FROM reminder_rules
       WHERE enabled = 1
         AND next_run_at IS NOT NULL
         AND next_run_at <= ?
         AND (pause_until IS NULL OR pause_until <= ?)
       ORDER BY next_run_at ASC, id ASC`,
      [nowIso, nowIso]
    );
    return rows.map((row) => this.rowToRule(row));
  }

  async updateNextRunAt(ruleId, nextRunAt, updatedAt) {
    await this.db.run(
      'UPDATE reminder_rules SET next_run_at = ?, updated_at = ? WHERE id = ?',
      [nextRunAt, updatedAt, ruleId]
    );
  }

  async updateRule({
    id,
    type,
    intervalMinutes,
    anchorMode,
    anchorMinutes,
    weekdays = [],
    windowStart,
    windowEnd,
    enabled = 1,
    pauseUntil = null,
    nextRunAt = null,
    updatedAt
  }) {
    await this.db.run(
      `UPDATE reminder_rules SET
        type = ?,
        interval_minutes = ?,
        anchor_mode = ?,
        anchor_minutes = ?,
        weekdays = ?,
        window_start = ?,
        window_end = ?,
        enabled = ?,
        pause_until = ?,
        next_run_at = ?,
        updated_at = ?
      WHERE id = ?`,
      [
        type,
        intervalMinutes,
        anchorMode,
        anchorMinutes,
        JSON.stringify(weekdays || []),
        windowStart,
        windowEnd,
        enabled,
        pauseUntil,
        nextRunAt,
        updatedAt,
        id
      ]
    );
    return this.findRuleById(id);
  }

  async deleteRule(ruleId) {
    await this.db.run('DELETE FROM reminder_occurrences WHERE rule_id = ?', [ruleId]);
    const result = await this.db.run('DELETE FROM reminder_rules WHERE id = ?', [ruleId]);
    return result.changes > 0;
  }

  async findOccurrenceByRuleAndScheduled(ruleId, scheduledAt) {
    const row = await this.db.get(
      'SELECT * FROM reminder_occurrences WHERE rule_id = ? AND scheduled_at = ?',
      [ruleId, scheduledAt]
    );
    return row ? this.rowToOccurrence(row) : null;
  }

  async findOccurrenceById(occurrenceId) {
    const row = await this.db.get(
      'SELECT * FROM reminder_occurrences WHERE id = ?',
      [occurrenceId]
    );
    return row ? this.rowToOccurrence(row) : null;
  }

  async insertOccurrence({
    ruleId,
    scheduledAt,
    status = 'pending',
    snoozedUntil = null,
    snoozeCount = 0,
    respondedAt = null,
    localDate,
    createdAt
  }) {
    const result = await this.db.run(
      `INSERT INTO reminder_occurrences (
        rule_id, scheduled_at, status, snoozed_until, snooze_count,
        responded_at, local_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ruleId,
        scheduledAt,
        status,
        snoozedUntil,
        snoozeCount,
        respondedAt,
        localDate,
        createdAt
      ]
    );
    return this.findOccurrenceById(result.lastID);
  }

  async updateOccurrence({
    id,
    status,
    snoozedUntil = null,
    snoozeCount = null,
    respondedAt = null
  }) {
    await this.db.run(
      `UPDATE reminder_occurrences SET
        status = ?,
        snoozed_until = ?,
        snooze_count = COALESCE(?, snooze_count),
        responded_at = ?
      WHERE id = ?`,
      [status, snoozedUntil, snoozeCount, respondedAt, id]
    );
    return this.findOccurrenceById(id);
  }

  async listSnoozedDue(nowIso) {
    const rows = await this.db.all(
      `SELECT * FROM reminder_occurrences
       WHERE status = 'snoozed'
         AND snoozed_until IS NOT NULL
         AND snoozed_until <= ?
       ORDER BY snoozed_until ASC, id ASC`,
      [nowIso]
    );
    return rows.map((row) => this.rowToOccurrence(row));
  }

  async listRecentOccurrences(limit = 12) {
    const rows = await this.db.all(
      `SELECT * FROM reminder_occurrences
       WHERE status <> 'pending'
       ORDER BY COALESCE(responded_at, scheduled_at) DESC, id DESC
       LIMIT ?`,
      [limit]
    );
    return rows.map((row) => this.rowToOccurrence(row));
  }

  async listPendingSince(cutoffIso) {
    const rows = await this.db.all(
      `SELECT * FROM reminder_occurrences
       WHERE status = 'pending' AND created_at >= ?
       ORDER BY scheduled_at ASC, id ASC`,
      [cutoffIso]
    );
    return rows.map((row) => this.rowToOccurrence(row));
  }

  async expirePendingBefore(cutoffIso, respondedAt) {
    const result = await this.db.run(
      `UPDATE reminder_occurrences
       SET status = 'expired', responded_at = ?
       WHERE status = 'pending' AND created_at < ?`,
      [respondedAt, cutoffIso]
    );
    return result.changes;
  }

  async deleteOccurrencesBefore(cutoffIso) {
    const result = await this.db.run(
      'DELETE FROM reminder_occurrences WHERE scheduled_at < ?',
      [cutoffIso]
    );
    return result.changes;
  }

  rowToRule(row) {
    let weekdays = [];
    try {
      weekdays = JSON.parse(row.weekdays || '[]');
    } catch (error) {
      weekdays = [];
    }
    return {
      id: row.id,
      type: row.type,
      intervalMinutes: row.interval_minutes,
      anchorMode: row.anchor_mode,
      anchorMinutes: row.anchor_minutes,
      weekdays,
      windowStart: row.window_start,
      windowEnd: row.window_end,
      enabled: row.enabled,
      pauseUntil: row.pause_until,
      nextRunAt: row.next_run_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  rowToOccurrence(row) {
    return {
      id: row.id,
      ruleId: row.rule_id,
      scheduledAt: row.scheduled_at,
      status: row.status,
      snoozedUntil: row.snoozed_until,
      snoozeCount: row.snooze_count,
      respondedAt: row.responded_at,
      localDate: row.local_date,
      createdAt: row.created_at
    };
  }
}

module.exports = SqliteReminderRepository;
