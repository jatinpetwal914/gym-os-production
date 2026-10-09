import crypto from 'crypto';
import { memberPhotoStoragePath, readAndValidateMemberPhoto } from '@/lib/member-photo';
import type { GymFormAnswer } from '@/lib/gym-forms';
import { extractSubmitter } from '@/lib/gym-forms';

export async function syncMemberFromForm(
  supabase: any,
  input: {
  gymId: string;
  branchId?: string | null;
  answers: GymFormAnswer[];
  planId: string | null;
  photo?: { buffer: Buffer; mime: 'image/jpeg' | 'image/png' | 'image/webp' } | null;
}) {
  const extracted = extractSubmitter(input.answers);
  const memberName = extracted.name;
  if (!memberName) return { memberId: null as string | null, error: 'A name is required to create a member.' };

  const phone = extracted.phone;
  const email = extracted.email;
  const address = extracted.address;
  const emergency = extracted.emergency;

  if (phone) {
    const { data: existing } = await supabase
      .from('members')
      .select('id, photo_url')
      .eq('gym_id', input.gymId)
      .eq('phone', phone)
      .maybeSingle();
    if (existing) {
      const patch: Record<string, string> = { name: memberName };
      if (address) patch.address = address;
      if (emergency) patch.emergency_contact = emergency;
      if (extracted.gender) patch.gender = extracted.gender;
      await supabase.from('members').update(patch).eq('id', existing.id);
      if (input.photo && !existing.photo_url) {
        const path = memberPhotoStoragePath(input.gymId, existing.id, input.photo.mime);
        await supabase.storage.from('member-photos').upload(path, input.photo.buffer, {
          contentType: input.photo.mime,
          upsert: true,
        });
        await supabase.from('members').update({ photo_url: path }).eq('id', existing.id);
      }
      return { memberId: existing.id, error: null };
    }
  }

  const { count } = await supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', input.gymId);
  const { data: gymRow } = await supabase.from('gyms').select('gym_id').eq('id', input.gymId).maybeSingle();
  const memberCode = `${gymRow?.gym_id || input.gymId}-${String((count || 0) + 1).padStart(4, '0')}`;
  const qrToken = crypto.randomBytes(32).toString('hex');
  const { data: defaultBranch } = await supabase
    .from('gym_branches')
    .select('id')
    .eq('gym_id', input.gymId)
    .eq('is_default', true)
    .maybeSingle();

  let plan = null as { id: string; duration_days: number; final_price: number } | null;
  if (input.planId) {
    const { data } = await supabase
      .from('membership_plans')
      .select('id, duration_days, final_price, gym_id')
      .eq('id', input.planId)
      .maybeSingle();
    if (data && data.gym_id === input.gymId) plan = data;
  }

  const start = new Date();
  const expiry = new Date(start);
  if (plan) expiry.setDate(expiry.getDate() + plan.duration_days);
  const startStr = start.toISOString().slice(0, 10);
  const expiryStr = plan ? expiry.toISOString().slice(0, 10) : null;

  const { data: member, error } = await supabase
    .from('members')
    .insert({
      gym_id: input.gymId,
      home_branch_id: input.branchId || defaultBranch?.id || null,
      member_id: memberCode,
      name: memberName,
      phone,
      gender: extracted.gender,
      address,
      emergency_contact: emergency,
      plan_id: plan?.id || null,
      start_date: plan ? startStr : null,
      expiry_date: expiryStr,
      amount_paid: 0,
      status: 'inactive',
      qr_token: qrToken,
      notes: email ? `Form email: ${email}` : 'Created from public form',
    })
    .select('id')
    .maybeSingle();
  if (error || !member) return { memberId: null, error: error?.message || 'Unable to create member.' };

  if (input.photo) {
    const path = memberPhotoStoragePath(input.gymId, member.id, input.photo.mime);
    await supabase.storage.from('member-photos').upload(path, input.photo.buffer, {
      contentType: input.photo.mime,
      upsert: true,
    });
    await supabase.from('members').update({ photo_url: path }).eq('id', member.id);
  }

  if (plan) {
    await supabase.from('memberships').insert({
      gym_id: input.gymId,
      branch_id: input.branchId || defaultBranch?.id || null,
      member_id: member.id,
      plan_id: plan.id,
      starts_on: startStr,
      ends_on: expiryStr,
      status: 'pending',
      amount_due: plan.final_price,
      amount_paid: 0,
    });
  }

  return { memberId: member.id, error: null };
}

export async function validatePhotoUpload(file: File) {
  return readAndValidateMemberPhoto(file);
}
