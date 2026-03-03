/**
 * Order models and interfaces for the application
 */

import { GelatoAddress, GelatoShippingMethod } from "@/lib/gelato";
import { PosterSize, CanvasSize } from "@/utils/gelatoUrls";

/**
 * LocalOrder interface for storing order data in localStorage
 * Used for displaying orders in the dashboard
 */
export interface LocalOrder {
  id: string;               // Gelato order ID
  referenceId: string;      // Our reference ID
  productName: string;      // Display name of the product
  productUid: string;       // Gelato product UID
  imageId: string;          // Cloudinary public ID of the image
  previewUrl?: string;      // URL for order preview image
  quantity: number;         // Order quantity
  price: number;            // Product price
  shippingCost: number;     // Shipping cost
  total: number;            // Total order cost
  currency: string;         // Currency code (e.g., USD)
  status: OrderStatus;      // Current order status
  trackingUrl?: string;     // Shipping tracking URL (available when shipped)
  shippingAddress: GelatoAddress; // Customer shipping address
  createdAt: string;        // ISO date string when order was created
  updatedAt?: string;       // ISO date string of last status update
}

/**
 * Order status enum from Gelato API
 * Using enum for exhaustiveness checks and typo prevention
 */
export enum OrderStatus {
  CREATED   = 'CREATED',    // Initial state
  QUEUED    = 'QUEUED',     // Payment received, processing
  PROCESSING = 'PROCESSING', // In production
  SHIPPED   = 'SHIPPED',    // Order has been shipped
  DELIVERED = 'DELIVERED',  // Order has been delivered
  CANCELED  = 'CANCELED',   // Order was canceled
  FAILED    = 'FAILED',     // Processing failed
}

/**
 * Request body for order quote API
 */
export interface OrderQuoteRequest {
  productUid: string;
  quantity: number;
  shippingAddress: GelatoAddress;
  currency?: string; // Defaults to USD
}

/**
 * Response from order quote API
 */
export interface OrderQuoteResponse {
  productPrice: number;
  shippingMethods: GelatoShippingMethod[];
  currency: string;
  total?: number; // Optional total with markup applied
}

/**
 * Crop params for deterministic image cropping (v1)
 * Normalized coordinates (0-1 range relative to source image)
 */
export interface CropParams {
  x: number       // Left edge (0-1)
  y: number       // Top edge (0-1)
  width: number   // Crop width (0-1)
  height: number  // Crop height (0-1)
  rotation?: 0 | 90 | 180 | 270
}

/**
 * Request body for order creation API
 */
export interface OrderCreateRequest {
  productUid: string;
  imagePublicId: string;
  quantity: number;
  shippingAddress: GelatoAddress;
  shippingMethodUid: string;
  size: PosterSize | CanvasSize;
  currency?: string; // Defaults to USD
  // v1: Optional enhancement transforms and crop params
  transforms?: string;  // Comma-separated enhancement keys
  cropParams?: CropParams;
  sourceWidth?: number;  // Source image width (required if cropParams)
  sourceHeight?: number; // Source image height (required if cropParams)
}

/**
 * Response from order creation API
 */
export interface OrderCreateResponse {
  success: boolean;
  order: {
    id: string;
    referenceId: string;
    status: OrderStatus;
    created: string;
    trackingUrl?: string;
  };
}

/**
 * Request parameters for order status API
 */
export interface OrderStatusParams {
  orderId: string;
}

/**
 * Response from order status API
 */
export interface OrderStatusResponse {
  success: boolean;
  order: {
    id: string;
    referenceId: string;
    status: OrderStatus;
    created: string;
    updated?: string;
    trackingUrl?: string;
    trackingNumber?: string;
    carrier?: string;
  };
}

/**
 * Utility function to store an order in localStorage
 */
export function saveOrderToLocalStorage(order: LocalOrder): void {
  try {
    const existingOrdersJson = localStorage.getItem('modernMosaicsOrders');
    const existingOrders: LocalOrder[] = existingOrdersJson 
      ? JSON.parse(existingOrdersJson) 
      : [];
    
    // Check if order already exists and update it
    const orderIndex = existingOrders.findIndex(o => o.id === order.id);
    
    if (orderIndex >= 0) {
      existingOrders[orderIndex] = {
        ...existingOrders[orderIndex],
        ...order,
        updatedAt: new Date().toISOString()
      };
    } else {
      // Add new order to the beginning of the array
      existingOrders.unshift({
        ...order,
        createdAt: order.createdAt || new Date().toISOString()
      });
    }
    
    // Store updated orders array
    localStorage.setItem('modernMosaicsOrders', JSON.stringify(existingOrders));
  } catch (error) {
    console.error('Failed to save order to localStorage:', error);
  }
}

/**
 * Utility function to get all orders from localStorage
 */
export function getOrdersFromLocalStorage(): LocalOrder[] {
  try {
    const ordersJson = localStorage.getItem('modernMosaicsOrders');
    return ordersJson ? JSON.parse(ordersJson) : [];
  } catch (error) {
    console.error('Failed to get orders from localStorage:', error);
    return [];
  }
}

/**
 * Utility function to get a single order from localStorage by ID
 */
export function getOrderFromLocalStorage(orderId: string): LocalOrder | null {
  try {
    const orders = getOrdersFromLocalStorage();
    return orders.find(order => order.id === orderId) || null;
  } catch (error) {
    console.error('Failed to get order from localStorage:', error);
    return null;
  }
}
