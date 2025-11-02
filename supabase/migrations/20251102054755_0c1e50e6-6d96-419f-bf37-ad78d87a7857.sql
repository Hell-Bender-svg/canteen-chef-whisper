-- Fix function search path security issue with CASCADE
DROP FUNCTION IF EXISTS public.update_recommendations_timestamp() CASCADE;

CREATE OR REPLACE FUNCTION public.update_recommendations_timestamp()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER update_recommendations_timestamp
  BEFORE UPDATE ON public.recommendations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_recommendations_timestamp();