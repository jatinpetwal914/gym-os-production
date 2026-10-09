'use client';

import Link from 'next/link';
import { Star } from 'lucide-react';
import { hasMembership, isFeePaid } from '@/lib/member-visual';
import { MemberAvatar } from '@/components/gym/member-avatar';

export type GymMemberCardData = {
  id: string;
  member_id: string;
  name: string;
  phone?: string | null;
  gender?: string | null;
  status: string;
  plan_id?: string | null;
  amount_paid?: number | null;
  expiry_date?: string | null;
  planName?: string | null;
  meta?: string;
  photo_url?: string | null;
};

export function GymMemberCard({
  member,
  href,
  meta,
}: {
  member: GymMemberCardData;
  href?: string;
  meta?: string;
}) {
  const paid = isFeePaid(member);
  const memberPlan = hasMembership(member);
  const genderLabel = member.gender ? member.gender : 'Member';

  const content = (
    <article
      className={`gym-card-hover relative overflow-hidden rounded-2xl border bg-white p-5 ${
        paid ? 'border-[#DAE1E7]' : 'border-[#DAE1E7]'
      }`}
    >
      <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full border border-[#6DCCC3]/35" aria-hidden />
      <div className="pointer-events-none absolute -right-4 -top-6 h-20 w-20 rounded-full border border-[#DAE1E7]" aria-hidden />
      {memberPlan && (
        <span className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#6DCCC3]/20 text-[#2064B6]">
          <Star className="h-3.5 w-3.5 fill-[#2064B6]" />
        </span>
      )}
      <div className="flex flex-col items-center text-center">
        <MemberAvatar
          memberId={member.id}
          photoUrl={member.photo_url}
          name={member.name}
          className="h-[4.5rem] w-[4.5rem] rounded-2xl ring-2 ring-[#6DCCC3]/40"
        />
        <p className="mt-4 w-full truncate text-sm font-semibold uppercase tracking-[0.14em] text-slate-800">{member.name}</p>
        <p className="mt-1 font-mono text-[11px] tracking-wide text-slate-400">{member.member_id}</p>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs">
        <span className={`capitalize ${paid ? 'admin-badge-active' : 'admin-badge'}`}>
          {member.status === 'inactive' ? 'Payment due' : member.status}
        </span>
        <span className="text-slate-400">{member.planName || genderLabel}</span>
      </div>
      {(meta || member.phone) && (
        <p className="mt-3 truncate text-center text-xs text-slate-400">
          {meta || member.phone}
        </p>
      )}
    </article>
  );

  if (!href) return content;
  return <Link href={href}>{content}</Link>;
}
