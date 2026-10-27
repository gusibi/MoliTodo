/**
 * 提醒弹窗适配器。
 * 维护最多 3 条 PopupIntent，弹窗保持显示直到用户确认、稍后或跳过；
 * 真正的窗口由 WindowManager 创建。
 */
class ReminderPopupPresenter {
  constructor({
    windowManager,
    reminderUseCases,
    clock,
    maxQueue = 3,
    onUpdated = () => {},
    onShown = () => {}
  }) {
    this.windowManager = windowManager;
    this.reminderUseCases = reminderUseCases;
    this.clock = clock;
    this.maxQueue = maxQueue;
    this.onUpdated = onUpdated;
    this.onShown = onShown;
    this.queue = [];
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
    this.onShown();
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

  close() {
    this.windowManager.closeReminderPopup();
  }

  reset() {
    this.queue = [];
    this.windowManager.closeReminderPopup();
  }

  dispose() {
    this.queue = [];
    this.windowManager.closeReminderPopup();
  }
}

module.exports = ReminderPopupPresenter;
