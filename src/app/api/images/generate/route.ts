import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { generateImage } from '../../../../lib/openai';
import { requireAuth, getAuthenticatedUser } from '@/lib/api-auth';
import crypto from 'crypto';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';

// =============================================================================
// RELIABILITY: Timeout protection for legacy generate route
// 
// Investigation found this route had NO timeout - could hang forever.
// Now uses same timeout budget as main generate-and-upload route.
// =============================================================================
const OPENAI_TIMEOUT_MS = 65_000; // 65s timeout for OpenAI

function generateRequestId(): string {
  return crypto.randomBytes(8).toString('hex');
}

function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => {
        const err = new Error(`${operation} timed out after ${ms / 1000}s`);
        (err as any).isTimeout = true;
        reject(err);
      }, ms)
    )
  ]);
}

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const requestStart = Date.now();
  
  console.log(`[Generate] [${requestId}] API called`);
  
  try {
    // Verify user is authenticated
    const authStart = Date.now();
    const authError = await requireAuth(req);
    if (authError) {
      return authError;
    }
    
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', requestId }, { status: 401 });
    }

    const rateLimit = checkRateLimit(`images:generate:${user.uid}`, 10, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many image generation requests. Please wait and try again.', requestId },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    const authDuration = Date.now() - authStart;
    console.log(`[Generate] [${requestId}] Auth complete: ${authDuration}ms`);

    // Get parameters from request body
    const { prompt } = await req.json();
    const promptLength = prompt?.length || 0;
    
    if (!prompt) {
      console.log(`[Generate] [${requestId}] Error: No prompt provided`);
      return NextResponse.json(
        { error: 'Prompt is required', requestId },
        { status: 400 }
      );
    }
    console.log(`[Generate] [${requestId}] promptLength: ${promptLength}`);

    // RELIABILITY: Generate with timeout protection
    const openaiStart = Date.now();
    console.log(`[Generate] [${requestId}] Starting OpenAI generation...`);
    
    const raw = await withTimeout(
      generateImage({ prompt }),
      OPENAI_TIMEOUT_MS,
      'OpenAI generation'
    );
    
    const openaiDuration = Date.now() - openaiStart;
    console.log(`[Generate] [${requestId}] OpenAI complete: ${openaiDuration}ms`);
    
    // Handle the case where generateImage might return an array
    const imageData = Array.isArray(raw) ? raw[0] : raw;
    
    // Format the response
    const imageUrl = imageData.startsWith('http') 
      ? imageData 
      : `data:image/png;base64,${imageData}`;
    
    const totalDuration = Date.now() - requestStart;
    console.log(`[Generate] [${requestId}] Complete: ${totalDuration}ms (auth: ${authDuration}ms, openai: ${openaiDuration}ms)`);
    
    return NextResponse.json({ imageUrl, requestId }, { status: 200, headers: getRateLimitHeaders(rateLimit) });
    
  } catch (error: any) {
    const totalDuration = Date.now() - requestStart;
    const isTimeout = error.isTimeout === true || error.message?.includes('timed out');
    
    console.error(`[Generate] [${requestId}] Error after ${totalDuration}ms:`, error.message ?? error);
    
    let errorMessage = error.message || "Failed to generate image";
    let statusCode = 500;
    
    // Handle timeout
    if (isTimeout) {
      errorMessage = "The AI is taking longer than usual. Please try again.";
      statusCode = 408;
    }
    
    // Check for content policy violation
    else if (errorMessage.includes("content policy") || 
        errorMessage.includes("policy") || 
        errorMessage.includes("filtered")) {
      errorMessage = "Your prompt was flagged by the content filter. Please try a different prompt.";
      statusCode = 400;
    }
    
    // Check for rate limits
    else if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
      errorMessage = "Too many requests. Please wait a moment and try again.";
      statusCode = 429;
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      requestId,
    }, { status: statusCode });
  }
}
