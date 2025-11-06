import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export interface RateLimitConfig {
  maxAttempts: number;
  windowMinutes: number;
  action: string;
}

export class RateLimiter {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async checkLimit(identifier: string, config: RateLimitConfig): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('check_rate_limit', {
      p_identifier: identifier,
      p_action: config.action,
      p_max_attempts: config.maxAttempts,
      p_window_minutes: config.windowMinutes
    });

    if (error) {
      console.error('Rate limit check error:', error);
      // Fail open - allow the request if rate limiting fails
      return true;
    }

    return data as boolean;
  }
}

export const RATE_LIMITS = {
  ORDER_PLACEMENT: { maxAttempts: 10, windowMinutes: 5, action: 'place_order' },
  WALLET_TOPUP: { maxAttempts: 5, windowMinutes: 15, action: 'wallet_topup' },
  RECOMMENDATIONS: { maxAttempts: 20, windowMinutes: 1, action: 'get_recommendations' },
  AUTH_LOGIN: { maxAttempts: 5, windowMinutes: 15, action: 'auth_login' },
};
