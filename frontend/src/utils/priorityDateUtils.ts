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
  critical: {
    label: 'Critical',
    color: '#d14d41',
    bg: 'rgba(209, 77, 65, 0.16)',
    borderColor: 'rgba(209, 77, 65, 0.45)',
    icon: '🔴',
    weight: 4,
  },
  high: {
    label: 'High',
    color: '#b84a58',
    bg: 'rgba(184, 74, 88, 0.16)',
    borderColor: 'rgba(184, 74, 88, 0.45)',
    icon: '🔺',
    weight: 3,
  },
  medium: {
    label: 'Medium',
    color: '#4d84e2',
    bg: 'rgba(77, 132, 226, 0.16)',
    borderColor: 'rgba(77, 132, 226, 0.45)',
    icon: '🔵',
    weight: 2,
  },
  low: {
    label: 'Low',
    color: '#567568',
    bg: 'rgba(86, 117, 104, 0.16)',
    borderColor: 'rgba(86, 117, 104, 0.45)',
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

export function normalizePriority(p?: string | null): PriorityLevel {
  if (!p) return 'medium';
  const lower = p.toLowerCase();
  if (lower === 'urgent' || lower === 'critical') return 'critical';
  if (lower === 'high') return 'high';
  if (lower === 'low') return 'low';
  return 'medium';
}

export function matchesPriorityFilter(taskPriority: PriorityLevel | undefined, filter: string): boolean {
  if (!filter || filter === 'all' || filter === 'ALL') return true;
  return normalizePriority(taskPriority) === normalizePriority(filter);
}
