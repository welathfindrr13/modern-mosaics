/**
 * Server-side Firestore utilities using Firebase Admin SDK
 * For use in API routes and server-side operations
 */

import admin from 'firebase-admin';
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

// Initialize Firebase Admin SDK
let adminApp: admin.app.App;
let adminDb: admin.firestore.Firestore;

try {
  if (!admin.apps.length) {
    // In production, use service account key from environment
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    } else {
      // In development, use application default credentials if available
      adminApp = admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    }
  } else {
    adminApp = admin.apps[0] as admin.app.App;
  }
  
  adminDb = admin.firestore(adminApp);
} catch (error) {
  console.error('Firebase Admin initialization failed:', error);
  throw error;
}

/**
 * Convert Firestore Timestamp to ISO string for client consumption
 */
const timestampToISOString = (timestamp: admin.firestore.Timestamp | null): string => {
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
 * User operations (Admin SDK)
 */
export const adminUserOperations = {
  /**
   * Create or update a user document
   */
  async createOrUpdate(userId: string, userData: CreateUserData): Promise<void> {
    const userRef = adminDb.collection('users').doc(userId);
    const userSnap = await userRef.get();
    
    if (userSnap.exists) {
      // Update existing user
      await userRef.update({
        ...userData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      // Create new user
      await userRef.set({
        ...userData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  },

  /**
   * Get user by ID
   */
  async getById(userId: string): Promise<ClientUser | null> {
    const userRef = adminDb.collection('users').doc(userId);
    const userSnap = await userRef.get();
    
    if (userSnap.exists) {
      return convertFirestoreUser(userSnap.id, userSnap.data() as FirestoreUser);
    }
    return null;
  },

  /**
   * Update user data
   */
  async update(userId: string, updates: UpdateUserData): Promise<void> {
    const userRef = adminDb.collection('users').doc(userId);
    await userRef.update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  },
};

/**
 * Image operations (Admin SDK)
 */
export const adminImageOperations = {
  /**
   * Create a new image document
   */
  async create(userId: string, imageData: CreateImageData): Promise<string> {
    const imagesRef = adminDb.collection('users').doc(userId).collection('images');
    const docRef = await imagesRef.add({
      ...imageData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return docRef.id;
  },

  /**
   * Get all images for a user
   */
  async getByUserId(userId: string, limitCount?: number): Promise<ClientImage[]> {
    let query = adminDb
      .collection('users')
      .doc(userId)
      .collection('images')
      .orderBy('createdAt', 'desc');
    
    if (limitCount) {
      query = query.limit(limitCount);
    }
    
    const querySnapshot = await query.get();
    
    return querySnapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => 
      convertFirestoreImage(doc.id, doc.data() as FirestoreImage)
    );
  },

  /**
   * Get a specific image by ID
   */
  async getById(userId: string, imageId: string): Promise<ClientImage | null> {
    const imageRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('images')
      .doc(imageId);
    const imageSnap = await imageRef.get();
    
    if (imageSnap.exists) {
      return convertFirestoreImage(imageSnap.id, imageSnap.data() as FirestoreImage);
    }
    return null;
  },

  /**
   * Delete an image
   */
  async delete(userId: string, imageId: string): Promise<void> {
    const imageRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('images')
      .doc(imageId);
    await imageRef.delete();
  },
};

/**
 * Order operations (Admin SDK)
 */
export const adminOrderOperations = {
  /**
   * Create a new order document
   */
  async create(userId: string, orderData: CreateOrderData): Promise<string> {
    const ordersRef = adminDb.collection('users').doc(userId).collection('orders');
    const now = admin.firestore.FieldValue.serverTimestamp();
    
    const docRef = await ordersRef.add({
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
    let query = adminDb
      .collection('users')
      .doc(userId)
      .collection('orders')
      .orderBy('createdAt', 'desc');
    
    if (limitCount) {
      query = query.limit(limitCount);
    }
    
    const querySnapshot = await query.get();
    
    return querySnapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => 
      convertFirestoreOrder(doc.id, doc.data() as FirestoreOrder)
    );
  },

  /**
   * Get a specific order by ID
   */
  async getById(userId: string, orderId: string): Promise<ClientOrder | null> {
    const orderRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('orders')
      .doc(orderId);
    const orderSnap = await orderRef.get();
    
    if (orderSnap.exists) {
      return convertFirestoreOrder(orderSnap.id, orderSnap.data() as FirestoreOrder);
    }
    return null;
  },

  /**
   * Update order data
   */
  async update(userId: string, orderId: string, updates: UpdateOrderData): Promise<void> {
    const orderRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('orders')
      .doc(orderId);
    await orderRef.update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  },

  /**
   * Find order by Gelato order ID
   */
  async getByGelatoOrderId(gelatoOrderId: string): Promise<{ userId: string; order: ClientOrder } | null> {
    // Note: This requires a composite index on gelatoOrderId
    const ordersQuery = adminDb.collectionGroup('orders').where('gelatoOrderId', '==', gelatoOrderId);
    const querySnapshot = await ordersQuery.get();
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const userId = doc.ref.parent.parent?.id;
      if (userId) {
        return {
          userId,
          order: convertFirestoreOrder(doc.id, doc.data() as FirestoreOrder)
        };
      }
    }
    return null;
  },

  /**
   * Find order by Stripe session ID
   */
  async getByStripeSessionId(stripeSessionId: string): Promise<{ userId: string; order: ClientOrder } | null> {
    // Note: This requires a composite index on stripeSessionId
    const ordersQuery = adminDb.collectionGroup('orders').where('stripeSessionId', '==', stripeSessionId);
    const querySnapshot = await ordersQuery.get();
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const userId = doc.ref.parent.parent?.id;
      if (userId) {
        return {
          userId,
          order: convertFirestoreOrder(doc.id, doc.data() as FirestoreOrder)
        };
      }
    }
    return null;
  },

  /**
   * Find order by internal/external reference ID
   */
  async getByReferenceId(referenceId: string): Promise<{ userId: string; order: ClientOrder } | null> {
    const ordersQuery = adminDb.collectionGroup('orders').where('referenceId', '==', referenceId);
    const querySnapshot = await ordersQuery.get();

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const userId = doc.ref.parent.parent?.id;
      if (userId) {
        return {
          userId,
          order: convertFirestoreOrder(doc.id, doc.data() as FirestoreOrder)
        };
      }
    }
    return null;
  },
};

/**
 * Order status history operations (Admin SDK)
 */
export const adminOrderStatusHistoryOperations = {
  /**
   * Add a status history entry
   */
  async create(userId: string, orderId: string, historyData: CreateOrderStatusHistoryData): Promise<string> {
    const historyRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('orders')
      .doc(orderId)
      .collection('statusHistory');
    
    const docRef = await historyRef.add({
      ...historyData,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return docRef.id;
  },

  /**
   * Get status history for an order
   */
  async getByOrderId(userId: string, orderId: string): Promise<ClientOrderStatusHistory[]> {
    const historyQuery = adminDb
      .collection('users')
      .doc(userId)
      .collection('orders')
      .doc(orderId)
      .collection('statusHistory')
      .orderBy('timestamp', 'desc');
    
    const querySnapshot = await historyQuery.get();
    
    return querySnapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => 
      convertFirestoreOrderStatusHistory(doc.id, doc.data() as FirestoreOrderStatusHistory)
    );
  },
};

export { adminDb, adminApp };
