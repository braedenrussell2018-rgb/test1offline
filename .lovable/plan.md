

# Data Cleanup: Inventory and Employee Dashboard

This plan will delete data from specific tables while leaving the CRM (people, companies, branches) completely untouched.

## Data to be Deleted

### Inventory Management
| Table | Records | Notes |
|-------|---------|-------|
| items | 2,572 | All inventory items |
| quotes | 4 | All quotes |
| invoices | 5 | All invoices |

### Employee Dashboard
| Table | Records | Notes |
|-------|---------|-------|
| ai_conversations | 3 | Past conversation recordings |
| internal_notes | 0 | Already empty |
| video_meetings | 6 | All past meetings |
| video_meeting_participants | 9 | Meeting participant records |
| meeting_chat_messages | 1 | Chat history from meetings |

## Data NOT Touched (CRM)
- people
- companies
- branches
- All other tables (expenses, purchase_orders, vendors, accounts, spiff_program, etc.)

## Deletion Order

Due to foreign key relationships, deletions must happen in this order:

1. **meeting_chat_messages** (references video_meetings)
2. **video_meeting_participants** (references video_meetings)
3. **video_meetings**
4. **ai_conversations**
5. **items** (clear sold_in_invoice_id references first, then delete)
6. **quotes**
7. **invoices**

## Technical Details

All deletions will be executed using the Supabase data operations tool with `DELETE` statements. No schema changes are needed -- only data is being removed.

```text
DELETE FROM meeting_chat_messages;
DELETE FROM video_meeting_participants;
DELETE FROM video_meetings;
DELETE FROM ai_conversations;
UPDATE items SET sold_in_invoice_id = NULL;
DELETE FROM items;
DELETE FROM quotes;
DELETE FROM invoices;
```

