import { redirect } from 'next/navigation';
import OrderClient from './OrderClient';

/**
 * Server component for the order page
 * Handles query parameters with server-side validation
 */
export default function OrderPage({
  searchParams,
}: {
  searchParams: { imageId?: string; publicId?: string; imageUrl?: string };
}) {
  // Extract image identifier from URL params
  const imageId = searchParams.imageId;
  const publicId = searchParams.publicId;
  const imageUrl = searchParams.imageUrl;
  
  // Prioritize: imageUrl (full URL) > publicId (Cloudinary ID) > imageId (database ID)
  const imageIdentifier = imageUrl || publicId || imageId;

  // Redirect to gallery if no image identifier provided
  if (!imageIdentifier) {
    redirect('/gallery');
  }
  
  return <OrderClient imageIdentifier={imageIdentifier} />;
}
