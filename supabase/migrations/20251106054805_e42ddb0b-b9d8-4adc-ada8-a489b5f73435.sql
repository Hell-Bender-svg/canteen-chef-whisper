-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('order', 'payment', 'system', 'promotion')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read) WHERE is_read = false;

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service can create notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create email_queue table for async email sending
CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_email_queue_status ON public.email_queue(status) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policy - only service role
CREATE POLICY "Service role can manage emails"
ON public.email_queue
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Create analytics views and tables
CREATE TABLE IF NOT EXISTS public.item_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  total_revenue NUMERIC NOT NULL DEFAULT 0,
  avg_order_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(item_id, date)
);

CREATE INDEX idx_item_stats_date ON public.item_stats(date DESC);
CREATE INDEX idx_item_stats_item_id ON public.item_stats(item_id);

-- Enable RLS
ALTER TABLE public.item_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Owners can view item stats"
ON public.item_stats
FOR SELECT
TO authenticated
USING (has_user_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can insert item stats"
ON public.item_stats
FOR INSERT
TO authenticated
WITH CHECK (has_user_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update item stats"
ON public.item_stats
FOR UPDATE
TO authenticated
USING (has_user_role(auth.uid(), 'owner'));

-- Create sales_summary view
CREATE OR REPLACE VIEW public.sales_summary AS
SELECT 
  DATE(o.ordered_at) as date,
  COUNT(DISTINCT o.id) as total_orders,
  COUNT(DISTINCT o.user_id) as unique_customers,
  SUM(o.total_price) as total_revenue,
  AVG(o.total_price) as avg_order_value,
  SUM(o.quantity) as total_items_sold
FROM orders o
GROUP BY DATE(o.ordered_at)
ORDER BY date DESC;

-- Create peak_hours view
CREATE OR REPLACE VIEW public.peak_hours AS
SELECT 
  EXTRACT(HOUR FROM ordered_at) as hour,
  COUNT(*) as order_count,
  SUM(total_price) as revenue,
  AVG(total_price) as avg_order_value
FROM orders
WHERE ordered_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY EXTRACT(HOUR FROM ordered_at)
ORDER BY order_count DESC;

-- Create top_items view
CREATE OR REPLACE VIEW public.top_items AS
SELECT 
  m.id,
  m.name,
  m.category,
  m.price,
  COUNT(o.id) as order_count,
  SUM(o.quantity) as total_quantity,
  SUM(o.total_price) as total_revenue
FROM menu_items m
LEFT JOIN orders o ON m.id = o.item_id
WHERE o.ordered_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY m.id, m.name, m.category, m.price
ORDER BY total_revenue DESC;

-- Function to update item stats
CREATE OR REPLACE FUNCTION public.update_item_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.item_stats (item_id, date, total_orders, total_quantity, total_revenue, avg_order_value)
  SELECT 
    item_id,
    DATE(ordered_at) as date,
    COUNT(DISTINCT id) as total_orders,
    SUM(quantity) as total_quantity,
    SUM(total_price) as total_revenue,
    AVG(total_price) as avg_order_value
  FROM orders
  WHERE DATE(ordered_at) = CURRENT_DATE
  GROUP BY item_id, DATE(ordered_at)
  ON CONFLICT (item_id, date)
  DO UPDATE SET
    total_orders = EXCLUDED.total_orders,
    total_quantity = EXCLUDED.total_quantity,
    total_revenue = EXCLUDED.total_revenue,
    avg_order_value = EXCLUDED.avg_order_value,
    updated_at = now();
END;
$$;

-- Function to create notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (p_user_id, p_title, p_message, p_type, p_metadata)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Function to queue email
CREATE OR REPLACE FUNCTION public.queue_email(
  p_user_id UUID,
  p_to_email TEXT,
  p_subject TEXT,
  p_html_content TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_id UUID;
BEGIN
  INSERT INTO public.email_queue (user_id, to_email, subject, html_content)
  VALUES (p_user_id, p_to_email, p_subject, p_html_content)
  RETURNING id INTO v_email_id;
  
  RETURN v_email_id;
END;
$$;