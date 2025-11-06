import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@18.5.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { RateLimiter, RATE_LIMITS } from '../_shared/rateLimiter.ts';
import { AuditLogger, AUDIT_ACTIONS } from '../_shared/auditLogger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TopupRequest {
  amount: number; // Amount in rupees
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || '' } }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting
    const rateLimiter = new RateLimiter(supabaseUrl, serviceKey);
    const allowed = await rateLimiter.checkLimit(user.id, RATE_LIMITS.WALLET_TOPUP);
    
    if (!allowed) {
      console.log(`Wallet topup rate limit exceeded for user ${user.id}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Too many topup attempts. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize audit logger
    const auditLogger = new AuditLogger(supabaseUrl, serviceKey);
    const clientInfo = AuditLogger.extractClientInfo(req);

    const { amount }: TopupRequest = await req.json();

    console.log(`Processing wallet top-up for user ${user.id}: ₹${amount}`);

    // Validate amount
    if (!amount || amount < 100 || amount > 10000) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid amount. Must be between ₹100 and ₹10,000' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

    // Check if Stripe customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      // Create new customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id }
      });
      customerId = customer.id;
    }

    // Create checkout session for wallet top-up
    // Amount in smallest currency unit (paise for INR)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'inr',
            unit_amount: amount * 100, // Convert to paise
            product_data: {
              name: 'Wallet Top-up',
              description: `Add ₹${amount} to your wallet`,
            },
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.get('origin')}/?payment=success`,
      cancel_url: `${req.headers.get('origin')}/?payment=cancelled`,
      metadata: {
        user_id: user.id,
        type: 'wallet_topup',
        amount: amount.toString()
      }
    });

    console.log(`Checkout session created: ${session.id}`);

    // Log audit event
    await auditLogger.log({
      userId: user.id,
      action: AUDIT_ACTIONS.WALLET_TOPUP,
      resourceType: 'wallet',
      ...clientInfo,
      metadata: {
        amount,
        session_id: session.id,
        customer_id: customerId
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: session.url,
        session_id: session.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in wallet-topup function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
