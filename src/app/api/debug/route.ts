import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import {
  getAuthenticatedUser,
  isDebugAdminEmail,
  requireDebugAdmin,
} from '@/lib/api-auth';
import { getServerCloudinary } from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';

/**
 * Debug endpoint for diagnosing API issues
 * Only active in development mode for security reasons
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    const accessResponse = await requireDebugAdmin(req, '/api/debug');
    if (accessResponse) {
      return accessResponse;
    }
  }
  
  const authUser = await getAuthenticatedUser(req);
  const hasEmail = Boolean(authUser?.email);

  const results = {
    timestamp: new Date().toISOString(),
    authentication: {
      authenticated: Boolean(authUser),
      hasEmail,
      isDebugAdmin: isDebugAdminEmail(authUser?.email),
    },
    environment: {
      cloudinary: {
        cloudNameConfigured: Boolean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME),
        apiKeyConfigured: Boolean(process.env.CLOUDINARY_API_KEY),
        apiSecretConfigured: Boolean(process.env.CLOUDINARY_API_SECRET),
        uploadPresetConfigured: Boolean(process.env.CLOUDINARY_UPLOAD_PRESET),
      },
    },
    cloudinary: {
      connected: false,
      rootFolderCount: null as number | null,
      sampleAssetAvailable: null as boolean | null,
      sampleAssetSummary: null as
        | { format: string | null; width: number | null; height: number | null; bytes: number | null }
        | null,
      userFolder: null as { checked: boolean; exists: boolean | null; imageCount: number | null } | null,
      error: null as string | null,
    },
    cookies: {
      present: req.cookies.getAll().length > 0,
      count: req.cookies.getAll().length,
    },
  };
  
  if (
    results.environment.cloudinary.cloudNameConfigured &&
    results.environment.cloudinary.apiKeyConfigured &&
    results.environment.cloudinary.apiSecretConfigured
  ) {
    try {
      const cloudinary = await getServerCloudinary();
      results.cloudinary.connected = true;

      try {
        const sampleResult = await cloudinary.api.resource('sample');
        results.cloudinary.sampleAssetAvailable = true;
        results.cloudinary.sampleAssetSummary = {
          format: typeof sampleResult.format === 'string' ? sampleResult.format : null,
          width: typeof sampleResult.width === 'number' ? sampleResult.width : null,
          height: typeof sampleResult.height === 'number' ? sampleResult.height : null,
          bytes: typeof sampleResult.bytes === 'number' ? sampleResult.bytes : null,
        };
      } catch {
        results.cloudinary.sampleAssetAvailable = false;
      }
      
      try {
        const foldersResult = await cloudinary.api.root_folders();
        results.cloudinary.rootFolderCount = Array.isArray(foldersResult.folders)
          ? foldersResult.folders.length
          : 0;

        if (authUser?.uid) {
          const userFolder = `modern-mosaics/${authUser.uid.replace(/[^a-zA-Z0-9]/g, '_')}`;
          try {
            const folderSearch = await cloudinary.search
              .expression(`folder:${userFolder}`)
              .max_results(1)
              .execute();
            
            results.cloudinary.userFolder = {
              checked: true,
              exists: true,
              imageCount: typeof folderSearch.total_count === 'number' ? folderSearch.total_count : 0,
            };
          } catch {
            results.cloudinary.userFolder = {
              checked: true,
              exists: false,
              imageCount: null,
            };
          }
        }
      } catch {
        results.cloudinary.rootFolderCount = null;
      }
    } catch (cloudinaryError: any) {
      results.cloudinary.error = 'Cloudinary check failed';
    }
  }
  
  return NextResponse.json(results);
}
