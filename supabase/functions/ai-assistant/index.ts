import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
      console.error("No AI API key configured");
      throw new Error("No AI API key configured");
    }

    const apiUrl = useOpenAI 
      ? "https://api.openai.com/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    
    const apiKey = useOpenAI ? userOpenAIKey : LOVABLE_API_KEY;
    const model = useOpenAI ? "gpt-4o-mini" : "google/gemini-2.5-flash";
    
    console.log(`Using API: ${useOpenAI ? 'OpenAI' : 'Lovable'}, Model: ${model}`);

    if (action === "analyze_transcript") {
      // Analyze transcript and match to contacts
      const contactList = contacts?.length > 0 
        ? contacts.map((c: any) => 
            `- ID: ${c.id}, Name: ${c.name}, Company: ${c.company || 'N/A'}, Email: ${c.email || 'N/A'}, Phone: ${c.phone || 'N/A'}`
          ).join('\n')
        : 'No existing contacts.';

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
}

If you cannot identify a specific contact from the transcript, set matchedContactId to null and matchConfidence to "no_match".
If you can extract contact info from the conversation, include it in suggestedNewContact.`;

      console.log("Sending analyze request to AI...");
      
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
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI API error:", response.status, errorText);
        throw new Error(`AI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("AI response received:", JSON.stringify(data).substring(0, 200));
      
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        console.error("No content in AI response");
        throw new Error("No content in AI response");
      }

      // Parse the JSON response - try multiple approaches
      let analysis;
      try {
        // First try direct parse
        analysis = JSON.parse(content);
      } catch {
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error("Could not parse AI response:", content);
          throw new Error("Invalid AI response format");
        }
        analysis = JSON.parse(jsonMatch[0]);
      }
      
      console.log("Analysis parsed successfully");
      
      return new Response(JSON.stringify(analysis), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === "ask_question") {
      // Answer questions about past recordings
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      let conversationContext = '';
      let hasCompanyData = false;
      
      if (conversationIds && conversationIds.length > 0) {
        // Fetch conversations for context
        const { data: conversations, error } = await supabase
          .from("ai_conversations")
          .select("transcript, summary, key_points, created_at, contact_id")
          .in("id", conversationIds);

        if (error) {
          console.error("Database error:", error);
          throw new Error("Failed to fetch conversations");
        }

        if (conversations && conversations.length > 0) {
          hasCompanyData = true;
          conversationContext = conversations.map((c: any, i: number) => 
            `[Conversation ${i + 1} - ${new Date(c.created_at).toLocaleDateString()}]\nSummary: ${c.summary || 'No summary'}\nKey Points: ${JSON.stringify(c.key_points || [])}\nTranscript: ${c.transcript}`
          ).join('\n\n---\n\n');
        }
      }

      // First, try to answer from company data
      const systemPromptWithData = `You are a helpful sales assistant AI with access to past conversation recordings and general knowledge.

IMPORTANT: You must ALWAYS start your response with a source indicator:
- If the answer comes from the conversation history provided, start with: "📁 **Source: Company Database**\\n\\n"
- If you need to use general knowledge or web information, start with: "🌐 **Source: General Knowledge / Web**\\n\\n"
- If you use both, start with: "📁🌐 **Source: Company Database & General Knowledge**\\n\\n"

When answering:
1. First check if the conversation history contains relevant information
2. If it does, answer from that data and cite which conversation(s)
3. If the information isn't in conversations, use your general knowledge to help
4. Be clear about what information came from where

${hasCompanyData ? `COMPANY CONVERSATION HISTORY:
${conversationContext}` : 'No company conversation history available.'}`;

      console.log("Sending question to AI...");

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPromptWithData },
            { role: "user", content: question }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI API error:", response.status, errorText);
        
        // Handle rate limits
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add more credits." }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content || "I couldn't generate an answer.";

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
