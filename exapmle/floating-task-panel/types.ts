export type TaskStatus = 'todo' | 'doing' | 'done' | 'paused';

export type Category = 'today' | 'planned' | 'doing' | 'paused' | 'all' | 'inbox' | 'completed';

export interface SubTask {
  id: string;
  content: string;
  completed: boolean;
}

export interface Task {
  id: string;
  content: string;
  status: TaskStatus;
  createdAt: string;
  completedAt?: string;
  startedAt?: string; // For tracking duration
  totalDuration?: number; // In milliseconds
  reminderTime?: string; // ISO date string
  subtasks?: SubTask[];
}

export interface CategoryOption {
  value: Category;
  label: string;
  iconName: string;
  count: number;
}