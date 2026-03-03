'use client'

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface PhotoUploaderProps {
  onLoad: (file: File) => void;
}

// =============================================================================
// HEIC DETECTION: iPhone photos are often HEIC format
// Server-side Sharp cannot decode HEIC, so we convert to JPEG client-side
// =============================================================================
const isHeicFile = (file: File): boolean => {
  // Check MIME type (browsers may report these for HEIC)
  const heicMimes = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];
  if (heicMimes.includes(file.type.toLowerCase())) {
    return true;
  }
  
  // Check file extension (fallback - some browsers don't set MIME for HEIC)
  const extension = file.name.split('.').pop()?.toLowerCase();
  return extension === 'heic' || extension === 'heif';
};

// =============================================================================
// HEIC → JPEG CONVERSION: Runs entirely in browser
// =============================================================================
const convertHeicToJpeg = async (file: File): Promise<File> => {
  const { default: heic2any } = await import('heic2any');

  // heic2any returns a Blob or Blob[] - we want a single Blob
  const result = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.9, // High quality, reasonable file size
  });
  
  // heic2any may return array for multi-image HEIC, take first
  const jpegBlob = Array.isArray(result) ? result[0] : result;
  
  // Create new File with .jpg extension, preserving original name
  const originalName = file.name.replace(/\.(heic|heif)$/i, '');
  const newFileName = `${originalName}.jpg`;
  
  return new File([jpegBlob], newFileName, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
};

export default function PhotoUploader({ onLoad }: PhotoUploaderProps) {
  // HEIC conversion state
  const [isConverting, setIsConverting] = useState(false);
  const [conversionError, setConversionError] = useState<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    setConversionError(null);
    
    if (isHeicFile(file)) {
      // Convert HEIC → JPEG before passing to parent
      setIsConverting(true);
      try {
        const jpegFile = await convertHeicToJpeg(file);
        
        // Verify converted file is under 10MB limit
        if (jpegFile.size > 10 * 1024 * 1024) {
          setConversionError('Converted photo is too large. Please use a smaller image.');
          return;
        }
        
        onLoad(jpegFile);
      } catch (err) {
        console.error('HEIC conversion failed:', err);
        setConversionError("We couldn't process this photo. Please upload a JPG or PNG.");
      } finally {
        setIsConverting(false);
      }
    } else {
      // Non-HEIC file - pass through directly
      onLoad(file);
    }
  }, [onLoad]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      processFile(acceptedFiles[0]);
    }
  }, [processFile]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      // Include HEIC/HEIF so dropzone accepts them (we convert client-side)
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic', '.heif']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
    disabled: isConverting, // Prevent new uploads while converting
  });

  return (
    <div className="w-full">
      {/* Converting status - shown above dropzone */}
      {isConverting && (
        <div className="mb-3 p-3 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center gap-3">
          <div className="animate-spin w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full" />
          <p className="text-brand-400 text-sm">Converting iPhone photo...</p>
        </div>
      )}
      
      {/* Error message - shown above dropzone */}
      {conversionError && (
        <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 text-sm">{conversionError}</p>
          <button
            onClick={() => setConversionError(null)}
            className="mt-2 text-xs text-red-300 hover:text-red-200 underline"
          >
            Try again
          </button>
        </div>
      )}
      
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
          ${isConverting 
            ? 'border-brand-500/50 bg-brand-500/5 cursor-wait' 
            : isDragActive && !isDragReject 
            ? 'border-brand-500 bg-brand-500/10' 
            : isDragReject 
            ? 'border-red-500 bg-red-500/10' 
            : 'border-dark-600 hover:border-dark-500 hover:bg-dark-800/50'
          }
        `}
      >
        <input {...getInputProps()} />
        
        <div className="space-y-4">
          {/* Upload Icon */}
          <div className="mx-auto w-16 h-16 text-dark-400">
            <svg
              className="w-full h-full"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          
          {/* Text Content */}
          <div>
            {isConverting ? (
              <p className="text-brand-400 font-medium">
                Processing your photo...
              </p>
            ) : isDragActive ? (
              isDragReject ? (
                <p className="text-red-400 font-medium">
                  File type not supported
                </p>
              ) : (
                <p className="text-brand-400 font-medium">
                  Drop your photo here!
                </p>
              )
            ) : (
              <>
                <p className="text-lg font-medium text-white mb-2">
                  Drag your photo here
                </p>
                <p className="text-dark-400">
                  or <span className="text-brand-400 underline">click to browse</span>
                </p>
              </>
            )}
          </div>
          
          {/* File requirements */}
          <div className="text-sm text-dark-500">
            <p>JPG, PNG, HEIC (iPhone) up to 10MB</p>
          </div>
        </div>
      </div>
    </div>
  );
}
