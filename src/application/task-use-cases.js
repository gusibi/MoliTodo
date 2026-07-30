class TaskUseCases {
  constructor({ taskService, listService, notificationService, onReminder }) {
    this.taskService = taskService;
    this.listService = listService;
    this.notificationService = notificationService;
    this.onReminder = onReminder;
  }

  async listProjects() {
    const lists = await this.listService.getAllLists();
    return lists.map((list) => list.toJSON());
  }

  async listTasks(filters = {}) {
    const { status, listId, category, query, includeCompleted = false } = filters;
    let tasks;

    if (query) {
      tasks = await this.taskService.searchTasks(query, listId ?? null);
    } else if (category) {
      tasks = await this.taskService.getTasksByCategory(category, listId ?? null);
    } else if (listId !== null && listId !== undefined) {
      tasks = await this.taskService.getTasksByListId(listId);
    } else if (includeCompleted) {
      tasks = await this.taskService.getAllTasks();
    } else {
      tasks = await this.taskService.getIncompleteTasks();
    }

    if (status) {
      tasks = tasks.filter((task) => task.status === status);
    }

    return tasks.map((task) => this.serializeTask(task));
  }

  async getTask(taskId) {
    const task = await this.taskService.getTaskById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }
    return this.serializeTask(task);
  }

  async createTask(input = {}) {
    const listId = this.parseListId(input.listId ?? 0);
    await this.ensureProjectExists(listId);
    const reminderTime = this.parseReminderTime(input.reminderTime);
    const taskData = {
      metadata: input.metadata || {},
      recurrence: input.recurrence || null,
      dueDate: input.dueDate ?? null,
      dueTime: input.dueTime ?? null
    };
    const task = await this.taskService.createTaskInList(
      input.content,
      listId,
      reminderTime,
      taskData
    );
    this.scheduleReminder(task);
    return this.serializeTask(task);
  }

  async updateTask(taskId, updates = {}) {
    const normalized = { ...updates };
    if (updates.listId !== undefined) {
      normalized.listId = this.parseListId(updates.listId);
      await this.ensureProjectExists(normalized.listId);
    }
    if (updates.reminderTime !== undefined) {
      normalized.reminderTime = this.parseReminderTime(updates.reminderTime);
    }

    const task = await this.taskService.updateTask(taskId, normalized);
    if (updates.reminderTime !== undefined) {
      this.notificationService.cancelTaskReminder(taskId);
      this.scheduleReminder(task);
    }
    return this.serializeTask(task);
  }

  async startTask(taskId) {
    return this.serializeTask(await this.taskService.startTask(taskId));
  }

  async stopTask(taskId) {
    return this.serializeTask(await this.taskService.pauseTask(taskId));
  }

  async completeTask(taskId) {
    const task = await this.taskService.completeTask(taskId);
    this.notificationService.cancelTaskReminder(taskId);
    return this.serializeTask(task);
  }

  async deleteTask(taskId) {
    const success = await this.taskService.deleteTask(taskId);
    this.notificationService.cancelTaskReminder(taskId);
    return { success };
  }

  async ensureProjectExists(listId) {
    let list = await this.listService.getListById(listId);
    if (!list && listId === 0) {
      const lists = await this.listService.getAllLists();
      list = lists.find((candidate) => candidate.id === 0);
    }
    if (!list) {
      throw new Error(`项目不存在: ${listId}`);
    }
  }

  parseListId(value) {
    const listId = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(listId) || listId < 0) {
      throw new Error('project_id/listId 必须是非负整数');
    }
    return listId;
  }

  parseReminderTime(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const reminderTime = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(reminderTime.getTime())) {
      throw new Error('reminderTime 必须是合法的 ISO 8601 时间');
    }
    return reminderTime;
  }

  scheduleReminder(task) {
    if (task.reminderTime) {
      this.notificationService.scheduleTaskReminder(task, this.onReminder);
    }
  }

  serializeTask(task) {
    return {
      id: task.id,
      content: task.content,
      status: task.status,
      completed: task.completed,
      createdAt: this.toIso(task.createdAt),
      updatedAt: this.toIso(task.updatedAt),
      reminderTime: this.toIso(task.reminderTime),
      startedAt: this.toIso(task.startedAt),
      completedAt: this.toIso(task.completedAt),
      totalDuration: task.totalDuration,
      listId: task.listId,
      metadata: task.metadata,
      recurrence: task.recurrence,
      seriesId: task.seriesId,
      occurrenceDate: task.occurrenceDate,
      dueDate: task.dueDate,
      dueTime: task.dueTime
    };
  }

  toIso(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
}

module.exports = TaskUseCases;
