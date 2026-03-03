// Use dynamic import for the server-side full Cloudinary SDK
// This prevents the Node.js modules from being bundled for client components
import { Cloudinary } from 'cloudinary-core';

// Type for URL transformer function
type CloudinaryTransformer = (publicId: string, options?: any) => string;

/**
 * Get Cloudinary cloud name from env variable
 * @returns The cloud name configured in environment variables
 * @throws Error if the cloud name is not configured
 */
export const getCloudName = (): string => {
  const cn = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cn) {
    throw new Error(
      'Missing Cloudinary cloud name. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME in your env.'
    );
  }
  return cn;
};

// Server-side Cloudinary initialization (used in API routes)
export async function initServerCloudinary() {
  // Dynamically import the full Cloudinary SDK for server-side use only
  const { v2: cloudinary } = await import('cloudinary');
  
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  
  // Validate required configuration
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      `Missing Cloudinary configuration: ` +
      `${!cloudName ? 'CLOUD_NAME ' : ''}` +
      `${!apiKey ? 'API_KEY ' : ''}` +
      `${!apiSecret ? 'API_SECRET' : ''}`
    );
  }
  
  // Configure Cloudinary
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
  
  return cloudinary;
}

// Client-side Cloudinary initialization (safe for browser)
export function getClientCloudinary() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  
  if (!cloudName) {
    throw new Error('Missing Cloudinary cloud name in environment variables');
  }
  
  // Create a browser-safe instance with just the cloud name
  return new Cloudinary({ cloud_name: cloudName });
}

// For client components - URL generation only (no upload/admin functions)
let clientCloudinaryInstance: Cloudinary | null = null;
export function getCloudinary(): { url: CloudinaryTransformer } {
  if (typeof window === 'undefined') {
    // Server environment - we need to dynamically import
    throw new Error(
      'getCloudinary() called on server side. ' +
      'Use getServerCloudinary() with dynamic import in API routes instead.'
    );
  }
  
  // Client environment - safe to use cloudinary-core
  if (!clientCloudinaryInstance) {
    clientCloudinaryInstance = getClientCloudinary();
  }
  
  return {
    url: (publicId, options) => clientCloudinaryInstance!.url(publicId, options)
  };
}

// For API routes only
let serverCloudinaryPromise: Promise<any> | null = null;
export async function getServerCloudinary() {
  if (typeof window !== 'undefined') {
    throw new Error('getServerCloudinary() should only be called in API routes or server components');
  }
  
  if (!serverCloudinaryPromise) {
    serverCloudinaryPromise = initServerCloudinary();
  }
  
  return await serverCloudinaryPromise;
}
