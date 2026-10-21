/**
 * 植物、种子、小院状态与里程碑资格仓储。
 * inventory_items 是成熟树等物品的唯一所有权记录。
 */
class SqliteGardenRepository {
  constructor(db) {
    this.db = db;
  }

  async ensureState(now) {
    await this.db.run(
      'INSERT OR IGNORE INTO garden_state (id, updated_at) VALUES (1, ?)',
      [now]
    );
  }

  async getState() {
    const row = await this.db.get('SELECT * FROM garden_state WHERE id = 1');
    return row ? this.rowToState(row) : null;
  }

  async setActivePlantId(plantId, now) {
    await this.db.run(
      'UPDATE garden_state SET active_plant_id = ?, updated_at = ? WHERE id = 1',
      [plantId, now]
    );
  }

  async updateGardenStats({
    currentStreak,
    longestStreak,
    totalGrowthDays,
    level,
    updatedAt
  }) {
    await this.db.run(
      `UPDATE garden_state SET
        current_streak = ?,
        longest_streak = ?,
        total_growth_days = ?,
        level = ?,
        updated_at = ?
      WHERE id = 1`,
      [currentStreak, longestStreak, totalGrowthDays, level, updatedAt]
    );
  }

  async getActivePlant() {
    const row = await this.db.get(
      `SELECT * FROM plant_instances
       WHERE status = 'growing'
       ORDER BY id DESC
       LIMIT 1`
    );
    return row ? this.rowToPlant(row) : null;
  }

  async getPlantById(plantId) {
    const row = await this.db.get('SELECT * FROM plant_instances WHERE id = ?', [plantId]);
    return row ? this.rowToPlant(row) : null;
  }

  async insertPlant({
    speciesId,
    growthScore = 0,
    stage = 'seed',
    plantedAt,
    maturedAt = null,
    status = 'growing',
    localDatePlanted
  }) {
    const result = await this.db.run(
      `INSERT INTO plant_instances (
        species_id, growth_score, stage, planted_at, matured_at, status, local_date_planted
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [speciesId, growthScore, stage, plantedAt, maturedAt, status, localDatePlanted]
    );
    return result.lastID;
  }

  async updatePlant({ id, growthScore, stage, status, maturedAt = null }) {
    await this.db.run(
      `UPDATE plant_instances SET
        growth_score = ?,
        stage = ?,
        status = ?,
        matured_at = ?
      WHERE id = ?`,
      [growthScore, stage, status, maturedAt, id]
    );
  }

  async getSeedQuantity(speciesId) {
    const row = await this.db.get(
      'SELECT quantity FROM seed_inventory WHERE species_id = ?',
      [speciesId]
    );
    return row ? row.quantity : 0;
  }

  async getSeedTotal() {
    const row = await this.db.get(
      'SELECT COALESCE(SUM(quantity), 0) AS total FROM seed_inventory'
    );
    return row ? row.total : 0;
  }

  async countPendingRewards() {
    const row = await this.db.get(`
      SELECT
        (SELECT COUNT(*) FROM milestone_unlocks WHERE claim_status = 'pending')
        + (
          SELECT COUNT(*) FROM reward_claims rc
          WHERE rc.claimed_at IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM milestone_unlocks mu
              WHERE mu.id = rc.unlock_id AND mu.claim_status = 'pending'
            )
        ) AS count
    `);
    return row ? row.count : 0;
  }

  async addSeeds(speciesId, quantity, now) {
    await this.db.run(
      `INSERT INTO seed_inventory (species_id, quantity, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(species_id) DO UPDATE SET
         quantity = seed_inventory.quantity + excluded.quantity,
         updated_at = excluded.updated_at`,
      [speciesId, quantity, now]
    );
  }

  async consumeSeed(speciesId, now) {
    const result = await this.db.run(
      `UPDATE seed_inventory SET quantity = quantity - 1, updated_at = ?
       WHERE species_id = ? AND quantity > 0`,
      [now, speciesId]
    );
    return result.changes > 0;
  }

  async addInventoryItem({
    catalogId,
    kind,
    quantity = 1,
    originType,
    originId,
    acquiredAt
  }) {
    const result = await this.db.run(
      `INSERT INTO inventory_items (
        catalog_id, kind, quantity, origin_type, origin_id, acquired_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [catalogId, kind, quantity, originType, String(originId), acquiredAt]
    );
    return result.lastID;
  }

  async listUnlockedMilestones() {
    const rows = await this.db.all(
      'SELECT definition_id FROM milestone_unlocks ORDER BY id ASC'
    );
    return rows.map((row) => row.definition_id);
  }

  async unlockMilestone({
    definitionId,
    unlockedAt,
    claimStatus = 'pending',
    definitionVersion = null
  }) {
    const result = await this.db.run(
      `INSERT OR IGNORE INTO milestone_unlocks (
        definition_id, unlocked_at, claim_status, definition_version
      ) VALUES (?, ?, ?, ?)`,
      [definitionId, unlockedAt, claimStatus, definitionVersion]
    );
    const row = await this.db.get(
      'SELECT * FROM milestone_unlocks WHERE definition_id = ?',
      [definitionId]
    );
    return {
      id: row.id,
      definitionId: row.definition_id,
      claimStatus: row.claim_status,
      created: result.changes > 0
    };
  }

  async createRewardClaim({ unlockId, createdAt }) {
    const result = await this.db.run(
      `INSERT OR IGNORE INTO reward_claims (
        unlock_id, selected_item_id, claimed_at, created_at
      ) VALUES (?, NULL, NULL, ?)`,
      [unlockId, createdAt]
    );
    const row = await this.db.get(
      'SELECT * FROM reward_claims WHERE unlock_id = ?',
      [unlockId]
    );
    return {
      id: row.id,
      unlockId: row.unlock_id,
      selectedItemId: row.selected_item_id,
      claimedAt: row.claimed_at,
      createdAt: row.created_at,
      created: result.changes > 0
    };
  }

  async findRewardClaimById(claimId) {
    const row = await this.db.get('SELECT * FROM reward_claims WHERE id = ?', [claimId]);
    return row ? this.rowToRewardClaim(row) : null;
  }

  async markRewardClaimClaimed({ id, selectedItemId, claimedAt }) {
    const result = await this.db.run(
      `UPDATE reward_claims
       SET selected_item_id = ?, claimed_at = ?
       WHERE id = ? AND claimed_at IS NULL`,
      [selectedItemId, claimedAt, id]
    );
    return result.changes > 0;
  }

  async markMilestoneClaimed(unlockId) {
    await this.db.run(
      "UPDATE milestone_unlocks SET claim_status = 'claimed' WHERE id = ?",
      [unlockId]
    );
  }

  async listOwnedCatalogIds() {
    const rows = await this.db.all(
      'SELECT catalog_id FROM inventory_items WHERE quantity > 0'
    );
    return rows.map((row) => row.catalog_id);
  }

  async listSeeds() {
    const rows = await this.db.all(
      `SELECT * FROM seed_inventory
       WHERE quantity > 0
       ORDER BY species_id ASC`
    );
    return rows.map((row) => ({
      speciesId: row.species_id,
      quantity: row.quantity,
      updatedAt: row.updated_at
    }));
  }

  async listSpeciesUnlocks() {
    const rows = await this.db.all(
      'SELECT * FROM species_unlocks ORDER BY species_id ASC'
    );
    return rows.map((row) => ({
      speciesId: row.species_id,
      unlockedAt: row.unlocked_at,
      source: row.source
    }));
  }

  async listInventoryItems() {
    const rows = await this.db.all(
      'SELECT * FROM inventory_items ORDER BY kind ASC, catalog_id ASC, id ASC'
    );
    return rows.map((row) => ({
      id: row.id,
      catalogId: row.catalog_id,
      kind: row.kind,
      quantity: row.quantity,
      originType: row.origin_type,
      originId: row.origin_id,
      acquiredAt: row.acquired_at
    }));
  }

  async findInventoryItemById(inventoryId) {
    const row = await this.db.get('SELECT * FROM inventory_items WHERE id = ?', [inventoryId]);
    return row
      ? {
          id: row.id,
          catalogId: row.catalog_id,
          kind: row.kind,
          quantity: row.quantity,
          originType: row.origin_type,
          originId: row.origin_id,
          acquiredAt: row.acquired_at
        }
      : null;
  }

  async listPlacements() {
    const rows = await this.db.all(
      'SELECT * FROM garden_placements ORDER BY region_id ASC, slot_id ASC'
    );
    return rows.map((row) => ({
      id: row.id,
      inventoryId: row.inventory_id,
      regionId: row.region_id,
      slotId: row.slot_id,
      visible: row.visible === 1,
      placedAt: row.placed_at
    }));
  }

  async findPlacementByInventoryId(inventoryId) {
    const row = await this.db.get(
      'SELECT * FROM garden_placements WHERE inventory_id = ?',
      [inventoryId]
    );
    return row
      ? {
          id: row.id,
          inventoryId: row.inventory_id,
          regionId: row.region_id,
          slotId: row.slot_id,
          visible: row.visible === 1,
          placedAt: row.placed_at
        }
      : null;
  }

  async findPlacementBySlot(regionId, slotId) {
    const row = await this.db.get(
      'SELECT * FROM garden_placements WHERE region_id = ? AND slot_id = ?',
      [regionId, slotId]
    );
    return row
      ? {
          id: row.id,
          inventoryId: row.inventory_id,
          regionId: row.region_id,
          slotId: row.slot_id,
          visible: row.visible === 1,
          placedAt: row.placed_at
        }
      : null;
  }

  async addPlacement({ inventoryId, regionId, slotId, visible = 1, placedAt }) {
    const result = await this.db.run(
      `INSERT INTO garden_placements (
        inventory_id, region_id, slot_id, visible, placed_at
      ) VALUES (?, ?, ?, ?, ?)`,
      [inventoryId, regionId, slotId, visible, placedAt]
    );
    const row = await this.db.get(
      'SELECT * FROM garden_placements WHERE id = ?',
      [result.lastID]
    );
    return {
      id: row.id,
      inventoryId: row.inventory_id,
      regionId: row.region_id,
      slotId: row.slot_id,
      visible: row.visible === 1,
      placedAt: row.placed_at
    };
  }

  async removePlacement(inventoryId) {
    const result = await this.db.run(
      'DELETE FROM garden_placements WHERE inventory_id = ?',
      [inventoryId]
    );
    return result.changes > 0;
  }

  async listMilestoneUnlocks() {
    const rows = await this.db.all(
      'SELECT * FROM milestone_unlocks ORDER BY id ASC'
    );
    return rows.map((row) => ({
      id: row.id,
      definitionId: row.definition_id,
      unlockedAt: row.unlocked_at,
      claimStatus: row.claim_status,
      definitionVersion: row.definition_version
    }));
  }

  async listExpansions() {
    const rows = await this.db.all(
      'SELECT * FROM garden_expansions ORDER BY level ASC'
    );
    return rows.map((row) => ({
      level: row.level,
      unlockedAt: row.unlocked_at,
      conditionType: row.condition_type
    }));
  }

  async listRewardClaims() {
    const rows = await this.db.all(
      'SELECT * FROM reward_claims ORDER BY id ASC'
    );
    return rows.map((row) => this.rowToRewardClaim(row));
  }

  async addStackableInventoryItem({
    catalogId,
    kind,
    quantity = 1,
    originType,
    originId,
    acquiredAt
  }) {
    await this.db.run(
      `INSERT INTO inventory_items (
        catalog_id, kind, quantity, origin_type, origin_id, acquired_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(origin_type, origin_id) DO UPDATE SET
        quantity = inventory_items.quantity + excluded.quantity`,
      [catalogId, kind, quantity, originType, String(originId), acquiredAt]
    );
  }

  async unlockSpecies({ speciesId, unlockedAt, source }) {
    const result = await this.db.run(
      `INSERT OR IGNORE INTO species_unlocks (species_id, unlocked_at, source)
       VALUES (?, ?, ?)`,
      [speciesId, unlockedAt, source]
    );
    return result.changes > 0;
  }

  async hasSpeciesUnlock(speciesId) {
    const row = await this.db.get(
      'SELECT 1 AS found FROM species_unlocks WHERE species_id = ?',
      [speciesId]
    );
    return Boolean(row);
  }

  async unlockExpansion({ level, unlockedAt, conditionType }) {
    const result = await this.db.run(
      `INSERT OR IGNORE INTO garden_expansions (level, unlocked_at, condition_type)
       VALUES (?, ?, ?)`,
      [level, unlockedAt, conditionType]
    );
    return result.changes > 0;
  }

  async addInventoryItemIfAbsent({
    catalogId,
    kind,
    quantity = 1,
    originType,
    originId,
    acquiredAt
  }) {
    const result = await this.db.run(
      `INSERT OR IGNORE INTO inventory_items (
        catalog_id, kind, quantity, origin_type, origin_id, acquired_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [catalogId, kind, quantity, originType, String(originId), acquiredAt]
    );
    return result.changes > 0;
  }

  rowToPlant(row) {
    return {
      id: row.id,
      speciesId: row.species_id,
      growthScore: row.growth_score,
      stage: row.stage,
      plantedAt: row.planted_at,
      maturedAt: row.matured_at,
      status: row.status,
      localDatePlanted: row.local_date_planted
    };
  }

  rowToRewardClaim(row) {
    return {
      id: row.id,
      unlockId: row.unlock_id,
      selectedItemId: row.selected_item_id,
      claimedAt: row.claimed_at,
      createdAt: row.created_at
    };
  }

  rowToState(row) {
    return {
      id: row.id,
      currentStreak: row.current_streak,
      longestStreak: row.longest_streak,
      totalGrowthDays: row.total_growth_days,
      level: row.level,
      activePlantId: row.active_plant_id,
      autoPlant: row.auto_plant,
      updatedAt: row.updated_at
    };
  }
}

module.exports = SqliteGardenRepository;
