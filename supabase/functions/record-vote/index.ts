import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RecordVoteBody {
  project_id: string;
  poll_id: string;
  answer_id?: string | null;
  session_id: string;
}

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function parseDevice(ua: string): { device_type: string; browser: string; os: string } {
  const u = ua.toLowerCase();
  let device_type = 'desktop';
  if (/ipad|tablet|playbook|silk/.test(u)) device_type = 'tablet';
  else if (/mobi|iphone|ipod|android.*mobile|phone/.test(u)) device_type = 'mobile';

  let browser = 'Other';
  if (u.includes('edg/')) browser = 'Edge';
  else if (u.includes('chrome/') && !u.includes('edg/')) browser = 'Chrome';
  else if (u.includes('firefox/')) browser = 'Firefox';
  else if (u.includes('safari/') && !u.includes('chrome/')) browser = 'Safari';

  let os = 'Other';
  if (u.includes('windows')) os = 'Windows';
  else if (u.includes('mac os') && !/iphone|ipad/.test(u)) os = 'macOS';
  else if (u.includes('android')) os = 'Android';
  else if (/iphone|ipad|ipod/.test(u)) os = 'iOS';
  else if (u.includes('linux')) os = 'Linux';

  return { device_type, browser, os };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json()) as RecordVoteBody;
    if (!isUuid(body.project_id) || !isUuid(body.poll_id) || typeof body.session_id !== 'string' || body.session_id.length < 8) {
      return new Response(JSON.stringify({ error: 'Invalid input' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const answer_id = isUuid(body.answer_id) ? body.answer_id : null;

    const ua = req.headers.get('user-agent') ?? '';
    const { device_type, browser, os } = parseDevice(ua);

    const country =
      req.headers.get('cf-ipcountry') ||
      req.headers.get('x-vercel-ip-country') ||
      req.headers.get('x-country-code') ||
      'Unknown';
    const region =
      req.headers.get('cf-region') ||
      req.headers.get('x-vercel-ip-country-region') ||
      req.headers.get('x-region') ||
      'Unknown';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error } = await supabase.from('vote_analytics').insert({
      project_id: body.project_id,
      poll_id: body.poll_id,
      answer_id,
      session_id: body.session_id.slice(0, 64),
      device_type,
      browser,
      os,
      country,
      region,
    });

    if (error) {
      console.error('record-vote insert error', error);
      return new Response(JSON.stringify({ error: 'Insert failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mirror the vote into poll_answers.live_votes so the operator's
    // Program Preview / Full Screen Output bar graph (which subscribes to
    // poll_answers via useLiveVotes) updates in real time. Statistics
    // reads vote_analytics directly and is unaffected. Best-effort: if the
    // increment fails we still return ok so the viewer's vote isn't lost.
    if (answer_id) {
      const { error: incErr } = await supabase.rpc('increment_poll_answer_live_votes', {
        _answer_id: answer_id,
        _poll_id: body.poll_id,
      });
      if (incErr) console.error('record-vote live_votes increment failed', incErr);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('record-vote error', e);
    return new Response(JSON.stringify({ error: 'Bad request' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});