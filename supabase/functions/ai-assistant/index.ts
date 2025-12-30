import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, transcript, contacts, conversationIds, question, userOpenAIKey } = await req.json();
    console.log(`AI Assistant action: ${action}`);

    // Determine which API to use
    const useOpenAI = userOpenAIKey && userOpenAIKey.length > 0;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!useOpenAI && !LOVABLE_API_KEY) {
      throw new Error("No AI API key configured");
    }

    const apiUrl = useOpenAI 
      ? "https://api.openai.com/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    
    const apiKey = useOpenAI ? userOpenAIKey : LOVABLE_API_KEY;
    const model = useOpenAI ? "gpt-4o-mini" : "google/gemini-2.5-flash";

    if (action === "analyze_transcript") {
      // Analyze transcript and match to contacts
      const contactList = contacts.map((c: any) => 
        `- ID: ${c.id}, Name: ${c.name}, Company: ${c.company || 'N/A'}, Email: ${c.email || 'N/A'}, Phone: ${c.phone || 'N/A'}`
      ).join('\n');

      const systemPrompt = `You are a sales assistant AI. Analyze conversation transcripts and match them to existing contacts.

Given a transcript and a list of contacts, you must:
1. Identify who the salesperson was talking to
2. Match to an existing contact if possible, or suggest creating a new one
3. Extract key points from the conversation
4. Generate a brief summary

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "matchedContactId": "uuid-or-null",
  "matchConfidence": "high|medium|low|no_match",
  "suggestedNewContact": { "name": "string", "company": "string", "email": "string", "phone": "string" } | null,
  "summary": "Brief summary of the conversation",
  "keyPoints": ["point1", "point2", "point3"]
}`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `EXISTING CONTACTS:\n${contactList}\n\nTRANSCRIPT:\n${transcript}` }
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI API error:", response.status, errorText);
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      console.log("AI response:", content);

      // Parse the JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Invalid AI response format");
      }

      const analysis = JSON.parse(jsonMatch[0]);
      return new Response(JSON.stringify(analysis), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === "ask_question") {
      // Answer questions about past recordings
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Fetch conversations for context
      const { data: conversations, error } = await supabase
        .from("ai_conversations")
        .select("transcript, summary, key_points, created_at, contact_id")
        .in("id", conversationIds || []);

      if (error) {
        console.error("Database error:", error);
        throw new Error("Failed to fetch conversations");
      }

      const conversationContext = conversations?.map((c: any, i: number) => 
        `[Conversation ${i + 1} - ${new Date(c.created_at).toLocaleDateString()}]\nSummary: ${c.summary}\nKey Points: ${JSON.stringify(c.key_points)}\nTranscript: ${c.transcript}`
      ).join('\n\n---\n\n') || 'No conversations found.';

      const systemPrompt = `You are a helpful sales assistant AI with access to past conversation recordings. 
Answer questions based on the provided conversation history. Be specific and cite relevant conversations when applicable.
If the information isn't in the conversations, say so clearly.`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `CONVERSATION HISTORY:\n${conversationContext}\n\nQUESTION: ${question}` }
          ],
          temperature: 0.5,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI API error:", response.status, errorText);
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content;

      return new Response(JSON.stringify({ answer }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error) {
    console.error("AI Assistant error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
