import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Resend } from 'https://esm.sh/resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    console.log('Processing email queue...');

    // Get pending emails
    const { data: emails, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('attempts', 3)
      .limit(10);

    if (fetchError) throw fetchError;

    if (!emails || emails.length === 0) {
      console.log('No pending emails to process');
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${emails.length} emails`);

    let processed = 0;
    let failed = 0;

    for (const email of emails) {
      try {
        // Send email
        const { error: sendError } = await resend.emails.send({
          from: 'AKGEC Canteen <onboarding@resend.dev>',
          to: [email.to_email],
          subject: email.subject,
          html: email.html_content,
        });

        if (sendError) throw sendError;

        // Update status to sent
        await supabase
          .from('email_queue')
          .update({ 
            status: 'sent', 
            sent_at: new Date().toISOString() 
          })
          .eq('id', email.id);

        processed++;
        console.log(`Email sent successfully: ${email.id}`);
      } catch (error) {
        // Update attempts and error message
        await supabase
          .from('email_queue')
          .update({ 
            attempts: email.attempts + 1,
            error_message: error instanceof Error ? error.message : 'Unknown error',
            status: email.attempts + 1 >= 3 ? 'failed' : 'pending'
          })
          .eq('id', email.id);

        failed++;
        console.error(`Failed to send email ${email.id}:`, error);
      }
    }

    console.log(`Processed: ${processed}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({ success: true, processed, failed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in process-email-queue function:', error);
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
