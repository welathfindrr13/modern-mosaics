/**
 * Client-side Firestore utilities for Modern Mosaics application
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  setDoc,
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  Timestamp,
  serverTimestamp,
  QueryConstraint
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  FirestoreUser,
  FirestoreImage,
  FirestoreOrder,
  FirestoreOrderStatusHistory,
  ClientUser,
  ClientImage,
  ClientOrder,
  ClientOrderStatusHistory,
  CreateUserData,
  CreateImageData,
  CreateOrderData,
  CreateOrderStatusHistoryData,
  UpdateUserData,
  UpdateOrderData
} from '@/models/firestore';

/**
 * Convert Firestore Timestamp to ISO string for client consumption
 */
const timestampToISOString = (timestamp: Timestamp | null): string => {
  if (!timestamp) return new Date().toISOString();
  return timestamp.toDate().toISOString();
};

/**
 * Convert Firestore document to client-safe format
 */
const convertFirestoreUser = (id: string, data: FirestoreUser): ClientUser => ({
  id,
  ...data,
  createdAt: timestampToISOString(data.createdAt),
  updatedAt: timestampToISOString(data.updatedAt),
});

const convertFirestoreImage = (id: string, data: FirestoreImage): ClientImage => ({
  id,
  ...data,
  createdAt: timestampToISOString(data.createdAt),
});

const convertFirestoreOrder = (id: string, data: FirestoreOrder): ClientOrder => ({
  id,
  ...data,
  createdAt: timestampToISOString(data.createdAt),
  updatedAt: timestampToISOString(data.updatedAt),
});

const convertFirestoreOrderStatusHistory = (id: string, data: FirestoreOrderStatusHistory): ClientOrderStatusHistory => ({
  id,
  ...data,
  timestamp: timestampToISOString(data.timestamp),
});

/**
 * User operations
 */
export const userOperations = {
  /**
   * Create a new user document
   */
  async create(userId: string, userData: CreateUserData): Promise<void> {
    const userRef = doc(db, 'users', userId);
    const now = serverTimestamp();
    
    await updateDoc(userRef, {
      ...userData,
      createdAt: now,
      updatedAt: now,
    });
  },

  /**
   * Get user by ID
   */
  async getById(userId: string): Promise<ClientUser | null> {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return convertFirestoreUser(userSnap.id, userSnap.data() as FirestoreUser);
    }
    return null;
  },

  /**
   * Update user data
   */
  async update(userId: string, updates: UpdateUserData): Promise<void> {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Create user document if it doesn't exist
   */
  async createIfNotExists(userId: string, userData: CreateUserData): Promise<void> {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      const now = serverTimestamp();
      await setDoc(userRef, {
        ...userData,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
};

/**
 * Image operations
 */
export const imageOperations = {
  /**
   * Create a new image document
   */
  async create(userId: string, imageData: CreateImageData): Promise<string> {
    const imagesRef = collection(db, 'users', userId, 'images');
    const docRef = await addDoc(imagesRef, {
      ...imageData,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  /**
   * Get all images for a user
   */
  async getByUserId(userId: string, limitCount?: number): Promise<ClientImage[]> {
    const imagesRef = collection(db, 'users', userId, 'images');
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    
    if (limitCount) {
      constraints.push(limit(limitCount));
    }
    
    const q = query(imagesRef, ...constraints);
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => 
      convertFirestoreImage(doc.id, doc.data() as FirestoreImage)
    );
  },

  /**
   * Get a specific image by ID
   */
  async getById(userId: string, imageId: string): Promise<ClientImage | null> {
    const imageRef = doc(db, 'users', userId, 'images', imageId);
    const imageSnap = await getDoc(imageRef);
    
    if (imageSnap.exists()) {
      return convertFirestoreImage(imageSnap.id, imageSnap.data() as FirestoreImage);
    }
    return null;
  },

  /**
   * Delete an image
   */
  async delete(userId: string, imageId: string): Promise<void> {
    const imageRef = doc(db, 'users', userId, 'images', imageId);
    await deleteDoc(imageRef);
  },

  /**
   * Subscribe to real-time updates for user's images
   */
  subscribeToUserImages(userId: string, callback: (images: ClientImage[]) => void, limitCount?: number) {
    const imagesRef = collection(db, 'users', userId, 'images');
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    
    if (limitCount) {
      constraints.push(limit(limitCount));
    }
    
    const q = query(imagesRef, ...constraints);
    
    return onSnapshot(q, (querySnapshot) => {
      const images = querySnapshot.docs.map(doc => 
        convertFirestoreImage(doc.id, doc.data() as FirestoreImage)
      );
      callback(images);
    });
  },
};

/**
 * Order operations
 */
export const orderOperations = {
  /**
   * Create a new order document
   */
  async create(userId: string, orderData: CreateOrderData): Promise<string> {
    const ordersRef = collection(db, 'users', userId, 'orders');
    const now = serverTimestamp();
    
    const docRef = await addDoc(ordersRef, {
      ...orderData,
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  },

  /**
   * Get all orders for a user
   */
  async getByUserId(userId: string, limitCount?: number): Promise<ClientOrder[]> {
    const ordersRef = collection(db, 'users', userId, 'orders');
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    
    if (limitCount) {
      constraints.push(limit(limitCount));
    }
    
    const q = query(ordersRef, ...constraints);
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => 
      convertFirestoreOrder(doc.id, doc.data() as FirestoreOrder)
    );
  },

  /**
   * Get a specific order by ID
   */
  async getById(userId: string, orderId: string): Promise<ClientOrder | null> {
    const orderRef = doc(db, 'users', userId, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);
    
    if (orderSnap.exists()) {
      return convertFirestoreOrder(orderSnap.id, orderSnap.data() as FirestoreOrder);
    }
    return null;
  },

  /**
   * Update order data
   */
  async update(userId: string, orderId: string, updates: UpdateOrderData): Promise<void> {
    const orderRef = doc(db, 'users', userId, 'orders', orderId);
    await updateDoc(orderRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Subscribe to real-time updates for user's orders
   */
  subscribeToUserOrders(userId: string, callback: (orders: ClientOrder[]) => void, limitCount?: number) {
    const ordersRef = collection(db, 'users', userId, 'orders');
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    
    if (limitCount) {
      constraints.push(limit(limitCount));
    }
    
    const q = query(ordersRef, ...constraints);
    
    return onSnapshot(q, (querySnapshot) => {
      const orders = querySnapshot.docs.map(doc => 
        convertFirestoreOrder(doc.id, doc.data() as FirestoreOrder)
      );
      callback(orders);
    });
  },
};

/**
 * Order status history operations
 */
export const orderStatusHistoryOperations = {
  /**
   * Add a status history entry
   */
  async create(userId: string, orderId: string, historyData: CreateOrderStatusHistoryData): Promise<string> {
    const historyRef = collection(db, 'users', userId, 'orders', orderId, 'statusHistory');
    const docRef = await addDoc(historyRef, {
      ...historyData,
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  },

  /**
   * Get status history for an order
   */
  async getByOrderId(userId: string, orderId: string): Promise<ClientOrderStatusHistory[]> {
    const historyRef = collection(db, 'users', userId, 'orders', orderId, 'statusHistory');
    const q = query(historyRef, orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => 
      convertFirestoreOrderStatusHistory(doc.id, doc.data() as FirestoreOrderStatusHistory)
    );
  },
};
