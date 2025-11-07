-- Create user preferences table for personalized recommendations
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  preference_score NUMERIC NOT NULL DEFAULT 0,
  order_count INTEGER NOT NULL DEFAULT 0,
  last_ordered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id)
);

-- Create item forecast table for demand prediction
CREATE TABLE IF NOT EXISTS public.item_forecast (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  forecast_type TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
  predicted_quantity INTEGER NOT NULL DEFAULT 0,
  predicted_revenue NUMERIC NOT NULL DEFAULT 0,
  confidence_score NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(item_id, forecast_date, forecast_type)
);

-- Create collaborative filtering table for similar users
CREATE TABLE IF NOT EXISTS public.user_similarity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id_1 UUID NOT NULL,
  user_id_2 UUID NOT NULL,
  similarity_score NUMERIC NOT NULL DEFAULT 0,
  common_items INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id_1, user_id_2),
  CHECK (user_id_1 < user_id_2)
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_forecast ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_similarity ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_preferences
CREATE POLICY "Users can view their own preferences"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can manage preferences"
  ON public.user_preferences FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for item_forecast
CREATE POLICY "Anyone can view forecasts"
  ON public.item_forecast FOR SELECT
  USING (true);

CREATE POLICY "Service can manage forecasts"
  ON public.item_forecast FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can update forecasts"
  ON public.item_forecast FOR UPDATE
  USING (true);

-- RLS Policies for user_similarity
CREATE POLICY "Service can manage similarity"
  ON public.user_similarity FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_item_id ON public.user_preferences(item_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_score ON public.user_preferences(preference_score DESC);
CREATE INDEX IF NOT EXISTS idx_item_forecast_item_date ON public.item_forecast(item_id, forecast_date);
CREATE INDEX IF NOT EXISTS idx_item_forecast_date ON public.item_forecast(forecast_date);
CREATE INDEX IF NOT EXISTS idx_user_similarity_users ON public.user_similarity(user_id_1, user_id_2);

-- Create function to update user preferences based on orders
CREATE OR REPLACE FUNCTION public.update_user_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id, item_id, preference_score, order_count, last_ordered_at)
  VALUES (NEW.user_id, NEW.item_id, NEW.quantity * 10, 1, NEW.ordered_at)
  ON CONFLICT (user_id, item_id)
  DO UPDATE SET
    preference_score = user_preferences.preference_score + (NEW.quantity * 10),
    order_count = user_preferences.order_count + 1,
    last_ordered_at = NEW.ordered_at,
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Create trigger to update preferences on new orders
DROP TRIGGER IF EXISTS trigger_update_user_preferences ON public.orders;
CREATE TRIGGER trigger_update_user_preferences
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_preferences();

-- Create function to calculate time-weighted preference decay
CREATE OR REPLACE FUNCTION public.calculate_preference_decay()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_preferences
  SET preference_score = preference_score * 
    CASE 
      WHEN last_ordered_at > now() - interval '7 days' THEN 1.0
      WHEN last_ordered_at > now() - interval '30 days' THEN 0.8
      WHEN last_ordered_at > now() - interval '90 days' THEN 0.5
      ELSE 0.3
    END,
    updated_at = now()
  WHERE last_ordered_at IS NOT NULL;
END;
$$;