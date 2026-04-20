

## Invoice & Quote System Improvements Plan

### Current Problems
1. **Quotes can't be edited** — once created, no way to change items, prices, customer info, or notes. Only approve/reject buttons.
2. **Draft invoices use a separate dialog** (`EditDraftInvoiceDialog`) that duplicates ~80% of `InvoicePreviewEditor` logic, with inconsistent UI between create and edit flows.
3. **Finalized invoices are immutable** — typos or pricing fixes require deletion + recreation.
4. **No quote draft state** — every quote is "pending" the moment it's saved.
5. **Quote → Invoice approval is one-shot** — can't review/adjust before generating the invoice.
6. **Print HTML duplicated** in 3 files (`QuotePreviewEditor`, `InvoicePreviewEditor`, `EditDraftInvoiceDialog`) — drift risk.
7. **Missing fields** — no quantity per line, no notes/terms field, no tax field, no internal/private notes.
8. **No audit of edits** — finalized invoice changes need logging since this is sensitive financial data.

---

### 1. Unified Editor Component (`InvoiceQuoteEditor`)
Replace `QuotePreviewEditor`, `InvoicePreviewEditor`, and `EditDraftInvoiceDialog` content with a single shared editor that:
- Accepts `mode: 'create' | 'edit'` and `documentType: 'quote' | 'invoice'`
- Edits **all** fields: customer name/email/phone/address, ship-to, salesman, line items (description, serial, price, **quantity**), discount, shipping, **tax**, **notes/terms**
- Supports **adding items** from inventory (currently only edit-draft has this)
- Supports **removing items**, **reordering** via drag handle
- Has a single "Save" button with contextual label ("Create Quote" / "Save Draft" / "Finalize Invoice" / "Update")

### 2. Edit Existing Quotes
- Add an "Edit" button to each quote card on `Quotes.tsx`
- Opens `InvoiceQuoteEditor` in edit mode
- Editable while status is `pending` or new `draft`
- Once `approved`/`rejected`, becomes read-only (admins can override)

### 3. Add Quote Draft Status
- Extend quote status enum: `draft | pending | approved | rejected | expired`
- "Save as Draft" button in editor (parallel to invoice drafts)
- Add **"Quote Drafts"** dialog on Quotes page mirroring `DraftInvoicesDialog`
- Auto-expire pending quotes after 30 days → `expired` status (visual badge only)

### 4. Edit Finalized Invoices (Admin Only)
- Add "Edit" button on finalized invoices in `Accounting → InvoicesSection` for owners/developers
- Opens unified editor with **warning banner**: "Editing a finalized invoice — change will be logged"
- On save, write entry to `audit_logs` table (action: `invoice_edited`, risk_level: `medium`, capture before/after diff in metadata)
- If items change, re-sync inventory item statuses (release removed items back to `available`, mark added ones `sold`)

### 5. Quote → Invoice Conversion with Review Step
- Replace one-click "Approve & Create Invoice" with two steps:
  1. Click "Convert to Invoice" → opens unified editor pre-filled from quote, document type = invoice
  2. User can adjust pricing, items, or customer info → click "Finalize Invoice"
- Quote stays linked via new `source_quote_id` column on invoices

### 6. Schema Additions (migration)
- `quotes` table: add `status` value `draft`, add `notes text`, add `expires_at timestamptz`, add `tax numeric default 0`
- `invoices` table: add `notes text`, add `tax numeric default 0`, add `source_quote_id uuid`, add `last_edited_at`, `last_edited_by`
- Items in `items` jsonb gain `quantity int default 1` (handled in code, no schema change since jsonb)

### 7. Shared Print/PDF Renderer
- Extract print HTML into single helper `src/lib/document-print.ts` exporting `printDocument({ type, number, data })`
- Used by quote editor, invoice editor, edit-draft dialog, and accounting sections
- Add company letterhead (logo, address) at top — sourced from a new `company_settings` row or constants file

### 8. UX Polish
- **Line-item quantity**: separate qty + unit price columns; line total = qty × price
- **Auto-save draft** every 30s while editing (toast on save)
- **Keyboard shortcuts**: Ctrl+S save, Ctrl+P print, Esc to close
- **Duplicate document**: "Duplicate" button on any quote/invoice creates an editable copy
- **Send via email**: button that opens default mail client with PDF attachment summary (mailto with subject + body, PDF download triggered)
- **Status filter chips** on Quotes page: All / Draft / Pending / Approved / Rejected / Expired

### 9. Inventory Sync Safety
- When editing a finalized invoice and an item is removed → confirm dialog "Release [Part #] back to inventory?"
- When adding an item to a finalized invoice → mark it sold immediately
- Prevent finalizing an invoice if any item is no longer `available` (was sold elsewhere) — show conflict resolver

---

### Files Created
- `src/components/invoice-quote/InvoiceQuoteEditor.tsx` — unified editor (replaces 3 components' UI)
- `src/components/invoice-quote/LineItemRow.tsx` — single line item row with qty/price/serial/description
- `src/components/invoice-quote/AddItemPicker.tsx` — searchable inventory picker (extracted from edit-draft)
- `src/components/QuoteDraftsDialog.tsx` — draft quotes manager
- `src/components/EditQuoteDialog.tsx` — wrapper using unified editor
- `src/components/EditInvoiceDialog.tsx` — wrapper using unified editor (replaces EditDraftInvoiceDialog)
- `src/lib/document-print.ts` — shared print HTML generator

### Files Modified
- `src/pages/Quotes.tsx` — Edit button per quote, status filter chips, drafts dialog, two-step convert
- `src/components/CreateQuoteDialog.tsx` — use unified editor, add "Save as Draft"
- `src/components/CreateInvoiceDialog.tsx` — use unified editor
- `src/components/DraftInvoicesDialog.tsx` — open unified editor instead of EditDraftInvoiceDialog
- `src/components/accounting/InvoicesSection.tsx` — Edit button on finalized invoices (admin only)
- `src/lib/inventory-storage.ts` — add `updateQuote`, `duplicateInvoice`, `duplicateQuote`, `convertQuoteToInvoice` helpers; quantity & tax in totals
- `src/hooks/useUserRole.tsx` (read-only check) — gate finalized-edit by role

### Files Deleted (after migration)
- `src/components/EditDraftInvoiceDialog.tsx` — superseded by `EditInvoiceDialog`
- `src/components/quote/QuotePreviewEditor.tsx` — superseded by `InvoiceQuoteEditor`
- `src/components/invoice/InvoicePreviewEditor.tsx` — superseded by `InvoiceQuoteEditor`

### Database Migration
```sql
ALTER TABLE quotes
  ADD COLUMN status text DEFAULT 'pending',
  ADD COLUMN notes text,
  ADD COLUMN tax numeric DEFAULT 0,
  ADD COLUMN expires_at timestamptz;

ALTER TABLE invoices
  ADD COLUMN notes text,
  ADD COLUMN tax numeric DEFAULT 0,
  ADD COLUMN source_quote_id uuid,
  ADD COLUMN last_edited_at timestamptz,
  ADD COLUMN last_edited_by uuid;
```
RLS policies for new columns inherit existing table policies (no changes needed). Salesman edit policy already restricts to own records.

### Implementation Order
1. Database migration (add columns)
2. Build unified `InvoiceQuoteEditor` + `LineItemRow` + `AddItemPicker` components
3. Shared `document-print.ts` helper
4. Wire Create dialogs (quote + invoice) to unified editor
5. Build `EditQuoteDialog` + `EditInvoiceDialog` wrappers
6. Update `Quotes.tsx` (edit, status filter, drafts dialog, two-step convert)
7. Update `DraftInvoicesDialog` and add admin edit on finalized invoices in Accounting
8. Add audit logging for finalized-invoice edits
9. Auto-save, keyboard shortcuts, duplicate, status auto-expiry
10. Delete obsolete components

