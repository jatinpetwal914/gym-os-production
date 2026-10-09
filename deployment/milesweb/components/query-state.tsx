'use client';

import { Loader2 } from 'lucide-react';

export function QueryState({
  loading,
  error,
  empty,
  emptyMessage = 'Nothing to show yet.',
  children,
}: {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/70 px-4 py-10 text-center text-sm text-zinc-500">
        {emptyMessage}
      </div>
    );
  }

  return <>{children}</>;
}
