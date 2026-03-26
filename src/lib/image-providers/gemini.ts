/**
 * Gemini Image Provider
 * 
 * Generates images using Google's Gemini models.
 * Uses the @google/genai SDK.
 */

import { GoogleGenAI } from '@google/genai';
import type { GenerateImageRequest, GeneratedImage, AspectRatio } from './types';

// Models to try in order of preference
const IMAGE_GENERATION_MODELS = [
  'gemini-2.0-flash-exp',           // Experimental with image generation
  'gemini-2.0-flash-preview-image-generation',
  'gemini-exp-1206',                // Another experimental model
];

// Initialize Gemini client
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable');
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Estimate dimensions based on aspect ratio
 */
function estimateDimensions(aspectRatio?: AspectRatio): { width: number; height: number } {
  const ratio = aspectRatio || '1:1';
  
  switch (ratio) {
    case '1:1':
      return { width: 1024, height: 1024 };
    case '4:5':
      return { width: 1024, height: 1280 };
    case '2:3':
      return { width: 1024, height: 1536 };
    case '3:4':
      return { width: 1024, height: 1365 };
    case '16:9':
      return { width: 1024, height: 576 };
    case '9:16':
      return { width: 576, height: 1024 };
    default:
      return { width: 1024, height: 1024 };
  }
}

/**
 * Try to generate an image with a specific model
 */
async function tryGenerateWithModel(
  client: GoogleGenAI,
  modelName: string,
  prompt: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    console.log('[Gemini] Trying model', { modelName });
    
    const response = await client.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      return { success: false, error: 'No candidates in response' };
    }

    const content = candidates[0].content;
    if (!content || !content.parts) {
      return { success: false, error: 'No content parts in response' };
    }

    // Look for inline image data
    for (const part of content.parts) {
      if (part.inlineData && part.inlineData.data) {
        return { success: true, data: part.inlineData };
      }
    }

    return { success: false, error: 'No image data in response - model may not support image generation' };
  } catch (error: any) {
    console.log('[Gemini] Model failed', { modelName, message: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Generate an image using Google's Gemini model
 * Tries multiple models until one works
 */
export async function generateWithGemini(
  request: Omit<GenerateImageRequest, 'provider'>
): Promise<GeneratedImage> {
  const { prompt, aspectRatio } = request;

  if (!prompt) {
    throw new Error('Prompt is required');
  }

  console.log('[Gemini] Generating image', { promptLength: prompt.length, aspectRatio: aspectRatio || '1:1' });

  const client = getGeminiClient();
  let lastError = '';

  // Try each model until one works
  for (const modelName of IMAGE_GENERATION_MODELS) {
    const result = await tryGenerateWithModel(client, modelName, prompt);
    
    if (result.success && result.data) {
      console.log('[Gemini] Generation successful', { modelName });
      const dimensions = estimateDimensions(aspectRatio);
      
      return {
        provider: 'gemini',
        base64: result.data.data,
        width: dimensions.width,
        height: dimensions.height,
        mimeType: result.data.mimeType || 'image/png',
      };
    }
    
    lastError = result.error || 'Unknown error';
  }

  // If all models failed, throw a helpful error
  console.error('[Gemini] All models failed', { promptLength: prompt.length, lastError });

  if (lastError.includes('SAFETY') || lastError.includes('blocked')) {
    throw new Error(
      'Your prompt was flagged by Gemini\'s safety filters. ' +
      'Please try a different prompt.'
    );
  }

  if (lastError.includes('quota') || lastError.includes('429')) {
    throw new Error(
      'Gemini API rate limit exceeded. Please try again later.'
    );
  }

  // Generic error - suggest they might need to enable Imagen API
  throw new Error(
    'Gemini image generation is not available. ' +
    'This may require enabling the Imagen API in Google Cloud Console, ' +
    'or your API key may not have access to image generation models. ' +
    'Try using OpenAI instead.'
  );
}

/**
 * Generate multiple images using Gemini (makes parallel calls)
 */
export async function generateMultipleWithGemini(
  request: Omit<GenerateImageRequest, 'provider'>,
  count: number
): Promise<GeneratedImage[]> {
  console.log('[Gemini] Generating images in parallel', { count, promptLength: request.prompt.length });

  const promises = Array.from({ length: count }, () =>
    generateWithGemini(request)
  );

  const results = await Promise.all(promises);
  console.log('[Gemini] Parallel generation complete', { count: results.length });

  return results;
}
