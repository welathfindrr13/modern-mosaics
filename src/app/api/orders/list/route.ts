import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { requireAuth, getAuthenticatedUser } from '@/lib/api-auth';
import { adminOrderOperations } from '@/utils/firestore-admin';

export async function GET(req: NextRequest) {
  try {
    // Verify user is authenticated
    const authError = await requireAuth(req);
    if (authError) {
      return authError;
    }
    
    // Get authenticated user
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ 
        error: 'User not found. You may need to log out and log in again.',
        code: 'UNAUTHORIZED',
      }, { status: 401 });
    }

    if (!user.email) {
      return NextResponse.json(
        { error: 'Sign in with Google or email to access orders.', code: 'EMAIL_REQUIRED' },
        { status: 403 }
      );
    }

    // Use Firebase UID as the userId for Firestore
    const userId = user.uid;
    
    try {
      // Get orders from Firestore
      const orders = await adminOrderOperations.getByUserId(userId);
      return NextResponse.json({ orders });
    } catch (firestoreError: any) {
      console.error('[ORDERS_LIST] Firestore read failed:', firestoreError?.message || firestoreError);
      
      // Return empty orders list if Firestore fails
      return NextResponse.json({ 
        orders: [],
        message: 'Firestore not available, showing empty orders list'
      });
    }
  } catch (error: any) {
    console.error('[ORDERS_LIST] API error:', error?.message || error);
    return NextResponse.json({ 
      error: `Failed to retrieve orders: ${error.message || 'Unknown error'}`,
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}
