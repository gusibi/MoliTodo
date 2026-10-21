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

  async unlockMilestones(definitionIds, unlockedAt, definitionVersion = null) {
    for (const definitionId of definitionIds) {
      await this.db.run(
        `INSERT OR IGNORE INTO milestone_unlocks (
          definition_id, unlocked_at, claim_status, definition_version
        ) VALUES (?, ?, 'pending', ?)`,
        [definitionId, unlockedAt, definitionVersion]
      );
    }
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
