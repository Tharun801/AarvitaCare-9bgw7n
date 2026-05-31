/**
 * Edge Function: scan-prescription
 * Accepts a base64 image of a prescription and uses OnSpace AI (Gemini 3 Flash)
 * to extract medicine name, dosage, frequency, and duration.
 */
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'imageBase64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');
    const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');

    if (!apiKey || !baseUrl) {
      return new Response(
        JSON.stringify({ error: 'OnSpace AI is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const imageMime = mimeType || 'image/jpeg';
    const imageUrl = `data:${imageMime};base64,${imageBase64}`;

    const prompt = `You are a medical prescription parser AI assistant for an Indian health app.

Analyze this prescription image carefully and extract ALL medicines listed.

For EACH medicine found, extract:
1. name: Full medicine name (brand + generic if visible)
2. dosage: Dosage amount (e.g., "500mg", "1 tablet", "5ml", "10mg")
3. frequency: How often to take it — map to one of: once_daily, twice_daily, thrice_daily, four_times_daily, every_8_hours, every_6_hours, as_needed, weekly
4. duration: Number of days (integer). Use -1 if ongoing or not specified
5. instructions: Any special instructions (e.g., "after food", "before sleep", "avoid dairy"). Empty string if none.
6. type: Medicine type — one of: tablet, capsule, syrup, injection, drops, cream, inhaler, patch

Return ONLY a valid JSON object in this exact format, with no markdown, no explanation, no extra text:
{
  "medicines": [
    {
      "name": "Medicine Name",
      "dosage": "dosage string",
      "frequency": "frequency_id",
      "duration": 7,
      "instructions": "special instructions or empty string",
      "type": "tablet"
    }
  ],
  "doctorName": "Dr. Name if visible or empty string",
  "patientName": "Patient name if visible or empty string",
  "date": "prescription date if visible or empty string",
  "notes": "any general notes or empty string"
}

If no medicines are visible or the image is not a prescription, return:
{"medicines": [], "doctorName": "", "patientName": "", "date": "", "notes": "No prescription detected"}`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OnSpace AI error:', errText);
      return new Response(
        JSON.stringify({ error: `OnSpace AI: ${errText}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await response.json();
    const rawContent = aiData.choices?.[0]?.message?.content ?? '';

    // Strip markdown code fences if present
    const cleanContent = rawContent
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanContent);
    } catch {
      console.error('JSON parse error. Raw content:', rawContent);
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response', raw: rawContent }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: parsed }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('scan-prescription error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
