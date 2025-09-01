# Clients Page Issues Analysis and Fix Plan

## Issues Identified:

1. **Total Spent Always Shows 0**
   - The `clientsDb.getStatistics()` function queries a `client_statistics` table that doesn't exist in the database schema
   - The database only has `clients`, `services`, and `transactions` tables
   - Need to calculate statistics from actual transaction data

2. **Edit Modal Doesn't Show Current Client Information**
   - The ClientModal component has a bug in the `useState` initialization
   - `initialData` is not being properly set when the modal opens for editing
   - The form state needs to be reset when `initialData` changes

3. **Missing Database Views/Functions**
   - No `client_statistics` table or view exists
   - No proper relationship between clients and transactions for statistics calculation

## Fix Plan:

### Phase 1: Fix Client Statistics Calculation
1. Update `src/lib/clients.ts` to calculate statistics from actual transaction data
2. Remove dependency on non-existent `client_statistics` table
3. Create proper queries to calculate:
   - Total spent (sum of selling_price from transactions)
   - Services bought (unique services from transactions)
   - Total purchases count

### Phase 2: Fix Edit Modal Issues
1. Update `src/components/ClientModal.tsx` to properly handle `initialData` changes
2. Add `useEffect` to reset form data when `initialData` changes
3. Ensure form is properly populated when editing existing clients

### Phase 3: Enhance the Clients Page
1. Add loading states for individual client statistics
2. Add error handling for failed statistics calculations
3. Improve the UI with better visual feedback
4. Add search/filter functionality
5. Add sorting capabilities
6. Add client details view/modal
7. Improve responsive design

### Phase 4: Database Schema Improvements
1. Ensure proper foreign key relationships
2. Add indexes for better performance
3. Consider creating a view for client statistics

## Implementation Order:
1. Fix statistics calculation in clients.ts
2. Fix modal initialization in ClientModal.tsx
3. Update Clients.tsx with improved error handling and loading states
4. Add enhancements like search, sorting, and better UI
