import { Subscription, SubscriptionEvent } from '../types/subscription';

// Mock subscriptions for testing
export const mockSubscriptions: Subscription[] = [
  {
    id: '1',
    serviceId: 'placeholder-service-1', // Will be replaced with actual service ID
    clientId: 'john-doe',
    saleId: 'sale-1',
    startedAt: '2024-01-15T00:00:00Z',
    currentCycleStartAt: '2024-01-15T00:00:00Z',
    lastRenewalAt: '2024-01-15T00:00:00Z',
    nextRenewalAt: '2024-02-15T00:00:00Z',
    strategy: 'MONTHLY_MANUAL_DATE',
    status: 'active',
    notes: 'Netflix Premium subscription for John',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z'
  },
  {
    id: '2',
    serviceId: 'placeholder-service-2', // Will be replaced with actual service ID
    clientId: 'jane-smith',
    saleId: 'sale-2',
    startedAt: '2024-01-01T00:00:00Z',
    currentCycleStartAt: '2024-01-01T00:00:00Z',
    lastRenewalAt: '2024-01-01T00:00:00Z',
    nextRenewalAt: '2024-02-01T00:00:00Z',
    strategy: 'MONTHLY',
    status: 'active',
    notes: 'Spotify Family plan',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '3',
    serviceId: 'placeholder-service-3', // Will be replaced with actual service ID
    clientId: 'bob-wilson',
    saleId: 'sale-3',
    startedAt: '2024-01-10T00:00:00Z',
    currentCycleStartAt: '2024-01-10T00:00:00Z',
    lastRenewalAt: '2024-01-10T00:00:00Z',
    nextRenewalAt: '2024-01-24T00:00:00Z',
    strategy: 'EVERY_N_DAYS',
    intervalDays: 14,
    status: 'active',
    notes: 'Cursor Pro 14-day cycle',
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: '2024-01-10T00:00:00Z'

];

// Mock services for display (fallback)
export const mockServices = {
  'placeholder-service-1': { name: 'Service 1', logoUrl: '' },
  'placeholder-service-2': { name: 'Service 2', logoUrl: '' },
  'placeholder-service-3': { name: 'Service 3', logoUrl: '' }
};

// Mock clients for display (fallback)
export const mockClients = {
  'john-doe': { name: 'John Doe', email: 'john@example.com' },
  'jane-smith': { name: 'Jane Smith', email: 'jane@example.com' },
  'bob-wilson': { name: 'Bob Wilson', email: 'bob@example.com' },
  'alice-brown': { name: 'Alice Brown', email: 'alice@example.com' },
  'mike-davis': { name: 'Mike Davis', email: 'mike@example.com' },
  'sarah-jones': { name: 'Sarah Jones', email: 'sarah@example.com' },
  'tom-garcia': { name: 'Tom Garcia', email: 'tom@example.com' },
  'lisa-chen': { name: 'Lisa Chen', email: 'lisa@example.com' }
};

// Mock events for timeline
export const mockEvents: SubscriptionEvent[] = [
  {
    id: '1',
    subscriptionId: '1',
    type: 'created',
    at: '2024-01-15T00:00:00Z',
    meta: { saleId: 'sale-1', strategy: 'MONTHLY_MANUAL_DATE' },
    createdAt: '2024-01-15T00:00:00Z'
  },
  {
    id: '2',
    subscriptionId: '1',
    type: 'renewed',
    at: '2024-01-15T00:00:00Z',
    meta: { stepMonths: undefined },
    createdAt: '2024-01-15T00:00:00Z'
  }
];
