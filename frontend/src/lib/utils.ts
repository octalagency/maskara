import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'BDT') {
  return new Intl.NumberFormat('bn-BD', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('bn-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}

export function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    PENDING: 'badge-warning',
    CALLING: 'badge-info',
    VERIFIED: 'badge-success',
    CANCELLED: 'badge-danger',
    FAILED: 'badge-danger',
    ESCALATED: 'badge-info',
    COMPLETED: 'badge-success',
    NO_ANSWER: 'badge-warning',
  };
  return map[status] || 'badge-info';
}
