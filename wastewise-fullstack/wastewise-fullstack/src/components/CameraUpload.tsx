'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Zap, Image as ImageIcon, Search, AlertCircle, Sparkles, CheckCircle2, UploadCloud } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import type { AnalysisResponse } from '../types/api';

interface CameraUploadProps {
  localityId: string;
  onAnalysisStart: () => void;
  onAnalysisSuccess: (result: AnalysisResponse) => void;
  onError: (error: Error) => void;
  isLoading: boolean;
}

/**
 * Resizes and compresses an image before it is converted to Base64 for the API request.
 */
async function compressImage(image: Blob, maxDimension = 768, quality = 0.75): Promise<Blob> {
  const bitmap = await createImageBitmap(image);
  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to prepare the image for upload.');
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Unable to compress the selected image.')),
        'image/jpeg',
        quality
      );
    });
  } finally {
    bitmap.close();
  }
}

export const CameraUpload: React.FC<CameraUploadProps> = ({
  localityId,
  onAnalysisStart,
  onAnalysisSuccess,
  onError,
  isLoading
}) => {
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchActive, setTorchActive] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [textQuery, setTextQuery] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const clearPreviewImage = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewImage(null);
  };

  // Clean up camera stream and preview URL on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setTorchActive(false);
    setHasTorch(false);
  };

  const startCamera = async (facing: 'environment' | 'user' = facingMode) => {
    setCameraError(null);
    clearPreviewImage();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);
      setFacingMode(facing);

      const track = stream.getVideoTracks()[0];
      const capabilities = (track?.getCapabilities && track.getCapabilities()) as any;
      if (capabilities && 'torch' in capabilities) {
        setHasTorch(true);
      } else {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.warn('Camera access unavailable:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Use the file upload button or enter text below.'
          : err.message || 'Unable to open camera.'
      );
      setCameraActive(false);
    }
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextTorch = !torchActive;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }]
      });
      setTorchActive(nextTorch);
    } catch (e) {
      console.warn('Torch toggle not supported on this track:', e);
    }
  };

  const switchFacing = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    startCamera(nextFacing);
  };

  /**
   * Compress the original image before encoding and sending it to the API.
   */
  const processAndSubmitImage = async (image: Blob) => {
    try {
      onAnalysisStart();
      const compressedImage = await compressImage(image);
      clearPreviewImage();
      const previewUrl = URL.createObjectURL(compressedImage);
      previewUrlRef.current = previewUrl;
      setPreviewImage(previewUrl);

      const result = await apiClient.analyzeImage(compressedImage, { localityId });
      onAnalysisSuccess(result);
    } catch (err: any) {
      onError(err);
    }
  };

  /**
   * Capture live frame from Webcam canvas ensuring video stream is ready
   */
  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video) return;

    // Guard: Ensure video stream is ready before drawing
    if (video.readyState < 2 || video.videoWidth === 0) {
      onError(new Error('Webcam feed is not ready yet. Please wait a moment and try again.'));
      return;
    }

    const canvas = canvasRef.current || document.createElement('canvas');
    let width = video.videoWidth;
    let height = video.videoHeight;
    const maxDim = 768;

    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const image = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.75);
    });
    if (!image) {
      onError(new Error('Unable to prepare the captured photo. Please try again.'));
      return;
    }

    stopCamera();
    await processAndSubmitImage(image);
  };

  /**
   * File selection handler
   */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    stopCamera();
    await processAndSubmitImage(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Drag & Drop File Handlers
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      onError(new Error('Please drop a valid image file (JPEG, PNG, WebP).'));
      return;
    }

    stopCamera();
    await processAndSubmitImage(file);
  };

  /**
   * Text query search submission
   */
  const handleTextSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textQuery.trim() || isLoading) return;

    stopCamera();
    clearPreviewImage();

    try {
      onAnalysisStart();
      const result = await apiClient.analyzeText(textQuery.trim(), { localityId });
      onAnalysisSuccess(result);
    } catch (err: any) {
      onError(err);
    }
  };

  /**
   * Quick benchmark preset button
   */
  const runPreset = async (label: string, query: string) => {
    setTextQuery(query);
    stopCamera();
    clearPreviewImage();

    try {
      onAnalysisStart();
      const result = await apiClient.analyzeText(query, {
        localityId,
        productNameHint: label
      });
      onAnalysisSuccess(result);
    } catch (err: any) {
      onError(err);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full bg-white rounded-3xl shadow-sm border transition-all overflow-hidden ${
        isDragging ? 'border-forest ring-4 ring-forest/10' : 'border-stone-200/80'
      }`}
    >
      {/* Header */}
      <div className="px-6 py-5 bg-gradient-to-b from-stone-50 to-white border-b border-stone-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-deepGreen flex items-center gap-2">
            <Camera className="w-5 h-5 text-forest" />
            AI Waste Identifier
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Scan packaging, items, or materials to check verified municipal sorting rules.
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-softGreen text-forest">
          {localityId}
        </span>
      </div>

      <div className="p-6 space-y-6">
        <canvas ref={canvasRef} className="hidden" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Viewfinder Workspace */}
        <div className="relative w-full aspect-[4/3] sm:aspect-[16/9] bg-stone-900 rounded-2xl overflow-hidden flex flex-col items-center justify-center text-white border border-stone-800">
          {/* 1. Live Camera Stream */}
          {cameraActive && (
            <div className="absolute inset-0 w-full h-full">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Overlay Controls */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live View ({facingMode === 'environment' ? 'Rear' : 'Front'})
                </span>

                <div className="flex items-center gap-2 pointer-events-auto">
                  {hasTorch && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`p-2 rounded-full text-xs font-medium backdrop-blur-md border transition-colors ${
                        torchActive
                          ? 'bg-amber-400 text-stone-950 border-amber-300'
                          : 'bg-black/60 text-white border-white/20 hover:bg-black/80'
                      }`}
                      title="Toggle Torch"
                    >
                      <Zap className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={switchFacing}
                    className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-md border border-white/20 transition-colors"
                    title="Switch Camera Facing"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Viewfinder Target Reticle */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 sm:w-64 sm:h-64 border-2 border-dashed border-white/40 rounded-2xl relative">
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-emerald-400" />
                </div>
              </div>

              {/* Shutter Bar */}
              <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2 rounded-full bg-black/60 text-xs font-medium backdrop-blur-md text-stone-300 hover:text-white border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={isLoading}
                  className="w-16 h-16 rounded-full bg-white border-4 border-forest shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                  aria-label="Take Photo"
                >
                  <div className="w-12 h-12 rounded-full bg-forest flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* 2. Photo Preview */}
          {!cameraActive && previewImage && (
            <div className="absolute inset-0 w-full h-full bg-black flex items-center justify-center">
              <img
                src={previewImage}
                alt="Captured Waste Item"
                className="w-full h-full object-contain"
              />
              <div className="absolute top-3 left-3">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-stone-200 border border-white/10 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Photo Analyzed
                </span>
              </div>
              <div className="absolute bottom-3 right-3">
                <button
                  type="button"
                  onClick={clearPreviewImage}
                  className="px-3 py-1.5 rounded-lg bg-black/70 hover:bg-black/90 text-xs font-medium text-stone-300 backdrop-blur-md border border-white/10"
                >
                  Clear Photo
                </button>
              </div>
            </div>
          )}

          {/* 3. Idle Camera & Drag-and-Drop Area */}
          {!cameraActive && !previewImage && (
            <div className="text-center p-6 max-w-sm space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-stone-800/80 border border-stone-700/60 flex items-center justify-center mx-auto text-stone-300">
                <Camera className="w-8 h-8 text-softGreen" />
              </div>
              <div>
                <h3 className="font-semibold text-stone-200 text-sm sm:text-base">
                  Scan any waste item or packaging
                </h3>
                <p className="text-xs text-stone-400 mt-1">
                  Point camera, upload a photo, or drag and drop an image anywhere on this card.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => startCamera('environment')}
                  disabled={isLoading}
                  className="px-4 py-2.5 rounded-xl bg-forest hover:bg-deepGreen text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" />
                  Open Live Camera
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs sm:text-sm font-semibold flex items-center gap-2 border border-stone-700 transition-colors disabled:opacity-50"
                >
                  <UploadCloud className="w-4 h-4" />
                  Upload Photo
                </button>
              </div>

              {cameraError && (
                <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-800/80 text-amber-200 text-xs text-left flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <div>
                    <span className="font-bold">Camera Notice: </span>
                    {cameraError}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. Active Analysis Loading State */}
          {isLoading && (
            <div className="absolute inset-0 bg-deepGreen/85 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 z-20 space-y-4 animate-in fade-in">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-softGreen/30 border-t-softGreen animate-spin" />
                <Sparkles className="w-6 h-6 text-accentLime absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="text-center space-y-1">
                <h4 className="text-base font-bold text-softGreen">Identifying Waste Item</h4>
                <p className="text-xs text-stone-300 max-w-xs">
                  Extracting item components, materials, and retrieving verified local guide regulations...
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Text Description / Query Search */}
        <div>
          <form onSubmit={handleTextSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Or type any item (e.g., 'Broken ceramic mug', 'Lithium battery', 'Old t-shirt')..."
                value={textQuery}
                onChange={(e) => setTextQuery(e.target.value)}
                disabled={isLoading}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-forest/20 focus:border-forest transition-colors disabled:bg-stone-100"
              />
            </div>
            <button
              type="submit"
              disabled={!textQuery.trim() || isLoading}
              className="px-5 py-2.5 rounded-xl bg-forest hover:bg-deepGreen text-white text-sm font-bold shadow-sm transition-all disabled:opacity-40 disabled:pointer-events-none shrink-0"
            >
              Analyze
            </button>
          </form>
        </div>

        {/* Universal 8 Stream Benchmark Presets */}
        <div className="pt-2 border-t border-stone-100">
          <div className="text-xs font-semibold text-stone-500 mb-2.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-forest" /> Quick Test Benchmark Items:
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: '🔋 3.2V Lithium Battery', query: '3.2V 32700 lithium-ion cylindrical rechargeable battery' },
              { label: '☕ Broken Ceramic Mug', query: 'Broken glazed ceramic coffee mug' },
              { label: '🍕 Greasy Pizza Box', query: 'Greasy cardboard pizza box with melted cheese residue' },
              { label: '👕 Old Cotton T-Shirt', query: 'Worn cotton textile t-shirt clothing' },
              { label: '💊 Medicine Blister Pack', query: 'Empty aluminum foil and plastic pharmaceutical medicine blister pack' },
              { label: '🥤 Plastic Beverage Bottle', query: 'Clear PET plastic drinking water bottle with cap' },
              { label: '🍜 Instant Noodle Packet', query: 'Instant noodle packaging with plastic wrapper and seasoning packet' },
              { label: '🍌 Banana Fruit Peel', query: 'Raw banana fruit peel kitchen organic scraps' }
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => runPreset(preset.label, preset.query)}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-100 hover:bg-softGreen hover:text-forest text-stone-700 border border-stone-200 transition-colors disabled:opacity-50"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
