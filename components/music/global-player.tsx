'use client';

/**
 * GlobalPlayer — the persistent, global gym music player.
 *
 * Mounted once in the root layout (`<html>/<body>`), so it survives every
 * client-side navigation (login -> dashboard -> super-admin). That is what keeps
 * playback continuous across route changes and makes the same `<audio>` instance
 * serve every page.
 *
 * Data flow:
 *   1. On mount (client-only), read the last-known catalog from localStorage for
 *      an instant first render, then fetch fresh from /api/music/tracks.
 *   2. Feed the catalog into `useAudioPlayer`, which owns the HTML5 Audio object
 *      and all playback state (local to this browser).
 *   3. Render <MusicPlayer> with the current track + controls.
 *
 * SSR-safety: the server renders nothing for this component; the player appears
 * after hydration. This avoids any window/localStorage access during SSR and
 * guarantees zero hydration mismatch.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Music } from 'lucide-react';
import { useAudioPlayer } from './use-audio-player';
import { MusicPlayer } from './music-player';
import type { MusicTrack } from '@/lib/music/provider';
import { MUSIC_PLAYLIST_CONTEXTS } from '@/lib/music/catalog';

const CACHE_KEY = 'forggym-music-catalog';
const CONTEXT_KEY = 'forggym-music-context';
const CACHE_TTL_MS = 2 * 60 * 1000;

export function GlobalPlayer() {
  const pathname = usePathname();
  const gymFloor = pathname.startsWith('/gym');
  const isPublicSurface =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/f') ||
    pathname.startsWith('/auth');
  const [mounted, setMounted] = useState(false);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [contextId, setContextId] = useState('mixed');
  const contextIdRef = useRef(contextId);
  const catalogRequestRef = useRef<AbortController | null>(null);
  contextIdRef.current = contextId;

  const loadCatalog = useCallback(async (nextContext: string) => {
    catalogRequestRef.current?.abort();
    const controller = new AbortController();
    catalogRequestRef.current = controller;

    try {
      const response = await fetch(
        `/api/music/tracks?context=${encodeURIComponent(nextContext)}`,
        { signal: controller.signal }
      );
      if (!response.ok) {
        throw new Error(`Music catalog request failed with status ${response.status}`);
      }

      const json: { data?: MusicTrack[] } = await response.json();
      if (!Array.isArray(json.data)) {
        throw new Error('Music catalog response has an invalid data shape');
      }
      if (controller.signal.aborted) return;

      setTracks(json.data);
      if (json.data.length) {
        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ ts: Date.now(), tracks: json.data, context: nextContext })
          );
        } catch {
          /* Storage may be unavailable or full. */
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error('[music] Unable to refresh catalog; keeping the current catalog.', error);
      }
    } finally {
      if (catalogRequestRef.current === controller) {
        catalogRequestRef.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    if (isPublicSurface) {
      setLoading(false);
      return;
    }

    let initialContext = 'mixed';
    let cached: MusicTrack[] | null = null;
    try {
      const savedContext = localStorage.getItem(CONTEXT_KEY);
      if (savedContext && MUSIC_PLAYLIST_CONTEXTS.some((context) => context.active && context.id === savedContext)) {
        initialContext = savedContext;
      }
      setContextId(initialContext);
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed: { ts?: number; context?: string; tracks?: unknown } = JSON.parse(raw);
        const cacheAge = typeof parsed.ts === 'number' ? Date.now() - parsed.ts : -1;
        if (
          parsed.context === initialContext &&
          cacheAge >= 0 &&
          cacheAge < CACHE_TTL_MS &&
          Array.isArray(parsed.tracks)
        ) {
          cached = (parsed.tracks || []) as MusicTrack[];
        }
      }
    } catch {
      /* ignore corrupt cache */
    }
    if (cached && cached.length) setTracks(cached);

    void loadCatalog(initialContext);
    const refresh = window.setInterval(() => {
      void loadCatalog(contextIdRef.current);
    }, 15 * 60 * 1000);
    return () => {
      const pendingRequest = catalogRequestRef.current;
      catalogRequestRef.current = null;
      pendingRequest?.abort();
      window.clearInterval(refresh);
    };
  }, [loadCatalog, isPublicSurface]);

  const onContextChange = (value: string) => {
    setContextId(value);
    try {
      localStorage.setItem(CONTEXT_KEY, value);
    } catch {
      /* ignore */
    }
    setLoading(true);
    void loadCatalog(value);
  };

  const controls = useAudioPlayer(tracks);
  const current = controls.current;
  const barClass = gymFloor
    ? 'pointer-events-none fixed inset-x-0 z-[100] h-16 border-[#DAE1E7] bg-white/95 bottom-[calc(6.35rem+env(safe-area-inset-bottom))] lg:bottom-auto lg:top-0'
    : 'pointer-events-none fixed inset-x-2 z-[100] h-16 rounded-2xl border border-[#DAE1E7] bg-white/95 bottom-[max(0.5rem,env(safe-area-inset-bottom))] lg:inset-x-0 lg:rounded-none lg:bottom-auto lg:top-0';

  if (!mounted) return null;
  if (isPublicSurface) return null;

  if (!tracks.length) {
    if (loading) {
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={barClass}>
          <div className="flex h-full items-center gap-3 px-3">
            <div className="h-10 w-10 rounded-md bg-[#DAE1E7] animate-pulse" />
            <div className="flex flex-col gap-1.5">
              <div className="h-3.5 w-28 rounded bg-[#DAE1E7] animate-pulse" />
              <div className="h-3 w-20 rounded bg-[#DAE1E7] animate-pulse" />
            </div>
          </div>
        </motion.div>
      );
    }
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${barClass} pointer-events-auto`}>
        <div className="flex h-full items-center gap-3 px-3">
          <Music className="h-5 w-5 text-zinc-400" />
          <span className="text-sm text-slate-400">Music unavailable</span>
        </div>
      </motion.div>
    );
  }

  return (
    <MusicPlayer
      track={current}
      controls={controls}
      gymFloor={gymFloor}
      contextId={contextId}
      onContextChange={onContextChange}
      contexts={MUSIC_PLAYLIST_CONTEXTS.filter((ctx) => ctx.active).map((ctx) => ({ id: ctx.id, label: ctx.label }))}
    />
  );
}
