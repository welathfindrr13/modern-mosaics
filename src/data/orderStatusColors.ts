import { UIStatus } from '@/utils/statusMapper';

/**
 * Color mapping for UI order statuses
 * Used for displaying status badges in the UI
 */
export const orderStatusColors: Record<UIStatus, {
  bg: string;
  text: string;
  border: string;
  icon: string;
}> = {
  received: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-200',
    icon: 'text-yellow-500'
  },
  queued: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-200',
    icon: 'text-blue-500'
  },
  production: {
    bg: 'bg-indigo-100',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
    icon: 'text-indigo-500'
  },
  shipped: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-200',
    icon: 'text-purple-500'
  },
  delivered: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-200',
    icon: 'text-green-500'
  },
  cancelled: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-200',
    icon: 'text-red-500'
  },
  issue: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-200',
    icon: 'text-red-500'
  }
};

/**
 * Get status colors with fallback
 */
export function getStatusColors(uiStatus: UIStatus) {
  return orderStatusColors[uiStatus] || {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    border: 'border-gray-200',
    icon: 'text-gray-500'
  };
}

/**
 * Get tracking URL for a Gelato order
 * @param orderId Gelato order ID
 * @returns URL to Gelato's tracking page
 */
export function getTrackingUrl(orderId: string): string {
  return `https://dashboard.gelato.com/orders/${orderId}`;
}
