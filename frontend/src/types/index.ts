export interface Task {
  id: string;
  title: string;
  description: string;
  columnId?: string;
  originalColumnId?: string | null;
  originalColumnTitle?: string | null;
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
