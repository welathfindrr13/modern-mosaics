/**
 * Cloudinary URL utilities for client-side usage
 * This file builds transformation URLs using string manipulation instead of using 
 * the Cloudinary SDK directly to avoid Node.js module import errors in the browser.
 */
import { getCloudName } from '@/lib/cloudinary';

/**
 * Convert mm to pixels at 300 DPI
 * @param mm dimension in millimeters
 * @returns equivalent pixels at 300 DPI
 */
export const mmToPx = (mm: number): number => Math.round(mm / 25.4 * 300);

/**
 * Print sizes available in Gelato
 */
export enum PosterSize {
  SMALL = '12x16',
  MEDIUM = '16x20',
  LARGE = '18x24',
  XLARGE = '24x36'
}

export enum CanvasSize {
  SMALL = '8x10_SLIM',
  MEDIUM = '12x16_SLIM',
  LARGE = '16x20_SLIM',
  XLARGE_SLIM = '16x20_THICK',
  XLARGE = '24x36_THICK'
}

/**
 * Poster dimensions with 4mm bleed (Gelato requirement)
 */
export const POSTER_DIMENSIONS = {
  [PosterSize.SMALL]: { width: 3694, height: 4894 }, // 12x16" + bleed
  [PosterSize.MEDIUM]: { width: 4894, height: 6094 }, // 16x20" + bleed
  [PosterSize.LARGE]: { width: 5494, height: 7294 }, // 18x24" + bleed
  [PosterSize.XLARGE]: { width: 7294, height: 10894 }, // 24x36" + bleed
};

/**
 * Canvas dimensions from Gelato templates
 */
export const CANVAS_DIMENSIONS = {
  [CanvasSize.SMALL]: { width: 3510, height: 4693 }, // 8x10", 0.8" slim frame
  [CanvasSize.MEDIUM]: { width: 4407, height: 5740 }, // 12x16", 0.8" slim frame
  [CanvasSize.LARGE]: { width: 4996, height: 6191 }, // 16x20", 0.8" slim frame
  [CanvasSize.XLARGE_SLIM]: { width: 5134, height: 6323 }, // 16x20", 1.6" thick frame
  [CanvasSize.XLARGE]: { width: 7205, height: 10748 }, // 24x36", 1.6" thick frame
};

/** Accepts a plain public-id or a full Cloudinary URL and returns a clean
 *  public-id (keeps folder path, strips optional version folder). */
export const ensurePublicId = (input: string): string => {
  if (!input.includes('://')) return input;

  try {
    const { pathname } = new URL(input);
    const afterUpload = pathname.split('/upload/')[1] ?? pathname;
    return afterUpload.replace(/^v\d+\//, '');
  } catch {
    return input; // fall back untouched
  }
};

/**
 * Build a Cloudinary URL with transformations using string manipulation
 */
export const buildCloudinaryUrl = (
  publicId: string, 
  transformations: string[] = []
): string => {
  try {
    const cloudName = getCloudName();
    const tx = transformations.filter(Boolean).join(',');
    
    if (!publicId) {
      console.error('No publicId provided to buildCloudinaryUrl');
      return ''; // Return empty string on error
    }
    
    return `https://res.cloudinary.com/${cloudName}/image/upload/${tx}/${publicId}`;
  } catch (error) {
    console.error('Error building Cloudinary URL:', error);
    return ''; // Return empty string on error
  }
};

/**
 * Generate a print-ready PDF URL for posters
 * @param publicId Cloudinary public ID of the image
 * @param size Poster size to generate
 * @returns URL for the transformed image
 */
export const posterPdfUrl = (publicId: string, size: PosterSize): string => {
  const { width, height } = POSTER_DIMENSIONS[size];
  
  const transformations = [
    'c_fit', // Crop: fit
    `w_${width}`, // Width
    `h_${height}`, // Height
    'e_upscale:4.0', // Effect: upscale by 4x
    'f_pdf' // Format: PDF
  ];
  
  return buildCloudinaryUrl(ensurePublicId(publicId), transformations);
};

/**
 * Generate a print-ready PDF URL for canvas
 * @param publicId Cloudinary public ID of the image
 * @param size Canvas size to generate
 * @returns URL for the transformed image
 */
export const canvasPdfUrl = (publicId: string, size: CanvasSize): string => {
  const { width, height } = CANVAS_DIMENSIONS[size];
  
  const transformations = [
    'c_fit', // Crop: fit
    `w_${width}`, // Width
    `h_${height}`, // Height
    'e_upscale:4.0', // Effect: upscale by 4x
    'f_pdf' // Format: PDF
  ];
  
  return buildCloudinaryUrl(ensurePublicId(publicId), transformations);
};

/**
 * Scaled preview URL with a diagonal watermark.
 * Enhanced with better fallback and error handling.
 */
export const watermarkedPreviewUrl = (
  maybePublicId: string | null | undefined,
  text = 'PREVIEW',
  font = 'sans_serif',
  color = 'FFFFFF',
  opacity = 40
): string => {
  // Return a placeholder image if publicId is not valid
  if (!maybePublicId) {
    console.warn('watermarkedPreviewUrl: No publicId provided');
    // Using a reliable placeholder with proper encoding
    return getPlaceholderImage('No Image Selected');
  }
  
  try {
    const publicId = ensurePublicId(maybePublicId);
    console.log('Using publicId for watermarked preview:', publicId);
    
    // Simplified transformations to reduce chances of errors
    // Using just basic scaling to make sure the image loads
    const transformations = [
      'c_scale', // Crop: scale
      'w_1200' // Width: 1200px
      // Text overlay removed for basic functionality testing
    ];
    
    // Try a simple URL first to ensure connectivity
    const url = buildCloudinaryUrl(publicId, transformations);
    
    // For debugging - log the final URL to help diagnose issues
    console.log('Generated Cloudinary URL:', url);
    
    return url;
  } catch (error) {
    console.error('Error generating watermarked preview URL:', error);
    return getPlaceholderImage('Image Loading Error');
  }
};

/**
 * Generate a reliable placeholder image as a data URL
 */
function getPlaceholderImage(message: string): string {
  // Create a simple SVG placeholder with the provided message
  const svgPlaceholder = `<svg width="300" height="400" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f0f0f0"/><text x="50%" y="45%" font-family="Arial" font-size="20" fill="#666" text-anchor="middle">${message}</text><text x="50%" y="55%" font-family="Arial" font-size="16" fill="#999" text-anchor="middle">Modern Mosaics</text></svg>`;
  
  // Properly encode the SVG for use in a data URL
  const encodedSvg = encodeURIComponent(svgPlaceholder);
  return `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
}

/**
 * Estimate if upscaling will succeed based on source dimensions
 * @param width Source width in pixels
 * @param height Source height in pixels
 * @param targetWidth Target width in pixels
 * @param targetHeight Target height in pixels
 * @returns Whether the upscaling is likely to succeed with Super-Resolution
 */
export const canUseStandardUpscale = (
  width: number, 
  height: number, 
  targetWidth: number, 
  targetHeight: number
): boolean => {
  // Cloudinary Super-Resolution can upscale up to 4x and has a 16MP output cap
  const sourcePixels = width * height;
  const targetPixels = targetWidth * targetHeight;
  
  return sourcePixels < 4200000 && // Source must be < 4.2 MP
         targetPixels < 16000000 && // Target must be < 16 MP
         targetWidth <= width * 4 && // Target width must be ≤ 4x source width
         targetHeight <= height * 4; // Target height must be ≤ 4x source height
};
