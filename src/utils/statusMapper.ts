/**
 * Status mapping utility for converting Gelato API statuses to UI display statuses
 */

import { OrderStatus } from '@/models/order';

/**
 * UI-friendly status names for display purposes
 */
export type UIStatus =
  | 'received'
  | 'queued'
  | 'production'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'issue';

/**
 * Mapping from Gelato API statuses to UI display statuses
 * This provides a single source of truth for status conversion
 */
export const apiToUi: Record<OrderStatus, UIStatus> = {
  [OrderStatus.CREATED]:    'received',
  [OrderStatus.QUEUED]:     'queued',
  [OrderStatus.PROCESSING]: 'production',
  [OrderStatus.SHIPPED]:    'shipped',
  [OrderStatus.DELIVERED]:  'delivered',
  [OrderStatus.CANCELED]:   'cancelled',
  [OrderStatus.FAILED]:     'issue',
};

/**
 * Convert a Gelato API status to a UI status with fallback
 * @param apiStatus - The status from the Gelato API
 * @returns The corresponding UI status, or 'received' as fallback
 */
export function convertApiStatusToUi(apiStatus: OrderStatus | string): UIStatus {
  // Handle enum values
  if (Object.values(OrderStatus).includes(apiStatus as OrderStatus)) {
    return apiToUi[apiStatus as OrderStatus];
  }
  
  // Handle string values (for backward compatibility)
  const enumStatus = Object.values(OrderStatus).find(status => status === apiStatus);
  if (enumStatus) {
    return apiToUi[enumStatus];
  }
  
  // Fallback for unknown statuses
  console.warn(`Unknown order status: "${apiStatus}", falling back to 'received'`);
  return 'received';
}

/**
 * Get a human-readable display name for a UI status
 */
export function getDisplayName(uiStatus: UIStatus): string {
  const displayNames: Record<UIStatus, string> = {
    received: 'Order received',
    queued: 'In queue',
    production: 'In production',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    issue: 'Issue with order',
  };
  
  return displayNames[uiStatus] || uiStatus;
}
