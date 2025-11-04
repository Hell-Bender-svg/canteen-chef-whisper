import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@18.5.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2025-08-27.basil',
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  
  if (!signature) {
    return new Response('No signature', { status: 400 });
  }

  try {
    const body = await req.text();
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    
    // Verify webhook signature
    const event = webhookSecret
      ? stripe.webhooks.constructEvent(body, signature, webhookSecret)
      : JSON.parse(body);

    console.log(`Webhook received: ${event.type}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      console.log('Processing checkout session:', session.id);
      console.log('Metadata:', session.metadata);

      // Handle wallet top-up
      if (session.metadata?.type === 'wallet_topup') {
        const userId = session.metadata.user_id;
        const amount = parseFloat(session.metadata.amount);

        console.log(`Processing wallet top-up: user=${userId}, amount=${amount}`);

        // Get or create wallet
        const { data: wallet, error: walletFetchError } = await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (walletFetchError) {
          console.error('Error fetching wallet:', walletFetchError);
          throw walletFetchError;
        }

        let currentBalance = 0;
        
        if (!wallet) {
          // Create new wallet
          const { data: newWallet, error: createError } = await supabase
            .from('wallets')
            .insert({
              user_id: userId,
              balance: amount
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating wallet:', createError);
            throw createError;
          }
          
          currentBalance = amount;
          console.log('Created new wallet with balance:', currentBalance);
        } else {
          // Update existing wallet
          currentBalance = parseFloat(wallet.balance) + amount;
          
          const { error: updateError } = await supabase
            .from('wallets')
            .update({ balance: currentBalance })
            .eq('user_id', userId);

          if (updateError) {
            console.error('Error updating wallet:', updateError);
            throw updateError;
          }
          
          console.log('Updated wallet balance:', currentBalance);
        }

        // Create transaction record
        const { error: txError } = await supabase
          .from('transactions')
          .insert({
            user_id: userId,
            transaction_type: 'credit',
            amount: amount,
            balance_after: currentBalance,
            description: `Wallet top-up via Stripe`,
            stripe_payment_intent_id: session.payment_intent as string
          });

        if (txError) {
          console.error('Error creating transaction:', txError);
          throw txError;
        }

        // Create payment record
        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            user_id: userId,
            amount: amount,
            payment_method: 'stripe',
            payment_status: 'completed',
            stripe_payment_intent_id: session.payment_intent as string,
            stripe_customer_id: session.customer as string
          });

        if (paymentError) {
          console.error('Error creating payment record:', paymentError);
          throw paymentError;
        }

        console.log('Wallet top-up processed successfully');
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Webhook processing failed'
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
