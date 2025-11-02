-- Create menu_items table
CREATE TABLE public.menu_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  category text NOT NULL,
  price decimal(10,2) NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create orders table to track all orders
CREATE TABLE public.orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.menu_items(id) ON DELETE CASCADE NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  total_price decimal(10,2) NOT NULL,
  ordered_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create recommendations cache table
CREATE TABLE public.recommendations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid REFERENCES public.menu_items(id) ON DELETE CASCADE NOT NULL,
  recommendation_type text NOT NULL, -- 'overall', 'weekly', 'monthly'
  rank integer NOT NULL,
  order_count integer NOT NULL,
  time_period text, -- e.g., '2024-W01', '2024-01'
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for menu_items (public read access)
CREATE POLICY "Anyone can view menu items"
  ON public.menu_items FOR SELECT
  USING (true);

-- RLS Policies for orders (users can see their own orders)
CREATE POLICY "Users can view their own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for recommendations (public read access)
CREATE POLICY "Anyone can view recommendations"
  ON public.recommendations FOR SELECT
  USING (true);

-- Create indexes for better performance
CREATE INDEX idx_orders_item_id ON public.orders(item_id);
CREATE INDEX idx_orders_ordered_at ON public.orders(ordered_at);
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_recommendations_type ON public.recommendations(recommendation_type);

-- Function to update recommendations timestamp
CREATE OR REPLACE FUNCTION public.update_recommendations_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_recommendations_timestamp
  BEFORE UPDATE ON public.recommendations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_recommendations_timestamp();