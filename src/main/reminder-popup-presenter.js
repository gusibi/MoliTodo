/**
 * 提醒弹窗适配器。
 * 维护最多 3 条 PopupIntent，45 秒无操作全部过期；真正的窗口由 WindowManager 创建。
 */
class ReminderPopupPresenter {
  constructor({
    windowManager,
    reminderUseCases,
    clock,
    maxQueue = 3,
    expiryMs = 45 * 1000,
    onUpdated = () => {},
    onShown = () => {}
  }) {
    this.windowManager = windowManager;
    this.reminderUseCases = reminderUseCases;
    this.clock = clock;
    this.maxQueue = maxQueue;
    this.expiryMs = expiryMs;
    this.onUpdated = onUpdated;
    this.onShown = onShown;
    this.queue = [];
    this.expiryTimer = null;
  }

  has(occurrenceId) {
    return this.queue.some((intent) => intent.occurrence.id === occurrenceId);
  }

  getIntents() {
    return this.queue.map((intent) => this.serialize(intent));
  }

  serialize(intent) {
    return {
      occurrenceId: intent.occurrence.id,
      ruleType: intent.rule ? intent.rule.type : null,
      scheduledAt: intent.occurrence.scheduledAt,
      localDate: intent.occurrence.localDate,
      snoozeCount: intent.occurrence.snoozeCount
    };
  }

  async present(intents = []) {
    let added = false;
    for (const intent of intents) {
      if (!intent || !intent.occurrence) continue;
      if (this.has(intent.occurrence.id)) continue;
      this.queue.push(intent);
      added = true;
    }

    while (this.queue.length > this.maxQueue) {
      const dropped = this.queue.shift();
      await this.reminderUseCases.expireOccurrence(dropped.occurrence.id, this.clock.now());
    }

    if (added) {
      this.show();
    }
  }

  show() {
    if (this.queue.length === 0) {
      this.close();
      return;
    }
    this.windowManager.showReminderPopup(this.queue.map((intent) => this.serialize(intent)));
    this.startExpiry();
    this.onShown();
  }

  startExpiry() {
    this.clearExpiry();
    this.expiryTimer = setTimeout(() => {
      this.expireAll().catch((error) => {
        console.error('提醒弹窗自动过期失败:', error);
      });
    }, this.expiryMs);
    if (this.expiryTimer.unref) this.expiryTimer.unref();
  }

  clearExpiry() {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  async respond(occurrenceId, action) {
    const intent = this.queue.find((entry) => entry.occurrence.id === occurrenceId);
    this.queue = this.queue.filter((entry) => entry.occurrence.id !== occurrenceId);

    const result = await this.reminderUseCases.respond(
      occurrenceId,
      action,
      this.clock.now()
    );

    this.show();
    await this.onUpdated();
    return result;
  }

  async expireAll() {
    const pending = this.queue;
    this.queue = [];
    this.clearExpiry();

    for (const intent of pending) {
      try {
        await this.reminderUseCases.expireOccurrence(intent.occurrence.id, this.clock.now());
      } catch (error) {
        console.error('提醒实例过期失败:', error);
      }
    }

    this.windowManager.closeReminderPopup();
    await this.onUpdated();
  }

  close() {
    this.clearExpiry();
    this.windowManager.closeReminderPopup();
  }

  reset() {
    this.clearExpiry();
    this.queue = [];
    this.windowManager.closeReminderPopup();
  }

  dispose() {
    this.clearExpiry();
    this.queue = [];
    this.windowManager.closeReminderPopup();
  }
}

module.exports = ReminderPopupPresenter;
