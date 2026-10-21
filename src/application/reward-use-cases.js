const {
  ITEM_CATALOG,
  FALLBACK_ITEM,
  getChoiceCandidates
} = require('../domain/services/item-catalog');
const { withTransaction } = require('../infrastructure/persistence/with-transaction');

/**
 * 物品自选奖励领取。
 * 每次领取前重新读取库存，保证多笔待领取不会重复发放同一样物品。
 */
class RewardUseCases {
  constructor({
    db,
    clock,
    gardenRepository,
    itemCatalog = ITEM_CATALOG,
    fallbackItem = FALLBACK_ITEM
  }) {
    this.db = db;
    this.clock = clock;
    this.gardenRepository = gardenRepository;
    this.itemCatalog = itemCatalog;
    this.fallbackItem = fallbackItem;
  }

  async getClaimOptions(claimId) {
    const claim = await this.gardenRepository.findRewardClaimById(claimId);
    if (!claim) {
      throw new Error('待领取奖励不存在');
    }
    const ownedIds = await this.gardenRepository.listOwnedCatalogIds();
    const { remaining, candidates } = getChoiceCandidates(ownedIds, {
      catalog: this.itemCatalog
    });

    return {
      claim,
      candidates,
      remainingCount: remaining.length,
      directItem: remaining.length === 1 ? remaining[0] : null,
      fallbackItem: remaining.length === 0 ? this.fallbackItem : null
    };
  }

  async claimReward(claimId, { selectedItemId = null } = {}, now = this.clock.now()) {
    const instant = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(instant.getTime())) {
      throw new TypeError('now 不是有效时间');
    }
    const nowIso = instant.toISOString();

    return withTransaction(this.db, async () => {
      const claim = await this.gardenRepository.findRewardClaimById(claimId);
      if (!claim) {
        throw new Error('待领取奖励不存在');
      }
      if (claim.claimedAt) {
        return { claimed: false, duplicate: true, claim };
      }

      const ownedIds = await this.gardenRepository.listOwnedCatalogIds();
      const { remaining, candidates } = getChoiceCandidates(ownedIds, {
        catalog: this.itemCatalog
      });

      let item;
      let fallback = false;
      if (remaining.length === 0) {
        item = this.fallbackItem;
        fallback = true;
      } else if (remaining.length === 1) {
        item = remaining[0];
      } else {
        item = candidates.find((candidate) => candidate.id === selectedItemId);
        if (!item) {
          throw new Error('请选择当前候选中的物品');
        }
      }

      const marked = await this.gardenRepository.markRewardClaimClaimed({
        id: claimId,
        selectedItemId: item.id,
        claimedAt: nowIso
      });
      if (!marked) {
        return {
          claimed: false,
          duplicate: true,
          claim: await this.gardenRepository.findRewardClaimById(claimId)
        };
      }

      if (fallback) {
        await this.gardenRepository.addStackableInventoryItem({
          catalogId: item.id,
          kind: item.kind,
          quantity: 1,
          originType: 'fallback',
          originId: item.id,
          acquiredAt: nowIso
        });
      } else {
        await this.gardenRepository.addInventoryItem({
          catalogId: item.id,
          kind: item.kind,
          quantity: 1,
          originType: 'reward_claim',
          originId: claimId,
          acquiredAt: nowIso
        });
      }

      await this.gardenRepository.markMilestoneClaimed(claim.unlockId);

      return {
        claimed: true,
        duplicate: false,
        claim: await this.gardenRepository.findRewardClaimById(claimId),
        item,
        fallback
      };
    });
  }
}

module.exports = RewardUseCases;
