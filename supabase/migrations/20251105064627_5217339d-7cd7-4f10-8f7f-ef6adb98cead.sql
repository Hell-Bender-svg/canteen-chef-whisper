-- Create order_metrics table to track preparation times
CREATE TABLE IF NOT EXISTS public.order_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.menu_items(id) NOT NULL,
  avg_preparation_time INTEGER NOT NULL DEFAULT 300, -- seconds
  total_orders INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view order metrics"
  ON public.order_metrics FOR SELECT
  USING (true);

CREATE POLICY "Owners can update order metrics"
  ON public.order_metrics FOR UPDATE
  USING (public.has_user_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can insert order metrics"
  ON public.order_metrics FOR INSERT
  WITH CHECK (public.has_user_role(auth.uid(), 'owner'));

-- Create order_queue table for ticketing system
CREATE TABLE IF NOT EXISTS public.order_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) NOT NULL,
  ticket_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'completed')),
  estimated_ready_at TIMESTAMP WITH TIME ZONE,
  actual_ready_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(ticket_number)
);

-- Enable RLS
ALTER TABLE public.order_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for order_queue
CREATE POLICY "Users can view their own queue items"
  ON public.order_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_queue.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view ready orders"
  ON public.order_queue FOR SELECT
  USING (status IN ('ready', 'completed'));

CREATE POLICY "Owners can view all queue items"
  ON public.order_queue FOR SELECT
  USING (public.has_user_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update queue items"
  ON public.order_queue FOR UPDATE
  USING (public.has_user_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can insert queue items"
  ON public.order_queue FOR INSERT
  WITH CHECK (public.has_user_role(auth.uid(), 'owner'));

-- Create sequence for ticket numbers
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1;

-- Create function to get next ticket number
CREATE OR REPLACE FUNCTION public.get_next_ticket_number()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  -- Reset sequence daily at midnight
  IF NOT EXISTS (
    SELECT 1 FROM public.order_queue
    WHERE DATE(created_at) = CURRENT_DATE
  ) THEN
    ALTER SEQUENCE ticket_number_seq RESTART WITH 1;
  END IF;
  
  next_num := nextval('ticket_number_seq');
  RETURN next_num;
END;
$$;

-- Create function to calculate ETA based on metrics
CREATE OR REPLACE FUNCTION public.calculate_order_eta(p_item_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  avg_time INTEGER;
  queue_count INTEGER;
BEGIN
  -- Get average preparation time for the item
  SELECT avg_preparation_time INTO avg_time
  FROM public.order_metrics
  WHERE item_id = p_item_id;
  
  -- If no metrics exist, use default 5 minutes
  IF avg_time IS NULL THEN
    avg_time := 300;
  END IF;
  
  -- Count pending/preparing orders ahead
  SELECT COUNT(*) INTO queue_count
  FROM public.order_queue
  WHERE status IN ('pending', 'preparing')
  AND created_at < NOW();
  
  -- Calculate ETA: base time + (queue position * 60 seconds)
  RETURN avg_time + (queue_count * 60);
END;
$$;

-- Create trigger to update updated_at
CREATE TRIGGER update_order_metrics_updated_at
  BEFORE UPDATE ON public.order_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_order_queue_updated_at
  BEFORE UPDATE ON public.order_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create view for queue display
CREATE OR REPLACE VIEW public.queue_display AS
SELECT 
  oq.id,
  oq.ticket_number,
  oq.status,
  oq.estimated_ready_at,
  oq.actual_ready_at,
  oq.created_at,
  o.user_id,
  mi.name as item_name,
  o.quantity
FROM public.order_queue oq
JOIN public.orders o ON oq.order_id = o.id
JOIN public.menu_items mi ON o.item_id = mi.id
ORDER BY oq.ticket_number ASC;

GRANT SELECT ON public.queue_display TO authenticated;