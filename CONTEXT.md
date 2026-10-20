# MoliTodo

MoliTodo 是一款以 Task 为核心的桌面待办应用，并通过独立的健康提醒、番茄专注和 Moli 小院提供辅助与成长反馈。

## Core

**Task**：
一件需要完成的事务，具有完成状态与时间语义。
_Avoid_: Todo、reminder、habit

**List**：
一组 Task 的命名集合。
_Avoid_: Project、category、folder

**Tool**：
健康提醒、番茄专注和 Moli 小院的统称，不参与 Task 的完成语义。
_Avoid_: Feature、plugin、module

## Health reminders

**ReminderRule**：
一条长期健康提醒规则，定义提醒类型、间隔、有效星期与时段。
_Avoid_: Habit、recurring task、alarm

**ReminderOccurrence**：
ReminderRule 实际到期的一个实例，具有独立的响应状态。
_Avoid_: Notification、alert、reminder task

## Focus

**FocusSession**：
一次用户主动开始的专注计时，可选关联一个 Task，但不改变 Task 的完成状态。
_Avoid_: Pomodoro record、timer、task session

## Growth

**ActivityEvent**：
一次经用户确认的有效行为事实，是成长值与统计的追加记录。
_Avoid_: Log、action、click

**GrowthDay**：
一个满足有效行为门槛的本地自然日，用于连续与累计成长。
_Avoid_: Streak day、active day、usage day

**GrowthScore**：
一株植物累计获得的有效成长值。
_Avoid_: Points、XP、score

**WaterDrop**：
一次喝水确认带来的成长贡献。
_Avoid_: Water point、currency

**Sunlight**：
一次起身确认带来的成长贡献。
_Avoid_: Sun point、energy

**ActivePlant**：
当前正在生长的一株植物；同一时间只有一株。
_Avoid_: Daily plant、current crop

**PlantInstance**：
一次从种子到成熟的植物生长历史，成熟后成为收藏中的树。
_Avoid_: Tree record、harvest

**Seed**：
用于种植一株植物的消耗品，属于某个 Species。
_Avoid_: Seed item、inventory unit

**Species**：
一种植物种类；解锁后永久保留，并允许多次种植。
_Avoid_: Plant type、variety

## Rewards

**Milestone**：
一组行为条件达成后发放徽章与奖励的节点。
_Avoid_: Achievement、quest

**Badge**：
Milestone 或扩建达成后的永久成就标记。
_Avoid_: Medal、trophy

**RewardClaim**：
一次尚未领取或已经领取的自选奖励记录，只对应一个 Milestone 解锁。
_Avoid_: Reward、selection、choice

## Garden

**InventoryItem**：
用户拥有的一件可摆放物品，包括成熟树、家具、装饰、宠物和特殊树。
_Avoid_: Collection entry、possession、collectible

**GardenPlacement**：
一件 InventoryItem 在小院某个槽位中的摆放状态。
_Avoid_: Position、layout entry

**GardenLevel**：
小院当前已解锁的扩建等级，决定可用区域与容量。
_Avoid_: Expansion、tier

**Garden**：
用户拥有并布置的收藏空间，由场景、槽位和已摆放物品组成。
_Avoid_: Yard、farm

## Read models

**ShellSnapshot**：
侧栏、菜单栏和弹窗共用的轻量读模型，包含角标数量、专注摘要、今日资源和植物阶段。
_Avoid_: State、store、global state

**GardenView**：
Moli 小院页面使用的完整读模型，包含当前植物、种子、收藏、摆放和里程碑。
_Avoid_: Page state、garden state
