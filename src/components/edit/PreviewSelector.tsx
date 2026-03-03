'use client'

import React, { useState } from 'react';

interface PreviewSelectorProps {
  variants: string[];
  onPick: (dataUrl: string) => void;
}

export default function PreviewSelector({ variants, onPick }: PreviewSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const handleImageClick = async (variant: string, index: number) => {
    if (isSelecting) return;
    
    setSelectedIndex(index);
    setIsSelecting(true);
    
    try {
      await onPick(variant);
    } catch (error) {
      console.error('Error selecting image:', error);
      setIsSelecting(false);
      setSelectedIndex(null);
    }
  };

  if (variants.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No previews available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Grid of variants */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {variants.map((variant, index) => (
          <div
            key={index}
            className={`
              relative group cursor-pointer transition-all duration-200
              ${selectedIndex === index 
                ? 'ring-4 ring-blue-500 ring-opacity-75' 
                : 'hover:ring-4 hover:ring-blue-300 hover:ring-opacity-50'
              }
              ${isSelecting && selectedIndex !== index ? 'opacity-50' : ''}
              rounded-xl overflow-hidden
            `}
            onClick={() => handleImageClick(variant, index)}
          >
            {/* Image */}
            <div className="aspect-square bg-gray-100">
              <img
                src={variant}
                alt={`Option ${index + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            
            {/* Overlay */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
              {selectedIndex === index && isSelecting ? (
                <div className="bg-blue-600 text-white px-4 py-2 rounded-full flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span className="text-sm font-medium">Selecting...</span>
                </div>
              ) : (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="bg-white bg-opacity-90 text-gray-900 px-4 py-2 rounded-full">
                    <span className="text-sm font-medium">Choose this one</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Option number */}
            <div className="absolute top-3 left-3">
              <div className="bg-black bg-opacity-60 text-white text-xs font-medium px-2 py-1 rounded-full">
                Option {index + 1}
              </div>
            </div>
            
            {/* Selected indicator */}
            {selectedIndex === index && (
              <div className="absolute top-3 right-3">
                <div className="bg-blue-600 text-white rounded-full p-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Help text */}
      <div className="text-center">
        <p className="text-gray-600 text-sm">
          Click on your favorite option to add it to your cart
        </p>
        {variants.length === 1 && (
          <p className="text-yellow-600 text-sm mt-1">
            Only one variant was generated. This may happen occasionally.
          </p>
        )}
      </div>
      
      {/* Preview info */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-medium text-yellow-800">Preview Quality</h4>
            <p className="text-sm text-yellow-700 mt-1">
              These are medium-quality previews. After you place your order, we'll generate a high-resolution version perfect for printing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
