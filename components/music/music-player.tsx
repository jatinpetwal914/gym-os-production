'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Music } from 'lucide-react';
import type { MusicTrack } from '@/lib/music/provider';
import type { AudioPlayerControls } from './use-audio-player';
import { cn } from '@/lib/utils';

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '—:—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface MusicPlayerProps {
  track: MusicTrack | null;
  controls: AudioPlayerControls;
  gymFloor?: boolean;
  contextId: string;
  onContextChange: (value: string) => void;
  contexts: { id: string; label: string }[];
}

export function MusicPlayer({ track, controls, gymFloor, contextId, onContextChange, contexts }: MusicPlayerProps) {
  const { isPlaying, currentTime, duration, progress, hasTracks, error } = controls;
  const canPlay = hasTracks && !error;

  return (
    <motion.div
      initial={{ y: 40 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className={cn(
        'pointer-events-auto fixed inset-x-0 z-[100] flex items-center gap-2 border-[#DAE1E7] bg-white/95 px-2 backdrop-blur',
        'h-16 gap-2 px-2 sm:gap-3 sm:px-3',
        gymFloor
          ? 'bottom-[calc(6.35rem+env(safe-area-inset-bottom))] border-t lg:bottom-auto lg:top-0 lg:border-b lg:border-t-0'
          : 'bottom-[max(0.5rem,env(safe-area-inset-bottom))] mx-2 mb-0 rounded-2xl border lg:mx-0 lg:rounded-none lg:bottom-auto lg:top-0 lg:border-x-0 lg:border-b lg:border-t-0'
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        {track?.artworkUrl ? (
          <img
            src={track.artworkUrl}
            alt={`Cover for ${track.title}`}
            className="h-8 w-8 flex-shrink-0 rounded-md object-cover sm:h-10 sm:w-10"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-[#F4F7FA] text-slate-400 sm:h-10 sm:w-10">
            <Music className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 leading-tight">
          <p className="truncate text-xs font-medium text-slate-800 sm:text-sm" title={track?.title}>
            {track?.title || '—'}
          </p>
          <p className="truncate text-[11px] text-slate-400 sm:text-xs" title={track?.artist}>
            {track?.artist || '—'}
          </p>
        </div>
      </div>

      <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
        <span className="hidden w-10 text-right text-xs tabular-nums text-zinc-500 md:block">{formatTime(currentTime)}</span>
        <div
          role="slider"
          aria-label="Seek track"
          aria-valuenow={currentTime}
          aria-valuemin={0}
          aria-valuemax={duration || 1}
          tabIndex={0}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            controls.seek((duration || 0) * Math.max(0, Math.min(1, x)));
          }}
          className="relative h-1.5 flex-1 cursor-pointer rounded-full bg-[#DAE1E7]"
        >
          <div className="h-full rounded-full bg-[#2064B6]" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="hidden w-10 text-xs tabular-nums text-zinc-500 md:block">{formatTime(duration)}</span>
      </div>

      <label className="sr-only" htmlFor="music-context">Playlist</label>
      <select
        id="music-context"
        aria-label="Music playlist context"
        value={contextId}
        onChange={(event) => onContextChange(event.target.value)}
        className="max-w-[7rem] truncate rounded-full border border-[#DAE1E7] bg-[#F4F7FA] px-2 py-1.5 text-[10px] font-medium leading-none text-slate-600 sm:max-w-[10rem] sm:text-xs"
      >
        {contexts.map((ctx) => (
          <option key={ctx.id} value={ctx.id}>
            {ctx.label}
          </option>
        ))}
      </select>

      <div className="flex flex-shrink-0 items-center">
        <button
          type="button"
          aria-label="Previous track"
          onClick={controls.prev}
          disabled={!canPlay}
          className="rounded-full p-1.5 text-slate-500 hover:bg-[#F4F7FA] disabled:opacity-40 sm:p-2"
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <motion.button
          type="button"
          aria-label={isPlaying ? 'Pause music' : 'Play music'}
          onClick={isPlaying ? controls.pause : controls.play}
          disabled={!canPlay}
          className="mx-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-[#2064B6] text-white hover:bg-[#18539a] disabled:opacity-40"
          whileTap={{ scale: 0.9 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isPlaying ? (
              <motion.span key="pause" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Pause className="h-4 w-4" />
              </motion.span>
            ) : (
              <motion.span key="play" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Play className="h-4 w-4" />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
        <button
          type="button"
          aria-label="Next track"
          onClick={controls.next}
          disabled={!canPlay}
          className="rounded-full p-1.5 text-slate-500 hover:bg-[#F4F7FA] disabled:opacity-40 sm:p-2"
        >
          <SkipForward className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
