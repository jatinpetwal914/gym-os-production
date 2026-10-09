import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createUserServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase-server';
import { isSuperAdminRole } from '@/lib/roles';
import crypto from 'crypto';
import type { Database, Json } from '@/lib/database.types';

type GymUpdate = Database['public']['Tables']['gyms']['Update'];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

async function findGymAdmin(
  supabase: ReturnType<typeof createUserServerClient>,
  gymUuid: string
) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('gym_id', gymUuid)
    .in('role', ['gym_admin', 'gym_owner'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function writeAuditLog(
  supabase: ReturnType<typeof createUserServerClient>,
  payload: {
    actorId: string;
    gymId?: string | null;
    action: string;
    targetType: string;
    targetId: string;
    details?: Record<string, unknown>;
  }
) {
  await supabase.from('audit_logs').insert({
    actor_id: payload.actorId,
    gym_id: payload.gymId ?? null,
    action: payload.action,
    target_type: payload.targetType,
    target_id: payload.targetId,
    details: (payload.details ?? null) as Json,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isSuperAdminRole(session.role)) {
      return NextResponse.json({ error: 'Forbidden — Super Admin only' }, { status: 403 });
    }

    const supabase = createUserServerClient();
    const gymId = params.id;

    // Fetch gym — id could be the UUID or the gym_id text
    const { data: gym, error: gymError } = await supabase
      .from('gyms')
      .select('id, gym_id, name, owner_name, phone, email, address, status, created_at, updated_at')
      .or(`id.eq.${gymId},gym_id.eq.${gymId}`)
      .maybeSingle();

    if (gymError) throw gymError;
    if (!gym) {
      return NextResponse.json({ error: 'Gym not found' }, { status: 404 });
    }

    const { data: platform } = await supabase.rpc('platform_stats');
    const platformStats = (platform || {}) as {
      gyms?: Array<{
        id: string;
        member_count?: number;
        active_members?: number;
        expired_members?: number;
        today_visits?: number;
        revenue?: number;
      }>;
    };
    const gymStats = (platformStats.gyms || []).find((row) => row.id === gym.id);

    const { count: planCount } = await supabase
      .from('membership_plans')
      .select('*', { count: 'exact', head: true })
      .eq('gym_id', gym.id);

    const adminUser = await findGymAdmin(supabase, gym.id);

    return NextResponse.json({
      data: {
        ...gym,
        admin_username: adminUser?.username || null,
        admin_password: null,
        stats: {
          totalMembers: gymStats?.member_count || 0,
          activeMembers: gymStats?.active_members || 0,
          expiredMembers: gymStats?.expired_members || 0,
          todayAttendance: gymStats?.today_visits || 0,
          totalRevenue: Number(gymStats?.revenue || 0),
          planCount: planCount || 0,
        },
      },
    });
  } catch (error) {
    console.error('Gym GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isSuperAdminRole(session.role)) {
      return NextResponse.json({ error: 'Forbidden — Super Admin only' }, { status: 403 });
    }

    const supabase = createUserServerClient();
    const admin = createAdminClient();
    const lookupId = params.id;
    const body = await request.json();

    const { data: existingGym, error: fetchError } = await supabase
      .from('gyms')
      .select('id, gym_id, name')
      .or(`id.eq.${lookupId},gym_id.eq.${lookupId}`)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existingGym) {
      return NextResponse.json({ error: 'Gym not found' }, { status: 404 });
    }

    const oldGymId = existingGym.gym_id;
    let targetGymId = oldGymId;

    // Rename the gym code (GYM-XXX) if requested. Tenant tables store gyms.id (uuid),
    // so the text code change does not cascade.
    const newGymId = body.gym_id ? String(body.gym_id).trim() : undefined;
    if (newGymId && newGymId !== oldGymId) {
      const { data: dup, error: dupErr } = await supabase
        .from('gyms')
        .select('id')
        .ilike('gym_id', newGymId)
        .neq('id', existingGym.id)
        .maybeSingle();
      if (dupErr) throw dupErr;
      if (dup) {
        return NextResponse.json(
          { error: 'Gym ID is already in use' },
          { status: 409 }
        );
      }

      targetGymId = newGymId;
    }

    const newAdminUsername =
      body.admin_username !== undefined && body.admin_username !== null
        ? String(body.admin_username).trim()
        : undefined;

    if (newAdminUsername !== undefined) {
      if (!newAdminUsername) {
        return NextResponse.json(
          { error: 'Login username cannot be empty' },
          { status: 400 }
        );
      }

      const adminUser = await findGymAdmin(supabase, existingGym.id);
      if (!adminUser) {
        return NextResponse.json(
          { error: 'No gym admin user found for this gym' },
          { status: 404 }
        );
      }

      if (newAdminUsername !== adminUser.username) {
        const { data: userDup, error: userDupErr } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', newAdminUsername)
          .neq('id', adminUser.id)
          .maybeSingle();
        if (userDupErr) throw userDupErr;
        if (userDup) {
          return NextResponse.json(
            { error: 'This username is already in use.' },
            { status: 409 }
          );
        }

        const { error: usernameErr } = await supabase
          .from('profiles')
          .update({ username: newAdminUsername })
          .eq('id', adminUser.id);
        if (usernameErr) throw usernameErr;
      }
    }

    const updateData: GymUpdate = {};
    if (newGymId) updateData.gym_id = newGymId;
    if (body.name !== undefined) updateData.name = body.name;
    if (body.owner_name !== undefined) updateData.owner_name = body.owner_name;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.status !== undefined) updateData.status = body.status;

    const { data: updatedGym, error: updateError } = await supabase
      .from('gyms')
      .update(updateData)
      .eq('id', existingGym.id)
      .select('id, gym_id, name, owner_name, phone, email, address, status, created_at, updated_at')
      .maybeSingle();

    if (updateError) throw updateError;

    const refreshedAdmin = await findGymAdmin(supabase, existingGym.id);

    let newPassword: string | null = null;
    const customPassword =
      body.password !== undefined && body.password !== null ? String(body.password) : null;
    const shouldReset = body.reset_password === true || !!customPassword;

    if (shouldReset) {
      const adminUser = refreshedAdmin || (await findGymAdmin(supabase, existingGym.id));
      if (!adminUser) {
        return NextResponse.json(
          { error: 'No gym admin user found for this gym' },
          { status: 404 }
        );
      }

      if (customPassword) {
        if (customPassword.length < 8) {
          return NextResponse.json(
            { error: 'Password must be at least 8 characters' },
            { status: 400 }
          );
        }
        newPassword = customPassword;
      } else {
        newPassword = crypto.randomBytes(12).toString('base64url');
      }

      const { error: pwErr } = await admin.auth.admin.updateUserById(adminUser.id, {
        password: newPassword,
      });
      if (pwErr) throw pwErr;

      void writeAuditLog(supabase, {
        actorId: session.userId,
        gymId: existingGym.id,
        action: customPassword ? 'gym.admin_password_set' : 'gym.admin_password_reset',
        targetType: 'gym',
        targetId: existingGym.id,
        details: { gym_id: targetGymId, method: customPassword ? 'custom' : 'random' },
      });
    }

    void writeAuditLog(supabase, {
      actorId: session.userId,
      gymId: existingGym.id,
      action: 'gym.updated',
      targetType: 'gym',
      targetId: existingGym.id,
      details: {
        gym_id: targetGymId,
        renamed: Boolean(newGymId && newGymId !== oldGymId),
        admin_username_changed: newAdminUsername !== undefined && refreshedAdmin?.username === newAdminUsername,
        password_reset: newPassword !== null,
      },
    });

    return NextResponse.json({
      data: {
        ...updatedGym,
        admin_username: refreshedAdmin?.username || null,
        ...(newPassword ? { admin_password: newPassword } : {}),
      },
    });
  } catch (error) {
    console.error('Gym PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isSuperAdminRole(session.role)) {
      return NextResponse.json({ error: 'Forbidden — Super Admin only' }, { status: 403 });
    }

    const supabase = createUserServerClient();
    const admin = createAdminClient();
    const lookupId = params.id;
    const body = await request.json().catch(() => ({}));

    const { data: existingGym, error: fetchError } = await supabase
      .from('gyms')
      .select('id, gym_id, name')
      .or(`id.eq.${lookupId},gym_id.eq.${lookupId}`)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existingGym) {
      return NextResponse.json({ error: 'Gym not found' }, { status: 404 });
    }

    const { gym_id: gymIdText, name, id } = existingGym;

    if (!body.confirmGymId || !String(body.confirmGymId).trim()) {
      return NextResponse.json(
        { error: 'Gym ID confirmation is required.' },
        { status: 400 }
      );
    }

    if (normalize(String(body.confirmGymId)) !== normalize(gymIdText)) {
      return NextResponse.json(
        { error: 'Type the exact Gym ID to confirm deletion.' },
        { status: 400 }
      );
    }

    const { data: gymProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .eq('gym_id', id);
    if (profilesError) throw profilesError;

    await supabase.from('gyms').update({ owner_profile_id: null }).eq('id', id);

    for (const profile of gymProfiles || []) {
      const { error: authDeleteErr } = await admin.auth.admin.deleteUser(profile.id);
      if (authDeleteErr) {
        console.error('Failed to delete gym auth user', profile.id, authDeleteErr);
      }
    }

    const { error: gymDeleteErr } = await supabase
      .from('gyms')
      .delete()
      .eq('id', id);
    if (gymDeleteErr) throw gymDeleteErr;

    void writeAuditLog(supabase, {
      actorId: session.userId,
      action: 'gym.deleted',
      targetType: 'gym',
      targetId: id,
      details: {
        gym_id: gymIdText,
        gym_name: name,
      },
    });

    return NextResponse.json({
      data: { id, gym_id: gymIdText, name },
      message: 'Gym and all associated data deleted permanently',
    });
  } catch (error) {
    console.error('Gym DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
