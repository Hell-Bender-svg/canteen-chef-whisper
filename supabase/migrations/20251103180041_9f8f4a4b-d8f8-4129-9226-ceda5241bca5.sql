-- Add admin role to enum (separate transaction)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';