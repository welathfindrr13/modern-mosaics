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
  
  console.log(`OpenAI ${mode === 'edit' ? 'editing' : 'generating'} ${count} image(s) with prompt: ${prompt}`);

  try {
    /* ---------- edit mode ---------- */
    if (mode === 'edit') {
      if (!image) throw new Error('image required for edit');

      // For edit mode, we need to make multiple calls since OpenAI edit doesn't support n > 1
      if (count > 1) {
        console.log(`Making ${count} separate edit calls for multiple variants`);
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

        console.log(`Successfully generated ${imageUrls.length} edit variants`);
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
        
        console.debug("OpenAI raw response:", JSON.stringify(editResp, null, 2));

        const item = editResp.data?.[0];
        const b64Data = item?.b64_json;
        if (!b64Data) throw new Error('No image returned');
        
        const imageUrl = `data:image/png;base64,${b64Data}`;
        console.log("Image edit successful, returning response");
        return imageUrl;
      }
    }

    /* ---------- generate mode ---------- */
    // gpt-image-1 only supports n=1, so make multiple calls if count > 1
    if (count > 1) {
      console.log(`Making ${count} separate generation calls for multiple variants`);
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

      console.log(`Successfully generated ${imageUrls.length} images`);
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
      
      console.debug("OpenAI raw response:", JSON.stringify(genResp, null, 2));

      if (!genResp.data) {
        throw new Error('No data returned from OpenAI');
      }

      const item = genResp.data[0];
      const b64Data = item?.b64_json;
      if (!b64Data) throw new Error('No image data returned');
      
      const imageUrl = `data:image/png;base64,${b64Data}`;
      console.log("Image generation successful, returning response");
      return imageUrl;
    }
  } catch (error: any) {
    // Log the full error details with more context
    console.error("OpenAI image generation error:", error);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Error details:", JSON.stringify(error.response.data, null, 2));
      
      throw new Error(
        JSON.stringify({
          status: error.response.status,
          data: error.response.data,
          message: error.message || 'API error',
        })
      );
    }
    throw error;
  }
}

export default openai;
