import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPrelight } from "../_shared/cors.ts";

function validateExtraction(contactInfo: Record<string, string | null>) {
  const confidence: Record<string, boolean> = {};

  // Email must contain @
  if (contactInfo.email && !contactInfo.email.includes("@")) {
    confidence.email = false;
    contactInfo.email = null;
  } else {
    confidence.email = !!contactInfo.email;
  }

  // Phone must have at least 7 digits
  if (contactInfo.phone) {
    const digits = contactInfo.phone.replace(/\D/g, "");
    if (digits.length < 7) {
      confidence.phone = false;
      contactInfo.phone = null;
    } else {
      confidence.phone = true;
    }
  } else {
    confidence.phone = false;
  }

  // Name should not look like a company (no Inc, LLC, etc.)
  const companyPatterns = /\b(inc|llc|ltd|corp|corporation|company|co\.|group|enterprises|solutions)\b/i;
  if (contactInfo.name && companyPatterns.test(contactInfo.name)) {
    confidence.name = false;
    // Swap: this might be the company name
    if (!contactInfo.company) {
      contactInfo.company = contactInfo.name;
      contactInfo.name = null;
    }
  } else {
    confidence.name = !!contactInfo.name;
  }

  confidence.company = !!contactInfo.company;
  confidence.jobTitle = !!contactInfo.jobTitle;
  confidence.address = !!contactInfo.address;

  const totalFields = Object.keys(confidence).length;
  const confidentFields = Object.values(confidence).filter(Boolean).length;
  const needsReview = confidentFields < totalFields * 0.5;

  return { contactInfo, confidence, needsReview };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return handleCorsPrelight(req);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Scanning business card with gemini-2.5-pro + tool calling...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract the contact information from this business card image. Be precise:
- "name" is the PERSON's full name (first + last), NOT the company/business name.
- "company" is the business/organization name, often has Inc, LLC, Corp, or appears as a logo/header.
- "jobTitle" is the person's role/position.
- "email" contains an @ symbol.
- "phone" is a phone number with area code.
- "address" is the physical street address.

Call the extract_contact function with the extracted data. Use null for fields you cannot find.`,
              },
              {
                type: "image_url",
                image_url: { url: imageData },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_contact",
              description: "Extract structured contact information from a business card",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Person's full name (first and last name)" },
                  company: { type: "string", description: "Company or business name" },
                  jobTitle: { type: "string", description: "Job title or position" },
                  email: { type: "string", description: "Email address" },
                  phone: { type: "string", description: "Phone number with area code" },
                  address: { type: "string", description: "Full street address" },
                },
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_contact" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();

    // Extract from tool call response
    let contactInfo;
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        contactInfo = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("Failed to parse tool call arguments:", e);
        throw new Error("Failed to parse business card data");
      }
    } else {
      // Fallback: try content-based extraction
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        try {
          const clean = content.replace(/```json\n?|\n?```/g, "").trim();
          contactInfo = JSON.parse(clean);
        } catch {
          throw new Error("Failed to parse business card data");
        }
      } else {
        throw new Error("No extraction result from AI");
      }
    }

    console.log("Raw extraction:", JSON.stringify(contactInfo));

    // Validate and add confidence scores
    const validated = validateExtraction(contactInfo);

    console.log("Validated:", JSON.stringify(validated));

    return new Response(
      JSON.stringify({
        contactInfo: validated.contactInfo,
        confidence: validated.confidence,
        needsReview: validated.needsReview,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in scan-business-card function:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to scan business card";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
