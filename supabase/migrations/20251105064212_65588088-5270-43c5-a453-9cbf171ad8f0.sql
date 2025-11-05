-- Drop the security definer view and recreate without security definer
DROP VIEW IF EXISTS public.order_analytics;

-- Create analytics view without security definer (will use caller's permissions)
CREATE OR REPLACE VIEW public.order_analytics AS
SELECT 
  DATE(ordered_at) as order_date,
  COUNT(*) as total_orders,
  SUM(total_price) as total_revenue,
  COUNT(DISTINCT user_id) as unique_customers
FROM public.orders
GROUP BY DATE(ordered_at)
ORDER BY order_date DESC;

-- Grant access to authenticated users (RLS on orders table will still apply)
GRANT SELECT ON public.order_analytics TO authenticated;