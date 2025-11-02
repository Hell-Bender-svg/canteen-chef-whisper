import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Generating mock order data...');

    // Get all menu items
    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select('*');

    if (menuError || !menuItems || menuItems.length === 0) {
      throw new Error('No menu items found');
    }

    // Generate mock orders for the past 3 months
    const mockOrders = [];
    const now = new Date();
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Popular items (will have more orders)
    const popularItems = [
      'Samosa with Chhole (2 pcs)',
      'Masala Dosa',
      'Pao Bhaji',
      'Veg Thali',
      'Tea',
      'Chhole Bhature',
      'Veg Momos (6 pcs)',
      'Hot Coffee',
      'Grilled Sandwich',
      'Rajma Rice'
    ];

    // Generate 500 mock orders
    for (let i = 0; i < 500; i++) {
      // Random date within the past 3 months
      const orderDate = new Date(
        threeMonthsAgo.getTime() + 
        Math.random() * (now.getTime() - threeMonthsAgo.getTime())
      );

      // Bias towards popular items (70% chance)
      let selectedItem;
      if (Math.random() < 0.7) {
        const popularItemNames = popularItems.filter(name => 
          menuItems.some(item => item.name === name)
        );
        const randomPopularName = popularItemNames[
          Math.floor(Math.random() * popularItemNames.length)
        ];
        selectedItem = menuItems.find(item => item.name === randomPopularName);
      }
      
      // If no popular item selected, pick random
      if (!selectedItem) {
        selectedItem = menuItems[Math.floor(Math.random() * menuItems.length)];
      }

      const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 items
      const totalPrice = parseFloat(selectedItem.price) * quantity;

      mockOrders.push({
        user_id: null, // Anonymous orders for mock data
        item_id: selectedItem.id,
        quantity,
        total_price: totalPrice,
        ordered_at: orderDate.toISOString(),
        created_at: orderDate.toISOString()
      });
    }

    // Insert mock orders in batches
    const batchSize = 50;
    let inserted = 0;
    
    for (let i = 0; i < mockOrders.length; i += batchSize) {
      const batch = mockOrders.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('orders')
        .insert(batch);

      if (insertError) {
        console.error('Error inserting batch:', insertError);
        throw insertError;
      }
      
      inserted += batch.length;
      console.log(`Inserted ${inserted} / ${mockOrders.length} orders`);
    }

    console.log('Mock data generation complete!');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Generated ${mockOrders.length} mock orders`,
        inserted
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in seed-mock-data function:', error);
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