import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthenticatedUser = vi.fn();
const verifyCheckoutImageOwnership = vi.fn();
const searchExecute = vi.fn();
const resource = vi.fn();
const getServerCloudinary = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue(null),
  getAuthenticatedUser,
}));

vi.mock('@/lib/rate-limit', () => ({
  buildRateLimitKey: vi.fn().mockReturnValue('images:verify:user-1'),
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, resetTime: Date.now() + 1000 }),
  createRateLimitResponse: vi.fn(),
  getRateLimitHeaders: vi.fn().mockReturnValue({}),
  resolveRateLimitPolicy: vi.fn().mockReturnValue({ limit: 10, windowMs: 60_000, message: 'limited', body: {} }),
}));

vi.mock('@/lib/checkout-image-ownership', () => ({
  verifyCheckoutImageOwnership,
}));

vi.mock('@/lib/cloudinary', () => ({
  getServerCloudinary,
}));

function verifyRequest(imageIdentifier: string) {
  return {
    json: vi.fn().mockResolvedValue({ imageIdentifier }),
    headers: new Headers(),
  } as any;
}

describe('/api/images/verify ownership hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUser.mockResolvedValue({ uid: 'user-1', email: 'buyer@example.com' });
    verifyCheckoutImageOwnership.mockResolvedValue({ ok: true, proof: 'firestore' });
    searchExecute.mockResolvedValue({
      resources: [
        {
          format: 'jpg',
          width: 1200,
          height: 900,
          bytes: 12345,
          secure_url: 'https://res.cloudinary.com/demo/image/upload/owned.jpg',
        },
      ],
    });
    resource.mockResolvedValue({
      format: 'jpg',
      width: 1200,
      height: 900,
      bytes: 12345,
      secure_url: 'https://res.cloudinary.com/demo/image/upload/owned.jpg',
    });
    getServerCloudinary.mockResolvedValue({
      search: {
        expression: vi.fn(() => ({
          max_results: vi.fn(() => ({
            execute: searchExecute,
          })),
        })),
      },
      api: { resource },
    });
  });

  it('rejects foreign images before checking Cloudinary existence', async () => {
    const { POST } = await import('@/app/api/images/verify/route');
    verifyCheckoutImageOwnership.mockResolvedValueOnce({
      ok: false,
      reason: 'Image is not owned by the authenticated user.',
    });

    const response = await POST(verifyRequest('modern-mosaics/other_user/image'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      exists: false,
      code: 'FORBIDDEN_IMAGE',
    });
    expect(getServerCloudinary).not.toHaveBeenCalled();
    expect(searchExecute).not.toHaveBeenCalled();
    expect(resource).not.toHaveBeenCalled();
  });

  it('rejects global, temp, and processing image IDs before ownership or Cloudinary checks', async () => {
    const { POST } = await import('@/app/api/images/verify/route');

    for (const publicId of ['sample', 'temp/upload', 'modern-mosaics-processing/tmp']) {
      vi.clearAllMocks();
      getAuthenticatedUser.mockResolvedValue({ uid: 'user-1', email: 'buyer@example.com' });

      const response = await POST(verifyRequest(publicId));
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body).toMatchObject({
        exists: false,
        code: 'FORBIDDEN_IMAGE',
      });
      expect(verifyCheckoutImageOwnership).not.toHaveBeenCalled();
      expect(getServerCloudinary).not.toHaveBeenCalled();
    }
  });

  it('returns the existing response shape for owned images', async () => {
    const { POST } = await import('@/app/api/images/verify/route');

    const response = await POST(verifyRequest('modern-mosaics/user_1/image'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(verifyCheckoutImageOwnership).toHaveBeenCalledWith('user-1', 'modern-mosaics/user_1/image');
    expect(body).toMatchObject({
      exists: true,
      publicId: 'modern-mosaics/user_1/image',
      imageDetails: {
        width: 1200,
        height: 900,
      },
    });
  });
});
