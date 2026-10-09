-- Additive only. Commit the new enum value before functions may reference it.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
