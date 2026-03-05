import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getAuthenticatedUser } from '@/lib/api-auth';
import { getGelatoClient } from '@/lib/gelato';
import { OrderStatus, OrderStatusResponse } from '@/models/order';
import { adminOrderOperations } from '@/utils/firestore-admin';

/**
 * GET handler for retrieving order status from Gelato
 * This endpoint checks the current status of an order
 */
export async function GET(request: NextRequest) {
  const authResponse = await requireAuth(request);
  if (authResponse) {
    return authResponse;
  }

  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get order ID from query params
  const orderId = request.nextUrl.searchParams.get('orderId');
  if (!orderId || orderId === 'undefined') {
    return NextResponse.json({ error: 'Missing or invalid order ID' }, { status: 400 });
  }

  try {
    const orderByGelatoId = await adminOrderOperations.getByUserAndGelatoOrderId(user.uid, orderId);
    const orderByReference = orderByGelatoId
      ? null
      : await adminOrderOperations.getByUserAndReferenceId(user.uid, orderId);
    const orderRecord = orderByGelatoId || orderByReference;

    if (!orderRecord) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    const gelatoOrderId = orderRecord.gelatoOrderId || orderId;

    // Initialize Gelato client
    const gelatoClient = getGelatoClient();
    
    // Request order status from Gelato
    const orderDetails = await gelatoClient.getOrderStatus(gelatoOrderId);
    
    // Format the response
    const response: OrderStatusResponse = {
      success: true,
      order: {
        id: orderDetails.id || orderDetails.gelatoOrderId,
        referenceId: orderDetails.orderReferenceId,
        status: orderDetails.status as OrderStatus,
        created: orderDetails.created,
        updated: orderDetails.updated,
        trackingUrl: orderDetails.trackingUrl,
        trackingNumber: orderDetails.trackingNumber,
        carrier: orderDetails.carrier
      }
    };
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('[ORDER_STATUS] Status check failed:', error?.message || error);
    
    // Check if it's a 404 Not Found from Gelato
    if (error.message && error.message.includes('404')) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: `Failed to check order status: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * POST handler for canceling an order
 * This endpoint attempts to cancel a pending order
 */
export async function POST(request: NextRequest) {
  // Check authentication using Firebase Auth
  const authResponse = await requireAuth(request);
  if (authResponse) {
    // If requireAuth returns a response, it means auth failed
    return authResponse;
  }

  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Parse request body
    const { orderId } = await request.json();
    
    if (!orderId) {
      console.info('[ORDER_CANCEL_AUDIT]', JSON.stringify({
        uid: user.uid,
        orderId: null,
        outcome: 'rejected_missing_order_id',
        timestamp: new Date().toISOString(),
      }));
      return NextResponse.json({ error: 'Missing order ID' }, { status: 400 });
    }

    console.info('[ORDER_CANCEL_AUDIT]', JSON.stringify({
      uid: user.uid,
      orderId,
      outcome: 'attempt',
      timestamp: new Date().toISOString(),
    }));
    
    const orderByGelatoId = await adminOrderOperations.getByUserAndGelatoOrderId(user.uid, orderId);
    const orderByReference = orderByGelatoId
      ? null
      : await adminOrderOperations.getByUserAndReferenceId(user.uid, orderId);
    const orderRecord = orderByGelatoId || orderByReference;

    if (!orderRecord) {
      console.info('[ORDER_CANCEL_AUDIT]', JSON.stringify({
        uid: user.uid,
        orderId,
        outcome: 'rejected_order_not_found',
        timestamp: new Date().toISOString(),
      }));
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    const gelatoOrderId = orderRecord.gelatoOrderId || orderId;

    // Initialize Gelato client
    const gelatoClient = getGelatoClient();
    
    // Check order status first to ensure it can be canceled
    const orderDetails = await gelatoClient.getOrderStatus(gelatoOrderId);
    
    // Can only cancel orders in QUEUED status
    if (orderDetails.status !== 'QUEUED') {
      console.info('[ORDER_CANCEL_AUDIT]', JSON.stringify({
        uid: user.uid,
        orderId,
        gelatoOrderId,
        outcome: 'rejected_non_queued',
        orderStatus: orderDetails.status,
        timestamp: new Date().toISOString(),
      }));
      return NextResponse.json(
        { 
          error: 'Order cannot be canceled', 
          status: orderDetails.status,
          message: 'Only orders in QUEUED status can be canceled'
        }, 
        { status: 400 }
      );
    }
    
    // Attempt to cancel the order
    await gelatoClient.cancelOrder(gelatoOrderId);

    console.info('[ORDER_CANCEL_AUDIT]', JSON.stringify({
      uid: user.uid,
      orderId,
      gelatoOrderId,
      outcome: 'cancelled',
      timestamp: new Date().toISOString(),
    }));
    
    return NextResponse.json({
      success: true,
      order: {
        id: gelatoOrderId,
        status: 'CANCELED',
        message: 'Order successfully canceled'
      }
    });
    
  } catch (error: any) {
    console.error('[ORDER_STATUS] Cancellation failed:', error?.message || error);
    console.info('[ORDER_CANCEL_AUDIT]', JSON.stringify({
      uid: user.uid,
      outcome: 'error',
      message: error?.message || 'unknown_error',
      timestamp: new Date().toISOString(),
    }));
    return NextResponse.json(
      { error: `Failed to cancel order: ${error.message}` },
      { status: 500 }
    );
  }
}
