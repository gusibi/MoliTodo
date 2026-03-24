import { useState, useMemo } from 'react';
import { Task, TaskStatus, Category } from '../types';

const INITIAL_TASKS: Task[] = [
  {
    id: '1',
    content: 'Review designs with product team',
    status: 'doing',
    createdAt: new Date().toISOString(),
    startedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    totalDuration: 0,
    reminderTime: new Date(Date.now() + 7200000).toISOString(),
    subtasks: [
      { id: 'st1', content: 'Check typography', completed: true },
      { id: 'st2', content: 'Review color palette', completed: false }
    ]
  },
  {
    id: '2',
    content: 'Implement floating panel component',
    status: 'todo',
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    content: 'Update documentation',
    status: 'done',
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  },
  {
    id: '4',
    content: 'Fix scrollbar bug in dark mode',
    status: 'paused',
    createdAt: new Date().toISOString(),
    totalDuration: 1500000,
  }
];

export const useTaskStore = () => {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [currentListId] = useState('default');

  const addTask = (content: string) => {
    const newTask: Task = {
      id: Date.now().toString(),
      content,
      status: 'todo',
      createdAt: new Date().toISOString(),
    };
    setTasks(prev => [newTask, ...prev]);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const cycleStatus = (id: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id !== id) return task;
      
      const map: Record<TaskStatus, TaskStatus> = {
        'todo': 'doing',
        'doing': 'done',
        'done': 'todo',
        'paused': 'doing'
      };
      
      const newStatus = map[task.status];
      const updates: Partial<Task> = { status: newStatus };
      
      if (newStatus === 'doing') updates.startedAt = new Date().toISOString();
      if (newStatus === 'done') updates.completedAt = new Date().toISOString();
      if (task.status === 'doing' && newStatus !== 'doing') {
        // Simple duration calculation logic for demo
        const sessionDuration = Date.now() - new Date(task.startedAt!).getTime();
        updates.totalDuration = (task.totalDuration || 0) + sessionDuration;
        updates.startedAt = undefined;
      }

      return { ...task, ...updates };
    }));
  };

  const getFilteredTasks = (category: Category) => {
    let filtered = tasks;
    if (category === 'today') {
      // Mock logic: Show everything except completed for today
      filtered = tasks.filter(t => t.status !== 'done');
    } else if (category === 'completed') {
      filtered = tasks.filter(t => t.status === 'done');
    } else if (category === 'doing') {
      filtered = tasks.filter(t => t.status === 'doing');
    } else if (category === 'paused') {
      filtered = tasks.filter(t => t.status === 'paused');
    }
    // Sort: Doing first, then todo, then paused, then done
    return filtered.sort((a, b) => {
      const order = { doing: 0, todo: 1, paused: 2, done: 3 };
      return order[a.status] - order[b.status];
    });
  };

  const getStats = () => {
    const completed = tasks.filter(t => t.status === 'done').length;
    return { total: tasks.length, completed };
  };

  return {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    cycleStatus,
    getFilteredTasks,
    getStats,
    currentListId
  };
};