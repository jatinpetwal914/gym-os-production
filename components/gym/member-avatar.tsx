'use client';

import { useState } from 'react';
import { memberInitials } from '@/lib/member-visual';

export function MemberAvatar({
  memberId,
  photoUrl,
  name,
  className = 'h-12 w-12',
}: {
  memberId: string;
  photoUrl?: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = memberInitials(name);
  const showPhoto = Boolean(photoUrl) && !failed;

  if (!showPhoto) {
    return (
      <div className={`flex flex-shrink-0 items-center justify-center rounded-xl border border-[#6DCCC3]/50 bg-[#6DCCC3]/20 text-sm font-semibold text-[#2064B6] ${className}`}>
        {initials}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/members/${memberId}/photo`}
      alt={`${name} photograph`}
      className={`flex-shrink-0 rounded-2xl object-cover ring-1 ring-[#6DCCC3]/40 ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
