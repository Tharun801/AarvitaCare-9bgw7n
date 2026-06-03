/**
 * supabase/functions/health-insight/index.ts
 *
 * Generates a personalised 2-sentence daily health tip using OnSpace AI
 * (google/gemini-3-flash-preview) based on the user's adherence stats,
 * streak, and active medicine list.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
  // ── CORS preflight ──────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      memberName,
      streak,
      adherencePct,
      takenToday,
      missedToday,
      pendingToday,
      medicineNames,   // string[]
    } = body as {
      memberName: string;
      streak: number;
      adherencePct: number;
      takenToday: number;
      missedToday: number;
      pendingToday: number;
      medicineNames: string[];
    };

    const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');
    const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');

    if (!apiKey || !baseUrl) {
      return new Response(
        JSON.stringify({ error: 'OnSpace AI not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Build prompt ────────────────────────────────────────────────────────
    const medList = medicineNames.length > 0
      ? medicineNames.slice(0, 8).join(', ')
      : 'no medicines listed';

    const prompt = `You are a friendly, empathetic health companion for an Indian family health app called AarvitaCare.

User context:
- Name: ${memberName}
- Current streak: ${streak} day(s)
- 7-day adherence: ${adherencePct}%
- Today: ${takenToday} taken, ${missedToday} missed, ${pendingToday} pending
- Active medicines: ${medList}

Write exactly 2 short, warm sentences as a personalised health insight for today.
Rules:
- Be encouraging and positive, even if adherence is low
- Reference the streak or adherence specifically
- If medicines are listed, mention one natural tip relevant to common medicines (e.g. take with food, stay hydrated)
- Use simple English suitable for all ages
- Do NOT use markdown, bullet points, or headers — plain prose only
- End with a small motivational nudge

Output only the 2 sentences, nothing else.`;

    // ── Call OnSpace AI ─────────────────────────────────────────────────────
    const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a friendly health companion. Always respond in plain English with exactly 2 sentences.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 120,
        temperature: 0.75,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('OnSpace AI error:', errText);
      return new Response(
        JSON.stringify({ error: `OnSpace AI: ${errText}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const insight = aiData.choices?.[0]?.message?.content?.trim() ?? '';

    console.log('Health insight generated for', memberName, '- length:', insight.length);

    return new Response(
      JSON.stringify({ insight }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('health-insight error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
