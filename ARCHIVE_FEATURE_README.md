# Subscription Archive Feature

## Overview

The subscription archive feature allows users to archive subscriptions instead of deleting them. Archived subscriptions are hidden from normal views but can be restored later, preserving all subscription history and data.

## Features

### Archive Functionality
- **Archive Subscriptions**: Change subscription status to "archived" to hide them from active views
- **Unarchive Subscriptions**: Restore archived subscriptions back to their previous status
- **Preserve History**: All subscription events and data are preserved when archiving
- **Event Tracking**: Archive/unarchive actions are logged in the subscription event history

### UI Updates

#### Subscriptions Page
- Added "Archived" filter option in the view dropdown
- Added archived count to the status summary section
- Updated grouped view to show archived count in status chips
- Archived subscriptions are filtered out of due/overdue calculations

#### Subscription Detail Modal
- Added "Archive" button for active subscriptions
- Added "Unarchive" button for archived subscriptions
- Archive events are displayed in the event history with metadata
- Visual styling distinguishes archived subscriptions

#### Subscription Cards
- Archived subscriptions have distinct visual styling (gray theme)
- Added "Archived" badge to archived subscription cards
- Archived subscriptions maintain all existing functionality for viewing details

### Database Changes

#### Schema Updates
- Added 'archived' to the subscription status enum
- Added 'archived' and 'reverted' to subscription event types
- Created migration file: `supabase/migrations/20241201000000_add_archived_status.sql`

#### Data Preservation
- Archived subscriptions retain all original data
- Event history includes archive/unarchive events
- Previous status is stored in event metadata

## Usage

### Archiving a Subscription
1. Navigate to the Subscriptions page
2. Click on a subscription card to open details
3. Click the "Archive" button in the Quick Actions section
4. Confirm the action in the dialog
5. The subscription status will change to "archived"

### Viewing Archived Subscriptions
1. On the Subscriptions page, select "Archived" from the View dropdown
2. Archived subscriptions will be displayed with gray styling
3. Click on any archived subscription to view details

### Unarchiving a Subscription
1. Open an archived subscription's details
2. Click the "Unarchive" button in the Quick Actions section
3. The subscription will be restored to its previous status

### Filtering and Grouping
- Use the "Archived" view filter to see only archived subscriptions
- Grouped views show archived count alongside other status counts
- Archived subscriptions are excluded from due/overdue calculations

## Technical Implementation

### Service Layer
- `SubscriptionService.archive()`: Archives a subscription
- `SubscriptionService.revert()`: Can restore archived subscriptions
- Event logging for archive/unarchive actions

### Type System
- Updated `SubscriptionStatus` to include 'archived'
- Updated `SubscriptionEventType` to include 'archived'
- Added proper TypeScript types throughout

### UI Components
- Updated all subscription-related components to handle archived status
- Added archive-specific styling and badges
- Enhanced event history display for archive events

## Benefits

1. **Data Preservation**: No data loss when archiving subscriptions
2. **Audit Trail**: Complete history of archive/unarchive actions
3. **Flexibility**: Easy to restore archived subscriptions
4. **Clean Interface**: Archived subscriptions don't clutter active views
5. **Compliance**: Maintains records for business/legal requirements

## Migration

To apply the database changes:

1. Run the migration: `supabase/migrations/20241201000000_add_archived_status.sql`
2. The application will automatically handle the new status types
3. Existing subscriptions remain unaffected

## Future Enhancements

Potential improvements for the archive feature:
- Bulk archive/unarchive operations
- Archive retention policies
- Archive export functionality
- Archive search and filtering
- Archive analytics and reporting
