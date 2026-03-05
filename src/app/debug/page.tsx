import { notFound } from 'next/navigation';

import DebugPageClient from './DebugPageClient';

export default function DebugPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return <DebugPageClient />;
}
