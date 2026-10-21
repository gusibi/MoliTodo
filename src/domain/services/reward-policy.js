/**
 * 里程碑奖励定义解析（纯函数）。
 * 只描述奖励类型，不写入数据库，也不处理领取界面。
 */

const REWARD_TYPES = Object.freeze({
  ITEM_CHOICE: 'item-choice',
  SPECIES: 'species'
});

function getMilestoneReward(definition) {
  if (!definition || !definition.reward || !definition.reward.type) {
    throw new Error('里程碑缺少奖励定义');
  }
  const reward = definition.reward;
  if (reward.type !== REWARD_TYPES.ITEM_CHOICE && reward.type !== REWARD_TYPES.SPECIES) {
    throw new Error(`未知里程碑奖励类型: ${reward.type}`);
  }
  if (reward.type === REWARD_TYPES.SPECIES && !reward.speciesId) {
    throw new Error('物种奖励缺少 speciesId');
  }
  return reward;
}

function getMilestoneClaimStatus(definition) {
  const reward = getMilestoneReward(definition);
  return reward.type === REWARD_TYPES.ITEM_CHOICE ? 'pending' : 'granted';
}

module.exports = {
  REWARD_TYPES,
  getMilestoneReward,
  getMilestoneClaimStatus
};
