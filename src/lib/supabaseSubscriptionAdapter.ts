import { Subscription, SubscriptionEvent, RenewalStrategyKey } from '../types/subscription';
import { supabase } from './supabase';

export interface SubscriptionPersistenceAdapter {
  createSubscription(subscription: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<Subscription>;
  getSubscription(id: string): Promise<Subscription | null>;
  updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription>;
  listSubscriptions(): Promise<Subscription[]>;
  createSubscriptionEvent(event: Omit<SubscriptionEvent, 'id' | 'createdAt'>): Promise<SubscriptionEvent>;
  getSubscriptionEvents(subscriptionId: string): Promise<SubscriptionEvent[]>;
  deleteSubscription(id: string): Promise<void>;
}

export class SupabaseSubscriptionPersistenceAdapter implements SubscriptionPersistenceAdapter {
  async createSubscription(subscription: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<Subscription> {
    console.log('Supabase adapter: Creating subscription with data:', subscription);
    
    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        service_id: subscription.serviceId,
        client_id: subscription.clientId,
        transaction_id: subscription.saleId || null,
        started_at: subscription.startedAt,
        current_cycle_start_at: subscription.currentCycleStartAt,
        last_renewal_at: subscription.lastRenewalAt,
        next_renewal_at: subscription.nextRenewalAt,
        custom_next_renewal_at: subscription.customNextRenewalAt,
        target_end_at: subscription.targetEndAt,
        interval_days: subscription.intervalDays,
        notes: subscription.notes,
        iterations_done: subscription.iterationsDone || 0,
        strategy: subscription.strategy,
        status: subscription.status,
        is_auto_renew: subscription.isAutoRenew
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase adapter: Error creating subscription:', error);
      throw new Error(`Failed to create subscription: ${error.message}`);
    }

    console.log('Supabase adapter: Successfully created subscription:', data);

    // Map database fields back to our Subscription interface
    const createdSubscription: Subscription = {
      id: data.id,
      serviceId: data.service_id,
      clientId: data.client_id,
      saleId: data.transaction_id,
      startedAt: data.started_at,
      currentCycleStartAt: data.current_cycle_start_at,
      lastRenewalAt: data.last_renewal_at,
      nextRenewalAt: data.next_renewal_at,
      customNextRenewalAt: data.custom_next_renewal_at,
      targetEndAt: data.target_end_at,
      intervalDays: data.interval_days,
      notes: data.notes,
      iterationsDone: data.iterations_done,
      strategy: data.strategy as RenewalStrategyKey,
      status: data.status as any,
      isAutoRenew: data.is_auto_renew,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };

    return createdSubscription;
  }

  async getSubscription(id: string): Promise<Subscription | null> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    // Map database fields to our Subscription interface
    const subscription: Subscription = {
      id: data.id,
      serviceId: data.service_id,
      clientId: data.client_id,
      saleId: data.transaction_id,
      startedAt: data.started_at,
      currentCycleStartAt: data.current_cycle_start_at,
      lastRenewalAt: data.last_renewal_at,
      nextRenewalAt: data.next_renewal_at,
      customNextRenewalAt: data.custom_next_renewal_at,
      targetEndAt: data.target_end_at,
      intervalDays: data.interval_days,
      notes: data.notes,
      iterationsDone: data.iterations_done,
      strategy: data.strategy as RenewalStrategyKey,
      status: data.status as any,
      isAutoRenew: data.is_auto_renew,
      resourcePoolId: data.resource_pool_id,
      resourcePoolSeatId: data.resource_pool_seat_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };

    return subscription;
  }

  async updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription> {
    // Map our interface fields to database fields
    const dbUpdates: any = {};
    
    if (updates.serviceId !== undefined) dbUpdates.service_id = updates.serviceId;
    if (updates.clientId !== undefined) dbUpdates.client_id = updates.clientId;
    if (updates.saleId !== undefined) dbUpdates.transaction_id = updates.saleId;
    if (updates.startedAt !== undefined) dbUpdates.started_at = updates.startedAt;
    if (updates.currentCycleStartAt !== undefined) dbUpdates.current_cycle_start_at = updates.currentCycleStartAt;
    if (updates.lastRenewalAt !== undefined) dbUpdates.last_renewal_at = updates.lastRenewalAt;
    if (updates.nextRenewalAt !== undefined) dbUpdates.next_renewal_at = updates.nextRenewalAt;
    if (updates.customNextRenewalAt !== undefined) dbUpdates.custom_next_renewal_at = updates.customNextRenewalAt;
    if (updates.targetEndAt !== undefined) dbUpdates.target_end_at = updates.targetEndAt;
    if (updates.intervalDays !== undefined) dbUpdates.interval_days = updates.intervalDays;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.iterationsDone !== undefined) dbUpdates.iterations_done = updates.iterationsDone;
    if (updates.strategy !== undefined) dbUpdates.strategy = updates.strategy;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.isAutoRenew !== undefined) dbUpdates.is_auto_renew = updates.isAutoRenew;
    if (updates.resourcePoolId !== undefined) dbUpdates.resource_pool_id = updates.resourcePoolId;
    if (updates.resourcePoolSeatId !== undefined) dbUpdates.resource_pool_seat_id = updates.resourcePoolSeatId;

    const { data, error } = await supabase
      .from('subscriptions')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating subscription:', error);
      throw new Error(`Failed to update subscription: ${error.message}`);
    }

    // Map back to our interface
    const updatedSubscription: Subscription = {
      id: data.id,
      serviceId: data.service_id,
      clientId: data.client_id,
      saleId: data.transaction_id,
      startedAt: data.started_at,
      currentCycleStartAt: data.current_cycle_start_at,
      lastRenewalAt: data.last_renewal_at,
      nextRenewalAt: data.next_renewal_at,
      customNextRenewalAt: data.custom_next_renewal_at,
      targetEndAt: data.target_end_at,
      intervalDays: data.interval_days,
      notes: data.notes,
      iterationsDone: data.iterations_done,
      strategy: data.strategy as RenewalStrategyKey,
      status: data.status as any,
      isAutoRenew: data.is_auto_renew,
      resourcePoolId: data.resource_pool_id,
      resourcePoolSeatId: data.resource_pool_seat_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };

    return updatedSubscription;
  }

  async listSubscriptions(): Promise<Subscription[]> {
    console.log('Supabase adapter: Fetching all subscriptions...');
    
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase adapter: Error listing subscriptions:', error);
      throw new Error(`Failed to list subscriptions: ${error.message}`);
    }

    console.log('Supabase adapter: Retrieved subscriptions from database:', data);

    // Map database fields to our Subscription interface
    return data.map(dbSub => ({
      id: dbSub.id,
      serviceId: dbSub.service_id,
      clientId: dbSub.client_id,
      saleId: dbSub.transaction_id,
      startedAt: dbSub.started_at,
      currentCycleStartAt: dbSub.current_cycle_start_at,
      lastRenewalAt: dbSub.last_renewal_at,
      nextRenewalAt: dbSub.next_renewal_at,
      customNextRenewalAt: dbSub.custom_next_renewal_at,
      targetEndAt: dbSub.target_end_at,
      intervalDays: dbSub.interval_days,
      notes: dbSub.notes,
      iterationsDone: dbSub.iterations_done,
      strategy: dbSub.strategy as RenewalStrategyKey,
      status: dbSub.status as any,
      isAutoRenew: dbSub.is_auto_renew,
      resourcePoolId: dbSub.resource_pool_id,
      resourcePoolSeatId: dbSub.resource_pool_seat_id,
      createdAt: dbSub.created_at,
      updatedAt: dbSub.updated_at
    }));
  }

  async createSubscriptionEvent(event: Omit<SubscriptionEvent, 'id' | 'createdAt'>): Promise<SubscriptionEvent> {
    const { data, error } = await supabase
      .from('subscription_events')
      .insert({
        subscription_id: event.subscriptionId,
        type: event.type,
        at: event.at,
        meta: event.meta
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating subscription event:', error);
      throw new Error(`Failed to create subscription event: ${error.message}`);
    }

    return {
      id: data.id,
      subscriptionId: data.subscription_id,
      type: data.type as any,
      at: data.at,
      meta: data.meta,
      createdAt: data.created_at
    };
  }

  async getSubscriptionEvents(subscriptionId: string): Promise<SubscriptionEvent[]> {
    console.log('Supabase adapter: Fetching events for subscription:', subscriptionId);
    
    const { data, error } = await supabase
      .from('subscription_events')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .order('at', { ascending: false });

    if (error) {
      console.error('Supabase adapter: Error fetching subscription events:', error);
      throw new Error(`Failed to fetch subscription events: ${error.message}`);
    }

    console.log('Supabase adapter: Retrieved events from database:', data);

    // Map database fields to our SubscriptionEvent interface
    return data.map(dbEvent => ({
      id: dbEvent.id,
      subscriptionId: dbEvent.subscription_id,
      type: dbEvent.type as any,
      at: dbEvent.at,
      meta: dbEvent.meta,
      createdAt: dbEvent.created_at
    }));
  }

  async deleteSubscription(id: string): Promise<void> {
    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting subscription:', error);
      throw new Error(`Failed to delete subscription: ${error.message}`);
    }
  }
}
