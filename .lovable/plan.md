

# Email Platform powered by Mailcow

## Overview

Build a full-featured webmail client as a new top-level page (`/email`) that connects to a self-hosted Mailcow server for real email operations (IMAP, SMTP, REST API). The platform will be accessible to internal roles (owner, employee, developer).

Since IMAP/SMTP/Mailcow API calls cannot run in the browser, all mail operations will go through Supabase Edge Functions that act as a secure proxy. Credentials are stored server-side as secrets and never exposed to the client.

---

## Step 1 -- Store Mailcow Secrets

Request the following secrets from the user (via the add_secret tool):

- `MAILCOW_API_URL` -- e.g. `https://mail.companydomain.com`
- `MAILCOW_API_KEY` -- Mailcow admin/read-write API key
- `MAILCOW_IMAP_HOST` -- e.g. `mail.companydomain.com`
- `MAILCOW_IMAP_PORT` -- e.g. `993`
- `MAILCOW_SMTP_HOST` -- e.g. `mail.companydomain.com`
- `MAILCOW_SMTP_PORT` -- e.g. `587`

These will be available as `Deno.env.get(...)` inside edge functions.

---

## Step 2 -- Database: User Mailbox Credentials

Create a new table to securely map app users to their mailbox credentials:

```
email_accounts
  id (uuid, PK)
  user_id (uuid, references auth.users via column only -- no FK)
  email_address (text)
  imap_username (text, encrypted at rest)
  imap_password (text, encrypted at rest)
  display_name (text)
  signature_html (text)
  auto_reply_enabled (boolean, default false)
  auto_reply_message (text)
  created_at (timestamptz)
  updated_at (timestamptz)
```

RLS: Users can only read/update their own row. Only owners can insert (provision accounts).

---

## Step 3 -- Edge Functions (Backend Proxy)

Create **one primary edge function** `mailcow-email` with action-based routing. All IMAP/SMTP/API operations happen server-side.

### Actions supported:

| Action | Protocol | Description |
|--------|----------|-------------|
| `list-folders` | IMAP | Fetch all IMAP folders |
| `list-messages` | IMAP | Paginated message list for a folder |
| `get-message` | IMAP | Fetch full message body + attachments |
| `send-message` | SMTP | Send email (To, CC, BCC, attachments) + IMAP APPEND to Sent |
| `move-message` | IMAP | Move message between folders |
| `delete-message` | IMAP | Move to Trash or EXPUNGE |
| `flag-message` | IMAP | Toggle read/unread, starred |
| `search-messages` | IMAP SEARCH | Search by sender, subject, body, date |
| `save-draft` | IMAP | APPEND to Drafts folder |
| `create-folder` | Mailcow API | Create custom folder |
| `rename-folder` | Mailcow API | Rename folder |
| `delete-folder` | Mailcow API | Delete folder |
| `get-settings` | Mailcow API | Fetch mailbox settings (quota, aliases, spam) |
| `update-settings` | Mailcow API | Update spam sensitivity, auto-reply, signature |
| `get-quarantine` | Mailcow API | View spam quarantine |
| `empty-trash` | IMAP | EXPUNGE all Trash messages |

The edge function will:
1. Authenticate the user via JWT
2. Look up their `email_accounts` row to get IMAP/SMTP credentials
3. Connect to Mailcow IMAP/SMTP using Deno-compatible libraries
4. Execute the requested action
5. Return JSON response

**Deno IMAP/SMTP approach**: Use raw TCP sockets via `Deno.connect` with TLS to implement IMAP/SMTP protocol commands, or use a Deno-compatible library like `denomailer` for SMTP. For IMAP, implement a lightweight command parser since full IMAP libraries for Deno are limited.

---

## Step 4 -- Frontend: Page and Routing

### New route: `/email`

Add to `App.tsx` with `RoleProtectedRoute` for `["owner", "employee", "developer"]`.

### New page: `src/pages/Email.tsx`

Master layout with three-panel design:
- Left sidebar (folders)
- Center panel (message list)
- Right panel (message viewer) -- or overlay on mobile

### Navigation

Add "Email" link to `AppMenuBar.tsx` for internal users, with a `Mail` icon from lucide-react and an unread badge.

---

## Step 5 -- Frontend Components

All created under `src/components/email/`:

| Component | Purpose |
|-----------|---------|
| `EmailSidebar.tsx` | Folder list with unread counts, create/rename/delete folder actions |
| `EmailList.tsx` | Paginated message list with sender, subject, snippet, timestamp, read/unread/star/attachment indicators |
| `EmailViewer.tsx` | Full message display with sanitized HTML, attachments, reply/forward/move/delete actions |
| `ComposeEmail.tsx` | Modal dialog with To/CC/BCC fields, subject, rich text body (textarea with basic formatting), drag-and-drop attachments, draft autosave |
| `EmailSearch.tsx` | Search bar with filters (sender, subject, body, date range, folder) |
| `EmailSettings.tsx` | Settings panel for display name, signature, auto-reply, spam sensitivity, aliases, storage usage |
| `EmailNotifications.tsx` | Hook/provider for polling new messages and updating unread counts |

---

## Step 6 -- Key Implementation Details

### Message List
- Fetch 50 messages per page from IMAP via the edge function
- Show sender, subject, body snippet (first 100 chars), date, flags
- Click to open in viewer panel
- Bulk actions: mark read/unread, delete, move

### Email Viewer
- Render HTML body in a sandboxed iframe or with DOMPurify sanitization
- Download attachments via edge function (base64 decode)
- Reply/Reply All/Forward pre-populate compose modal

### Compose
- Rich text via a `contentEditable` div or textarea with markdown
- File attachments encoded as base64 and sent to the edge function
- Autosave drafts every 30 seconds via IMAP APPEND to Drafts

### Search
- IMAP SEARCH commands sent through the edge function
- Client-side filtering for instant results on already-loaded messages

### Notifications
- Poll the edge function every 60 seconds for new message count
- Update unread badge in the navigation bar
- Update browser tab title: `(3) Email - AppName`

### Security
- All credentials stay server-side in the edge function
- HTML email bodies sanitized with DOMPurify before rendering
- Attachment file type validation
- RLS on `email_accounts` table ensures user isolation

---

## Step 7 -- Files to Create/Modify

### New files:
- `src/pages/Email.tsx`
- `src/components/email/EmailSidebar.tsx`
- `src/components/email/EmailList.tsx`
- `src/components/email/EmailViewer.tsx`
- `src/components/email/ComposeEmail.tsx`
- `src/components/email/EmailSearch.tsx`
- `src/components/email/EmailSettings.tsx`
- `src/components/email/useEmailClient.ts` (hook for all edge function calls)
- `supabase/functions/mailcow-email/index.ts`

### Modified files:
- `src/App.tsx` -- add `/email` route
- `src/components/AppMenuBar.tsx` -- add Email nav link with unread badge
- `supabase/config.toml` -- add `[functions.mailcow-email]` with `verify_jwt = false` (manual JWT check in code)

### Database migration:
- Create `email_accounts` table with RLS policies

---

## Technical Notes

- **IMAP in Deno**: Deno supports `Deno.connect` with TLS for raw socket connections. The edge function will implement a minimal IMAP command set (LOGIN, LIST, SELECT, FETCH, SEARCH, STORE, MOVE, APPEND, EXPUNGE, IDLE). This is the most complex part of the implementation.
- **SMTP in Deno**: Use the `denomailer` pattern or raw SMTP commands via `Deno.connect` for sending mail.
- **Mailcow REST API**: Standard `fetch()` calls with the API key in headers for folder/settings management.
- **No Prisma**: All app-side metadata stored in the `email_accounts` table via Supabase client. Email data lives on the Mailcow/IMAP server and is not duplicated.
- **DOMPurify**: Will need to sanitize HTML email content on the client side to prevent XSS.

