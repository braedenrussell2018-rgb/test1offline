import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String: string, chunkSize = 32768): Uint8Array {
  const chunks: Uint8Array[] = [];
  let position = 0;
  
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    
    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { audio, userOpenAIKey } = await req.json();
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log("Received audio for transcription, length:", audio.length);

    // For transcription, we need OpenAI's Whisper API
    // Lovable AI doesn't support audio transcription directly
    // So we'll use OpenAI if user provides key, otherwise use Lovable AI for a simpler approach
    
    // If user has OpenAI key, use Whisper
    if (userOpenAIKey) {
      const binaryAudio = processBase64Chunks(audio);
      
      const formData = new FormData();
      const blob = new Blob([binaryAudio.buffer as ArrayBuffer], { type: 'audio/webm' });
      formData.append('file', blob, 'audio.webm');
      formData.append('model', 'whisper-1');
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userOpenAIKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Whisper API error:", response.status, errorText);
        throw new Error(`Transcription API error: ${response.status}`);
      }

      const result = await response.json();
      console.log("Transcription successful");

      return new Response(
        JSON.stringify({ text: result.text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Without OpenAI key, we'll use ElevenLabs if connected, or return an error
      // For now, return a helpful message
      return new Response(
        JSON.stringify({ 
          error: "Voice transcription requires an OpenAI API key. Please add your key in Settings to enable voice recording.",
          needsApiKey: true 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error("Transcription error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
