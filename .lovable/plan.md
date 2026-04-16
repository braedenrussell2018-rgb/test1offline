

## Cross-Cutting Page Improvements Plan

### Scope
Apply 6 improvements consistently across all pages that are currently missing them. Reference implementation: `Index.tsx` and `CRM.tsx` (already have most patterns).

### Pages Needing Work

| Page | Lines | Missing Patterns |
|------|-------|-----------------|
| Accounting.tsx | 760 | useAsyncData, ErrorBoundary, skeletons, search, pagination, ProtectedRoute |
| Expenses.tsx | 242 | useAsyncData, ErrorBoundary, skeletons, debounced search, pagination |
| Quotes.tsx | 257 | useAsyncData, ErrorBoundary, skeletons, search, pagination, ProtectedRoute |
| SoldItems.tsx | 151 | useAsyncData, ErrorBoundary, skeletons |
| SpiffProgram.tsx | 567 | useAsyncData, ErrorBoundary, skeletons, pagination |
| EmployeeDashboard.tsx | 1044 | ErrorBoundary, skeletons, refactor into sub-components |
| MapView.tsx | 294 | useAsyncData, ErrorBoundary, skeletons |

### 1. Standardize useAsyncData, ErrorBoundary, and Loading Skeletons
- Wrap each page's content in `<ErrorBoundary>` (like Index.tsx)
- Replace raw `useState` + `useEffect` data fetching with `useAsyncData` hook (provides retry, caching, loading/error states)
- Add `CardSkeleton` / `StatsCardSkeleton` loading states while data loads
- Add error states with retry buttons when data fails to load

### 2. Add useDebouncedSearch to All List Pages
- **Accounting.tsx**: Add search bar to filter invoices, quotes, POs, and expenses by number/name/amount
- **Quotes.tsx**: Add search bar to filter by quote number, customer, status
- **SpiffProgram.tsx**: Add search for sale descriptions, serial numbers
- **Expenses.tsx**: Replace raw `searchQuery` state with `useDebouncedSearch` hook for consistent debouncing

### 3. Add Empty State Components
- Create a reusable `EmptyState` component (icon, title, description, optional action button)
- Add contextual empty states to every list: Accounting sections, Expenses, Quotes, Sold Items, Spiff entries
- Use relevant icons per context (e.g., Receipt for expenses, FileText for quotes)

### 4. Refactor Large Page Files into Sub-Components
- **EmployeeDashboard.tsx (1044 lines)**: Extract into:
  - `NotesTab.tsx` — internal notes CRUD with pinning
  - `ConversationsTab.tsx` — AI conversation history and playback
  - `MeetingsTab.tsx` — video meetings list, recording player, lobby
  - `CalendarTab.tsx` — weekly calendar integration
- **Accounting.tsx (760 lines)**: Extract into:
  - `AccountingStats.tsx` — summary cards at the top
  - `InvoicesSection.tsx` — paid/unpaid invoice collapsibles
  - `QuotesSection.tsx` — pending/approved quote collapsibles
  - `PurchaseOrdersSection.tsx` — vendor PO groups
  - `ExpenseSummarySection.tsx` — expense breakdown

### 5. Add usePagination to List Pages
- **Accounting.tsx**: Paginate invoices, quotes, POs (reuse `PaginationControls` component from inventory)
- **Expenses.tsx**: Paginate expense list per employee group
- **Quotes.tsx**: Paginate quote list
- **SpiffProgram.tsx**: Paginate spiff entries table

### 9. Add ProtectedRoute / RoleProtectedRoute Wrappers Consistently
- **Accounting.tsx**: Wrap in `ProtectedRoute` (authenticated users only)
- **Quotes.tsx**: Wrap in `ProtectedRoute`
- **MapView.tsx**: Wrap in `ProtectedRoute`
- Verify all other pages already have proper route protection in `App.tsx` routing config

### Files Created
- `src/components/EmptyState.tsx` — reusable empty state component
- `src/components/employee-dashboard/NotesTab.tsx`
- `src/components/employee-dashboard/ConversationsTab.tsx`
- `src/components/employee-dashboard/MeetingsTab.tsx`
- `src/components/employee-dashboard/CalendarTab.tsx`
- `src/components/accounting/AccountingStats.tsx`
- `src/components/accounting/InvoicesSection.tsx`
- `src/components/accounting/QuotesSection.tsx`
- `src/components/accounting/PurchaseOrdersSection.tsx`
- `src/components/accounting/ExpenseSummarySection.tsx`

### Files Modified
- `src/pages/Accounting.tsx` — useAsyncData, ErrorBoundary, skeletons, search, pagination, ProtectedRoute, extract sub-components
- `src/pages/Expenses.tsx` — useAsyncData, ErrorBoundary, skeletons, debounced search, pagination, empty states
- `src/pages/Quotes.tsx` — useAsyncData, ErrorBoundary, skeletons, search, pagination, ProtectedRoute, empty states
- `src/pages/SoldItems.tsx` — useAsyncData, ErrorBoundary, skeletons, empty states
- `src/pages/SpiffProgram.tsx` — useAsyncData, ErrorBoundary, skeletons, pagination, empty states
- `src/pages/EmployeeDashboard.tsx` — ErrorBoundary, skeletons, extract sub-components
- `src/pages/MapView.tsx` — useAsyncData, ErrorBoundary, skeletons, ProtectedRoute

### Implementation Order
1. Create `EmptyState` component
2. Refactor EmployeeDashboard into sub-components (largest file first)
3. Refactor Accounting into sub-components
4. Standardize Accounting (useAsyncData, ErrorBoundary, search, pagination, ProtectedRoute)
5. Standardize Expenses (useAsyncData, ErrorBoundary, debounced search, pagination)
6. Standardize Quotes (useAsyncData, ErrorBoundary, search, pagination, ProtectedRoute)
7. Standardize SoldItems, SpiffProgram, MapView (useAsyncData, ErrorBoundary, ProtectedRoute)
8. Add empty states to all list views

