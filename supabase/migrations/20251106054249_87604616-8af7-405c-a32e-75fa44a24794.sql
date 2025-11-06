-- Create audit_logs table for security tracking
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit_logs
CREATE POLICY "Admins can view all audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  has_user_role(auth.uid(), 'admin')
);

CREATE POLICY "Service can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create rate_limit_tracker table
CREATE TABLE IF NOT EXISTS public.rate_limit_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- Can be user_id, IP, or API key
  action TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(identifier, action, window_start)
);

-- Create index for rate limiting lookups
CREATE INDEX idx_rate_limit_identifier ON public.rate_limit_tracker(identifier, action, window_start);

-- Enable RLS
ALTER TABLE public.rate_limit_tracker ENABLE ROW LEVEL SECURITY;

-- RLS Policy - only service role can access
CREATE POLICY "Service role can manage rate limits"
ON public.rate_limit_tracker
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Function to check rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier TEXT,
  p_action TEXT,
  p_max_attempts INTEGER,
  p_window_minutes INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts INTEGER;
  v_window_start TIMESTAMP WITH TIME ZONE;
BEGIN
  v_window_start := date_trunc('minute', now() - (p_window_minutes || ' minutes')::interval);
  
  -- Get current attempts in window
  SELECT COALESCE(SUM(attempts), 0) INTO v_attempts
  FROM public.rate_limit_tracker
  WHERE identifier = p_identifier
    AND action = p_action
    AND window_start >= v_window_start;
  
  -- Check if limit exceeded
  IF v_attempts >= p_max_attempts THEN
    RETURN FALSE;
  END IF;
  
  -- Increment counter
  INSERT INTO public.rate_limit_tracker (identifier, action, window_start)
  VALUES (p_identifier, p_action, date_trunc('minute', now()))
  ON CONFLICT (identifier, action, window_start)
  DO UPDATE SET attempts = rate_limit_tracker.attempts + 1;
  
  RETURN TRUE;
END;
$$;

-- Function to log audit events
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_ip_address,
    p_user_agent,
    p_metadata
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Clean up old rate limit entries (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limit_tracker
  WHERE window_start < now() - interval '1 hour';
END;
$$;