import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createUserServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase-server';
import { createTenantAuthUser, ProfileClaimError } from '@/lib/auth-profile';
import { isSuperAdminRole } from '@/lib/roles';
import crypto from 'crypto';

function normalize(value: string) {
  return value.trim().toLowerCase();
}

async function isGymCodeTaken(supabase: ReturnType<typeof createUserServerClient>, gymCode: string, excludeId?: string) {
  let query = supabase.from('gyms').select('id').ilike('gym_id', gymCode);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isSuperAdminRole(session.role)) {
      return NextResponse.json({ error: 'Forbidden — Super Admin only' }, { status: 403 });
    }

    const supabase = createUserServerClient();
    const { data: gyms, error: gymsError } = await supabase
      .from('gyms')
      .select('id, gym_id, name, owner_name, phone, email, address, status, created_at, updated_at')
      .order('created_at', { ascending: true });

    if (gymsError) throw gymsError;

    const { data: platform } = await supabase.rpc('platform_stats');
    const stats = (platform || {}) as {
      gyms?: Array<{ id: string; member_count: number; revenue: number }>;
    };
    const statsByGym = new Map((stats.gyms || []).map((row) => [row.id, row]));

    const gymsWithStats = await Promise.all(
      (gyms || []).map(async (gym) => {
        const row = statsByGym.get(gym.id);
        const { data: admin } = await supabase
          .from('profiles')
          .select('username')
          .eq('gym_id', gym.id)
          .in('role', ['gym_admin', 'gym_owner'])
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        return {
          ...gym,
          admin_username: admin?.username || null,
          memberCount: row?.member_count || 0,
          revenue: Number(row?.revenue || 0),
        };
      })
    );

    return NextResponse.json({ data: gymsWithStats });
  } catch (error) {
    console.error('Gyms GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isSuperAdminRole(session.role)) {
      return NextResponse.json({ error: 'Forbidden — Super Admin only' }, { status: 403 });
    }

    const supabase = createUserServerClient();
    const admin = createAdminClient();
    const body = await request.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    let defaultPassword: string;
    if (body.password) {
      const pw = String(body.password);
      if (pw.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
      }
      defaultPassword = pw;
    } else {
      defaultPassword = crypto.randomBytes(12).toString('base64url');
    }

    const { data: existingGyms, error: countError } = await supabase
      .from('gyms')
      .select('gym_id')
      .order('created_at', { ascending: false })
      .limit(25);

    if (countError) throw countError;

    let nextNum = 1;
    for (const row of existingGyms || []) {
      const match = String(row.gym_id || '').match(/GYM-(\d+)/i);
      if (match) nextNum = Math.max(nextNum, parseInt(match[1], 10) + 1);
    }

    let gymCode = `GYM-${String(nextNum).padStart(3, '0')}`;
    while (await isGymCodeTaken(supabase, gymCode)) {
      nextNum += 1;
      gymCode = `GYM-${String(nextNum).padStart(3, '0')}`;
    }

    const { data: gym, error: gymError } = await supabase
      .from('gyms')
      .insert({
        gym_id: gymCode,
        name: body.name.trim(),
        owner_name: body.owner_name || null,
        phone: body.phone || null,
        email: body.email || null,
        address: body.address || null,
        status: 'active',
      })
      .select('id, gym_id, name, owner_name, phone, email, address, status, created_at, updated_at')
      .maybeSingle();

    if (gymError) throw gymError;
    if (!gym) return NextResponse.json({ error: 'Failed to create gym' }, { status: 500 });

    let createdUserId: string | null = null;
    try {
      let adminUsername = `${normalize(gymCode).replace(/[^a-z0-9]/g, '')}_admin`;
      let suffix = 1;
      while (true) {
        const { data: taken } = await admin.from('profiles').select('id').ilike('username', adminUsername).maybeSingle();
        if (!taken) break;
        adminUsername = `${normalize(gymCode).replace(/[^a-z0-9]/g, '')}_admin_${suffix}`;
        suffix += 1;
      }

      const { data: defaultBranch, error: branchError } = await admin
        .from('gym_branches')
        .select('id')
        .eq('gym_id', gym.id)
        .eq('is_default', true)
        .maybeSingle();
      if (branchError) throw branchError;

      const { user, profile } = await createTenantAuthUser(admin, {
        email: `${adminUsername}@users.forgegym.local`,
        password: defaultPassword,
        username: adminUsername,
        fullName: body.owner_name || body.name.trim(),
        role: 'gym_owner',
        gymId: gym.id,
        homeBranchId: defaultBranch?.id ?? null,
      });
      createdUserId = user.id;

      const { error: ownerError } = await supabase
        .from('gyms')
        .update({ owner_profile_id: profile.id })
        .eq('id', gym.id);
      if (ownerError) throw ownerError;

      await supabase.from('audit_logs').insert({
        actor_id: session.userId,
        gym_id: gym.id,
        action: 'gym.create',
        target_type: 'gym',
        target_id: gym.id,
        details: { gym_id: gym.gym_id },
      });

      return NextResponse.json({
        data: {
          gym,
          adminUser: {
            id: profile.id,
            username: profile.username,
            role: profile.role,
            gym_id: profile.gym_id,
            temporaryPassword: defaultPassword,
          },
        },
      }, { status: 201 });
    } catch (error) {
      if (createdUserId) {
        await supabase.from('gyms').update({ owner_profile_id: null }).eq('id', gym.id);
        await admin.auth.admin.deleteUser(createdUserId);
      }
      await supabase.from('gyms').delete().eq('id', gym.id);
      if (error instanceof ProfileClaimError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  } catch (error) {
    console.error('Gyms POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
