import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecommendationRequest {
  type?: 'overall' | 'weekly' | 'monthly';
  limit?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Processing recommendations request');

    const { type = 'overall', limit = 10 }: RecommendationRequest = 
      req.method === 'GET' ? Object.fromEntries(new URL(req.url).searchParams) : await req.json();

    // Calculate recommendations based on order data
    const now = new Date();
    let startDate: Date;
    let timePeriod: string;

    switch (type) {
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const weekNum = Math.ceil((now.getDate() - now.getDay() + 1) / 7);
        timePeriod = `${now.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        timePeriod = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        break;
      default:
        startDate = new Date(0); // Beginning of time for overall
        timePeriod = 'all-time';
    }

    console.log(`Calculating ${type} recommendations from ${startDate.toISOString()}`);

    // Get order statistics
    const { data: orderStats, error: statsError } = await supabase
      .from('orders')
      .select('item_id, quantity')
      .gte('ordered_at', startDate.toISOString());

    if (statsError) {
      console.error('Error fetching order stats:', statsError);
      throw statsError;
    }

    // Calculate popularity scores
    const popularityMap = new Map<string, number>();
    orderStats?.forEach((order) => {
      const current = popularityMap.get(order.item_id) || 0;
      popularityMap.set(order.item_id, current + order.quantity);
    });

    // Sort by popularity
    const sortedItems = Array.from(popularityMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, parseInt(limit.toString()));

    // Fetch item details
    const itemIds = sortedItems.map(([id]) => id);
    const { data: items, error: itemsError } = await supabase
      .from('menu_items')
      .select('*')
      .in('id', itemIds);

    if (itemsError) {
      console.error('Error fetching menu items:', itemsError);
      throw itemsError;
    }

    // Create recommendation objects
    const recommendations = sortedItems.map(([itemId, orderCount], index) => {
      const item = items?.find(i => i.id === itemId);
      return {
        rank: index + 1,
        item,
        order_count: orderCount,
        recommendation_type: type,
        time_period: timePeriod
      };
    }).filter(r => r.item);

    // Cache recommendations in database
    for (const rec of recommendations) {
      await supabase
        .from('recommendations')
        .upsert({
          item_id: rec.item.id,
          recommendation_type: type,
          rank: rec.rank,
          order_count: rec.order_count,
          time_period: timePeriod,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'item_id,recommendation_type,time_period',
          ignoreDuplicates: false
        });
    }

    console.log(`Generated ${recommendations.length} recommendations`);

    return new Response(
      JSON.stringify({
        success: true,
        type,
        time_period: timePeriod,
        recommendations
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in recommendations function:', error);
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