import { NextResponse } from 'next/server';
import { z } from 'zod';

const trimString = (value: unknown) => {
  if (typeof value !== 'string') return value;
  return value.trim();
};

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

const requiredText = (field: string, max: number, min = 1) =>
  z.preprocess(
    trimString,
    z
      .string({ required_error: `${field} is required` })
      .min(min, `${field} is required`)
      .max(max, `${field} must be ${max} characters or fewer`)
  );

const optionalText = (field: string, max: number) =>
  z.preprocess(
    emptyStringToUndefined,
    z.string().max(max, `${field} must be ${max} characters or fewer`).optional()
  );

const positiveInt = (field: string, max: number) =>
  z
    .number({ invalid_type_error: `${field} must be a number` })
    .int(`${field} must be an integer`)
    .min(1, `${field} must be at least 1`)
    .max(max, `${field} must be ${max} or less`);

const safeIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,254}$/;
const sizeKeyPattern = /^[A-Za-z0-9-]{2,24}$/;
const dataImageUrlPattern = /^data:image\/(?:png|jpeg|jpg|webp|gif|heic|heif);base64,[A-Za-z0-9+/=\r\n]+$/i;
const countryCodePattern = /^[A-Za-z]{2}$/;

const safeIdentifier = (field: string) =>
  z.preprocess(
    trimString,
    z
      .string({ required_error: `${field} is required` })
      .min(1, `${field} is required`)
      .max(255, `${field} must be 255 characters or fewer`)
      .regex(safeIdentifierPattern, `${field} contains invalid characters`)
  );

export const cloudinaryPublicIdSchema = safeIdentifier('Cloudinary public ID').refine(
  (value) => !/^https?:\/\//i.test(value),
  'Cloudinary public ID must not be a URL'
);

export const imageDataUrlSchema = z.preprocess(
  trimString,
  z
    .string({ required_error: 'imageUrl is required' })
    .max(15_000_000, 'Image payload is too large')
    .regex(dataImageUrlPattern, 'imageUrl must be a base64 data image URL')
);

export const imageVerifyIdentifierSchema = z.preprocess(
  trimString,
  z
    .string({ required_error: 'Image identifier is required' })
    .min(1, 'Image identifier is required')
    .max(1024, 'Image identifier is too long')
);

export const uploadImageRequestSchema = z
  .object({
    imageUrl: imageDataUrlSchema.optional(),
    prompt: optionalText('Prompt', 500),
    save: z.boolean().optional().default(true),
    cloudinaryPublicId: cloudinaryPublicIdSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.imageUrl && !value.cloudinaryPublicId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either imageUrl or cloudinaryPublicId is required',
        path: ['imageUrl'],
      });
    }
  });

export const generateAndUploadRequestSchema = z.object({
  prompt: requiredText('Prompt', 2_000),
  provider: z.enum(['openai', 'gemini']).optional().default('openai'),
  saveToGallery: z.boolean().optional().default(true),
});

export const countryCodeSchema = z.preprocess(
  trimString,
  z
    .string({ required_error: 'Country is required' })
    .regex(countryCodePattern, 'Country must be a 2-letter code')
    .transform((value) => value.toUpperCase())
);

export const shippingAddressInputSchema = z.object({
  firstName: requiredText('First name', 80),
  lastName: requiredText('Last name', 80),
  line1: requiredText('Address line 1', 120),
  line2: optionalText('Address line 2', 120),
  city: requiredText('City', 80),
  state: optionalText('State', 80),
  postalCode: requiredText('Postal code', 32),
  country: z.preprocess(
    trimString,
    countryCodeSchema
  ),
  email: z.preprocess(
    emptyStringToUndefined,
    z.string().email('Invalid email address').max(254, 'Email is too long').optional()
  ),
  phone: optionalText('Phone', 32),
});

export const orderQuoteRequestSchema = z.object({
  productUid: safeIdentifier('Product UID'),
  quantity: positiveInt('Quantity', 10).optional(),
  shippingAddress: shippingAddressInputSchema,
});

const enhancementKeys = ['enhance', 'warmer', 'cooler', 'brighter', 'sharper', 'denoise'] as const;
export const transformsSchema = z.preprocess(
  emptyStringToUndefined,
  z
    .string()
    .max(120, 'Transforms value is too long')
    .refine((value) => {
      const tokens = value.split(',').map((token) => token.trim()).filter(Boolean);
      return tokens.length > 0 && tokens.every((token) => enhancementKeys.includes(token as (typeof enhancementKeys)[number]));
    }, 'Transforms contain unsupported enhancement keys')
    .transform((value) =>
      Array.from(new Set(value.split(',').map((token) => token.trim()).filter(Boolean))).join(',')
    )
    .optional()
);

export const checkoutSessionRequestSchema = z.object({
  productUid: safeIdentifier('Product UID'),
  imagePublicId: cloudinaryPublicIdSchema,
  shippingAddress: shippingAddressInputSchema,
  shippingMethodUid: safeIdentifier('Shipping method UID'),
  productName: requiredText('Product name', 120),
  quantity: positiveInt('Quantity', 1).optional(),
  shippingCost: z
    .number({ invalid_type_error: 'Shipping cost must be a number' })
    .finite('Shipping cost must be finite')
    .min(0, 'Shipping cost must be zero or greater')
    .max(10_000, 'Shipping cost is too large'),
  shippingCurrency: z.preprocess(
    emptyStringToUndefined,
    z.string().length(3, 'Shipping currency must be a 3-letter code').transform((value) => value.toUpperCase()).optional()
  ),
  productPrice: z.number().finite().optional(),
  total: z.number().finite().optional(),
  transforms: transformsSchema,
  sizeKey: z.preprocess(
    emptyStringToUndefined,
    z.string().regex(sizeKeyPattern, 'Invalid size key').optional()
  ),
  size: z.preprocess(
    emptyStringToUndefined,
    z.string().regex(sizeKeyPattern, 'Invalid size').optional()
  ),
  cropParams: optionalText('Crop params', 512),
  sourceWidth: positiveInt('Source width', 20_000).optional(),
  sourceHeight: positiveInt('Source height', 20_000).optional(),
});

export const orderIdSchema = z.preprocess(
  trimString,
  z
    .string({ required_error: 'Order ID is required' })
    .min(3, 'Order ID is required')
    .max(128, 'Order ID is too long')
    .regex(/^[A-Za-z0-9_#-]+$/, 'Order ID contains invalid characters')
);

export const imageVerifyRequestSchema = z.object({
  imageIdentifier: imageVerifyIdentifierSchema,
});

export const generateImageRequestSchema = z.object({
  prompt: requiredText('Prompt', 2_000),
});

export const imageRouteParamsSchema = z.object({
  imageId: safeIdentifier('Image ID'),
});

export const pricingOptionsQuerySchema = z.object({
  productType: z.enum(['poster', 'canvas', 'fine_art']),
  country: countryCodeSchema,
});

export const pricingPreviewQuerySchema = z
  .object({
    productUid: z.preprocess(emptyStringToUndefined, safeIdentifier('Product UID').optional()),
    productType: z.preprocess(
      emptyStringToUndefined,
      z.enum(['poster', 'canvas', 'fine_art']).optional()
    ),
    sizeKey: z.preprocess(
      emptyStringToUndefined,
      z.string().regex(sizeKeyPattern, 'Invalid size key').optional()
    ),
    country: countryCodeSchema,
  })
  .superRefine((value, ctx) => {
    if (!value.productUid && !(value.productType && value.sizeKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide productUid or both productType and sizeKey.',
        path: ['productUid'],
      });
    }
  });

export const pricingPreviewBatchRequestSchema = z.object({
  country: countryCodeSchema,
  items: z
    .array(
      z.object({
        productType: z.enum(['poster', 'canvas', 'fine_art']),
        sizeKey: z.string().regex(sizeKeyPattern, 'Invalid size key'),
      })
    )
    .min(1, 'At least one pricing item is required')
    .max(20, 'Too many pricing items requested'),
});

export const checkoutSuccessQuerySchema = z.object({
  session_id: z.preprocess(
    trimString,
    z
      .string({ required_error: 'Missing session ID' })
      .min(1, 'Missing session ID')
      .max(255, 'Session ID is too long')
      .transform((value) => value.split('?')[0].trim())
      .refine((value) => value.startsWith('cs_'), 'Invalid session ID format')
  ),
  confirmationNonce: z.preprocess(
    trimString,
    z
      .string({ required_error: 'Missing or invalid confirmation nonce' })
      .min(1, 'Missing or invalid confirmation nonce')
      .max(255, 'Confirmation nonce is too long')
  ),
});

export const telemetryEventRequestSchema = z.object({
  event: z.preprocess(
    trimString,
    z
      .string({ required_error: 'Event name is required' })
      .min(2, 'Event name is invalid')
      .max(64, 'Event name is invalid')
      .regex(/^[a-z0-9_:-]{2,64}$/i, 'Invalid event name.')
  ),
  properties: z.unknown().optional(),
  pathname: optionalText('Pathname', 120),
});

export const ordersCreateRequestSchema = z.object({
  productUid: safeIdentifier('Product UID'),
  imagePublicId: cloudinaryPublicIdSchema,
  shippingAddress: shippingAddressInputSchema,
  shippingMethodUid: safeIdentifier('Shipping method UID'),
  size: z.preprocess(
    trimString,
    z
      .string({ required_error: 'Size is required' })
      .min(2, 'Size is required')
      .max(24, 'Size is invalid')
      .regex(sizeKeyPattern, 'Invalid size')
  ),
  quantity: positiveInt('Quantity', 10).optional(),
  currency: z.preprocess(
    emptyStringToUndefined,
    z.string().length(3, 'Currency must be a 3-letter code').transform((value) => value.toUpperCase()).optional()
  ),
  transforms: transformsSchema,
  cropParams: z
    .union([
      optionalText('Crop params', 512),
      z
        .object({
          x: z.number().finite(),
          y: z.number().finite(),
          width: z.number().finite().positive(),
          height: z.number().finite().positive(),
          rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
        })
        .optional(),
    ])
    .optional(),
  sourceWidth: positiveInt('Source width', 20_000).optional(),
  sourceHeight: positiveInt('Source height', 20_000).optional(),
});

const cloudinaryHostSchema = z.preprocess(
  trimString,
  z
    .string({ required_error: 'imageUrl is required' })
    .url('imageUrl must be a valid URL')
    .refine((value) => {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      if (!cloudName) return false;
      try {
        const parsed = new URL(value);
        return (
          parsed.protocol === 'https:' &&
          parsed.hostname === 'res.cloudinary.com' &&
          parsed.pathname.startsWith(`/${cloudName}/`)
        );
      } catch {
        return false;
      }
    }, 'imageUrl must be a Cloudinary HTTPS URL for the configured cloud')
);

export const upscaleRequestSchema = z.object({
  imageUrl: cloudinaryHostSchema,
  sourceWidth: positiveInt('sourceWidth', 20_000),
  sourceHeight: positiveInt('sourceHeight', 20_000),
  targetWidth: positiveInt('targetWidth', 20_000),
  targetHeight: positiveInt('targetHeight', 20_000),
  uploadToCloudinary: z.boolean().optional().default(true),
});

export const orderStatusRequestSchema = z.object({
  orderId: orderIdSchema,
});

export function getValidationMessage(error: z.ZodError): string {
  return error.issues[0]?.message || 'Invalid input';
}

export function extractBase64ImageData(dataUrl: string): string {
  const [, base64 = ''] = dataUrl.split(',', 2);
  return base64.replace(/\s+/g, '');
}

export function estimateBase64DecodedBytes(base64: string): number {
  const normalized = base64.replace(/\s+/g, '');
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}

type ParseSuccess<T> = { success: true; data: T };
type ParseFailure = { success: false; response: NextResponse };
type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export async function parseJsonWithSchema<S extends z.ZodTypeAny>(
  request: Request,
  schema: S
): Promise<ParseResult<z.infer<S>>> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return {
      success: false,
      response: NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(rawBody);
  if (!parsed.success) {
    return {
      success: false,
      response: NextResponse.json({ error: getValidationMessage(parsed.error) }, { status: 400 }),
    };
  }

  return { success: true, data: parsed.data };
}

export function parseSearchParamsWithSchema<S extends z.ZodTypeAny>(
  searchParams: URLSearchParams,
  schema: S
): ParseResult<z.infer<S>> {
  const parsed = schema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) {
    return {
      success: false,
      response: NextResponse.json({ error: getValidationMessage(parsed.error) }, { status: 400 }),
    };
  }

  return { success: true, data: parsed.data };
}

export function parseRouteParamsWithSchema<S extends z.ZodTypeAny>(
  params: Record<string, string | string[] | undefined>,
  schema: S
): ParseResult<z.infer<S>> {
  const normalized = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
  );
  const parsed = schema.safeParse(normalized);
  if (!parsed.success) {
    return {
      success: false,
      response: NextResponse.json({ error: getValidationMessage(parsed.error) }, { status: 400 }),
    };
  }

  return { success: true, data: parsed.data };
}
