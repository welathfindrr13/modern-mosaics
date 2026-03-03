/**
 * Firestore data models for the Modern Mosaics application
 */

import { Timestamp } from 'firebase/firestore';
import { OrderStatus } from './order';

/**
 * User document in the users collection
 */
export interface FirestoreUser {
  email: string;
  firebaseUid: string;
  displayName?: string;
  photoURL?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  preferences: {
    currency: string;
    notifications: boolean;
  };
}

/**
 * Image document in the users/{userId}/images subcollection
 */
export interface FirestoreImage {
  cloudinaryPublicId: string;
  cloudinaryUrl: string;
  prompt: string;
  metadata: {
    width: number;
    height: number;
    format: string;
    bytes: number;
  };
  createdAt: Timestamp;
  tags: string[];
}

/**
 * Order document in the users/{userId}/orders subcollection
 */
export interface FirestoreOrder {
  referenceId: string;
  gelatoOrderId?: string;
  stripeSessionId?: string;
  stripeEventId?: string;
  stripePaymentStatus?: string;
  fulfillmentState?: 'processing' | 'pending_payment' | 'fulfilled' | 'failed_retryable' | 'failed_non_retryable';
  imageId: string;
  productDetails: {
    uid: string;
    name: string;
    size: string;
    type: string;
  };
  pricing: {
    productPrice: number;
    shippingCost: number;
    total: number;
    currency: string;
  };
  quantity: number;
  status: OrderStatus;
  shippingAddress: {
    firstName: string;
    lastName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    postCode: string;
    state?: string;
    country: string;
    email: string;
    phone?: string;
  };
  tracking?: {
    number: string;
    url: string;
    carrier: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Status history document in the orders/{orderId}/statusHistory subcollection
 */
export interface FirestoreOrderStatusHistory {
  status: OrderStatus;
  message: string;
  timestamp: Timestamp;
}

/**
 * Client-safe versions (with Date instead of Timestamp)
 * These are used when sending data to the client
 */
export interface ClientUser extends Omit<FirestoreUser, 'createdAt' | 'updatedAt'> {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientImage extends Omit<FirestoreImage, 'createdAt'> {
  id: string;
  createdAt: string;
}

export interface ClientOrder extends Omit<FirestoreOrder, 'createdAt' | 'updatedAt'> {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientOrderStatusHistory extends Omit<FirestoreOrderStatusHistory, 'timestamp'> {
  id: string;
  timestamp: string;
}

/**
 * Utility types for creating documents (without server-generated fields)
 */
export type CreateUserData = Omit<FirestoreUser, 'createdAt' | 'updatedAt'>;
export type CreateImageData = Omit<FirestoreImage, 'createdAt'>;
export type CreateOrderData = Omit<FirestoreOrder, 'createdAt' | 'updatedAt'>;
export type CreateOrderStatusHistoryData = Omit<FirestoreOrderStatusHistory, 'timestamp'>;

/**
 * Update types (all fields optional except ID)
 */
export type UpdateUserData = Partial<Omit<FirestoreUser, 'createdAt' | 'updatedAt'>>;
export type UpdateOrderData = Partial<Omit<FirestoreOrder, 'createdAt' | 'updatedAt'>>;
