/**
 * 工具域轻量读模型。
 * ShellSnapshot 供侧栏、菜单栏和提醒弹窗共用；本阶段只读取，不写入。
 */
class ToolsReadModel {
  constructor({ clock, activityRepository, gardenRepository }) {
    this.clock = clock;
    this.activityRepository = activityRepository;
    this.gardenRepository = gardenRepository;
  }

  async getShellSnapshot(now = this.clock.now()) {
    const instant = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(instant.getTime())) {
      throw new TypeError('now 不是有效时间');
    }

    const localDate = this.clock.localDate(instant);
    const [daily, plant, gardenState, seedCount, pendingRewards] = await Promise.all([
      this.activityRepository.getDailySummary(localDate),
      this.gardenRepository.getActivePlant(),
      this.gardenRepository.getState(),
      this.gardenRepository.getSeedTotal(),
      this.gardenRepository.countPendingRewards()
    ]);

    return {
      generatedAt: instant.toISOString(),
      localDate,
      badges: {
        pendingRewards
      },
      // 专注模块尚未实现，避免返回伪造的计时状态。
      focus: null,
      today: {
        focusCount: daily ? daily.focusCount : 0,
        waterCount: daily ? daily.waterCount : 0,
        sunCount: daily ? daily.sunCount : 0,
        totalGrowth: daily ? daily.totalGrowth : 0
      },
      plant: plant
        ? {
            id: plant.id,
            speciesId: plant.speciesId,
            stage: plant.stage,
            growthScore: plant.growthScore,
            status: plant.status
          }
        : null,
      garden: {
        level: gardenState ? gardenState.level : 1,
        seedCount,
        autoPlant: gardenState ? gardenState.autoPlant === 1 : true
      }
    };
  }
}

module.exports = ToolsReadModel;
