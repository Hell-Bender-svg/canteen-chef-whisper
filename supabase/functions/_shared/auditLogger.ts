import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export interface AuditLogParams {
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export class AuditLogger {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async log(params: AuditLogParams): Promise<void> {
    const { error } = await this.supabase.rpc('log_audit_event', {
      p_user_id: params.userId || null,
      p_action: params.action,
      p_resource_type: params.resourceType,
      p_resource_id: params.resourceId || null,
      p_ip_address: params.ipAddress || null,
      p_user_agent: params.userAgent || null,
      p_metadata: params.metadata || {}
    });

    if (error) {
      console.error('Audit logging error:', error);
    }
  }

  static extractClientInfo(req: Request): { ipAddress?: string; userAgent?: string } {
    return {
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] || 
                 req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined
    };
  }
}

export const AUDIT_ACTIONS = {
  ORDER_PLACED: 'order.placed',
  ORDER_UPDATED: 'order.updated',
  WALLET_TOPUP: 'wallet.topup',
  PAYMENT_COMPLETED: 'payment.completed',
  MENU_ITEM_CREATED: 'menu_item.created',
  MENU_ITEM_UPDATED: 'menu_item.updated',
  MENU_ITEM_DELETED: 'menu_item.deleted',
  USER_ROLE_ASSIGNED: 'user_role.assigned',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
};
