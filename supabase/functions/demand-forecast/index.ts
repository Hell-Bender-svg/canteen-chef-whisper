import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ForecastRequest {
  item_id?: string;
  forecast_type?: 'daily' | 'weekly' | 'monthly';
  days_ahead?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Processing demand forecast request');

    const { item_id, forecast_type = 'daily', days_ahead = 7 }: ForecastRequest = 
      req.method === 'GET' ? Object.fromEntries(new URL(req.url).searchParams) : await req.json();

    const now = new Date();

    // Get historical order data (last 90 days)
    const lookbackDays = 90;
    const startDate = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

    let query = supabase
      .from('orders')
      .select('item_id, quantity, ordered_at, total_price')
      .gte('ordered_at', startDate.toISOString());

    if (item_id) {
      query = query.eq('item_id', item_id);
    }

    const { data: historicalOrders, error: ordersError } = await query;

    if (ordersError) {
      console.error('Error fetching historical orders:', ordersError);
      throw ordersError;
    }

    console.log(`Analyzing ${historicalOrders?.length || 0} historical orders`);

    // Group orders by item and date
    const itemDataMap = new Map<string, Map<string, { quantity: number; revenue: number }>>();

    historicalOrders?.forEach((order) => {
      if (!itemDataMap.has(order.item_id)) {
        itemDataMap.set(order.item_id, new Map());
      }
      
      const dateKey = new Date(order.ordered_at).toISOString().split('T')[0];
      const itemData = itemDataMap.get(order.item_id)!;
      
      const existing = itemData.get(dateKey) || { quantity: 0, revenue: 0 };
      itemData.set(dateKey, {
        quantity: existing.quantity + order.quantity,
        revenue: existing.revenue + parseFloat(order.total_price.toString())
      });
    });

    const forecasts: any[] = [];

    // Generate forecasts for each item
    for (const [itemId, dateData] of itemDataMap.entries()) {
      const sortedDates = Array.from(dateData.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));

      if (sortedDates.length < 7) {
        console.log(`Skipping item ${itemId} - insufficient data`);
        continue;
      }

      // Simple moving average forecasting with trend adjustment
      const windowSize = forecast_type === 'daily' ? 7 : forecast_type === 'weekly' ? 4 : 3;
      const recentData = sortedDates.slice(-windowSize);
      
      const avgQuantity = recentData.reduce((sum, [, data]) => sum + data.quantity, 0) / recentData.length;
      const avgRevenue = recentData.reduce((sum, [, data]) => sum + data.revenue, 0) / recentData.length;

      // Calculate trend (comparing first half vs second half of recent data)
      const halfSize = Math.floor(recentData.length / 2);
      const firstHalfAvg = recentData.slice(0, halfSize).reduce((sum, [, data]) => sum + data.quantity, 0) / halfSize;
      const secondHalfAvg = recentData.slice(-halfSize).reduce((sum, [, data]) => sum + data.quantity, 0) / halfSize;
      const trendFactor = secondHalfAvg / (firstHalfAvg || 1);

      // Calculate standard deviation for confidence
      const variance = recentData.reduce((sum, [, data]) => {
        const diff = data.quantity - avgQuantity;
        return sum + diff * diff;
      }, 0) / recentData.length;
      const stdDev = Math.sqrt(variance);
      const confidenceScore = Math.max(0, Math.min(1, 1 - (stdDev / (avgQuantity || 1))));

      // Generate forecasts for upcoming days
      for (let i = 1; i <= parseInt(days_ahead.toString()); i++) {
        const forecastDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
        const dateStr = forecastDate.toISOString().split('T')[0];

        // Apply trend and add slight randomness for variance
        const trendAdjustedQuantity = avgQuantity * Math.pow(trendFactor, i / windowSize);
        const predictedQuantity = Math.max(0, Math.round(trendAdjustedQuantity));
        const predictedRevenue = avgRevenue * (predictedQuantity / (avgQuantity || 1));

        // Store forecast in database
        await supabase
          .from('item_forecast')
          .upsert({
            item_id: itemId,
            forecast_date: dateStr,
            forecast_type,
            predicted_quantity: predictedQuantity,
            predicted_revenue: predictedRevenue,
            confidence_score: confidenceScore,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'item_id,forecast_date,forecast_type',
            ignoreDuplicates: false
          });

        if (i === 1) { // Only add first day to response for brevity
          forecasts.push({
            item_id: itemId,
            forecast_date: dateStr,
            predicted_quantity: predictedQuantity,
            predicted_revenue: predictedRevenue,
            confidence_score: confidenceScore,
            trend: trendFactor > 1.1 ? 'increasing' : trendFactor < 0.9 ? 'decreasing' : 'stable',
            historical_avg: avgQuantity
          });
        }
      }
    }

    // Fetch item details for the forecasts
    const forecastItemIds = forecasts.map(f => f.item_id);
    const { data: items } = await supabase
      .from('menu_items')
      .select('*')
      .in('id', forecastItemIds);

    const enrichedForecasts = forecasts.map(forecast => ({
      ...forecast,
      item: items?.find(i => i.id === forecast.item_id)
    }));

    console.log(`Generated ${forecasts.length} demand forecasts`);

    return new Response(
      JSON.stringify({
        success: true,
        forecast_type,
        days_ahead,
        forecasts: enrichedForecasts,
        total_items_forecasted: itemDataMap.size
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in demand-forecast function:', error);
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
