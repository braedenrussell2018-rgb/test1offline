

## Fix Business Card Scanner — Accurate Field Extraction

### Problem
Fields (name, company, phone, job title) get mixed up or extracted incorrectly. Root causes:
1. **Model**: Using `gemini-2.5-flash` — weaker at vision tasks
2. **Extraction method**: Asking the model to return raw JSON text, which is unreliable — the model can hallucinate or misformat
3. **No validation**: Extracted data is trusted blindly with no cross-checks
4. **Image size**: Full-resolution base64 images sent without compression, which can degrade model performance

### Solution

#### 1. Upgrade model to `gemini-2.5-pro` (best vision accuracy)
In `supabase/functions/scan-business-card/index.ts`, switch from `gemini-2.5-flash` to `gemini-2.5-pro` — the top-tier model for image+text reasoning.

#### 2. Use tool calling for structured extraction
Replace the "return JSON" prompt approach with **tool calling**, which forces the model to output data in an exact schema. This eliminates JSON parse failures and reduces field confusion.

```typescript
tools: [{
  type: "function",
  function: {
    name: "extract_contact",
    description: "Extract contact info from a business card",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Person's full name" },
        company: { type: "string", description: "Company/business name" },
        jobTitle: { type: "string", description: "Job title/position" },
        email: { type: "string", description: "Email address" },
        phone: { type: "string", description: "Phone number" },
        address: { type: "string", description: "Street address" }
      }
    }
  }
}],
tool_choice: { type: "function", function: { name: "extract_contact" } }
```

#### 3. Add post-extraction validation
Cross-check extracted email (must contain `@`), phone (must have digits), and flag suspicious results for user review.

#### 4. Resize image before sending
In the frontend hook, compress the image to max 1200px width before sending to the edge function — reduces payload size and improves model focus.

### Files Modified
- `supabase/functions/scan-business-card/index.ts` — Tool calling, model upgrade, validation
- `src/hooks/useBusinessCardScanner.ts` — Image compression before upload
- `src/components/AddPersonDialog.tsx` — Show confidence indicator when fields may need review

### Implementation Order
1. Upgrade model and add tool calling in edge function
2. Add validation logic in edge function
3. Add image compression in frontend hook
4. Add review indicator in AddPersonDialog

