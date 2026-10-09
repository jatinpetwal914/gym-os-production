-- Create a default Main branch whenever a gym is inserted.

CREATE OR REPLACE FUNCTION private.create_default_branch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.gym_branches (gym_id, name, address, phone, is_default, status)
  VALUES (NEW.id, 'Main', NEW.address, NEW.phone, true, 'active');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gyms_default_branch ON public.gyms;
CREATE TRIGGER trg_gyms_default_branch
  AFTER INSERT ON public.gyms
  FOR EACH ROW EXECUTE FUNCTION private.create_default_branch();
