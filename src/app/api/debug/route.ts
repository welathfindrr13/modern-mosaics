import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { requireAuth, getUserEmail, isAuthenticated } from '@/lib/api-auth';
import { getServerCloudinary } from '@/lib/cloudinary';

function isDebugAdmin(email: string | null): boolean {
  if (!email) return false;
  const allowlist = (process.env.DEBUG_ADMIN_EMAILS || '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}

/**
 * Debug endpoint for diagnosing API issues
 * Only active in development mode for security reasons
 */
export async function GET(req: NextRequest) {
  // Development is open for local diagnosis. Non-dev requires explicit admin allowlist.
  if (process.env.NODE_ENV !== 'development') {
    const authResponse = await requireAuth(req);
    if (authResponse) {
      console.warn('[DEBUG_ACCESS_DENIED]', JSON.stringify({
        path: '/api/debug',
        reason: 'unauthenticated',
        env: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
      }));
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const email = await getUserEmail(req);
    if (!isDebugAdmin(email)) {
      console.warn('[DEBUG_ACCESS_DENIED]', JSON.stringify({
        path: '/api/debug',
        reason: 'not_allowlisted',
        hasEmail: Boolean(email),
        env: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
      }));
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }
  
  const results: any = {
    timestamp: new Date().toISOString(),
    authentication: {
      status: false,
      email: null,
    },
    environment: {
      cloudinary: {
        cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ? 'set' : 'missing',
        apiKey: process.env.CLOUDINARY_API_KEY ? 'set' : 'missing',
        apiSecret: process.env.CLOUDINARY_API_SECRET ? 'set' : 'missing',
        uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || 'not_set',
      },
    },
    cloudinary: {
      connected: false,
      folders: null,
      error: null,
    },
    cookies: {
      values: {},
    },
  };

  // Check authentication
  try {
    results.authentication.status = await isAuthenticated(req);
    results.authentication.email = await getUserEmail(req);
    
    // Create folder name as done in the gallery API
    if (results.authentication.email) {
      results.authentication.folder = `modern-mosaics/${results.authentication.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }
  } catch (authError: any) {
    results.authentication.error = authError.message;
  }
  
  // Check cookies
  req.cookies.getAll().forEach(cookie => {
    results.cookies.values[cookie.name] = '[REDACTED]';
  });
  
  // Check Cloudinary connection
  if (results.environment.cloudinary.cloudName === 'set' && 
      results.environment.cloudinary.apiKey === 'set' && 
      results.environment.cloudinary.apiSecret === 'set') {
    try {
      const cloudinary = await getServerCloudinary();
      results.cloudinary.connected = true;
      
      // Add image URL testing functionality
      results.cloudinary.imageTests = {
        sampleImage: `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/sample`,
        testUrls: []
      };
      
      // Test URL construction with sample image
      try {
        // Try to fetch sample image info to test connectivity
        const sampleResult = await cloudinary.api.resource('sample');
        results.cloudinary.imageTests.sampleExists = true;
        results.cloudinary.imageTests.sampleInfo = {
          format: sampleResult.format,
          width: sampleResult.width,
          height: sampleResult.height,
          bytes: sampleResult.bytes
        };
      } catch (sampleError: any) {
        results.cloudinary.imageTests.sampleExists = false;
        results.cloudinary.imageTests.sampleError = sampleError.message;
      }
      
      try {
        // Try to get root folders
        const foldersResult = await cloudinary.api.root_folders();
        results.cloudinary.folders = foldersResult.folders.map((f: any) => f.name);
        
        // If authenticated, try to check user folder
        if (results.authentication.folder) {
          try {
            // Try to search user's folder 
            const folderSearch = await cloudinary.search
              .expression(`folder:${results.authentication.folder}`)
              .max_results(1)
              .execute();
            
            results.cloudinary.userFolder = {
              exists: true,
              imageCount: folderSearch.total_count,
            };
          } catch (folderError: any) {
            // Usually means folder doesn't exist - that's normal for new users
            results.cloudinary.userFolder = {
              exists: false,
              error: folderError.message,
            };
          }
        }
      } catch (folderError: any) {
        results.cloudinary.foldersError = folderError.message;
      }
    } catch (cloudinaryError: any) {
      results.cloudinary.error = cloudinaryError.message;
    }
  }
  
  return NextResponse.json(results);
}
