import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { requireAuth, getAuthenticatedUser } from '@/lib/api-auth';
import { getServerCloudinary } from '@/lib/cloudinary';
import { adminImageOperations, adminUserOperations } from '@/utils/firestore-admin';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    // Verify user is authenticated
    console.log("Image upload API called");
    const authError = await requireAuth(req);
    if (authError) {
      console.error("Authentication failed:", authError);
      return authError;
    }
    
    // Get authenticated user
    const user = await getAuthenticatedUser(req);
    if (!user) {
      console.error("User not found after authentication");
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }
    console.log("User authenticated:", user.email);

    const rateLimit = checkRateLimit(`images:upload:${user.uid}`, 20, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many upload requests. Please wait and try again.' },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      );
    }
    
    // Get the image data from request
    const { imageUrl, prompt, save = true, cloudinaryPublicId } = await req.json();
    
    // Check if we have either an imageUrl or cloudinaryPublicId
    if (!imageUrl && !cloudinaryPublicId) {
      console.log("Error: Neither image URL nor cloudinaryPublicId provided");
      return NextResponse.json({ error: 'Either imageUrl or cloudinaryPublicId is required' }, { status: 400 });
    }
    
    console.log("Prompt received:", prompt);
    console.log("Save to gallery:", save);
    console.log("Uploading image to Cloudinary...");
    
    // Determine the appropriate folder
    let folder;
    const userFolder = user.uid.replace(/[^a-zA-Z0-9]/g, '_');
    
    if (save) {
      // For saving to gallery, use the user's folder
      folder = `modern-mosaics/${userFolder}`;
    } else {
      // For temporary storage (like before upscaling), use a processing folder
      folder = 'modern-mosaics-processing';
    }
    
    // Setup tags based on save parameter
    const tags = ['modern-mosaics', 'generated-image'];
    if (!save) {
      tags.push('temp');
    }
    
    // Get Cloudinary instance
    let cloudinary;
    try {
      cloudinary = await getServerCloudinary();
      console.log("Cloudinary instance obtained successfully");
    } catch (cloudinaryError) {
      console.error("Failed to get Cloudinary instance:", cloudinaryError);
      return NextResponse.json({ error: 'Cloudinary configuration error' }, { status: 500 });
    }
    
    let uploadResult;
    
    try {
      if (cloudinaryPublicId) {
        // If we have a Cloudinary public ID (for example, after upscaling)
        console.log(`Using existing Cloudinary image: ${cloudinaryPublicId}`);
        
        // Get the URL of the existing image
        const existingUrl = cloudinary.url(cloudinaryPublicId, { secure: true });
        console.log(`Got URL for existing image: ${existingUrl}`);
        
        // Upload the existing image to the new location
        uploadResult = await cloudinary.uploader.upload(existingUrl, {
          folder,
          tags,
          context: {
            prompt: prompt || 'No prompt provided',
            user_email: user.email || 'anonymous',
            save_to_gallery: save ? 'true' : 'false'
          }
        });
      } else {
        // Otherwise upload the image URL to Cloudinary
        console.log(`Uploading image URL to Cloudinary, imageUrl type:`, typeof imageUrl);
        console.log(`Image URL length:`, imageUrl?.length);
        console.log(`Image URL starts with:`, imageUrl?.substring(0, 100));
        
        uploadResult = await cloudinary.uploader.upload(imageUrl, {
          folder,
          tags,
          context: {
            prompt: prompt || 'No prompt provided',
            user_email: user.email || 'anonymous',
            save_to_gallery: save ? 'true' : 'false'
          }
        });
      }
    } catch (uploadError: any) {
      console.error('Cloudinary upload failed:', uploadError);
      return NextResponse.json({ 
        error: `Failed to upload to Cloudinary: ${uploadError.message || 'Unknown error'}` 
      }, { status: 500 });
    }
    
    console.log("Image uploaded successfully:", uploadResult.public_id);
    
    // If saving to gallery, also save metadata to Firestore
    if (save && user.email) {
      try {
        // Use Firebase UID instead of email-based ID
        const userId = user.uid;
        
        // Ensure user document exists
        await adminUserOperations.createOrUpdate(userId, {
          email: user.email,
          firebaseUid: user.uid,
          displayName: user.name || user.email.split('@')[0],
          preferences: {
            currency: 'GBP',
            notifications: true
          }
        });
        
        // Save image metadata to Firestore
        const imageId = await adminImageOperations.create(userId, {
          cloudinaryPublicId: uploadResult.public_id,
          cloudinaryUrl: uploadResult.secure_url,
          prompt: prompt || '',
          metadata: {
            width: uploadResult.width || 1024,
            height: uploadResult.height || 1024,
            format: uploadResult.format || 'png',
            bytes: uploadResult.bytes || 0
          },
          tags: ['generated']
        });
        
        console.log("Image metadata saved to Firestore:", imageId);
      } catch (firestoreError) {
        console.error('Failed to save to Firestore:', firestoreError);
        // Continue anyway - Cloudinary upload was successful
      }
    }
    
    return NextResponse.json(
      {
        publicId: uploadResult.public_id,
        secureUrl: uploadResult.secure_url
      },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (error: any) {
    console.error('Image upload error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to upload image'
    }, { status: 500 });
  }
}
