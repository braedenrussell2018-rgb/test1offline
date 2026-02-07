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
    const { meetingId } = await req.json();
    if (!meetingId) {
      return new Response(JSON.stringify({ error: "meetingId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get meeting details
    const { data: meeting, error: meetingError } = await supabase
      .from("video_meetings")
      .select("*")
      .eq("id", meetingId)
      .single();

    if (meetingError || !meeting) {
      console.error("Meeting not found:", meetingError);
      return new Response(JSON.stringify({ error: "Meeting not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get participants
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

    // Generate AI notes based on meeting metadata (since we can't transcribe video directly)
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

    // Extract tool call result
    let notes = { summary: "", key_points: [] as string[], todo_list: [] as any[] };
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        notes = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("Failed to parse AI response:", e);
      }
    }

    // Update meeting with AI notes
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
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
