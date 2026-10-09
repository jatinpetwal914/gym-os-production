import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createUserServerClient } from '@/lib/supabase/server';
import { canAccessGymPortal, isSuperAdminRole } from '@/lib/roles';

type FloorMember = {
  id: string;
  member_id: string;
  name: string;
  phone: string | null;
  gender: string | null;
  status: string;
  plan_id: string | null;
  amount_paid: number;
  expiry_date: string | null;
};

type VisitRow = {
  id: string;
  check_in_at: string | null;
  check_out_at: string | null;
  members: FloorMember | FloorMember[];
};

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canAccessGymPortal(session.role) && !isSuperAdminRole(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createUserServerClient();
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0];

    if (canAccessGymPortal(session.role)) {
      if (!session.gymId) {
        return NextResponse.json({ error: 'No gym associated with account' }, { status: 403 });
      }

      const gymId = session.gymId;

      const { count: totalMembers } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('gym_id', gymId);

      const { count: activeMembers } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('gym_id', gymId)
        .eq('status', 'active');

      const { count: expiringMembers } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('gym_id', gymId)
        .eq('status', 'expiring')
        .gte('expiry_date', today)
        .lte('expiry_date', sevenDaysStr);

      const { count: expiredMembers } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('gym_id', gymId)
        .eq('status', 'expired');

      const { data: revenueRows } = await supabase
        .from('payments')
        .select('amount')
        .eq('gym_id', gymId);

      const totalRevenue = (revenueRows || []).reduce((sum, p) => sum + Number(p.amount), 0);

      const { data: todayVisitRows } = await supabase
        .from('visits')
        .select(`
          id, check_in_at, check_out_at, status,
          members!inner(id, member_id, name, phone, gender, status, plan_id, amount_paid, expiry_date)
        `)
        .eq('gym_id', gymId)
        .gte('check_in_at', today)
        .order('check_in_at', { ascending: false });

      const todayVisits = (todayVisitRows || []) as VisitRow[];
      const mapVisit = (row: VisitRow) => {
        const member = Array.isArray(row.members) ? row.members[0] : row.members;
        return {
          attendanceId: row.id,
          check_in_time: row.check_in_at,
          check_out_time: row.check_out_at,
          ...member,
        };
      };
      const inside = todayVisits.filter((row) => !row.check_out_at).map(mapVisit);
      const left = todayVisits.filter((row) => Boolean(row.check_out_at)).map(mapVisit);
      const todayAttendance = todayVisits.length;

      // Attendance chart: last 14 days
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const fourteenDaysStr = fourteenDaysAgo.toISOString().split('T')[0];

      const { data: visitRows } = await supabase
        .from('visits')
        .select('check_in_at')
        .eq('gym_id', gymId)
        .gte('check_in_at', fourteenDaysStr)
        .order('check_in_at', { ascending: true });

      const attendanceMap: Record<string, number> = {};
      (visitRows || []).forEach((r: { check_in_at: string }) => {
        const date = r.check_in_at?.slice(0, 10);
        if (!date) return;
        attendanceMap[date] = (attendanceMap[date] || 0) + 1;
      });

      const attendanceChart = Object.entries(attendanceMap).map(([date, count]) => ({
        date: date.slice(5),
        count,
      }));

      // Revenue chart: last 6 months
      const revenueChart: { month: string; revenue: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const year = d.getFullYear();
        const month = d.getMonth();
        const monthStart = new Date(year, month, 1).toISOString().split('T')[0];
        const monthEnd = new Date(year, month + 1, 0).toISOString().split('T')[0];

        const { data: monthPayments } = await supabase
          .from('payments')
          .select('amount')
          .eq('gym_id', gymId)
          .gte('payment_date', monthStart)
          .lte('payment_date', monthEnd);

        const monthRevenue = (monthPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);
        revenueChart.push({
          month: d.toLocaleDateString('en-US', { month: 'short' }),
          revenue: monthRevenue,
        });
      }

      // Recent members
      const { data: recentMembers } = await supabase
        .from('members')
        .select('id, member_id, name, status, expiry_date')
        .eq('gym_id', gymId)
        .order('created_at', { ascending: false })
        .limit(5);

      return NextResponse.json({
        stats: {
          totalMembers: totalMembers || 0,
          activeMembers: activeMembers || 0,
          expiringMembers: expiringMembers || 0,
          expiredMembers: expiredMembers || 0,
          totalRevenue,
          todayAttendance: todayAttendance || 0,
          insideNow: inside.length,
          leftToday: left.length,
        },
        floor: { inside, left },
        attendanceChart,
        revenueChart,
        recentMembers: recentMembers || [],
      });
    }

    const { data: platform, error: statsError } = await supabase.rpc('platform_stats');
    if (statsError) throw statsError;

    const platformStats = (platform || {}) as {
      total_gyms?: number;
      total_members?: number;
      active_members?: number;
      expiring_members?: number;
      expired_members?: number;
      total_revenue?: number;
      today_visits?: number;
      gyms?: Array<{
        id: string;
        gym_id: string;
        name: string;
        owner_name: string | null;
        status: string;
        member_count: number;
        revenue: number;
      }>;
    };

    return NextResponse.json({
      stats: {
        totalGyms: platformStats.total_gyms || 0,
        totalMembers: platformStats.total_members || 0,
        activeMembers: platformStats.active_members || 0,
        expiringMembers: platformStats.expiring_members || 0,
        expiredMembers: platformStats.expired_members || 0,
        totalRevenue: Number(platformStats.total_revenue || 0),
        todayAttendance: platformStats.today_visits || 0,
      },
      gyms: (platformStats.gyms || []).map((gym) => ({
        id: gym.id,
        gym_id: gym.gym_id,
        name: gym.name,
        owner_name: gym.owner_name,
        status: gym.status,
        member_count: gym.member_count || 0,
        revenue: Number(gym.revenue || 0),
      })),
    });
  } catch (error) {
    console.error('Dashboard GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
