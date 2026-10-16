import { PriorityLevel, DueDateFilter } from '../types';

export interface PriorityMeta {
  label: string;
  color: string;
  bg: string;
  borderColor: string;
  icon: string;
  weight: number;
}

export const PRIORITY_CONFIG: Record<PriorityLevel, PriorityMeta> = {
  urgent: {
    label: 'Urgent',
    color: '#cf4f44',
    bg: 'rgba(207, 79, 68, 0.16)',
    borderColor: 'rgba(207, 79, 68, 0.45)',
    icon: '🔴',
    weight: 4,
  },
  high: {
    label: 'High',
    color: '#e59a52',
    bg: 'rgba(229, 154, 82, 0.16)',
    borderColor: 'rgba(229, 154, 82, 0.45)',
    icon: '🟠',
    weight: 3,
  },
  medium: {
    label: 'Medium',
    color: '#5b82c4',
    bg: 'rgba(91, 130, 196, 0.16)',
    borderColor: 'rgba(91, 130, 196, 0.45)',
    icon: '🟡',
    weight: 2,
  },
  low: {
    label: 'Low',
    color: '#6ba87e',
    bg: 'rgba(107, 168, 126, 0.16)',
    borderColor: 'rgba(107, 168, 126, 0.45)',
    icon: '🟢',
    weight: 1,
  },
};

export interface DueDateInfo {
  status: 'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'none';
  isOverdue: boolean;
  badgeText: string;
  fullText: string;
  rawDate: string | null;
  daysDiff: number;
}

export function parseLocalDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length < 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  return new Date(y, m, d);
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function getDueDateInfo(dueDateStr: string | null | undefined): DueDateInfo {
  if (!dueDateStr) {
    return {
      status: 'none',
      isOverdue: false,
      badgeText: '',
      fullText: '',
      rawDate: null,
      daysDiff: 0,
    };
  }

  const dueDate = parseLocalDate(dueDateStr);
  if (!dueDate || isNaN(dueDate.getTime())) {
    return {
      status: 'none',
      isOverdue: false,
      badgeText: '',
      fullText: '',
      rawDate: null,
      daysDiff: 0,
    };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffTime = dueDate.getTime() - today.getTime();
  const daysDiff = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const shortDate = formatShortDate(dueDate);

  if (daysDiff < 0) {
    return {
      status: 'overdue',
      isOverdue: true,
      badgeText: `Overdue (${shortDate})`,
      fullText: `Overdue by ${Math.abs(daysDiff)} day${Math.abs(daysDiff) > 1 ? 's' : ''} (${shortDate})`,
      rawDate: dueDateStr,
      daysDiff,
    };
  } else if (daysDiff === 0) {
    return {
      status: 'today',
      isOverdue: false,
      badgeText: 'Due Today',
      fullText: 'Due Today',
      rawDate: dueDateStr,
      daysDiff: 0,
    };
  } else if (daysDiff === 1) {
    return {
      status: 'tomorrow',
      isOverdue: false,
      badgeText: 'Tomorrow',
      fullText: 'Due Tomorrow',
      rawDate: dueDateStr,
      daysDiff: 1,
    };
  } else {
    return {
      status: 'upcoming',
      isOverdue: false,
      badgeText: shortDate,
      fullText: `Due ${shortDate}`,
      rawDate: dueDateStr,
      daysDiff,
    };
  }
}

export function matchesDueDateFilter(dueDateStr: string | null | undefined, filter: DueDateFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'no_date') return !dueDateStr;
  if (filter === 'has_date') return Boolean(dueDateStr);

  const info = getDueDateInfo(dueDateStr);
  if (info.status === 'none') return false;

  if (filter === 'overdue') return info.status === 'overdue';
  if (filter === 'today') return info.status === 'today';
  if (filter === 'week') {
    return info.status === 'today' || info.status === 'tomorrow' || (info.daysDiff > 0 && info.daysDiff <= 7);
  }

  return true;
}

export function matchesPriorityFilter(taskPriority: PriorityLevel | undefined, filter: string): boolean {
  if (!filter || filter === 'all' || filter === 'ALL') return true;
  const current = taskPriority || 'medium';
  return current.toLowerCase() === filter.toLowerCase();
}
