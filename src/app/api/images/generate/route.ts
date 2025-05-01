import { NextResponse } from 'next/server';
import openai from '../../../../lib/openai';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function POST(req: Request) {
  console.log("Image generation API called");
  try {
    // Verify user is authenticated
    console.log("Checking authentication");
    const session = await getServerSession(authOptions);
    if (!session) {
      console.log("Unauthorized: No session found");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log("User authenticated:", session.user?.email);

    // Get the prompt from request body
    console.log("Parsing request body");
    const { prompt } = await req.json();
    
    if (!prompt) {
      console.log("Error: No prompt provided");
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }
    console.log("Prompt received:", prompt);

    // Call OpenAI API to generate image
    console.log("Calling OpenAI API with model: dall-e-3");
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
    });

    // Check if we have a valid response with data
    if (!response.data || response.data.length === 0) {
      return NextResponse.json(
        { error: 'No image was generated' },
        { status: 500 }
      );
    }

    // Return the generated image URL
    return NextResponse.json({ 
      imageUrl: response.data[0].url 
    });
  } catch (error: any) {
    console.error("OpenAI error:", error.response?.data ?? error);
    return NextResponse.json(error.response?.data ?? { error: "Unknown error" }, { status: 500 });
  }
}
