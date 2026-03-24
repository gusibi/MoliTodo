import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTaskStore } from '../store/taskStore';
import { 
  CalendarDayIcon, CalendarWeekIcon, PlayCircleIcon, 
  PauseCircleIcon, ListIcon, InboxIcon, CheckCircleIcon,
  ChevronDownIcon, PinIcon, PlusIcon, ClockIcon, TrashIcon
} from './Icons';
import { Category, Task, TaskStatus } from '../types';

// Utility for duration formatting
const formatDuration = (ms: number) => {
  if (ms < 1000) return '0s';
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

// Utility for time formatting
const formatTime = (isoString: string) => {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const CATEGORIES = [
  { value: 'today', label: 'Today', icon: CalendarDayIcon },
  { value: 'planned', label: 'Planned', icon: CalendarWeekIcon },
  { value: 'doing', label: 'Doing', icon: PlayCircleIcon },
  { value: 'paused', label: 'Paused', icon: PauseCircleIcon },
  { value: 'all', label: 'All', icon: ListIcon },
  { value: 'inbox', label: 'Inbox', icon: InboxIcon },
  { value: 'completed', label: 'Completed', icon: CheckCircleIcon }
];

const TaskPanel: React.FC = () => {
  const { addTask, updateTask, deleteTask, cycleStatus, getFilteredTasks, getStats } = useTaskStore();
  
  // Local State
  const [selectedCategory, setSelectedCategory] = useState<Category>('today');
  const [isPinned, setIsPinned] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [newTaskContent, setNewTaskContent] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  
  // Refs
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Derived State
  const tasks = getFilteredTasks(selectedCategory);
  const stats = getStats();

  // Effects
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handlers
  const handleAddTask = () => {
    if (!newTaskContent.trim()) return;
    addTask(newTaskContent.trim());
    setNewTaskContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAddTask();
  };

  const startEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setEditContent(task.content);
  };

  const saveEdit = (id: string) => {
    if (editContent.trim()) {
      updateTask(id, { content: editContent.trim() });
    }
    setEditingTaskId(null);
  };

  const cancelEdit = () => {
    setEditingTaskId(null);
  };

  const getCurrentCategoryIcon = () => {
    const cat = CATEGORIES.find(c => c.value === selectedCategory);
    const Icon = cat ? cat.icon : CalendarDayIcon;
    return <Icon className="w-4 h-4 text-slate-500" />;
  };

  const getCurrentCategoryLabel = () => {
    return CATEGORIES.find(c => c.value === selectedCategory)?.label || 'Unknown';
  };

  // Status Styling Logic
  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'doing': return 'bg-blue-500 border-blue-500 text-white';
      case 'done': return 'bg-green-500 border-green-500 text-white';
      case 'paused': return 'bg-amber-100 border-amber-300 text-amber-600';
      default: return 'bg-transparent border-slate-300 text-transparent hover:border-blue-400';
    }
  };

  return (
    <div className={`
      relative flex flex-col w-[380px] h-[600px] 
      bg-slate-50/95 backdrop-blur-xl 
      rounded-2xl shadow-2xl overflow-hidden
      border border-white/50
      transition-all duration-300 ease-in-out
    `}>
      {/* --- Header --- */}
      <div 
        className={`
          flex items-center justify-between px-4 py-3 
          bg-white/60 border-b border-slate-200/50 backdrop-blur-sm
          ${isPinned ? 'cursor-move' : ''}
        `}
      >
        {/* Dropdown Trigger */}
        <div 
          className="relative" 
          ref={dropdownRef}
        >
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-200/50 transition-colors group"
          >
            {getCurrentCategoryIcon()}
            <span className="font-semibold text-sm text-slate-700">{getCurrentCategoryLabel()}</span>
            <span className="text-xs px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded-full font-medium">
              {tasks.length}
            </span>
            <ChevronDownIcon className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const isActive = selectedCategory === cat.value;
                return (
                  <button
                    key={cat.value}
                    onClick={() => {
                      setSelectedCategory(cat.value as Category);
                      setIsDropdownOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                      ${isActive ? 'bg-blue-50 text-blue-600 font-medium' : 'text-slate-600 hover:bg-slate-50'}
                    `}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-500' : 'text-slate-400'}`} />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Pin Button */}
        <button 
          onClick={() => setIsPinned(!isPinned)}
          className={`
            p-2 rounded-lg transition-all duration-200
            ${isPinned ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}
          `}
          title={isPinned ? "Unpin panel" : "Pin panel"}
        >
          <PinIcon filled={isPinned} className="w-4 h-4" />
        </button>
      </div>

      {/* --- Quick Add --- */}
      <div className="px-4 py-3 bg-white/40">
        <div className="relative group">
          <input
            ref={inputRef}
            type="text"
            value={newTaskContent}
            onChange={(e) => setNewTaskContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a new task..."
            className="
              w-full pl-4 pr-10 py-2.5 
              bg-white border border-slate-200 rounded-xl
              text-sm text-slate-700 placeholder:text-slate-400
              focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
              shadow-sm transition-all
            "
          />
          <button 
            onClick={handleAddTask}
            className={`
              absolute right-2 top-1/2 -translate-y-1/2 
              p-1.5 rounded-lg
              transition-all duration-200
              ${newTaskContent.trim() ? 'bg-blue-500 text-white shadow-md' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'}
            `}
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* --- Task List --- */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 custom-scrollbar">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
            <CheckCircleIcon className="w-12 h-12 mb-3 stroke-1" />
            <p className="text-sm font-medium">No tasks found</p>
          </div>
        ) : (
          tasks.map(task => {
            const isDone = task.status === 'done';
            const isDoing = task.status === 'doing';
            const isEditing = editingTaskId === task.id;

            return (
              <div 
                key={task.id}
                className={`
                  group relative flex flex-col p-3
                  bg-white rounded-xl border transition-all duration-200
                  ${isDoing ? 'border-blue-200 shadow-md shadow-blue-500/5' : 'border-slate-100 shadow-sm hover:border-slate-200 hover:shadow-md'}
                  ${isDone ? 'opacity-70 bg-slate-50' : ''}
                `}
              >
                {/* Main Row */}
                <div className="flex items-start gap-3">
                  {/* Status Checkbox */}
                  <button 
                    onClick={() => cycleStatus(task.id)}
                    className={`
                      mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center
                      transition-all duration-200
                      ${getStatusColor(task.status)}
                    `}
                  >
                    {isDone && <CheckCircleIcon className="w-3.5 h-3.5" />}
                    {isDoing && <div className="w-2 h-2 bg-white rounded-full animate-pulse" />}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input 
                        autoFocus
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        onBlur={() => saveEdit(task.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveEdit(task.id);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        className="w-full text-sm bg-transparent border-b border-blue-500 focus:outline-none pb-0.5"
                      />
                    ) : (
                      <div 
                        onDoubleClick={() => startEdit(task)}
                        className={`
                          text-sm leading-relaxed cursor-text truncate
                          ${isDone ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-700'}
                          ${isDoing ? 'font-medium text-slate-800' : ''}
                        `}
                      >
                        {task.content}
                      </div>
                    )}

                    {/* Meta Row */}
                    <div className="flex items-center gap-3 mt-1.5 h-4">
                      {/* Reminder */}
                      {task.reminderTime && !isDone && (
                        <div className={`flex items-center gap-1 text-xs ${new Date(task.reminderTime) < new Date() ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                          <ClockIcon className="w-3 h-3" />
                          <span>{formatTime(task.reminderTime)}</span>
                        </div>
                      )}

                      {/* Duration */}
                      {isDoing && (
                         <div className="flex items-center gap-1 text-xs text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded-full">
                           <PlayCircleIcon className="w-3 h-3" />
                           {/* In a real app, this value would tick */}
                           <span>In Progress</span>
                         </div>
                      )}
                      
                      {/* Subtasks Indicator (Simulated) */}
                      {task.subtasks && task.subtasks.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                           <ListIcon className="w-3 h-3" />
                           <span>{task.subtasks.filter(st => st.completed).length}/{task.subtasks.length}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hover Actions */}
                  <div className="
                    opacity-0 group-hover:opacity-100 
                    transition-opacity duration-200 
                    flex items-center gap-1
                  ">
                    {isDoing && (
                       <button 
                        onClick={() => cycleStatus(task.id)} 
                        className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-md transition-colors"
                        title="Pause"
                      >
                         <PauseCircleIcon className="w-3.5 h-3.5" />
                       </button>
                    )}
                    <button 
                      onClick={() => deleteTask(task.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Subtasks (Only render if there are incomplete ones and task is active) */}
                {task.subtasks && !isDone && (
                  <div className="mt-2 pl-8 space-y-1">
                    {task.subtasks.filter(st => !st.completed).map(st => (
                      <div key={st.id} className="flex items-center gap-2 text-xs text-slate-500 group/sub">
                        <div className="w-3 h-3 border rounded-full border-slate-300 cursor-pointer hover:border-blue-400" />
                        <span>{st.content}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* --- Footer --- */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-400">
        <span className="hover:text-slate-600 cursor-pointer transition-colors">
          {stats.completed}/{stats.total} completed
        </span>
        <span className="hover:text-slate-600 cursor-pointer transition-colors">
          Open Task Manager
        </span>
      </div>
    </div>
  );
};

export default TaskPanel;