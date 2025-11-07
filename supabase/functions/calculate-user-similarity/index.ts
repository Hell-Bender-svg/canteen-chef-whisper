import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Calculating user similarity matrix');

    // Get all user preferences
    const { data: allPreferences, error: prefsError } = await supabase
      .from('user_preferences')
      .select('user_id, item_id, preference_score');

    if (prefsError) {
      console.error('Error fetching preferences:', prefsError);
      throw prefsError;
    }

    // Group preferences by user
    const userItemMap = new Map<string, Map<string, number>>();
    allPreferences?.forEach((pref) => {
      if (!userItemMap.has(pref.user_id)) {
        userItemMap.set(pref.user_id, new Map());
      }
      userItemMap.get(pref.user_id)!.set(pref.item_id, pref.preference_score);
    });

    const userIds = Array.from(userItemMap.keys());
    console.log(`Calculating similarity for ${userIds.length} users`);

    const similarities: any[] = [];

    // Calculate cosine similarity between all user pairs
    for (let i = 0; i < userIds.length; i++) {
      for (let j = i + 1; j < userIds.length; j++) {
        const userId1 = userIds[i];
        const userId2 = userIds[j];
        
        const items1 = userItemMap.get(userId1)!;
        const items2 = userItemMap.get(userId2)!;

        // Find common items
        const commonItems = new Set<string>();
        let dotProduct = 0;
        let magnitude1 = 0;
        let magnitude2 = 0;

        // Calculate for user 1
        items1.forEach((score, itemId) => {
          magnitude1 += score * score;
          if (items2.has(itemId)) {
            commonItems.add(itemId);
            dotProduct += score * items2.get(itemId)!;
          }
        });

        // Calculate magnitude for user 2
        items2.forEach((score) => {
          magnitude2 += score * score;
        });

        if (commonItems.size > 0 && magnitude1 > 0 && magnitude2 > 0) {
          const cosineSimilarity = dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
          
          // Only store if similarity is significant
          if (cosineSimilarity > 0.1) {
            similarities.push({
              user_id_1: userId1 < userId2 ? userId1 : userId2,
              user_id_2: userId1 < userId2 ? userId2 : userId1,
              similarity_score: cosineSimilarity,
              common_items: commonItems.size
            });
          }
        }
      }
    }

    console.log(`Calculated ${similarities.length} user similarities`);

    // Store similarities in batches
    const batchSize = 100;
    for (let i = 0; i < similarities.length; i += batchSize) {
      const batch = similarities.slice(i, i + batchSize);
      await supabase
        .from('user_similarity')
        .upsert(batch, {
          onConflict: 'user_id_1,user_id_2',
          ignoreDuplicates: false
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_users: userIds.length,
        similarities_calculated: similarities.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in calculate-user-similarity function:', error);
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
