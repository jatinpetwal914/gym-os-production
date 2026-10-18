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

function throwIfQueryError(error: { message: string } | null) {
  if (error) throw error;
}

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
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const sevenDaysFromNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 7));
    const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0];

    if (canAccessGymPortal(session.role)) {
      if (!session.gymId) {
        return NextResponse.json({ error: 'No gym associated with account' }, { status: 403 });
      }

      const gymId = session.gymId;

      const fourteenDaysAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 13));
      const fourteenDaysStr = fourteenDaysAgo.toISOString().slice(0, 10);
      const monthWindows = Array.from({ length: 6 }, (_, index) => {
        const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - index), 1));
        return {
          month,
          nextMonth: new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)),
        };
      });

      const [
        totalMembersResult,
        activeMembersResult,
        expiringMembersResult,
        expiredMembersResult,
        revenueResult,
        todayVisitsResult,
        visitResult,
        monthPaymentResults,
        recentMembersResult,
      ] = await Promise.all([
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gymId),
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gymId).eq('status', 'active'),
        supabase
          .from('members')
          .select('*', { count: 'exact', head: true })
          .eq('gym_id', gymId)
          .eq('status', 'expiring')
          .gte('expiry_date', today)
          .lte('expiry_date', sevenDaysStr),
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gymId).eq('status', 'expired'),
        supabase
          .from('payments')
          .select('amount, refund_amount')
          .eq('gym_id', gymId)
          .in('status', ['completed', 'partially_refunded']),
        supabase
          .from('visits')
          .select(`
            id, check_in_at, check_out_at, status,
            members!inner(id, member_id, name, phone, gender, status, plan_id, amount_paid, expiry_date)
          `)
          .eq('gym_id', gymId)
          .gte('check_in_at', `${today}T00:00:00.000Z`)
          .lt('check_in_at', tomorrow.toISOString())
          .order('check_in_at', { ascending: false }),
        supabase
          .from('visits')
          .select('check_in_at')
          .eq('gym_id', gymId)
          .gte('check_in_at', `${fourteenDaysStr}T00:00:00.000Z`)
          .lt('check_in_at', tomorrow.toISOString())
          .order('check_in_at', { ascending: true }),
        Promise.all(
          monthWindows.map(({ month, nextMonth }) =>
            supabase
              .from('payments')
              .select('amount, refund_amount')
              .eq('gym_id', gymId)
              .in('status', ['completed', 'partially_refunded'])
              .gte('payment_date', month.toISOString())
              .lt('payment_date', nextMonth.toISOString())
          )
        ),
        supabase
          .from('members')
          .select('id, member_id, name, status, expiry_date')
          .eq('gym_id', gymId)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      [
        totalMembersResult,
        activeMembersResult,
        expiringMembersResult,
        expiredMembersResult,
        revenueResult,
        todayVisitsResult,
        visitResult,
        ...monthPaymentResults,
        recentMembersResult,
      ].forEach((result) => throwIfQueryError(result.error));

      const totalRevenue = (revenueResult.data || []).reduce(
        (sum, payment) => sum + Number(payment.amount) - Number(payment.refund_amount || 0),
        0
      );

      const todayVisits = (todayVisitsResult.data || []) as VisitRow[];
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
      const attendanceMap: Record<string, number> = {};
      (visitResult.data || []).forEach((r: { check_in_at: string }) => {
        const date = r.check_in_at?.slice(0, 10);
        if (!date) return;
        attendanceMap[date] = (attendanceMap[date] || 0) + 1;
      });

      const attendanceChart = Array.from({ length: 14 }, (_, index) => {
        const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 13 + index))
          .toISOString()
          .slice(0, 10);
        return { date: date.slice(5), count: attendanceMap[date] || 0 };
      });

      // Revenue chart: last 6 months
      const revenueChart = monthWindows.map(({ month }, index) => {
        const monthPaymentsResult = monthPaymentResults[index];
        const monthRevenue = (monthPaymentsResult.data || []).reduce(
          (sum, payment) => sum + Number(payment.amount) - Number(payment.refund_amount || 0),
          0
        );
        return {
          month: month.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
          revenue: monthRevenue,
        };
      });

      return NextResponse.json({
        stats: {
          totalMembers: totalMembersResult.count || 0,
          activeMembers: activeMembersResult.count || 0,
          expiringMembers: expiringMembersResult.count || 0,
          expiredMembers: expiredMembersResult.count || 0,
          totalRevenue,
          todayAttendance: todayAttendance || 0,
          insideNow: inside.length,
          leftToday: left.length,
        },
        floor: { inside, left },
        attendanceChart,
        revenueChart,
        recentMembers: recentMembersResult.data || [],
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
