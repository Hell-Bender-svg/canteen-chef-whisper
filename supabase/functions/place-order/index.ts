import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderItem {
  item_id: string;
  variant_id?: string;
  quantity: number;
}

interface OrderRequest {
  items: OrderItem[];
  canteen_id?: string;
  payment_method: 'wallet' | 'cash' | 'card';
  special_instructions?: string;
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

    const { items, canteen_id, payment_method, special_instructions }: OrderRequest = await req.json();

    console.log(`Processing order for user ${user.id}: ${items.length} items, payment: ${payment_method}`);

    // Validate input
    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No items in order' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all items and calculate total
    let totalAmount = 0;
    const itemDetails = [];

    for (const orderItem of items) {
      const { data: item, error: itemError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('id', orderItem.item_id)
        .single();

      if (itemError || !item) {
        console.error('Item not found:', orderItem.item_id);
        return new Response(
          JSON.stringify({ success: false, error: `Item ${orderItem.item_id} not found` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if item is available
      if (!item.is_available) {
        return new Response(
          JSON.stringify({ success: false, error: `Item ${item.name} is not available` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const itemPrice = parseFloat(item.price);
      const itemTotal = itemPrice * orderItem.quantity;
      totalAmount += itemTotal;

      itemDetails.push({
        ...orderItem,
        item,
        unit_price: itemPrice,
        subtotal: itemTotal
      });
    }

    // For wallet payments, check and deduct balance
    if (payment_method === 'wallet') {
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (walletError || !wallet) {
        return new Response(
          JSON.stringify({ success: false, error: 'Wallet not found. Please set up your wallet first.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const currentBalance = parseFloat(wallet.balance);
      if (currentBalance < totalAmount) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Insufficient balance',
            current_balance: currentBalance,
            required: totalAmount
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Deduct from wallet
      const newBalance = currentBalance - totalAmount;
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
          amount: totalAmount,
          description: `Order payment for ${items.length} items`,
          balance_after: newBalance
        });
    }

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        canteen_id: canteen_id || null,
        total_amount: totalAmount,
        status: 'pending',
        payment_status: payment_method === 'wallet' ? 'paid' : 'pending',
        payment_method: payment_method,
        special_instructions: special_instructions
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      throw orderError;
    }

    // Create order items
    const orderItems = itemDetails.map(detail => ({
      order_id: order.id,
      item_id: detail.item_id,
      variant_id: detail.variant_id || null,
      quantity: detail.quantity,
      unit_price: detail.unit_price,
      subtotal: detail.subtotal
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
      throw itemsError;
    }

    // Create payment record if wallet payment
    if (payment_method === 'wallet') {
      await supabase
        .from('payments')
        .insert({
          order_id: order.id,
          user_id: user.id,
          amount: totalAmount,
          payment_method: 'wallet',
          payment_status: 'completed'
        });
    }

    // Add to order queue
    await supabase
      .from('order_queue')
      .insert({
        order_id: order.id,
        canteen_id: canteen_id || null,
        status: 'pending',
        priority: 'normal'
      });

    console.log(`Order created successfully: ${order.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        order: {
          ...order,
          items: itemDetails
        }
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