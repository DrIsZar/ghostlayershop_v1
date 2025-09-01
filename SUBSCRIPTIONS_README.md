# GhostLayer Shop Dashboard - Subscriptions System

## Overview

The Subscriptions system is a comprehensive, product-agnostic solution for tracking and managing all types of subscriptions in the GhostLayer Shop Dashboard. It supports various renewal strategies, live countdowns, and integrates seamlessly with existing Sales & Expenses.

## Features

### 🎯 **Product-Agnostic Design**
- No hardcoded product rules
- Configurable renewal strategies per service
- Extensible strategy system for future products

### 📅 **Renewal Strategies**
- **MONTHLY**: Standard monthly renewals
- **MONTHLY_MANUAL_DATE**: Netflix-style irregular months with manual date setting
- **EVERY_N_DAYS**: Custom interval cycles (e.g., 14-day Cursor Pro)
- **QUARTERLY_UNTIL_YEAR**: 3-month cycles until reaching 1 year
- **STEP_MONTHS_UNTIL_PERIOD**: Flexible month additions until target period
- **ONE_TIME_YEARLY**: 12-month one-time subscriptions
- **ONE_TIME_FIXED_PERIOD**: Custom period one-time subscriptions

### ⚡ **Live Features**
- Real-time countdown timers (updates every minute)
- Progress bars for current cycles
- Status badges (Active, Due Today, Due Soon, Overdue, etc.)
- Due date buckets (Today, 3 Days, Overdue)

### 🔧 **Management Actions**
- Renew Now (with step month options)
- Set Manual Next Date (for irregular months)
- Pause/Resume subscriptions
- Complete/Cancel subscriptions
- Step month additions (+1M, +3M, +6M)

## Architecture

### Core Types (`src/types/subscription.ts`)

```typescript
interface ServiceConfig {
  id: string;
  name: string;
  sku: string;
  defaultStrategy: RenewalStrategyKey;
  intervalDays?: number;
  stepMonthOptions?: number[];
  periodMonths?: number;
}

interface Subscription {
  id: string;
  serviceId: string;
  clientId: string;
  saleId?: string;
  strategy: RenewalStrategyKey;
  status: SubscriptionStatus;
  // ... timestamps, counters, config
}
```

### Strategy System (`src/lib/subscriptionStrategies.ts`)

```typescript
interface StrategyHandler {
  computeNextRenewal(sub: Subscription): Date | null;
  onRenew?(sub: Subscription, opts?: { stepMonths?: number }): Partial<Subscription>;
}

export const STRATEGIES: Record<RenewalStrategyKey, StrategyHandler>;
```

### Service Layer (`src/lib/subscriptionService.ts`)

```typescript
class SubscriptionService {
  async createFromSale(saleId, serviceId, clientId, configOverrides?)
  async createManual(serviceId, clientId, initialConfig)
  async renewNow(subscriptionId, opts?)
  async setManualNextDate(subscriptionId, isoDateString)
  async pause(subscriptionId), resume(subscriptionId)
  async complete(subscriptionId), cancel(subscriptionId)
}
```

## Usage Examples

### Creating a Netflix-style Subscription

```typescript
// Service config
const netflixConfig: ServiceConfig = {
  id: 'netflix-premium',
  name: 'Netflix Premium',
  defaultStrategy: 'MONTHLY_MANUAL_DATE'
};

// Create subscription
const subscription = await subscriptionService.createFromSale(
  'sale-123',
  'netflix-premium',
  'client-456'
);
```

### Creating a 14-day Cycle Subscription

```typescript
// Service config
const cursorConfig: ServiceConfig = {
  id: 'cursor-pro',
  name: 'Cursor Pro',
  defaultStrategy: 'EVERY_N_DAYS',
  intervalDays: 14
};

// Create subscription
const subscription = await subscriptionService.createFromSale(
  'sale-789',
  'cursor-pro',
  'client-101'
);
```

### Step Month Strategy

```typescript
// Service config
const gamingConfig: ServiceConfig = {
  id: 'gaming-pass',
  name: 'Gaming Pass',
  defaultStrategy: 'STEP_MONTHS_UNTIL_PERIOD',
  periodMonths: 12,
  stepMonthOptions: [1, 3, 6]
};

// Renew with +3 months
await subscriptionService.renewNow('subscription-id', { stepMonths: 3 });
```

## UI Components

### SubscriptionCard
- Displays subscription details with live countdown
- Contextual action buttons based on strategy/status
- Progress bars and status badges
- Manual date picker for irregular months

### SubscriptionModal
- Create subscriptions manually or from sales
- Strategy-specific configuration fields
- Service and client selection
- Validation and error handling

### Subscriptions Page
- KPI dashboard with due buckets
- Filtering by status, service, client
- Search functionality
- Grid layout with subscription cards

## Integration Points

### Sales Integration
- Create subscriptions from existing sales
- Optional sale linking for manual subscriptions
- Sales hooks for automatic renewal tracking

### Service Configuration
- Services define default renewal strategies
- Override strategies per subscription
- Portable configuration snapshots

### Client Management
- Link subscriptions to existing clients
- Client-specific subscription views
- Billing and renewal history

## Extensibility

### Adding New Strategies

1. **Extend the union type:**
```typescript
type RenewalStrategyKey = 
  | 'MONTHLY' 
  | 'CUSTOM_STRATEGY'; // Add new strategy
```

2. **Implement the handler:**
```typescript
export const STRATEGIES: Record<RenewalStrategyKey, StrategyHandler> = {
  // ... existing strategies
  CUSTOM_STRATEGY: {
    computeNextRenewal(sub: Subscription): Date | null {
      // Custom logic
    },
    onRenew(sub: Subscription, opts?): Partial<Subscription> {
      // Custom renewal logic
    }
  }
};
```

3. **Add UI support (if needed):**
```typescript
// Add new action buttons or fields in SubscriptionCard
if (subscription.strategy === 'CUSTOM_STRATEGY') {
  // Custom UI elements
}
```

### Adding New Actions

```typescript
// In SubscriptionCard, add new action buttons
{canCustomAction(subscription) && (
  <button onClick={() => handleCustomAction()}>
    Custom Action
  </button>
)}

// In subscriptionUtils, add helper functions
export const canCustomAction = (sub: Subscription): boolean => {
  return sub.status === 'active' && sub.strategy === 'CUSTOM_STRATEGY';
};
```

## Performance Considerations

### Live Updates
- Countdown timers update every minute (not real-time)
- Progress bars use efficient calculations
- Optimistic UI updates for actions

### Data Loading
- Pagination support for large subscription lists
- Efficient filtering and search
- Cached due bucket calculations

### Memory Management
- Cleanup intervals on component unmount
- Efficient re-renders with React.memo patterns
- Optimized state updates

## Future Enhancements

### Planned Features
- **Bulk Operations**: Renew multiple subscriptions
- **Automated Renewals**: Scheduled renewal processing
- **Advanced Analytics**: Renewal patterns, churn analysis
- **Integration APIs**: Webhook support for external systems
- **Mobile App**: Native mobile subscription management

### Technical Improvements
- **Real-time Updates**: WebSocket integration for live data
- **Offline Support**: Service worker for offline management
- **Advanced Caching**: Redis integration for performance
- **Audit Logging**: Comprehensive event tracking

## Testing

### Mock Data
The system includes comprehensive mock data for testing:
- Sample subscriptions with all strategies
- Mock services and clients
- Test events and timelines

### Test Scenarios
- Strategy-specific renewal logic
- Date calculations and countdowns
- Status transitions and validations
- UI interactions and responsiveness

## Deployment

### Environment Variables
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Database Schema
The system is designed to work with any persistence layer through adapters. For Supabase:

```sql
-- Subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  sale_id TEXT,
  strategy TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  -- ... additional fields
);

-- Subscription events table
CREATE TABLE subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id),
  type TEXT NOT NULL,
  at TIMESTAMP WITH TIME ZONE NOT NULL,
  meta JSONB
);
```

## Support

For questions or issues with the Subscriptions system:

1. Check the console for error messages
2. Verify service and client configurations
3. Review strategy handler implementations
4. Check mock data for testing scenarios

The system is designed to be self-documenting with clear error messages and validation feedback.
