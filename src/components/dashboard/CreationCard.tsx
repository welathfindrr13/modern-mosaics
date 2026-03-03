'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ensurePublicId } from '@/utils/gelatoUrls';

export interface CreationCardProps {
  id: string;
  imageUrl: string;
  publicId: string;
  prompt?: string;
  createdAt: string;
}

export function CreationCard({ id, imageUrl, publicId, prompt, createdAt }: CreationCardProps) {
  const router = useRouter();
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  
  const formattedDate = formatDate(createdAt);
  
  const handleOrderPrint = () => {
    const cleanPublicId = ensurePublicId(publicId);
    router.push(`/order?imageId=${id}&publicId=${encodeURIComponent(cleanPublicId)}`);
  };

  return (
    <div className="group glass-card overflow-hidden">
      <div className="aspect-square relative overflow-hidden">
        <Image
          src={imageUrl}
          alt={prompt || "Custom image"}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-110"
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
        />
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <button
              onClick={handleOrderPrint}
              className="w-full btn-gold text-sm py-2"
            >
              Order Print
            </button>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        {prompt && (
          <p className="text-sm text-dark-200 mb-2 line-clamp-2" title={prompt}>
            {prompt}
          </p>
        )}
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-dark-500">{formattedDate}</span>
          
          <Link
            href={`/order?imageUrl=${encodeURIComponent(imageUrl)}`}
            className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
          >
            View →
          </Link>
        </div>
      </div>
    </div>
  );
}
