import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderRequest {
  item_id: string;
  quantity: number;
  use_wallet?: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get auth header
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

    const { item_id, quantity, use_wallet = false }: OrderRequest = await req.json();

    console.log(`Processing order for user ${user.id}: item ${item_id}, quantity ${quantity}, wallet: ${use_wallet}`);

    // Validate input
    if (!item_id || !quantity || quantity < 1) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid order details' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get item details
    const { data: item, error: itemError } = await supabase
      .from('menu_items')
      .select('*')
      .eq('id', item_id)
      .single();

    if (itemError || !item) {
      console.error('Item not found:', itemError);
      return new Response(
        JSON.stringify({ success: false, error: 'Item not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate total price
    const totalPrice = parseFloat(item.price) * quantity;

    // Handle wallet payment if requested
    if (use_wallet) {
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (walletError && walletError.code !== 'PGRST116') {
        console.error('Error fetching wallet:', walletError);
        throw walletError;
      }

      if (!wallet) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'No wallet found. Please add money to your wallet first.' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const currentBalance = parseFloat(wallet.balance);
      
      if (currentBalance < totalPrice) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Insufficient wallet balance',
            current_balance: currentBalance,
            required: totalPrice
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Deduct from wallet
      const newBalance = currentBalance - totalPrice;
      const { error: updateError } = await supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating wallet:', updateError);
        throw updateError;
      }

      // Create transaction record
      await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          transaction_type: 'debit',
          amount: totalPrice,
          balance_after: newBalance,
          description: `Order payment: ${item.name} x${quantity}`
        });

      console.log(`Wallet payment processed: ₹${totalPrice} deducted, new balance: ₹${newBalance}`);
    }

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        item_id: item_id,
        quantity: quantity,
        total_price: totalPrice,
        ordered_at: new Date().toISOString()
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      throw orderError;
    }

    // Create payment record if wallet was used
    if (use_wallet) {
      await supabase
        .from('payments')
        .insert({
          order_id: order.id,
          user_id: user.id,
          amount: totalPrice,
          payment_method: 'wallet',
          payment_status: 'completed'
        });
    }

    console.log(`Order created successfully: ${order.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        order: {
          ...order,
          item
        },
        payment_method: use_wallet ? 'wallet' : 'cash'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in place-order function:', error);
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