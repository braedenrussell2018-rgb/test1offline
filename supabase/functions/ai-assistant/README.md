# AI Assistant Function

This Supabase Edge Function provides AI-powered conversation analysis and question answering using Anthropic's Claude API.

## Features

1. **Transcript Analysis** - Analyzes sales call transcripts and matches them to contacts
2. **Question Answering** - Answers questions based on conversation history or general knowledge

## Setup

### 1. Get an Anthropic API Key

1. Sign up at [Anthropic Console](https://console.anthropic.com/)
2. Navigate to API Keys section
3. Create a new API key

### 2. Configure Environment Variable

Set the API key in Supabase:

```bash
# Using Supabase CLI
supabase secrets set ANTHROPIC_API_KEY=your_api_key_here

# Or in Supabase Dashboard:
# Project Settings → Edge Functions → Secrets
# Add: ANTHROPIC_API_KEY = your_api_key_here
```

### 3. Deploy the Function

```bash
supabase functions deploy ai-assistant
```

## Configuration

### Model Selection

The default model is `claude-3-5-sonnet-20241022`. You can change this in `index.ts`:

```typescript
const model = "claude-3-5-sonnet-20241022"; // Most capable, higher cost
// const model = "claude-3-haiku-20240307"; // Faster, lower cost
```

### Token Limits

- **Transcript Analysis**: 2048 max_tokens
- **Question Answering**: 4096 max_tokens

Adjust these in the code if needed for longer responses.

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

Claude API pricing (as of 2024):

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| Claude 3.5 Sonnet | $3.00 | $15.00 |
| Claude 3 Haiku | $0.25 | $1.25 |

**Example costs:**
- Analyzing a 1000-word transcript: ~$0.01 with Sonnet, ~$0.001 with Haiku
- Answering a question: ~$0.01-0.05 depending on conversation history

## Troubleshooting

### "Anthropic API key not configured"
- Ensure ANTHROPIC_API_KEY is set in Supabase secrets
- Redeploy the function after setting the secret

### API Rate Limits
- Claude API has rate limits based on your plan
- Handle 429 errors gracefully (function already includes basic handling)

### Authentication Errors
- Make sure requests include valid Supabase auth token
- The function verifies user authentication before processing questions

## Migration from OpenAI

If you previously used OpenAI (GPT):

1. Remove old environment variable: `supabase secrets unset OPENAI_API_KEY`
2. Set new variable: `supabase secrets set ANTHROPIC_API_KEY=...`
3. Deploy updated function: `supabase functions deploy ai-assistant`

No frontend changes required - the API interface remains the same.
