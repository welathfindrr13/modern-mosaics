import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY environment variable');
}

// =============================================================================
// RELIABILITY: OpenAI SDK configured with explicit timeout
// 
// Investigation found the default SDK has no timeout, causing requests to hang
// forever when OpenAI is unresponsive. This ensures real cancellation.
// 
// - timeout: 65s (matches server-side wrappers)
// - maxRetries: 0 (no automatic retries - handled at higher level)
// =============================================================================
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 65_000,
  maxRetries: 0,
});

console.log('OpenAI client initialized with 65s timeout');

export interface GenArgs {
  prompt: string;
  mode?: 'edit';
  image?: File;
  mask?: File;
  count?: number; // Number of images to generate
  quality?: 'standard' | 'high';
}

/**
 * Generate or edit an image via gpt‑image‑1.
 * @param args Generation arguments.
 * @returns URL(s) of the resulting image(s). Returns string for single image, string[] for multiple.
 */
export async function generateImage(args: GenArgs): Promise<string | string[]> {
  const { prompt, mode, image, mask, count = 1, quality = 'standard' } = args;

  if (!prompt) throw new Error('Prompt is required');

  console.log('OpenAI request started', {
    mode: mode === 'edit' ? 'edit' : 'generate',
    count,
    promptLength: prompt.length,
    quality,
    hasMask: Boolean(mask),
  });

  try {
    /* ---------- edit mode ---------- */
    if (mode === 'edit') {
      if (!image) throw new Error('image required for edit');

      // For edit mode, we need to make multiple calls since OpenAI edit doesn't support n > 1
      if (count > 1) {
        const promises = Array.from({ length: count }, () =>
          openai.images.edit({
            model: 'gpt-image-1.5',
            prompt,
            image,
            ...(mask && { mask }),
            size: '1024x1024',
            // gpt-image-1 doesn't support quality or response_format parameters
            // It always returns base64 by default
          })
        );

        const responses = await Promise.all(promises);
        const imageUrls = responses.map(resp => {
          const item = resp.data?.[0];
          const b64Data = item?.b64_json;
          if (!b64Data) throw new Error('No image data returned');
          return `data:image/png;base64,${b64Data}`;
        });

        console.log(`OpenAI edit completed with ${imageUrls.length} variants`);
        return imageUrls;
      } else {
        // Single edit
        const editResp = await openai.images.edit({
          model: 'gpt-image-1.5',
          prompt,
          image,
          ...(mask && { mask }),
          size: '1024x1024',
          // gpt-image-1 doesn't support quality or response_format parameters
          // It always returns base64 by default
        });
        const item = editResp.data?.[0];
        const b64Data = item?.b64_json;
        if (!b64Data) throw new Error('No image returned');
        
        const imageUrl = `data:image/png;base64,${b64Data}`;
        console.log('OpenAI edit completed successfully');
        return imageUrl;
      }
    }

    /* ---------- generate mode ---------- */
    // gpt-image-1 only supports n=1, so make multiple calls if count > 1
    if (count > 1) {
      const promises = Array.from({ length: count }, () =>
        openai.images.generate({
          model: 'gpt-image-1.5',
          prompt,
          n: 1,
          size: '1024x1024',
          // gpt-image-1 doesn't support quality or response_format parameters
          // It always returns base64 by default
        })
      );

      const responses = await Promise.all(promises);
      const imageUrls = responses.map(resp => {
        const item = resp.data?.[0];
        const b64Data = item?.b64_json;
        if (!b64Data) throw new Error('No image data returned');
        return `data:image/png;base64,${b64Data}`;
      });

      console.log(`OpenAI generation completed with ${imageUrls.length} images`);
      return imageUrls;
    } else {
      // Single generation
      const genResp = await openai.images.generate({
        model: 'gpt-image-1.5',
        prompt,
        n: 1,
        size: '1024x1024',
        // gpt-image-1 doesn't support quality or response_format parameters
        // It always returns base64 by default
      });
      if (!genResp.data) {
        throw new Error('No data returned from OpenAI');
      }

      const item = genResp.data[0];
      const b64Data = item?.b64_json;
      if (!b64Data) throw new Error('No image data returned');
      
      const imageUrl = `data:image/png;base64,${b64Data}`;
      console.log('OpenAI generation completed successfully');
      return imageUrl;
    }
  } catch (error: any) {
    const statusCode = error?.response?.status;
    const message = typeof error?.message === 'string' ? error.message : 'API error';
    console.error('OpenAI image generation failed', {
      mode: mode === 'edit' ? 'edit' : 'generate',
      count,
      promptLength: prompt.length,
      statusCode,
      message,
    });
    if (statusCode) {
      throw new Error(`OpenAI API error (${statusCode}): ${message}`);
    }
    throw error;
  }
}

export default openai;
