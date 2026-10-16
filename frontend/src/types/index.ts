export interface Label {
  id: number;
  board_id: number;
  name: string;
  color: string;
  created_at?: string;
}

export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';
export type DueDateFilter = 'all' | 'overdue' | 'today' | 'week' | 'has_date' | 'no_date';

export interface Task {
  id: string;
  title: string;
  description: string;
  columnId?: string;
  originalColumnId?: string | null;
  originalColumnTitle?: string | null;
  labels?: Label[];
  priority?: PriorityLevel;
  dueDate?: string | null;
}

export type SelectedTask = Task | { isNew: true; columnId: string } | null;

export interface HistoryItem {
  id: number;
  task_id: number;
  user_id: number;
  username: string;
  change_type: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface Column {
  id: string;
  title: string;
  tasks: Task[];
}

export type ViewMode = 'board' | 'list' | 'table';

