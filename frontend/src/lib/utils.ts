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
    MANUAL_COMPLETE: 'badge-info',
  };
  return map[status] || 'badge-info';
}

export function orderStatusLabel(order: {
  status: string;
  manualComplete?: boolean;
  metadata?: Record<string, unknown> | null;
}) {
  const meta = order.metadata || {};
  const fromShopIn =
    meta.provider === 'shopin' ||
    meta.shopInStatus != null ||
    String(meta.manualCompleteFromWebsiteSource || '').includes('shopin');

  if (order.manualComplete || meta.manualCompleteFromWebsite === true) {
    return fromShopIn ? 'Manual Confirm (ShopIn)' : 'Manual Complete';
  }
  if (order.status === 'CANCELLED' && meta.cancelledFromWebsite === true) {
    return fromShopIn ? 'Cancelled (ShopIn)' : 'Cancelled (Website)';
  }
  return order.status;
}
