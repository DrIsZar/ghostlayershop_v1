import { Subscription, SubscriptionEvent, RenewalStrategyKey, ServiceConfig } from '../types/subscription';
import { STRATEGIES, onRenewWithPoolAwareness, computeNextRenewalWithPoolAwareness, computeNextRenewalWithoutCustomWithPoolAwareness } from './subscriptionStrategies';
import { supabase } from './supabase';
import { SupabaseSubscriptionPersistenceAdapter, SubscriptionPersistenceAdapter } from './supabaseSubscriptionAdapter';
import { getNowISOInTunisia } from './dateUtils';

export interface SalesIntegrationHook {
  onSubscriptionRenewed(subscription: Subscription): Promise<void>;
}

export class SubscriptionService {
  constructor(
    private persistenceAdapter: SubscriptionPersistenceAdapter,
    private salesIntegration?: SalesIntegrationHook
  ) {}

  private async getServiceConfig(serviceId: string): Promise<ServiceConfig | null> {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('id, product_service, logo_url, duration')
        .eq('id', serviceId)
        .single();

      if (error || !data) {
        return null;
      }

      // Parse duration text (e.g., "1 month", "3 months") to days
      let intervalDays: number | undefined;
      let serviceDurationDays: number | undefined;
      
      if (data.duration) {
        const durationMatch = data.duration.match(/(\d+)\s*month/);
        if (durationMatch) {
          const months = parseInt(durationMatch[1]);
          serviceDurationDays = months * 30;
          intervalDays = months * 30;
        }
      }

      return {
        id: data.id,
        name: data.product_service,
        sku: data.id,
        logoUrl: data.logo_url,
        intervalDays,
        serviceDurationDays
      };
    } catch (error) {
      console.error('Error fetching service config:', error);
      return null;
    }
  }

  async createFromSale(
    saleId: string, 
    serviceId: string, 
    clientId: string, 
    configOverrides?: Partial<Pick<Subscription, 'strategy' | 'intervalDays' | 'startedAt' | 'notes' | 'targetEndAt'>>
  ): Promise<Subscription> {
    const serviceConfig = await this.getServiceConfig(serviceId);
    if (!serviceConfig) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    const startDate = configOverrides?.startedAt || getNowISOInTunisia();
    const strategy = configOverrides?.strategy || 'MONTHLY';
    const strategyHandler = STRATEGIES[strategy];

    if (!strategyHandler) {
      throw new Error(`Invalid strategy: ${strategy}`);
    }

    // Compute initial dates
    let nextRenewalAt: string | undefined;
    let targetEndAt: string | undefined;

    if (strategyHandler.computeNextRenewal) {
      const tempSub: Subscription = {
        id: '',
        serviceId,
        clientId,
        saleId,
        startedAt: startDate,
        currentCycleStartAt: startDate,
        strategy,
        intervalDays: configOverrides?.intervalDays || serviceConfig.intervalDays,
        status: 'active',
        notes: configOverrides?.notes,
        createdAt: startDate,
        updatedAt: startDate
      };

      // Use pool-aware logic if the subscription will be linked to a pool
      // For now, we'll use the standard logic since we don't have pool info at creation time
      const nextRenewal = strategyHandler.computeNextRenewal(tempSub);
      if (nextRenewal) {
        nextRenewalAt = nextRenewal.toISOString();
      }
    }

    // Set target end date based on service duration or provided override
    if (configOverrides?.targetEndAt) {
      targetEndAt = configOverrides.targetEndAt;
    } else if (serviceConfig.serviceDurationDays) {
      const startDateObj = new Date(startDate);
      const endDate = new Date(startDateObj.getTime() + (serviceConfig.serviceDurationDays * 24 * 60 * 60 * 1000));
      targetEndAt = endDate.toISOString();
    }

    const subscriptionData = {
      serviceId,
      clientId,
      saleId,
      startedAt: startDate,
      currentCycleStartAt: startDate,
      strategy,
      intervalDays: configOverrides?.intervalDays || serviceConfig.intervalDays,
      status: 'active' as const,
      notes: configOverrides?.notes,
      nextRenewalAt,
      targetEndAt
    };

    const subscription = await this.persistenceAdapter.createSubscription(subscriptionData);

    // Create event
    await this.persistenceAdapter.createSubscriptionEvent({
      subscriptionId: subscription.id,
      type: 'created',
      at: startDate,
      meta: { saleId, strategy }
    });

    return subscription;
  }

  async createManual(
    serviceId: string, 
    clientId: string, 
    initialConfig: Pick<Subscription, 'strategy' | 'intervalDays' | 'startedAt' | 'notes' | 'targetEndAt'>
  ): Promise<Subscription> {
    return this.createFromSale('', serviceId, clientId, initialConfig);
  }

  async renewNow(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.persistenceAdapter.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    if (subscription.status !== 'active' && subscription.status !== 'overdue') {
      throw new Error(`Cannot renew subscription with status: ${subscription.status}. Only active or overdue subscriptions can be renewed.`);
    }

    // Use pool-aware renewal logic
    const updates = await onRenewWithPoolAwareness(subscription);
    const now = new Date().toISOString();

    // Calculate renewal details for history
    const previousRenewalAt = subscription.lastRenewalAt;
    const renewalNumber = (subscription.iterationsDone || 0) + 1;
    const renewalDate = new Date(now);
    const nextRenewalDate = updates.nextRenewalAt ? new Date(updates.nextRenewalAt) : null;

    const updatedSubscription = await this.persistenceAdapter.updateSubscription(subscriptionId, {
      ...updates,
      status: 'active', // Reset status to active when renewing (especially important for overdue subscriptions)
      updatedAt: now
    });

    // Create detailed renewal event
    await this.persistenceAdapter.createSubscriptionEvent({
      subscriptionId: subscriptionId,
      type: 'renewed',
      at: now,
      meta: { 
        strategy: subscription.strategy, 
        previousRenewalAt: previousRenewalAt,
        renewalNumber: renewalNumber,
        renewalDate: renewalDate.toISOString(),
        nextRenewalDate: nextRenewalDate?.toISOString(),
        intervalDays: subscription.intervalDays,
        cycleStartDate: updates.currentCycleStartAt,
        cycleEndDate: updates.nextRenewalAt,
        poolAware: true // Flag to indicate pool-aware logic was used
      }
    });

    // Call sales integration hook if available
    if (this.salesIntegration) {
      try {
        await this.salesIntegration.onSubscriptionRenewed(updatedSubscription);
      } catch (error) {
        console.error('Error calling sales integration hook:', error);
      }
    }

    return updatedSubscription;
  }

  async setCustomRenewalDate(subscriptionId: string, customDate: string): Promise<Subscription> {
    const subscription = await this.persistenceAdapter.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    if (subscription.status !== 'active') {
      throw new Error(`Cannot set custom date for subscription with status: ${subscription.status}`);
    }

    const now = new Date().toISOString();
    const updatedSubscription = await this.persistenceAdapter.updateSubscription(subscriptionId, {
      customNextRenewalAt: customDate,
      nextRenewalAt: customDate,
      updatedAt: now
    });

    await this.persistenceAdapter.createSubscriptionEvent({
      subscriptionId: subscriptionId,
      type: 'custom_date_set',
      at: now,
      meta: { customDate, previousNextRenewalAt: subscription.nextRenewalAt }
    });

    return updatedSubscription;
  }

  async clearCustomRenewalDate(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.persistenceAdapter.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    if (subscription.status !== 'active') {
      throw new Error(`Cannot clear custom date for subscription with status: ${subscription.status}`);
    }

    let nextRenewalAt: string | undefined = undefined;
    
    try {
      // Use pool-aware logic to calculate next renewal
      const nextRenewal = await computeNextRenewalWithoutCustomWithPoolAwareness(subscription);
      nextRenewalAt = nextRenewal ? nextRenewal.toISOString() : undefined;
    } catch (error) {
      console.error('Error calculating next renewal date:', error);
    }

    const now = new Date().toISOString();
    const updatedSubscription = await this.persistenceAdapter.updateSubscription(subscriptionId, {
      customNextRenewalAt: undefined,
      nextRenewalAt: nextRenewalAt,
      updatedAt: now
    });

    await this.persistenceAdapter.createSubscriptionEvent({
      subscriptionId: subscriptionId,
      type: 'custom_date_cleared',
      at: now,
      meta: { 
        previousCustomDate: subscription.customNextRenewalAt,
        newNextRenewalAt: nextRenewalAt,
        strategy: subscription.strategy,
        poolAware: true // Flag to indicate pool-aware logic was used
      }
    });

    return updatedSubscription;
  }



  async complete(subscriptionId: string): Promise<Subscription> {
    const now = new Date().toISOString();
    const updatedSubscription = await this.persistenceAdapter.updateSubscription(subscriptionId, {
      status: 'completed',
      nextRenewalAt: undefined,
      updatedAt: now
    });

    await this.persistenceAdapter.createSubscriptionEvent({
      subscriptionId: subscriptionId,
      type: 'completed',
      at: now
    });

    return updatedSubscription;
  }

  async archive(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.persistenceAdapter.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    if (subscription.status === 'archived') {
      throw new Error(`Subscription is already archived`);
    }

    const now = new Date().toISOString();
    const previousStatus = subscription.status;
    
    const updatedSubscription = await this.persistenceAdapter.updateSubscription(subscriptionId, {
      status: 'archived',
      nextRenewalAt: undefined,
      updatedAt: now
    });

    await this.persistenceAdapter.createSubscriptionEvent({
      subscriptionId: subscriptionId,
      type: 'archived',
      at: now,
      meta: { 
        previousStatus: previousStatus,
        archivedAt: now
      }
    });

    return updatedSubscription;
  }



  async revert(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.persistenceAdapter.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    if (subscription.status === 'active') {
      throw new Error(`Subscription is already active and cannot be reverted`);
    }

    let nextRenewalAt: string | undefined = undefined;
    
    try {
      // Use pool-aware logic to calculate next renewal
      const nextRenewal = await computeNextRenewalWithoutCustomWithPoolAwareness(subscription);
      nextRenewalAt = nextRenewal ? nextRenewal.toISOString() : undefined;
    } catch (error) {
      console.error('Error calculating next renewal date:', error);
    }

    const now = new Date().toISOString();
    const previousStatus = subscription.status;
    
    const updatedSubscription = await this.persistenceAdapter.updateSubscription(subscriptionId, {
      status: 'active',
      nextRenewalAt: nextRenewalAt,
      updatedAt: now
    });

    await this.persistenceAdapter.createSubscriptionEvent({
      subscriptionId: subscriptionId,
      type: 'reverted',
      at: now,
      meta: { 
        previousStatus: previousStatus,
        newNextRenewalAt: nextRenewalAt,
        strategy: subscription.strategy,
        poolAware: true // Flag to indicate pool-aware logic was used
      }
    });

    return updatedSubscription;
  }

  async markOverdue(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.persistenceAdapter.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    if (subscription.status === 'overdue') {
      throw new Error(`Subscription is already marked as overdue`);
    }

    if (subscription.status !== 'active') {
      throw new Error(`Cannot mark subscription as overdue. Only active subscriptions can be manually marked as overdue. Current status: ${subscription.status}`);
    }

    const now = new Date().toISOString();
    const previousStatus = subscription.status;
    
    const updatedSubscription = await this.persistenceAdapter.updateSubscription(subscriptionId, {
      status: 'overdue',
      updatedAt: now
    });

    await this.persistenceAdapter.createSubscriptionEvent({
      subscriptionId: subscriptionId,
      type: 'overdue',
      at: now,
      meta: { 
        previousStatus: previousStatus,
        manuallyMarked: true // Flag to indicate this was manually marked as overdue
      }
    });

    return updatedSubscription;
  }

  async updateSubscription(subscriptionId: string, updates: Partial<Subscription>): Promise<Subscription> {
    const now = new Date().toISOString();
    const updatedSubscription = await this.persistenceAdapter.updateSubscription(subscriptionId, {
      ...updates,
      updatedAt: now
    });
    
    await this.persistenceAdapter.createSubscriptionEvent({
      subscriptionId: subscriptionId,
      type: 'updated',
      at: now,
      meta: { updates }
    });
    
    return updatedSubscription;
  }

  async delete(subscriptionId: string): Promise<void> {
    await this.persistenceAdapter.deleteSubscription(subscriptionId);
  }

  async listSubscriptions(): Promise<Subscription[]> {
    return await this.persistenceAdapter.listSubscriptions();
  }

  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    return await this.persistenceAdapter.getSubscription(subscriptionId);
  }

  async getDueBuckets(): Promise<{ dueToday: number; dueIn3Days: number; overdue: number }> {
    const subscriptions = await this.persistenceAdapter.listSubscriptions();
    const now = new Date();
    
    let dueToday = 0;
    let dueIn3Days = 0;
    let overdue = 0;

    subscriptions.forEach(sub => {
      if (sub.status !== 'active' || !sub.nextRenewalAt) return;

      const renewalDate = new Date(sub.nextRenewalAt);
      const diffTime = renewalDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        dueToday++;
      } else if (diffDays > 0 && diffDays <= 3) {
        dueIn3Days++;
      } else if (diffDays < 0) {
        overdue++;
      }
    });

    return { dueToday, dueIn3Days, overdue };
  }

  async getRenewalHistory(subscriptionId: string): Promise<SubscriptionEvent[]> {
    const events = await this.persistenceAdapter.getSubscriptionEvents(subscriptionId);
    return events.filter((event: SubscriptionEvent) => event.type === 'renewed').sort((a: SubscriptionEvent, b: SubscriptionEvent) => 
      new Date(b.at).getTime() - new Date(a.at).getTime()
    );
  }

  async getSubscriptionHistory(subscriptionId: string): Promise<SubscriptionEvent[]> {
    const events = await this.persistenceAdapter.getSubscriptionEvents(subscriptionId);
    return events.sort((a: SubscriptionEvent, b: SubscriptionEvent) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }

  // Method to recalculate renewal date when subscription is linked to a pool
  async recalculateRenewalDateForPool(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.persistenceAdapter.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    if (subscription.status !== 'active') {
      throw new Error(`Cannot recalculate renewal date for subscription with status: ${subscription.status}`);
    }

    let nextRenewalAt: string | undefined = undefined;
    
    try {
      // Use pool-aware logic to calculate next renewal
      const nextRenewal = await computeNextRenewalWithPoolAwareness(subscription);
      nextRenewalAt = nextRenewal ? nextRenewal.toISOString() : undefined;
    } catch (error) {
      console.error('Error calculating next renewal date:', error);
    }

    const now = new Date().toISOString();
    const updatedSubscription = await this.persistenceAdapter.updateSubscription(subscriptionId, {
      nextRenewalAt: nextRenewalAt,
      updatedAt: now
    });

    await this.persistenceAdapter.createSubscriptionEvent({
      subscriptionId: subscriptionId,
      type: 'renewal_recalculated',
      at: now,
      meta: { 
        previousNextRenewalAt: subscription.nextRenewalAt,
        newNextRenewalAt: nextRenewalAt,
        strategy: subscription.strategy,
        poolAware: !!subscription.resourcePoolId,
        reason: subscription.resourcePoolId ? 'pool_linked' : 'pool_unlinked'
      }
    });

    return updatedSubscription;
  }

  // Method to automatically complete expired subscriptions
  async refreshSubscriptionStatus(): Promise<{ completedCount: number; overdueCount: number }> {
    try {
      // Call the database function to refresh subscription statuses
      const { data, error } = await supabase.rpc('refresh_subscription_status');
      
      if (error) {
        console.error('Error refreshing subscription status:', error);
        throw new Error(`Failed to refresh subscription status: ${error.message}`);
      }

      const result = data?.[0] || { completed_count: 0, overdue_count: 0 };
      
      console.log(`✅ Refreshed subscription status: ${result.completed_count} completed, ${result.overdue_count} overdue`);
      
      return {
        completedCount: result.completed_count || 0,
        overdueCount: result.overdue_count || 0
      };
    } catch (error) {
      console.error('Error refreshing subscription status:', error);
      throw error;
    }
  }

  // Method to check if a subscription should be automatically completed
  shouldAutoComplete(subscription: Subscription): boolean {
    if (subscription.status !== 'active') {
      return false;
    }
    
    if (!subscription.targetEndAt) {
      return false;
    }
    
    const now = new Date();
    const targetEnd = new Date(subscription.targetEndAt);
    
    return now >= targetEnd;
  }
}

// Export a default instance
export const subscriptionService = new SubscriptionService(new SupabaseSubscriptionPersistenceAdapter());
