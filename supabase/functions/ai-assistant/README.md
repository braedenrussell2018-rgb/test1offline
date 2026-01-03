# AI Assistant Function

This Supabase Edge Function provides AI-powered conversation analysis and question answering using Lovable AI (Google Gemini models).

## Features

1. **Transcript Analysis** - Analyzes sales call transcripts and matches them to contacts
2. **Question Answering** - Answers questions based on conversation history or general knowledge

## Setup

### 1. Get a Lovable AI API Key

The Lovable AI API key is automatically available for projects hosted on Lovable. If you need to set it manually:

1. Check your Lovable project settings
2. The `LOVABLE_API_KEY` should already be configured in Supabase secrets

### 2. Verify Environment Variable

Check that the API key is configured in Supabase:

```bash
# Using Supabase CLI
supabase secrets list

# Or in Supabase Dashboard:
# Project Settings → Edge Functions → Secrets
# Verify: LOVABLE_API_KEY exists
```

### 3. Deploy the Function

```bash
supabase functions deploy ai-assistant
```

## Configuration

### Model Selection

The default model is `google/gemini-2.5-flash`. This is a fast and capable model from Google.

Other available models through Lovable AI:
- `google/gemini-2.5-flash` (recommended - fast and capable)
- `google/gemini-pro` (more powerful, slightly slower)

To change the model, edit line 29 in `index.ts`:

```typescript
const model = "google/gemini-2.5-flash"; // Change to your preferred model
```

## API Usage

### Analyze Transcript

```typescript
const response = await supabase.functions.invoke('ai-assistant', {
  body: {
    action: 'analyze_transcript',
    transcript: 'Call recording text...',
    contacts: [/* array of contact objects */]
  }
});
```

### Ask Question

```typescript
const response = await supabase.functions.invoke('ai-assistant', {
  body: {
    action: 'ask_question',
    question: 'What did we discuss with Acme Corp?',
    conversationIds: ['uuid1', 'uuid2']
  }
});
```

## Cost Considerations

Lovable AI includes API credits for projects hosted on the platform. The Google Gemini models are cost-effective:

- **Gemini 2.5 Flash**: Very fast, optimized for frequent use
- **Gemini Pro**: More capable for complex tasks

**Example usage:**
- Analyzing a 1000-word transcript: Fast and efficient
- Answering a question: Real-time responses with conversation context

## Integration with Lovable

Since this project is hosted on Lovable, the AI gateway is pre-configured:

- **Endpoint**: `https://ai.gateway.lovable.dev/v1/chat/completions`
- **Format**: OpenAI-compatible API
- **Authentication**: Automatic via `LOVABLE_API_KEY`

## Troubleshooting

### "Lovable AI API key not configured"
- Verify `LOVABLE_API_KEY` exists in Supabase secrets
- Check that you're using a Lovable-hosted project
- Redeploy the function after configuration

### API Rate Limits
- Lovable AI has rate limits based on your project plan
- Error 429 responses include retry information
- The function handles rate limit errors gracefully

### Authentication Errors
- Ensure requests include valid Supabase auth token
- The function verifies user authentication before processing questions

## Migration from Other AI Providers

If you previously used OpenAI or Claude:

1. The API interface remains the same (no frontend changes needed)
2. The environment variable changes from `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` to `LOVABLE_API_KEY`
3. Deploy the updated function: `supabase functions deploy ai-assistant`

## Other Functions Using Lovable AI

This project also uses Lovable AI in:
- `scan-business-card` - AI-powered business card OCR
- `scan-receipt` - Receipt scanning and extraction
- `generate-budget-forecast` - Financial forecasting

All use the same `LOVABLE_API_KEY` and Lovable AI gateway.
