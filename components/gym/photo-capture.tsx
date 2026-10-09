'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCcw, Upload, X } from 'lucide-react';
import { MEMBER_PHOTO_MAX_BYTES } from '@/lib/member-photo';

type CaptureState = 'idle' | 'live' | 'preview';

export function PhotoCapture({
  value,
  previewUrl,
  onChange,
  required,
  label = 'Photograph',
}: {
  value: File | null;
  previewUrl?: string;
  onChange: (file: File | null) => void;
  required?: boolean;
  label?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CaptureState>(value || previewUrl ? 'preview' : 'idle');
  const [error, setError] = useState('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [blobUrl, setBlobUrl] = useState('');
  const [pending, setPending] = useState<File | null>(null);

  useEffect(() => {
    const file = pending || value;
    if (!file) {
      setBlobUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pending, value]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const localPreview = blobUrl || previewUrl || '';

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const startCamera = async (mode: 'user' | 'environment' = facingMode) => {
    setError('');
    if (typeof window === 'undefined' || !window.isSecureContext) {
      setError('Camera capture needs a secure connection (HTTPS or localhost). Use Upload instead.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser does not support live camera capture. Use Upload instead.');
      return;
    }
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setFacingMode(mode);
      setState('live');
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError') setError('Camera permission was denied. Use Upload instead, or allow camera access.');
      else if (name === 'NotFoundError') setError('No camera was detected on this device. Use Upload instead.');
      else setError('Camera is unavailable. Use Upload instead.');
      setState('idle');
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    const size = Math.min(video.videoWidth || 720, video.videoHeight || 720, 1080);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const sx = Math.max(0, ((video.videoWidth || size) - size) / 2);
    const sy = Math.max(0, ((video.videoHeight || size) - size) / 2);
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) {
      setError('Could not capture the photograph. Try again or upload a file.');
      return;
    }
    if (blob.size > MEMBER_PHOTO_MAX_BYTES) {
      setError('Photograph must be 5 MB or smaller.');
      return;
    }
    const captured = new File([blob], 'member-photo.jpg', { type: 'image/jpeg' });
    stopStream();
    setPending(captured);
    setState('preview');
  };

  const confirmPhoto = () => {
    if (!pending) return;
    onChange(pending);
    setPending(null);
    setState('preview');
  };

  const cancelLive = () => {
    stopStream();
    setPending(null);
    setState(value || previewUrl ? 'preview' : 'idle');
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-slate-500">
        {label} {required ? '*' : ''}
      </p>
      <p className="text-sm text-slate-500">Capture a live photo for identity checks, or upload an existing image.</p>

      {state === 'live' && (
        <div className="space-y-3 rounded-xl border border-[#DAE1E7] bg-black p-3">
          <video ref={videoRef} autoPlay playsInline muted className="mx-auto h-56 w-56 rounded-xl object-cover" />
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={capture} className="admin-primary-btn">
              Capture photo
            </button>
            <button
              type="button"
              onClick={() => startCamera(facingMode === 'user' ? 'environment' : 'user')}
              className="admin-secondary-btn"
            >
              Flip camera
            </button>
            <button type="button" onClick={cancelLive} className="admin-secondary-btn">
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {state !== 'live' && localPreview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={localPreview} alt="Member photograph preview" className="mx-auto h-40 w-40 rounded-xl object-cover" />
      )}

      {state !== 'live' && (
        <div className="flex flex-wrap gap-2">
          {pending ? (
            <>
              <button type="button" onClick={confirmPhoto} className="admin-primary-btn">
                Confirm
              </button>
              <button
                type="button"
                onClick={() => {
                  setPending(null);
                  startCamera();
                }}
                className="admin-secondary-btn"
              >
                <RefreshCcw className="h-4 w-4" />
                Retake
              </button>
              <button type="button" onClick={cancelLive} className="admin-secondary-btn">
                <X className="h-4 w-4" />
                Cancel
              </button>
            </>
          ) : (
            <>
          <button type="button" onClick={() => startCamera()} className="admin-primary-btn">
            <Camera className="h-4 w-4" />
            Take photo
          </button>
          <label className="admin-secondary-btn cursor-pointer">
            <Upload className="h-4 w-4" />
            Upload
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                if (file && file.size > MEMBER_PHOTO_MAX_BYTES) {
                  setError('Photograph must be 5 MB or smaller.');
                  return;
                }
                setError('');
                onChange(file);
                setState(file ? 'preview' : 'idle');
              }}
            />
          </label>
          {(value || previewUrl) && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setState('idle');
              }}
              className="admin-secondary-btn"
            >
              <RefreshCcw className="h-4 w-4" />
              Retake
            </button>
          )}
            </>
          )}
        </div>
      )}
      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
