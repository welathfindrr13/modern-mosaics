'use client'

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/firebase-auth-provider';
import { useRouter } from 'next/navigation';
import PhotoUploader from '@/components/edit/PhotoUploader';
import PreviewSelector from '@/components/edit/PreviewSelector';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';

// Dynamically import MaskEditor with SSR disabled to prevent Konva build issues
const MaskEditor = dynamic(() => import('@/components/edit/MaskEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p className="text-gray-600">Loading canvas editor...</p>
      </div>
    </div>
  ),
});

type EditStep = 'upload' | 'mask' | 'loading' | 'pick';

const SCENE_PRESETS = [
  {
    label: 'Studio Portrait',
    prompt: 'replace the background with a clean neutral studio backdrop, improve lighting naturally, keep face identity unchanged',
  },
  {
    label: 'Wedding Scene',
    prompt: 'replace the background with a soft elegant wedding venue, keep the person unchanged and realistic',
  },
  {
    label: 'Birthday Party',
    prompt: 'replace the background with tasteful birthday decorations and warm indoor lighting, keep the person unchanged',
  },
  {
    label: 'Holiday Card',
    prompt: 'replace the background with a cozy festive holiday setting, keep the person unchanged and realistic',
  },
  {
    label: 'Memorial Tribute',
    prompt: 'replace the background with a calm respectful memorial floral setting, keep the person unchanged and natural',
  },
];

export default function EditPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<EditStep>('upload');
  const [photo, setPhoto] = useState<File | null>(null);
  const [maskBlob, setMaskBlob] = useState<Blob | null>(null);
  const [variants, setVariants] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Helper functions
  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  };

  const blobToDataUrl = (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  const generatePreviews = async (editPrompt: string) => {
    if (!photo || !maskBlob) return;
    
    setStep('loading');
    setError(null);
    
    try {
      const imageDataUrl = await fileToDataUrl(photo);
      const maskDataUrl = await blobToDataUrl(maskBlob);
      
      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('image', photo);
      formData.append('mask', maskBlob);
      formData.append('prompt', editPrompt);
      formData.append('generateMultiple', 'true'); // Flag for 3 variants
      
      const response = await fetch('/api/images/edit', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate previews');
      }
      
      // Handle both single image and multiple variants
      const imageUrls = data.variants || [data.imageUrl];
      setVariants(imageUrls);
      setStep('pick');
      
    } catch (err: any) {
      console.error('Preview generation error:', err);
      setError(err.message || 'Failed to generate previews');
      setStep('mask'); // Go back to mask step
    }
  };

  const handleImagePick = async (selectedImageUrl: string) => {
    try {
      // Save the selected image to Cloudinary and redirect to order page
      const response = await fetch('/api/images/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          imageUrl: selectedImageUrl, 
          prompt: `Edited: ${prompt}`,
          save: true
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save image');
      }
      
      const data = await response.json();
      
      // Redirect to order page with the new image
      router.push(`/order?publicId=${data.publicId}`);
      
    } catch (err: any) {
      console.error('Error saving selected image:', err);
      setError(err.message || 'Failed to save selected image');
    }
  };

  const handleStartOver = () => {
    setStep('upload');
    setPhoto(null);
    setMaskBlob(null);
    setVariants([]);
    setPrompt('');
    setSelectedPreset(null);
    setError(null);
  };

  const handleBackToMask = () => {
    setStep('mask');
    setError(null);
  };

  if (authLoading || !mounted) {
    return (
      <div className="min-h-screen bg-dark-900 pt-24 pb-12">
        <div className="fixed inset-0 bg-glow-gradient opacity-20 pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 text-center py-24">
          <div className="w-10 h-10 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-dark-300">Loading editor...</p>
        </div>
      </div>
    );
  }

  if (!user || user.isAnonymous) {
    router.push('/signin');
    return null;
  }

  return (
    <div className="min-h-screen bg-dark-900 pt-24 pb-12">
      <div className="fixed inset-0 bg-glow-gradient opacity-20 pointer-events-none" />
      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mb-2">
            Scene <span className="text-gradient">Reimagine</span>
          </h1>
          <p className="text-dark-300">
            Upload a photo, brush the areas you want to change, and choose from AI-powered edits.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-8 text-sm">
          <div className={`flex items-center ${step === 'upload' ? 'text-brand-400' : step === 'mask' || step === 'loading' || step === 'pick' ? 'text-green-400' : 'text-dark-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 text-sm font-semibold ${step === 'upload' ? 'bg-brand-500/20 text-brand-400 border border-brand-500/50' : step === 'mask' || step === 'loading' || step === 'pick' ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-dark-800 text-dark-500 border border-white/10'}`}>
              1
            </div>
            Upload
          </div>
          <div className={`flex items-center ${step === 'mask' ? 'text-brand-400' : step === 'loading' || step === 'pick' ? 'text-green-400' : 'text-dark-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 text-sm font-semibold ${step === 'mask' ? 'bg-brand-500/20 text-brand-400 border border-brand-500/50' : step === 'loading' || step === 'pick' ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-dark-800 text-dark-500 border border-white/10'}`}>
              2
            </div>
            Edit
          </div>
          <div className={`flex items-center ${step === 'pick' ? 'text-brand-400' : 'text-dark-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 text-sm font-semibold ${step === 'pick' ? 'bg-brand-500/20 text-brand-400 border border-brand-500/50' : 'bg-dark-800 text-dark-500 border border-white/10'}`}>
              3
            </div>
            Choose
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-6">
            <p className="text-red-300 font-medium">{error}</p>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-6">
            <PhotoUploader 
              onLoad={(file) => {
                setPhoto(file);
                setStep('mask');
              }} 
            />
            <div className="text-center text-sm text-dark-500 space-y-1">
              <p>Supported formats: JPG, PNG • Max size: 10MB</p>
              <p>Scene Reimagine presets appear after upload.</p>
            </div>
          </div>
        )}

        {/* Step 2: Mask editing */}
        {step === 'mask' && photo && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-white mb-2">Mark What to Change</h2>
              <p className="text-dark-300 mb-4">
                Use the pink brush to paint over areas you want to modify. Then pick a scene or describe your edit.
              </p>
            </div>
            
            <MaskEditor 
              src={URL.createObjectURL(photo)} 
              onDone={(blob) => setMaskBlob(blob)}
            />
            
            <div className="space-y-4">
              <div>
                <p className="block text-sm font-medium text-dark-200 mb-2">
                  Scene Reimagine presets:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SCENE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setPrompt(preset.prompt);
                        setSelectedPreset(preset.label);
                      }}
                      className={`rounded-xl border px-3 py-2.5 text-xs text-left transition-all ${
                        selectedPreset === preset.label
                          ? 'border-brand-500 bg-brand-500/20 text-brand-300'
                          : 'border-white/10 hover:border-white/20 bg-dark-800/50 text-dark-300 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Or describe the changes you want:
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-white/10 bg-dark-800 text-white shadow-sm focus:border-brand-500 focus:ring-brand-500 p-3 placeholder-dark-500"
                  placeholder="e.g., change hair to blonde, add glasses, make shirt blue"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>
              
              <div className="flex gap-4">
                <Button
                  onClick={handleStartOver}
                  variant="outline"
                  className="flex-1 border-white/20 text-dark-200 hover:text-white"
                >
                  Start Over
                </Button>
                <Button
                  onClick={() => generatePreviews(prompt)}
                  disabled={!maskBlob || !prompt.trim()}
                  className="flex-1 btn-primary"
                >
                  Generate Options
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Loading */}
        {step === 'loading' && (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Generating your scene...</h2>
            <p className="text-dark-300">This usually takes about 5 seconds</p>
            <div className="w-full bg-dark-800 rounded-full h-2 mt-4 max-w-md mx-auto">
              <div className="bg-brand-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
        )}

        {/* Step 4: Preview selection */}
        {step === 'pick' && variants.length > 0 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-white mb-2">Choose Your Favorite</h2>
              <p className="text-dark-300 mb-4">
                Click on the image you like best to continue to print ordering.
              </p>
            </div>
            
            <PreviewSelector 
              variants={variants} 
              onPick={handleImagePick}
            />
            
            <div className="flex gap-4">
              <Button
                onClick={handleBackToMask}
                variant="outline"
                className="flex-1 border-white/20 text-dark-200 hover:text-white"
              >
                Try Different Edit
              </Button>
              <Button
                onClick={handleStartOver}
                variant="outline"
                className="flex-1 border-white/20 text-dark-200 hover:text-white"
              >
                Start Over
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
