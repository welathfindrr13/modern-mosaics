import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/firestore-admin', () => ({
  adminImageOperations: {
    getByCloudinaryPublicId: vi.fn(),
  },
}));

import {
  assertProductUidMatchesSizeKey,
  getProductSelectionByUid,
} from '@/data/printLabCatalog';
import { getDimensionsForProductUid } from '@/utils/printSizes';
import { makeCloudinaryPrintUrlForProductUid } from '@/utils/cloudinaryPrint';
import { verifyCheckoutImageOwnership } from '@/lib/checkout-image-ownership';
import { adminImageOperations } from '@/utils/firestore-admin';

const POSTER_12X16 = 'flat_300x400-mm-12x16-inch_170-gsm-65lb-uncoated_4-0_ver';
const CANVAS_12X16 = 'canvas_12x16-inch-300x400-mm_canvas_wood-fsc-slim_4-0_ver';

describe('commerce P0 helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'demo-cloud';
  });

  it('resolves enabled canonical product UIDs and rejects unknown or disabled UIDs', () => {
    expect(getProductSelectionByUid(POSTER_12X16)).toMatchObject({
      productType: 'poster',
      sizeKey: '12x16',
      productUid: POSTER_12X16,
      priceGBP: 26.99,
    });

    expect(getProductSelectionByUid('flat_600x900-mm-24x36-inch_170-gsm-65lb-uncoated_4-0_ver')).toBeNull();
    expect(getProductSelectionByUid('not-a-real-sku')).toBeNull();
  });

  it('rejects productUid and sizeKey conflicts', () => {
    expect(assertProductUidMatchesSizeKey(POSTER_12X16, '12x16')).toBe(true);
    expect(assertProductUidMatchesSizeKey(POSTER_12X16, '16x20')).toBe(false);
  });

  it('resolves canvas 12x16 using canvas dimensions instead of poster dimensions', () => {
    expect(getDimensionsForProductUid(CANVAS_12X16)).toEqual({ w: 4407, h: 5740 });
    expect(getDimensionsForProductUid(CANVAS_12X16)).not.toEqual(getDimensionsForProductUid(POSTER_12X16));
  });

  it('builds productUid print URLs with crop/source dimensions preserved', () => {
    const url = makeCloudinaryPrintUrlForProductUid(
      'modern-mosaics/user_1/image',
      CANVAS_12X16,
      'sharper',
      { x: 0.1, y: 0.2, width: 0.5, height: 0.6, rotation: 90 },
      2000,
      3000
    );

    expect(url).toContain('a_90/c_crop,x_200,y_600,w_1000,h_1800');
    expect(url).toContain('c_scale,w_4407,h_5740');
    expect(url).toContain('/q_90/f_jpg/modern-mosaics/user_1/image');
  });

  it('accepts Firestore-owned checkout images', async () => {
    vi.mocked(adminImageOperations.getByCloudinaryPublicId).mockResolvedValue({
      id: 'img_1',
      cloudinaryPublicId: 'some/legacy/path',
    } as any);

    await expect(verifyCheckoutImageOwnership('user_1', 'some/legacy/path')).resolves.toEqual({
      ok: true,
      proof: 'firestore',
    });
  });

  it('accepts strict current-user Cloudinary prefix fallback', async () => {
    vi.mocked(adminImageOperations.getByCloudinaryPublicId).mockResolvedValue(null);

    await expect(
      verifyCheckoutImageOwnership('user-1', 'modern-mosaics/user_1/generated-image')
    ).resolves.toEqual({ ok: true, proof: 'prefix' });
  });

  it('rejects processing, global, and foreign Cloudinary prefixes', async () => {
    vi.mocked(adminImageOperations.getByCloudinaryPublicId).mockResolvedValue(null);

    await expect(verifyCheckoutImageOwnership('user-1', 'modern-mosaics-processing/tmp')).resolves.toMatchObject({
      ok: false,
    });
    await expect(verifyCheckoutImageOwnership('user-1', 'sample')).resolves.toMatchObject({ ok: false });
    await expect(
      verifyCheckoutImageOwnership('user-1', 'modern-mosaics/other_user/generated-image')
    ).resolves.toMatchObject({ ok: false });
  });
});
