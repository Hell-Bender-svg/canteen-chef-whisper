import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PersonalizedRecommendationRequest {
  user_id?: string;
  limit?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { user_id, limit = 10 }: PersonalizedRecommendationRequest = 
      req.method === 'GET' ? Object.fromEntries(new URL(req.url).searchParams) : await req.json();

    console.log('Generating personalized recommendations for user:', user_id);

    // Get user's preference data
    const { data: userPrefs, error: prefsError } = await supabase
      .from('user_preferences')
      .select('item_id, preference_score, order_count')
      .eq('user_id', user_id)
      .order('preference_score', { ascending: false });

    if (prefsError) {
      console.error('Error fetching user preferences:', prefsError);
    }

    // Get similar users using collaborative filtering
    const { data: similarUsers, error: similarError } = await supabase
      .from('user_similarity')
      .select('user_id_1, user_id_2, similarity_score')
      .or(`user_id_1.eq.${user_id},user_id_2.eq.${user_id}`)
      .order('similarity_score', { ascending: false })
      .limit(5);

    if (similarError) {
      console.error('Error fetching similar users:', similarError);
    }

    // Extract similar user IDs
    const similarUserIds = similarUsers?.map(s => 
      s.user_id_1 === user_id ? s.user_id_2 : s.user_id_1
    ) || [];

    // Get items that similar users liked but current user hasn't tried
    const userItemIds = userPrefs?.map(p => p.item_id) || [];
    let collaborativeItems: any[] = [];

    if (similarUserIds.length > 0) {
      const { data: collabData, error: collabError } = await supabase
        .from('user_preferences')
        .select('item_id, preference_score')
        .in('user_id', similarUserIds)
        .not('item_id', 'in', `(${userItemIds.join(',')})`)
        .order('preference_score', { ascending: false })
        .limit(parseInt(limit.toString()));

      if (!collabError && collabData) {
        collaborativeItems = collabData;
      }
    }

    // Get overall popular items as fallback
    const { data: popularItems, error: popularError } = await supabase
      .from('orders')
      .select('item_id, quantity')
      .gte('ordered_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (popularError) {
      console.error('Error fetching popular items:', popularError);
    }

    // Calculate popularity scores
    const popularityMap = new Map<string, number>();
    popularItems?.forEach((order) => {
      const current = popularityMap.get(order.item_id) || 0;
      popularityMap.set(order.item_id, current + order.quantity);
    });

    // Combine recommendations using hybrid approach
    const recommendationScores = new Map<string, number>();

    // Add user's own preferences (boosted)
    userPrefs?.forEach((pref) => {
      recommendationScores.set(pref.item_id, (pref.preference_score || 0) * 1.5);
    });

    // Add collaborative filtering recommendations
    collaborativeItems.forEach((item) => {
      const current = recommendationScores.get(item.item_id) || 0;
      recommendationScores.set(item.item_id, current + (item.preference_score || 0) * 1.2);
    });

    // Add popular items (lower weight)
    popularityMap.forEach((score, itemId) => {
      if (!userItemIds.includes(itemId)) {
        const current = recommendationScores.get(itemId) || 0;
        recommendationScores.set(itemId, current + score * 0.5);
      }
    });

    // Sort by score and get top items
    const sortedItems = Array.from(recommendationScores.entries())
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

    // Create recommendation objects with ML scores
    const recommendations = sortedItems.map(([itemId, score], index) => {
      const item = items?.find(i => i.id === itemId);
      return {
        rank: index + 1,
        item,
        ml_score: score,
        recommendation_type: 'personalized',
        personalization_factors: {
          user_preference: userPrefs?.find(p => p.item_id === itemId) ? 'high' : 'none',
          collaborative: collaborativeItems.find(c => c.item_id === itemId) ? 'high' : 'none',
          popularity: popularityMap.has(itemId) ? 'medium' : 'low'
        }
      };
    }).filter(r => r.item);

    console.log(`Generated ${recommendations.length} personalized recommendations`);

    return new Response(
      JSON.stringify({
        success: true,
        user_id,
        recommendation_type: 'personalized_ml',
        recommendations
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in personalized-recommendations function:', error);
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
