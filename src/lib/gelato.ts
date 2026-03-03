/**
 * Gelato API Client
 * 
 * Provides methods for interacting with Gelato's print-on-demand API
 * for product catalogs, shipping quotes, and order placement.
 */

// Define API version options
type GelatoApiVersion = 'v3' | 'v4';

// API Endpoints
const API_ENDPOINTS = {
  v3: {
    base: 'https://order.gelatoapis.com/v3',
    catalogs: 'https://product.gelatoapis.com/v3/catalogs',
    products: 'https://product.gelatoapis.com/v3/catalogs',
    prices: 'https://product.gelatoapis.com/v3/products',
    quote: 'https://order.gelatoapis.com/v3/orders:quote',
    order: 'https://order.gelatoapis.com/v3/orders',
  },
  v4: {
    base: 'https://order.gelatoapis.com/v4',
    catalogs: 'https://product.gelatoapis.com/v3/catalogs', // Still v3 endpoint
    products: 'https://product.gelatoapis.com/v3/catalogs', // Still v3 endpoint
    prices: 'https://product.gelatoapis.com/v3/products', // Still v3 endpoint
    quote: 'https://order.gelatoapis.com/v4/orders:quote',
    order: 'https://order.gelatoapis.com/v4/orders',
  }
};

// Types for Gelato API responses and requests
export interface GelatoCatalog {
  uid: string;
  name: string;
  description?: string;
  currency: string;
}

export interface GelatoProduct {
  uid: string;
  name: string;
  description?: string;
  attributes: Record<string, string | number | boolean>;
  productType: string;
}

export interface GelatoPrice {
  uid: string;
  price: number;
  currency: string;
  minimumQuantity: number;
}

export interface GelatoAddress {
  firstName: string;
  lastName: string;
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
  state?: string;
  country: string;
  email?: string;
  phone?: string;
}

export interface GelatoRecipient {
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
  companyName?: string;
}

export interface GelatoShippingMethod {
  uid: string;
  name: string;
  price: number;
  currency: string;
  minTransitDays: number;
  maxTransitDays: number;
}

export interface GelatoQuoteRequest {
  orderReferenceId: string;
  customerReferenceId: string;
  currency: string;
  allowMultipleQuotes?: boolean;
  recipient: GelatoRecipient;
  products: {
    itemReferenceId: string;
    productUid: string;
    quantity: number;
    files?: GelatoOrderFile[];
  }[];
}

export interface GelatoQuoteResponse {
  orderReferenceId: string;
  quotes: {
    id: string;
    itemReferenceIds: string[];
    products: {
      itemReferenceId: string;
      productUid: string;
      quantity: number;
      price: number;
      currency: string;
      pageCount?: number;
      options: any[];
      customTrim?: any;
    }[];
    fulfillmentCountry: string;
    shipmentMethods: {
      deliveryPromiseId: string;
      name: string;
      shipmentMethodUid: string;
      price: number;
      initialPrice: number;
      currency: string;
      minDeliveryDays: number;
      maxDeliveryDays: number;
      minDeliveryDate: string;
      maxDeliveryDate: string;
      type: string;
      isPrivate: boolean;
      isBusiness: boolean;
      totalWeight: number;
      packageCount: number;
      incoTerms: string;
      speedType: string;
    }[];
    expirationDateTime: string;
    productionTimeZone: string;
    productionCountry: string;
  }[];
  errors: any[];
}

export interface GelatoOrderFile {
  type: string;
  url: string;
}

export interface GelatoOrderItem {
  itemReferenceId: string;
  productUid: string;
  quantity: number;
  files: GelatoOrderFile[];
}

/**
 * Gelato API shipping address format (with correct field names)
 * Note: This differs from our internal GelatoAddress schema
 */
export interface GelatoApiShippingAddress {
  firstName: string;
  lastName: string;
  addressLine1: string;        // Gelato requires this name (not line1)
  addressLine2?: string;
  city: string;
  postCode: string;            // Gelato requires this name (not postalCode)
  state?: string;
  country: string;
  email?: string;
  phone?: string;
}

export interface GelatoOrderRequest {
  orderReferenceId: string;
  customerReferenceId: string;
  currency: string;
  items: GelatoOrderItem[];
  shippingAddress: GelatoApiShippingAddress;  // Use Gelato's field names
  shippingMethodUid: string;
}

export interface GelatoOrderResponse {
  gelatoOrderId: string;
  orderReferenceId: string;
  created: string;
  status: string;
}

/**
 * Class for interacting with the Gelato API
 */
export class GelatoClient {
  private apiKey: string;
  private apiVersion: GelatoApiVersion;
  private endpoints: typeof API_ENDPOINTS.v3 | typeof API_ENDPOINTS.v4;

  /**
   * Initialize Gelato API client
   * @param apiKey Gelato API key
   * @param version API version to use (v3 or v4)
   */
  constructor(apiKey: string, version: GelatoApiVersion = 'v4') {
    this.apiKey = apiKey;
    this.apiVersion = version;
    this.endpoints = API_ENDPOINTS[version];
    
    // Validate API key
    if (!apiKey) {
      throw new Error('Gelato API key is required');
    }
  }

  /**
   * Helper method for making authenticated requests to Gelato API
   * @param url Full URL to call
   * @param method HTTP method
   * @param data Optional request body
   */
  private async request<T>(url: string, method: string, data?: any): Promise<T> {
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.apiKey,
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      // Check if the request was successful
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gelato API error (${response.status}): ${errorText}`);
      }

      // Parse and return the response
      return await response.json() as T;
    } catch (error) {
      console.error('Gelato API request failed:', error);
      throw error;
    }
  }

  /**
   * Get all available catalogs
   * @returns List of catalogs
   */
  async getCatalogs(): Promise<GelatoCatalog[]> {
    return this.request<GelatoCatalog[]>(this.endpoints.catalogs, 'GET');
  }

  /**
   * Search products within a catalog
   * @param catalogUid Catalog UID
   * @param limit Number of products per page (max 100)
   * @param offset Pagination offset
   * @returns List of products
   */
  async searchProducts(catalogUid: string, limit = 100, offset = 0): Promise<GelatoProduct[]> {
    const url = `${this.endpoints.products}/${catalogUid}/products:search`;
    return this.request<GelatoProduct[]>(url, 'POST', { limit, offset });
  }

  /**
   * Get price tiers for a product
   * @param productUid Product UID
   * @returns List of price tiers
   */
  async getProductPrices(productUid: string): Promise<GelatoPrice[]> {
    const url = `${this.endpoints.prices}/${productUid}/prices`;
    return this.request<GelatoPrice[]>(url, 'GET');
  }

  /**
   * Generate a shipping quote for an order
   * @param quoteRequest Quote request details
   * @returns Quote with available shipping methods
   */
  async quoteOrder(quoteRequest: GelatoQuoteRequest): Promise<GelatoQuoteResponse> {
    return this.request<GelatoQuoteResponse>(this.endpoints.quote, 'POST', quoteRequest);
  }

  /**
   * Create a new order
   * @param orderRequest Order details
   * @returns Created order information
   */
  async createOrder(orderRequest: GelatoOrderRequest): Promise<GelatoOrderResponse> {
    return this.request<GelatoOrderResponse>(this.endpoints.order, 'POST', orderRequest);
  }

  /**
   * Get order status
   * @param orderId Gelato order ID
   * @returns Order status details
   */
  async getOrderStatus(orderId: string): Promise<any> {
    const url = `${this.endpoints.order}/${orderId}`;
    return this.request<any>(url, 'GET');
  }

  /**
   * Cancel an order
   * Only works for orders with status = QUEUED
   * @param orderId Gelato order ID
   * @returns Cancellation response
   */
  async cancelOrder(orderId: string): Promise<any> {
    const url = `${this.endpoints.order}/${orderId}:cancel`;
    return this.request<any>(url, 'POST');
  }
}

/**
 * Create and initialize a Gelato client instance with proper error handling
 * @returns Initialized Gelato client
 */
export function getGelatoClient(apiVersion: GelatoApiVersion = 'v4'): GelatoClient {
  // Get API key from environment
  const apiKey = process.env.GELATO_API_KEY;
  
  // Validate required configuration
  if (!apiKey) {
    throw new Error('Missing Gelato API key in environment variables');
  }
  
  // Initialize and return client
  return new GelatoClient(apiKey, apiVersion);
}

/**
 * Helper function to create Gelato order line items with print-ready URLs
 * This integrates with the unified print size system
 */
export function createGelatoLineItem(params: {
  publicId: string;
  productUid: string; // Full Gelato SKU
  quantity?: number;
  itemReferenceId?: string;
}): GelatoOrderItem {
  const { publicId, productUid, quantity = 1, itemReferenceId = publicId } = params;
  
  // Import the print URL function here to avoid circular dependencies
  const { makeCloudinaryPrintUrl } = require('@/utils/cloudinaryPrint');
  
  return {
    itemReferenceId,
    productUid,
    quantity,
    files: [
      {
        type: 'default',
        url: makeCloudinaryPrintUrl(publicId, productUid),
      },
    ],
  };
}

/**
 * RELIABILITY: Map internal address schema to Gelato's required field names
 * 
 * Internal schema uses: line1, line2, postalCode
 * Gelato API requires: addressLine1, addressLine2, postCode
 * 
 * This helper ensures orders don't fail with "Address line 1 required" errors.
 */
export function mapAddressToGelato(address: GelatoAddress): {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postCode: string;
  state?: string;
  country: string;
  email?: string;
  phone?: string;
} {
  return {
    firstName: address.firstName,
    lastName: address.lastName,
    addressLine1: address.line1,           // line1 → addressLine1
    addressLine2: address.line2,           // line2 → addressLine2
    city: address.city,
    postCode: address.postalCode,          // postalCode → postCode
    state: address.state,
    country: address.country.toUpperCase(),
    email: address.email,
    phone: address.phone,
  };
}

/**
 * RELIABILITY: Validate address has required fields before sending to Gelato
 * Returns null if valid, or an error message if invalid.
 */
export function validateGelatoAddress(address: GelatoAddress): string | null {
  const missing: string[] = [];
  
  if (!address.firstName?.trim()) missing.push('firstName');
  if (!address.lastName?.trim()) missing.push('lastName');
  if (!address.line1?.trim()) missing.push('addressLine1');
  if (!address.city?.trim()) missing.push('city');
  if (!address.postalCode?.trim()) missing.push('postCode');
  if (!address.country?.trim()) missing.push('country');
  
  if (missing.length > 0) {
    return `Missing required address fields: ${missing.join(', ')}`;
  }
  
  return null;
}
