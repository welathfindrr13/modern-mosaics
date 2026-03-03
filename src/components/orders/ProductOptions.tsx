'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { formatPrice, calculateSmartPrice } from '@/utils/priceUtils';
import { Spinner } from '@/components/ui/spinner';

export interface Product {
  uid: string;
  name: string;
  basePrice?: number;
  thumbnailUrl?: string;
  description?: string;
  currency?: string;
}

interface ProductOptionsProps {
  products: Product[];
  selectedProductUid?: string;
  onSelectProduct: (product: Product) => void;
  isLoading?: boolean;
}

// Get product icon based on type
function getProductIcon(uid: string): string {
  if (uid.startsWith('canvas_')) return '🖼️';
  if (uid.includes('archival') || uid.includes('fine-art')) return '🎨';
  return '📄';
}

// Get size from product name
function extractSize(name: string): string {
  const sizeMatch = name.match(/(\d+[×x]\d+["″]?)/i);
  return sizeMatch ? sizeMatch[1] : '';
}

/**
 * Premium product options with elegant light theme
 */
export default function ProductOptions({
  products,
  selectedProductUid,
  onSelectProduct,
  isLoading = false
}: ProductOptionsProps) {
  const [selectedUid, setSelectedUid] = useState<string | undefined>(selectedProductUid);
  
  useEffect(() => {
    if (selectedProductUid !== undefined) {
      setSelectedUid(selectedProductUid);
    } else if (products.length > 0 && !selectedUid) {
      setSelectedUid(products[0].uid);
      onSelectProduct(products[0]);
    }
  }, [selectedProductUid, products, selectedUid, onSelectProduct]);

  const handleSelect = (product: Product) => {
    setSelectedUid(product.uid);
    onSelectProduct(product);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <Spinner size="large" />
          <p className="mt-3 text-gray-500 text-sm">Loading products...</p>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12 px-6 bg-gray-50 rounded-xl border border-gray-100">
        <span className="text-4xl mb-3 block">📦</span>
        <p className="text-gray-500">No products available</p>
      </div>
    );
  }

  // Group products by type (Glossy removed - no SKUs exist)
  const groupedProducts = products.reduce((groups, product) => {
    let type = 'Other';
    
    if (product.uid.startsWith('flat_') && product.uid.includes('uncoated')) {
      type = 'Premium Matte Posters';
    } else if (product.uid.startsWith('canvas_')) {
      type = 'Gallery Canvas';
    } else if (product.uid.includes('archival')) {
      type = 'Fine Art Prints';
    }
    
    if (!groups[type]) {
      groups[type] = [];
    }
    
    groups[type].push(product);
    return groups;
  }, {} as Record<string, Product[]>);

  const orderedCategories = [
    'Premium Matte Posters', 
    'Gallery Canvas', 
    'Fine Art Prints',
    'Other'
  ];

  return (
    <div className="space-y-8" role="radiogroup" aria-label="Product options">
      {orderedCategories.map(category => {
        const categoryProducts = groupedProducts[category];
        if (!categoryProducts?.length) return null;
        
        return (
          <div key={category}>
            {/* Category Header */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">
                {category.includes('Canvas') ? '🖼️' : category.includes('Fine') ? '🎨' : '📄'}
              </span>
              <h3 className="font-serif text-lg text-gray-800 font-medium">{category}</h3>
            </div>
            
            {/* Product Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryProducts.map((product) => {
                const isSelected = selectedUid === product.uid;
                const size = extractSize(product.name);
                
                return (
                  <button
                    key={product.uid}
                    type="button"
                    className={`
                      relative text-left p-5 rounded-xl transition-all duration-200
                      ${isSelected 
                        ? 'bg-white ring-2 ring-teal-500 shadow-lg shadow-teal-500/10' 
                        : 'bg-white border border-gray-100 hover:border-gray-200 hover:shadow-md'
                      }
                    `}
                    onClick={() => handleSelect(product)}
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={product.name}
                  >
                    {/* Selected Badge */}
                    {isSelected && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-teal-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    
                    {/* Product Content */}
                    <div className="flex flex-col h-full">
                      {/* Size Badge */}
                      {size && (
                        <span className="inline-block self-start px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded mb-3">
                          {size}
                        </span>
                      )}
                      
                      {/* Product Name */}
                      <h4 className="font-medium text-gray-800 mb-2 leading-snug">
                        {product.name.replace(/\s*–\s*\d+[×x]\d+["″]?\s*/i, ' ').trim()}
                      </h4>
                      
                      {/* Description */}
                      {product.description && (
                        <p className="text-gray-500 text-sm mb-3 flex-grow">
                          {product.description}
                        </p>
                      )}
                      
                      {/* Price */}
                      {product.basePrice !== undefined && (
                        <div className="mt-auto pt-3 border-t border-gray-100">
                          <p className="text-xl font-semibold text-amber-600">
                            {formatPrice(calculateSmartPrice(product.basePrice, product.uid))}
                          </p>
                          <p className="text-gray-400 text-xs mt-0.5">
                            including VAT
                          </p>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
