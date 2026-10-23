/**
 * 专注会话仓储。会话由主进程持有，渲染层只读取状态。
 */
class SqliteFocusRepository {
  constructor(db) {
    this.db = db;
  }

  async createSession({
    linkedTaskId = null,
    plannedSeconds,
    phase = 'focus',
    status = 'running',
    startedAt,
    endedAt = null,
    pausedMs = 0,
    createdAt
  }) {
    const result = await this.db.run(
      `INSERT INTO focus_sessions (
        linked_task_id, planned_seconds, phase, focus_seconds, status,
        started_at, ended_at, paused_ms, created_at
      ) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      [linkedTaskId, plannedSeconds, phase, status, startedAt, endedAt, pausedMs, createdAt]
    );
    return this.findSessionById(result.lastID);
  }

  async findSessionById(sessionId) {
    const row = await this.db.get('SELECT * FROM focus_sessions WHERE id = ?', [sessionId]);
    return row ? this.rowToSession(row) : null;
  }

  async findActiveSession() {
    const row = await this.db.get(
      `SELECT * FROM focus_sessions
       WHERE status IN ('running', 'paused')
       ORDER BY id DESC
       LIMIT 1`
    );
    return row ? this.rowToSession(row) : null;
  }

  async updateSession({
    id,
    status,
    focusSeconds,
    startedAt,
    endedAt = null,
    pausedMs = null
  }) {
    await this.db.run(
      `UPDATE focus_sessions SET
        status = ?,
        focus_seconds = COALESCE(?, focus_seconds),
        started_at = COALESCE(?, started_at),
        ended_at = ?,
        paused_ms = COALESCE(?, paused_ms)
      WHERE id = ?`,
      [status, focusSeconds, startedAt, endedAt, pausedMs, id]
    );
    return this.findSessionById(id);
  }

  async interruptActiveSessions(nowIso) {
    const result = await this.db.run(
      `UPDATE focus_sessions SET status = 'interrupted', ended_at = ?
       WHERE status IN ('running', 'paused')`,
      [nowIso]
    );
    return result.changes;
  }

  async listRecentSessions(limit = 10) {
    const rows = await this.db.all(
      `SELECT * FROM focus_sessions
       WHERE phase = 'focus' AND status IN ('completed', 'cancelled', 'interrupted')
       ORDER BY id DESC
       LIMIT ?`,
      [limit]
    );
    return rows.map((row) => this.rowToSession(row));
  }

  rowToSession(row) {
    return {
      id: row.id,
      linkedTaskId: row.linked_task_id,
      plannedSeconds: row.planned_seconds,
      phase: row.phase || 'focus',
      focusSeconds: row.focus_seconds,
      status: row.status,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      pausedMs: row.paused_ms,
      createdAt: row.created_at
    };
  }
}

module.exports = SqliteFocusRepository;
