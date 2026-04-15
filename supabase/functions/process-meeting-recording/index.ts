import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- Authentication ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    // Verify the caller's JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { meetingId } = await req.json();
    if (!meetingId) {
      return new Response(JSON.stringify({ error: "meetingId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for DB operations (needed to update meeting)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- Authorization: verify caller is a participant or the meeting creator ---
    const { data: meeting, error: meetingError } = await supabase
      .from("video_meetings")
      .select("*")
      .eq("id", meetingId)
      .single();

    if (meetingError || !meeting) {
      return new Response(JSON.stringify({ error: "Meeting not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isCreator = meeting.created_by === userId;
    const { data: participation } = await supabase
      .from("video_meeting_participants")
      .select("id")
      .eq("meeting_id", meetingId)
      .eq("user_id", userId)
      .limit(1);

    if (!isCreator && (!participation || participation.length === 0)) {
      return new Response(JSON.stringify({ error: "Forbidden: not a participant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get participants for AI prompt
    const { data: participants } = await supabase
      .from("video_meeting_participants")
      .select("user_name")
      .eq("meeting_id", meetingId);

    const participantNames = (participants || []).map((p: any) => p.user_name);
    console.log(`Processing meeting "${meeting.title}" with ${participantNames.length} participants`);

    if (!lovableApiKey) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate AI notes
    const prompt = `You are an AI meeting assistant. A company meeting just ended with the following details:

Meeting Title: ${meeting.title}
Meeting Type: ${meeting.meeting_type}
Participants: ${participantNames.join(", ") || "Unknown participants"}
Started: ${meeting.started_at || "Unknown"}
Ended: ${meeting.ended_at || "Unknown"}

Based on the meeting title and context, generate:
1. A brief summary of what this meeting was likely about (2-3 sentences)
2. Key discussion points (3-5 bullet points)
3. Action items / to-do list for participants

Return your response as a JSON object with these exact fields:
- summary: string
- key_points: string[] (array of key point strings)
- todo_list: array of objects with { assignee: string, task: string, completed: false }

Assign action items to the actual participants listed above. If no participants are known, use "Team" as assignee.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a meeting notes AI. Always respond with valid JSON only, no markdown formatting." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_meeting_notes",
              description: "Save structured meeting notes",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "Brief meeting summary" },
                  key_points: {
                    type: "array",
                    items: { type: "string" },
                    description: "Key discussion points",
                  },
                  todo_list: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        assignee: { type: "string" },
                        task: { type: "string" },
                        completed: { type: "boolean" },
                      },
                      required: ["assignee", "task", "completed"],
                    },
                    description: "Action items for participants",
                  },
                },
                required: ["summary", "key_points", "todo_list"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "save_meeting_notes" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    console.log("AI response received");

    let notes = { summary: "", key_points: [] as string[], todo_list: [] as any[] };
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        notes = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("Failed to parse AI response:", e);
      }
    }

    const { error: updateError } = await supabase
      .from("video_meetings")
      .update({
        ai_summary: notes.summary,
        ai_key_points: notes.key_points,
        ai_todo_list: notes.todo_list,
      })
      .eq("id", meetingId);

    if (updateError) {
      console.error("Failed to update meeting:", updateError);
      return new Response(JSON.stringify({ error: "Failed to save notes" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Meeting notes saved successfully");
    return new Response(JSON.stringify({ success: true, notes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing meeting:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing the meeting" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
