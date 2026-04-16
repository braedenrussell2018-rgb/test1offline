

## AI Assistant Improvement Plan (Revised)

### Changes from existing AI Assistant
- Markdown rendering for AI responses
- Send full chat history for context
- Upgrade AI model
- Conversation search & filtering in History tab
- Auto-scroll chat to bottom

### 1. Markdown Rendering for AI Responses
- Install `react-markdown` and render all assistant messages with proper formatting (bold, lists, code blocks, links)
- Replace current manual line-by-line rendering with `<ReactMarkdown>`

### 2. Send Full Chat History for Context
- Currently only the latest question is sent to the edge function
- Update frontend to send the entire `chatHistory` array as `messages`
- In the edge function, append the full conversation so the AI remembers prior exchanges in the session

### 3. Upgrade AI Model
- Switch from `google/gemini-2.5-flash` to `google/gemini-3-flash-preview` (newer, better reasoning, same speed tier)

### 4. Conversation Search & Filtering in History Tab
- Add a search bar to filter conversations by contact name, summary text, or date
- Add sort options (newest/oldest, by contact)

### 5. Auto-scroll Chat to Bottom
- Add a `useEffect` with `scrollIntoView` so new messages are always visible

### Files Modified
- `supabase/functions/ai-assistant/index.ts` -- Accept full message history, upgrade model
- `src/pages/AIAssistant.tsx` -- Markdown rendering, full history, search/filter, auto-scroll

### Implementation Order
1. Upgrade model to `gemini-3-flash-preview` in edge function
2. Accept and forward full chat history in edge function
3. Send full chat history from frontend
4. Add `react-markdown` for AI response rendering
5. Add auto-scroll to chat
6. Add search/filter to History tab

