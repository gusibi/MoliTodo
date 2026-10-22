const { createClock } = require('./clock');
const ReminderPopupPresenter = require('./reminder-popup-presenter');
const SqliteActivityRepository = require('../infrastructure/persistence/sqlite-activity-repository');
const SqliteGardenRepository = require('../infrastructure/persistence/sqlite-garden-repository');
const SqliteReminderRepository = require('../infrastructure/persistence/sqlite-reminder-repository');
const SqliteFocusRepository = require('../infrastructure/persistence/sqlite-focus-repository');
const ToolsUseCases = require('../application/tools-use-cases');
const ReminderUseCases = require('../application/reminder-use-cases');
const GardenUseCases = require('../application/garden-use-cases');
const RewardUseCases = require('../application/reward-use-cases');
const FocusUseCases = require('../application/focus-use-cases');
const PlacementUseCases = require('../application/placement-use-cases');
const ToolsDataPort = require('../application/tools-data-port');
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
    this.focusTimer = null;
    this.tickInFlight = false;
    this.focusTickInFlight = false;
    this.focusPausedForSleep = false;
    this.autoPlace = windowManager?.configStore?.get?.('tools.autoPlace', true) ?? true;

    this.activityRepository = new SqliteActivityRepository(db);
    this.gardenRepository = new SqliteGardenRepository(db);
    this.reminderRepository = new SqliteReminderRepository(db);
    this.focusRepository = new SqliteFocusRepository(db);
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
    this.focusUseCases = new FocusUseCases({
      db,
      clock,
      focusRepository: this.focusRepository,
      toolsUseCases: this.toolsUseCases
    });
    this.placementUseCases = new PlacementUseCases({
      db,
      clock,
      gardenRepository: this.gardenRepository
    });
    this.dataPort = new ToolsDataPort({
      db,
      clock,
      gardenUseCases: this.gardenUseCases
    });
    this.readModel = new ToolsReadModel({
      clock,
      activityRepository: this.activityRepository,
      gardenRepository: this.gardenRepository,
      focusRepository: this.focusRepository,
      getAutoPlace: () => this.autoPlace
    });
    this.popupPresenter = new ReminderPopupPresenter({
      windowManager,
      reminderUseCases: this.reminderUseCases,
      clock,
      onUpdated: () => this.broadcastToolsUpdated(),
      onShown: () => {
        if (windowManager && typeof windowManager.playNotificationSound === 'function') {
          windowManager.playNotificationSound();
        }
      }
    });
  }

  async initialize() {
    await this.gardenUseCases.initializeGarden(this.clock.now());
    await this.focusUseCases.interruptActive(this.clock.now());
    await this.tick();
    const pending = await this.reminderUseCases.resumePending(this.clock.now());
    await this.popupPresenter.present(pending);
    await this.tickFocus();
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

    this.focusTimer = setInterval(() => {
      this.tickFocus().catch((error) => {
        console.error('专注心跳失败:', error);
      });
    }, 2000);
    if (this.focusTimer.unref) this.focusTimer.unref();
  }

  dispose() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.focusTimer) {
      clearInterval(this.focusTimer);
      this.focusTimer = null;
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

  async tickFocus(now = this.clock.now()) {
    if (this.focusTickInFlight) return null;
    this.focusTickInFlight = true;
    try {
      const result = await this.focusUseCases.tick(now);
      if (result.completed) {
        await this.autoPlaceNewItem(result.activity?.inventoryItemId);
        this.broadcastToolsUpdated();
      }
      return result;
    } finally {
      this.focusTickInFlight = false;
    }
  }

  async autoPlaceNewItem(inventoryItemId) {
    if (!this.autoPlace || !inventoryItemId) return [];
    return this.placementUseCases.autoPlace({
      now: this.clock.now(),
      inventoryIds: [inventoryItemId]
    });
  }

  async setAutoPlace(enabled) {
    this.autoPlace = Boolean(enabled);
    if (this.windowManager?.configStore?.set) {
      this.windowManager.configStore.set('tools.autoPlace', this.autoPlace);
    }
    this.broadcastToolsUpdated();
    return this.autoPlace;
  }

  async getFocusState(now = this.clock.now()) {
    return this.focusUseCases.getState(now);
  }

  async startFocus(input = {}) {
    const state = await this.focusUseCases.start(input);
    this.broadcastToolsUpdated();
    return state;
  }

  async pauseFocus(now = this.clock.now()) {
    const state = await this.focusUseCases.pause(now);
    this.broadcastToolsUpdated();
    return state;
  }

  async resumeFocus(now = this.clock.now()) {
    const state = await this.focusUseCases.resume(now);
    this.broadcastToolsUpdated();
    return state;
  }

  async cancelFocus(now = this.clock.now()) {
    const state = await this.focusUseCases.cancel(now);
    this.broadcastToolsUpdated();
    return state;
  }

  async handleSuspend() {
    const active = await this.focusRepository.findActiveSession();
    if (active && active.status === 'running') {
      await this.focusUseCases.pause(this.clock.now());
      this.focusPausedForSleep = true;
      this.broadcastToolsUpdated();
    }
  }

  async handleResume() {
    if (!this.focusPausedForSleep) return;
    this.focusPausedForSleep = false;
    const active = await this.focusRepository.findActiveSession();
    if (active && active.status === 'paused') {
      await this.focusUseCases.resume(this.clock.now());
      this.broadcastToolsUpdated();
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

  async deleteReminderRule(ruleId) {
    const result = await this.reminderUseCases.deleteRule(ruleId);
    this.broadcastToolsUpdated();
    return result;
  }

  getReminderPopupIntents() {
    return this.popupPresenter.getIntents();
  }

  async respondReminder(occurrenceId, action) {
    const result = this.popupPresenter.has(occurrenceId)
      ? await this.popupPresenter.respond(occurrenceId, action)
      : await this.reminderUseCases.respond(occurrenceId, action, this.clock.now());
    await this.autoPlaceNewItem(result.activity?.inventoryItemId);
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
    await this.autoPlaceNewItem(result.inventoryItemId);
    this.broadcastToolsUpdated();
    return result;
  }

  async placeItem(inventoryId, slotId) {
    const placement = await this.placementUseCases.placeItem({ inventoryId, slotId });
    this.broadcastToolsUpdated();
    return placement;
  }

  async removePlacement(inventoryId) {
    const placement = await this.placementUseCases.removeItem(inventoryId);
    this.broadcastToolsUpdated();
    return placement;
  }

  async exportToolsData() {
    return this.dataPort.exportToolsData();
  }

  async importToolsData(snapshot) {
    const result = await this.dataPort.importToolsData(snapshot);
    this.focusPausedForSleep = false;
    this.popupPresenter.reset();
    this.broadcastToolsUpdated();
    return result;
  }

  async clearToolsData() {
    await this.dataPort.clearToolsData();
    this.focusPausedForSleep = false;
    this.popupPresenter.reset();
    this.broadcastToolsUpdated();
  }

  async plantSeed(speciesId) {
    const result = await this.gardenUseCases.plantSeed({ speciesId });
    this.broadcastToolsUpdated();
    return result;
  }

  async claimBasicSeed() {
    const result = await this.gardenUseCases.claimBasicSeed();
    this.broadcastToolsUpdated();
    return result;
  }
}

module.exports = ToolsRuntime;
