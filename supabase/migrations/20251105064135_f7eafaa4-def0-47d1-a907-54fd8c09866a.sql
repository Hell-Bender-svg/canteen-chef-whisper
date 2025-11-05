-- Create user_roles table for proper role management
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'owner', 'student')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_user_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Update menu_items RLS policies for owner access
DROP POLICY IF EXISTS "Anyone can view menu items" ON public.menu_items;

CREATE POLICY "Anyone can view menu items"
  ON public.menu_items FOR SELECT
  USING (true);

CREATE POLICY "Owners can insert menu items"
  ON public.menu_items FOR INSERT
  WITH CHECK (public.has_user_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update menu items"
  ON public.menu_items FOR UPDATE
  USING (public.has_user_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can delete menu items"
  ON public.menu_items FOR DELETE
  USING (public.has_user_role(auth.uid(), 'owner'));

-- Update orders RLS policies for owner access
CREATE POLICY "Owners can view all orders"
  ON public.orders FOR SELECT
  USING (public.has_user_role(auth.uid(), 'owner'));

-- Create a view for order analytics
CREATE OR REPLACE VIEW public.order_analytics AS
SELECT 
  DATE(ordered_at) as order_date,
  COUNT(*) as total_orders,
  SUM(total_price) as total_revenue,
  COUNT(DISTINCT user_id) as unique_customers
FROM public.orders
GROUP BY DATE(ordered_at)
ORDER BY order_date DESC;