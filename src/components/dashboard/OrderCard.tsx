'use client';

import { OrderStatus } from '@/models/order';
import { convertApiStatusToUi, getDisplayName } from '@/utils/statusMapper';

export interface OrderCardProps {
  orderId: string;
  gelatoOrderId: string;
  status: OrderStatus;
  createdAt: string;
  productName?: string;
  onCancel?: (orderId: string) => Promise<void> | void;
  canceling?: boolean;
}

export function OrderCard({ orderId, gelatoOrderId, status, createdAt, productName, onCancel, canceling = false }: OrderCardProps) {
  const shortOrderId = `${orderId.slice(0, 12)}...`;

  const handleCopyOrderId = async () => {
    try {
      await navigator.clipboard.writeText(orderId);
    } catch {
      // no-op for unsupported clipboard environments
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formattedDate = formatDate(createdAt);
  
  const uiStatus = convertApiStatusToUi(status);
  const displayName = getDisplayName(uiStatus);

  // Status colors for dark theme
  const getStatusStyles = () => {
    switch (uiStatus) {
      case 'received':
        return {
          bg: 'bg-blue-500/10',
          text: 'text-blue-400',
          border: 'border-blue-500/30',
          icon: '✓'
        };
      case 'queued':
        return {
          bg: 'bg-yellow-500/10',
          text: 'text-yellow-400',
          border: 'border-yellow-500/30',
          icon: '⏳'
        };
      case 'production':
        return {
          bg: 'bg-purple-500/10',
          text: 'text-purple-400',
          border: 'border-purple-500/30',
          icon: '🖨️'
        };
      case 'shipped':
        return {
          bg: 'bg-brand-500/10',
          text: 'text-brand-400',
          border: 'border-brand-500/30',
          icon: '🚚'
        };
      case 'delivered':
        return {
          bg: 'bg-green-500/10',
          text: 'text-green-400',
          border: 'border-green-500/30',
          icon: '✓'
        };
      case 'cancelled':
        return {
          bg: 'bg-red-500/10',
          text: 'text-red-400',
          border: 'border-red-500/30',
          icon: '✕'
        };
      case 'issue':
        return {
          bg: 'bg-orange-500/10',
          text: 'text-orange-400',
          border: 'border-orange-500/30',
          icon: '⚠'
        };
      default:
        return {
          bg: 'bg-dark-700',
          text: 'text-dark-400',
          border: 'border-white/10',
          icon: '•'
        };
    }
  };

  const styles = getStatusStyles();

  return (
    <div className="glass-card p-4 hover:border-white/20 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Order icon */}
          <div className="w-10 h-10 rounded-lg bg-gold-500/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          
          <div>
            <div className="flex items-center gap-2">
              <div className="font-medium text-white" title={orderId}>Order #{shortOrderId}</div>
              <button
                type="button"
                onClick={handleCopyOrderId}
                className="text-[11px] px-2 py-0.5 rounded border border-white/10 text-dark-400 hover:text-white hover:border-white/20 transition-colors"
              >
                Copy ID
              </button>
            </div>
            {productName && (
              <p className="text-sm text-dark-400">{productName}</p>
            )}
            <div className="text-xs text-dark-500 mt-1">{formattedDate}</div>
          </div>
        </div>
        
        {/* Status badge */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${styles.bg} ${styles.text} border ${styles.border} text-xs font-medium`}>
          <span>{styles.icon}</span>
          <span className="capitalize">{displayName}</span>
        </div>
      </div>

      {status === OrderStatus.QUEUED && onCancel && (
        <div className="mt-4 pt-3 border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={() => onCancel(orderId)}
            disabled={canceling}
            className="px-3 py-1.5 text-xs rounded-lg border border-red-400/30 text-red-300 hover:text-red-200 hover:border-red-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {canceling ? 'Cancelling...' : 'Cancel queued order'}
          </button>
        </div>
      )}
    </div>
  );
}
