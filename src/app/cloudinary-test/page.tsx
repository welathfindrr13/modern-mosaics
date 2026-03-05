import { notFound } from 'next/navigation';

import CloudinaryTestPageClient from './CloudinaryTestPageClient';

export default function CloudinaryTestPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return <CloudinaryTestPageClient />;
}
