const {
  normalizePlannedSeconds,
  getFocusElapsedSeconds,
  getFocusSummary
} = require('../domain/services/focus-policy');
const { withTransaction } = require('../infrastructure/persistence/with-transaction');

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('专注时间不是有效时间');
  }
  return date;
}

/**
 * 番茄专注应用用例。
 * 计时由主进程持有，完成时与成长写入放在同一个事务内。
 */
class FocusUseCases {
  constructor({ db, clock, focusRepository, toolsUseCases }) {
    this.db = db;
    this.clock = clock;
    this.focusRepository = focusRepository;
    this.toolsUseCases = toolsUseCases;
  }

  async getState(now = this.clock.now()) {
    const instant = toDate(now);
    const [active, recent] = await Promise.all([
      this.focusRepository.findActiveSession(),
      this.focusRepository.listRecentSessions(5)
    ]);
    return {
      active: getFocusSummary(active, instant),
      recent: recent.map((session) => getFocusSummary(session, instant))
    };
  }

  async start({ plannedMinutes = 25, linkedTaskId = null, now = this.clock.now() } = {}) {
    const instant = toDate(now);
    const nowIso = instant.toISOString();
    const plannedSeconds = normalizePlannedSeconds(plannedMinutes);

    return withTransaction(this.db, async () => {
      const active = await this.focusRepository.findActiveSession();
      if (active) {
        throw new Error('已有进行中的专注');
      }
      await this.focusRepository.createSession({
        linkedTaskId,
        plannedSeconds,
        startedAt: nowIso,
        createdAt: nowIso
      });
      return this.getState(instant);
    });
  }

  async pause(now = this.clock.now()) {
    const instant = toDate(now);
    const nowIso = instant.toISOString();

    return withTransaction(this.db, async () => {
      const active = await this.focusRepository.findActiveSession();
      if (!active) throw new Error('没有进行中的专注');
      if (active.status === 'paused') return this.getState(instant);

      const elapsed = Math.min(
        active.plannedSeconds,
        getFocusElapsedSeconds(active, instant)
      );
      await this.focusRepository.updateSession({
        id: active.id,
        status: 'paused',
        focusSeconds: elapsed
      });
      return this.getState(instant);
    });
  }

  async resume(now = this.clock.now()) {
    const instant = toDate(now);
    const nowIso = instant.toISOString();

    return withTransaction(this.db, async () => {
      const active = await this.focusRepository.findActiveSession();
      if (!active) throw new Error('没有进行中的专注');
      if (active.status === 'running') return this.getState(instant);

      await this.focusRepository.updateSession({
        id: active.id,
        status: 'running',
        startedAt: nowIso
      });
      return this.getState(instant);
    });
  }

  async cancel(now = this.clock.now()) {
    const instant = toDate(now);
    const nowIso = instant.toISOString();

    return withTransaction(this.db, async () => {
      const active = await this.focusRepository.findActiveSession();
      if (!active) throw new Error('没有进行中的专注');

      const elapsed = Math.min(
        active.plannedSeconds,
        getFocusElapsedSeconds(active, instant)
      );
      await this.focusRepository.updateSession({
        id: active.id,
        status: 'cancelled',
        focusSeconds: elapsed,
        endedAt: nowIso
      });
      return this.getState(instant);
    });
  }

  async tick(now = this.clock.now()) {
    const instant = toDate(now);
    const nowIso = instant.toISOString();

    return withTransaction(this.db, async () => {
      const active = await this.focusRepository.findActiveSession();
      if (!active || active.status !== 'running') {
        return { completed: false, state: await this.getState(instant) };
      }

      const elapsed = getFocusElapsedSeconds(active, instant);
      if (elapsed < active.plannedSeconds) {
        return { completed: false, state: await this.getState(instant) };
      }

      await this.focusRepository.updateSession({
        id: active.id,
        status: 'completed',
        focusSeconds: active.plannedSeconds,
        endedAt: nowIso
      });

      const activity = await this.toolsUseCases.recordActivityInTransaction({
        type: 'focus',
        dedupeKey: `focus:${active.id}:completed`,
        sourceType: 'focus_session',
        sourceId: String(active.id),
        occurredAt: nowIso
      });

      return {
        completed: true,
        activity,
        state: await this.getState(instant)
      };
    });
  }

  async interruptActive(now = this.clock.now()) {
    return this.focusRepository.interruptActiveSessions(toDate(now).toISOString());
  }
}

module.exports = FocusUseCases;
