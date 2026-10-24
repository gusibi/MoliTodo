/**
 * 行为账本与成长日仓储。
 * activity_daily_summary、growth_days 是可重建派生数据。
 */
class SqliteActivityRepository {
  constructor(db) {
    this.db = db;
  }

  async findByDedupeKey(dedupeKey) {
    const row = await this.db.get(
      'SELECT * FROM activity_events WHERE dedupe_key = ?',
      [dedupeKey]
    );
    return row ? this.rowToEvent(row) : null;
  }

  async appendEvent({
    dedupeKey,
    sourceType,
    sourceId = null,
    eventType,
    growthPoints,
    occurredAt,
    localDate,
    tzOffset,
    createdAt
  }) {
    const result = await this.db.run(
      `INSERT INTO activity_events (
        dedupe_key, source_type, source_id, event_type, growth_points,
        occurred_at, local_date, tz_offset, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dedupeKey,
        sourceType,
        sourceId,
        eventType,
        growthPoints,
        occurredAt,
        localDate,
        tzOffset,
        createdAt
      ]
    );

    return {
      id: result.lastID,
      dedupeKey,
      sourceType,
      sourceId,
      eventType,
      growthPoints,
      occurredAt,
      localDate,
      tzOffset,
      createdAt
    };
  }

  async getDailySummary(localDate) {
    const row = await this.db.get(
      'SELECT * FROM activity_daily_summary WHERE local_date = ?',
      [localDate]
    );
    return row ? this.rowToDailySummary(row) : null;
  }

  async listRecentDailySummaries(limit = 7) {
    const rows = await this.db.all(
      `SELECT * FROM activity_daily_summary
       ORDER BY local_date DESC
       LIMIT ?`,
      [limit]
    );
    return rows.reverse().map((row) => this.rowToDailySummary(row));
  }

  async saveDailySummary({
    localDate,
    focusCount,
    waterCount,
    sunCount,
    totalGrowth,
    updatedAt
  }) {
    await this.db.run(
      `INSERT INTO activity_daily_summary (
        local_date, focus_count, water_count, sun_count, total_growth, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(local_date) DO UPDATE SET
        focus_count = excluded.focus_count,
        water_count = excluded.water_count,
        sun_count = excluded.sun_count,
        total_growth = excluded.total_growth,
        updated_at = excluded.updated_at`,
      [localDate, focusCount, waterCount, sunCount, totalGrowth, updatedAt]
    );
  }

  async getTotals() {
    const row = await this.db.get(`
      SELECT
        COALESCE(SUM(CASE WHEN event_type = 'focus' THEN 1 ELSE 0 END), 0) AS focus_count,
        COALESCE(SUM(CASE WHEN event_type IN ('water', 'sun') THEN 1 ELSE 0 END), 0) AS health_count
      FROM activity_events
    `);
    return {
      focusCount: row ? row.focus_count : 0,
      healthCount: row ? row.health_count : 0
    };
  }

  async listGrowthDays() {
    const rows = await this.db.all(
      'SELECT local_date FROM growth_days ORDER BY local_date ASC'
    );
    return rows.map((row) => row.local_date);
  }

  async addGrowthDay({ localDate, growthScore, createdAt }) {
    await this.db.run(
      `INSERT INTO growth_days (local_date, growth_score, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(local_date) DO UPDATE SET
         growth_score = excluded.growth_score`,
      [localDate, growthScore, createdAt]
    );
  }

  rowToEvent(row) {
    return {
      id: row.id,
      dedupeKey: row.dedupe_key,
      sourceType: row.source_type,
      sourceId: row.source_id,
      eventType: row.event_type,
      growthPoints: row.growth_points,
      occurredAt: row.occurred_at,
      localDate: row.local_date,
      tzOffset: row.tz_offset,
      createdAt: row.created_at
    };
  }

  rowToDailySummary(row) {
    return {
      localDate: row.local_date,
      focusCount: row.focus_count,
      waterCount: row.water_count,
      sunCount: row.sun_count,
      totalGrowth: row.total_growth,
      updatedAt: row.updated_at
    };
  }
}

module.exports = SqliteActivityRepository;
