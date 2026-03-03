import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// =============================================================================
// RELIABILITY: Internal timeout for stream uploads
// This ensures stalled streams don't hang forever
// =============================================================================
const STREAM_UPLOAD_TIMEOUT_MS = 25_000; // 25s internal timeout (less than API's 30s wrapper)

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

/**
 * Upload base64 image data to Cloudinary using streaming
 * This avoids size limits and memory issues with large images
 * 
 * RELIABILITY: Includes internal timeout to prevent infinite hangs
 */
export function uploadB64Stream(
  userId: string, 
  b64: string,
  options: {
    folder?: string;
    tags?: string[];
    context?: Record<string, string>;
  } = {}
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    // RELIABILITY: Track if we've already settled to prevent double-resolution
    let settled = false;
    
    // RELIABILITY: Internal timeout - reject if stream stalls
    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        console.error('[Cloudinary] Upload timed out after', STREAM_UPLOAD_TIMEOUT_MS, 'ms');
        reject(new Error('Cloudinary upload timed out - stream may have stalled'));
      }
    }, STREAM_UPLOAD_TIMEOUT_MS);
    
    const upload = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || `modern-mosaics/${userId.replace(/[^a-zA-Z0-9]/g, '_')}`,
        tags: options.tags || ['modern-mosaics', 'generated-image'],
        context: options.context || {},
        resource_type: 'image',
      },
      (error, result) => {
        // RELIABILITY: Clear timeout and check if already settled
        clearTimeout(timeoutId);
        if (settled) return; // Already timed out, ignore this callback
        settled = true;
        
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(error);
        } else if (result) {
          resolve({
            public_id: result.public_id,
            secure_url: result.secure_url,
            width: result.width,
            height: result.height,
            format: result.format,
            bytes: result.bytes,
          });
        } else {
          reject(new Error('No result from Cloudinary upload'));
        }
      }
    );

    // Convert base64 to buffer and create a readable stream
    try {
      const buffer = Buffer.from(b64, 'base64');
      streamifier.createReadStream(buffer).pipe(upload);
    } catch (err) {
      // RELIABILITY: Clear timeout on sync error
      clearTimeout(timeoutId);
      if (!settled) {
        settled = true;
        console.error('Error creating stream from base64:', err);
        reject(err);
      }
    }
  });
}

/**
 * Quick upload using data URI (for smaller images < 60MB)
 */
export async function uploadB64DataUri(
  userId: string,
  b64: string,
  options: {
    folder?: string;
    tags?: string[];
    context?: Record<string, string>;
  } = {}
): Promise<CloudinaryUploadResult> {
  const dataUri = `data:image/png;base64,${b64}`;
  
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: options.folder || `modern-mosaics/${userId.replace(/[^a-zA-Z0-9]/g, '_')}`,
    tags: options.tags || ['modern-mosaics', 'generated-image'],
    context: options.context || {},
  });

  return {
    public_id: result.public_id,
    secure_url: result.secure_url,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
  };
}
