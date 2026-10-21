const { createClock } = require('./clock');
const ReminderPopupPresenter = require('./reminder-popup-presenter');
const SqliteActivityRepository = require('../infrastructure/persistence/sqlite-activity-repository');
const SqliteGardenRepository = require('../infrastructure/persistence/sqlite-garden-repository');
const SqliteReminderRepository = require('../infrastructure/persistence/sqlite-reminder-repository');
const ToolsUseCases = require('../application/tools-use-cases');
const ReminderUseCases = require('../application/reminder-use-cases');
const GardenUseCases = require('../application/garden-use-cases');
const RewardUseCases = require('../application/reward-use-cases');
const ToolsReadModel = require('../application/tools-read-model');

/**
 * 主进程工具域运行时：装配仓储/用例，初始化花园，并按 20 秒心跳推进提醒。
 */
class ToolsRuntime {
  constructor({ db, windowManager, clock = createClock(), tickIntervalMs = 20 * 1000 }) {
    this.db = db;
    this.windowManager = windowManager;
    this.clock = clock;
    this.tickIntervalMs = tickIntervalMs;
    this.timer = null;
    this.tickInFlight = false;

    this.activityRepository = new SqliteActivityRepository(db);
    this.gardenRepository = new SqliteGardenRepository(db);
    this.reminderRepository = new SqliteReminderRepository(db);
    this.toolsUseCases = new ToolsUseCases({
      db,
      clock,
      activityRepository: this.activityRepository,
      gardenRepository: this.gardenRepository
    });
    this.reminderUseCases = new ReminderUseCases({
      db,
      clock,
      reminderRepository: this.reminderRepository,
      toolsUseCases: this.toolsUseCases
    });
    this.gardenUseCases = new GardenUseCases({ db, clock, gardenRepository: this.gardenRepository });
    this.rewardUseCases = new RewardUseCases({ db, clock, gardenRepository: this.gardenRepository });
    this.readModel = new ToolsReadModel({
      clock,
      activityRepository: this.activityRepository,
      gardenRepository: this.gardenRepository
    });
    this.popupPresenter = new ReminderPopupPresenter({
      windowManager,
      reminderUseCases: this.reminderUseCases,
      clock,
      onUpdated: () => this.broadcastToolsUpdated()
    });
  }

  async initialize() {
    await this.gardenUseCases.initializeGarden(this.clock.now());
    await this.tick();
    this.start();
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick().catch((error) => {
        console.error('健康提醒心跳失败:', error);
      });
    }, this.tickIntervalMs);
    if (this.timer.unref) this.timer.unref();
  }

  dispose() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.popupPresenter.dispose();
  }

  broadcastToolsUpdated() {
    if (this.windowManager && typeof this.windowManager.broadcastToolsUpdated === 'function') {
      this.windowManager.broadcastToolsUpdated();
    }
  }

  async tick(now = this.clock.now()) {
    if (this.tickInFlight) return null;
    this.tickInFlight = true;
    try {
      const result = await this.reminderUseCases.tick(now);
      await this.popupPresenter.present(result.intents);
      if (result.intents.length > 0 || result.cleaned > 0) {
        this.broadcastToolsUpdated();
      }
      return result;
    } finally {
      this.tickInFlight = false;
    }
  }

  async listReminderRules() {
    return this.reminderRepository.listRules();
  }

  async createReminderRule(input) {
    const rule = await this.reminderUseCases.createRule(input);
    this.broadcastToolsUpdated();
    return rule;
  }

  async updateReminderRule(ruleId, updates) {
    const rule = await this.reminderUseCases.updateRule(ruleId, updates);
    this.broadcastToolsUpdated();
    return rule;
  }

  async respondReminder(occurrenceId, action) {
    const result = this.popupPresenter.has(occurrenceId)
      ? await this.popupPresenter.respond(occurrenceId, action)
      : await this.reminderUseCases.respond(occurrenceId, action, this.clock.now());
    this.broadcastToolsUpdated();
    return result;
  }

  async getShellSnapshot(now = this.clock.now()) {
    return this.readModel.getShellSnapshot(now);
  }

  async getGardenView(now = this.clock.now()) {
    return this.readModel.getGardenView(now);
  }

  async getClaimOptions(claimId) {
    return this.rewardUseCases.getClaimOptions(claimId);
  }

  async claimReward(claimId, selectedItemId = null) {
    const result = await this.rewardUseCases.claimReward(
      claimId,
      { selectedItemId },
      this.clock.now()
    );
    this.broadcastToolsUpdated();
    return result;
  }
}

module.exports = ToolsRuntime;
