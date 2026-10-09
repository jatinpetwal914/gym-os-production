'use client';

import { useEffect, useRef, useState } from 'react';

const INTRO_STORAGE_KEY = 'gymos_intro_seen';
const INTRO_ZOOM_DURATION_MS = 650;

type IntroStatus = 'checking' | 'playing' | 'zooming' | 'done';

export function IntroGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<IntroStatus>('checking');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(INTRO_STORAGE_KEY) === 'true') {
        document.documentElement.removeAttribute('data-gymos-intro-pending');
        document.documentElement.removeAttribute('data-gymos-intro-active');
        setStatus('done');
        return;
      }

      setStatus('playing');
    } catch (error) {
      console.error('Unable to check whether the Gym OS intro was already seen.', error);
      document.documentElement.removeAttribute('data-gymos-intro-pending');
      document.documentElement.removeAttribute('data-gymos-intro-active');
      setStatus('done');
    }
  }, []);

  useEffect(() => {
    if (status !== 'playing') return;

    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.play().catch((error: unknown) => {
      console.error('Unable to autoplay the Gym OS intro; showing the website instead.', error);
      document.documentElement.removeAttribute('data-gymos-intro-pending');
      document.documentElement.removeAttribute('data-gymos-intro-active');
      setStatus('done');
    });
  }, [status]);

  useEffect(() => {
    if (status !== 'zooming') return;

    const timeout = window.setTimeout(() => {
      document.documentElement.removeAttribute('data-gymos-intro-active');
      setStatus('done');
    }, INTRO_ZOOM_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [status]);

  function handleVideoEnded() {
    try {
      window.localStorage.setItem(INTRO_STORAGE_KEY, 'true');
    } catch (error) {
      console.error('Unable to save that the Gym OS intro was seen.', error);
    }

    document.documentElement.removeAttribute('data-gymos-intro-pending');
    setStatus('zooming');
  }

  function handleVideoError() {
    console.error('The Gym OS intro video could not be loaded; showing the website instead.');
    document.documentElement.removeAttribute('data-gymos-intro-pending');
    document.documentElement.removeAttribute('data-gymos-intro-active');
    setStatus('done');
  }

  return (
    <>
      <div className="gymos-site-content" data-gymos-site-content>
        {children}
      </div>
      {(status === 'playing' || status === 'zooming') && (
        <div
          className={`gymos-intro-overlay${status === 'zooming' ? ' is-zooming' : ''}`}
          aria-hidden="true"
        >
          <video
            ref={videoRef}
            className="gymos-intro-video"
            src="/videos/gymos-intro.mp4"
            autoPlay
            muted
            playsInline
            preload="auto"
            onEnded={handleVideoEnded}
            onError={handleVideoError}
          />
        </div>
      )}
    </>
  );
}
