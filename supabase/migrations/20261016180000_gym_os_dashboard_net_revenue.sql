-- Keep platform dashboard revenue consistent with gym dashboards and refunds.
CREATE OR REPLACE FUNCTION private.platform_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_gyms', (SELECT count(*)::int FROM public.gyms),
    'total_members', (SELECT count(*)::int FROM public.members),
    'active_members', (SELECT count(*)::int FROM public.members WHERE status = 'active'),
    'expiring_members', (
      SELECT count(*)::int FROM public.members
      WHERE status = 'expiring'
        AND expiry_date >= CURRENT_DATE
        AND expiry_date <= CURRENT_DATE + 7
    ),
    'expired_members', (SELECT count(*)::int FROM public.members WHERE status = 'expired'),
    'total_revenue', (
      SELECT coalesce(sum(amount - coalesce(refund_amount, 0)), 0)
      FROM public.payments
      WHERE status IN ('completed', 'partially_refunded')
    ),
    'today_visits', (
      SELECT count(*)::int FROM public.visits
      WHERE check_in_at >= CURRENT_DATE
    ),
    'gyms', (
      SELECT coalesce(jsonb_agg(row_to_json(g)::jsonb ORDER BY g.created_at), '[]'::jsonb)
      FROM (
        SELECT
          gy.id,
          gy.gym_id,
          gy.name,
          gy.owner_name,
          gy.status,
          gy.created_at,
          (SELECT count(*)::int FROM public.members m WHERE m.gym_id = gy.id) AS member_count,
          (SELECT count(*)::int FROM public.members m WHERE m.gym_id = gy.id AND m.status = 'active') AS active_members,
          (SELECT count(*)::int FROM public.members m WHERE m.gym_id = gy.id AND m.status = 'expired') AS expired_members,
          (SELECT count(*)::int FROM public.visits v WHERE v.gym_id = gy.id AND v.check_in_at >= CURRENT_DATE) AS today_visits,
          (
            SELECT coalesce(sum(p.amount - coalesce(p.refund_amount, 0)), 0)
            FROM public.payments p
            WHERE p.gym_id = gy.id AND p.status IN ('completed', 'partially_refunded')
          ) AS revenue
        FROM public.gyms gy
      ) g
    )
  );
$$;
