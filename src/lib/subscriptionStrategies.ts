import { RenewalStrategyKey, StrategyHandler, Subscription } from '../types/subscription';
import { getPoolForSubscription } from './inventory';
import { getNowInTunisia, isTodayInTunisia, toTunisiaTime } from './dateUtils';

// Utility function to add months to a date
const addMonths = (date: Date, months: number): Date => {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + months);
  return newDate;
};

// Utility function to add days to a date
const addDays = (date: Date, days: number): Date => {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
};

// Utility function to check if date is today (in Tunisian timezone)
const isToday = (date: Date): boolean => {
  return isTodayInTunisia(date);
};

// Utility function to check if date is within N days (in Tunisian timezone)
const isWithinDays = (date: Date, days: number): boolean => {
  const today = getNowInTunisia();
  const tunisiaDate = toTunisiaTime(date);
  const diffTime = tunisiaDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= days;
};

// Utility function to get pool end date if subscription is linked to a pool
// Returns the pool's end date if the subscription is linked to an alive pool, null otherwise
const getPoolEndDate = async (subscription: Subscription): Promise<Date | null> => {
  if (!subscription.resourcePoolId) {
    return null;
  }

  try {
    const { data: pool, error } = await getPoolForSubscription(subscription.id);
    if (error || !pool) {
      return null;
    }

    // Only use pool end date if the pool is alive
    // Dead/expired pools shouldn't affect renewal dates
    if (!pool.is_alive) {
      return null;
    }

    const poolEndDate = new Date(pool.end_at);
    return poolEndDate;
  } catch (error) {
    console.error('Error checking pool end date:', error);
    return null;
  }
};

export const STRATEGIES: Record<RenewalStrategyKey, StrategyHandler> = {
  MONTHLY: {
    computeNextRenewal(sub: Subscription): Date | null {
      // If custom date is set, use it
      if (sub.customNextRenewalAt) {
        return new Date(sub.customNextRenewalAt);
      }
      // Otherwise use strategy logic
      const lastRenewal = sub.lastRenewalAt ? new Date(sub.lastRenewalAt) : new Date(sub.currentCycleStartAt);
      return addMonths(lastRenewal, 1);
    },
    computeNextRenewalWithoutCustom(sub: Subscription): Date | null {
      // Always use strategy logic, ignore custom dates
      const lastRenewal = sub.lastRenewalAt ? new Date(sub.lastRenewalAt) : new Date(sub.currentCycleStartAt);
      return addMonths(lastRenewal, 1);
    },
    onRenew(sub: Subscription): Partial<Subscription> {
      const now = getNowInTunisia();
      const nextRenewal = addMonths(now, 1);
      return {
        currentCycleStartAt: now.toISOString(),
        lastRenewalAt: now.toISOString(),
        nextRenewalAt: nextRenewal.toISOString(),
        customNextRenewalAt: undefined, // Clear custom override after renewal
        iterationsDone: (sub.iterationsDone || 0) + 1
      };
    }
  },

  EVERY_N_DAYS: {
    computeNextRenewal(sub: Subscription): Date | null {
      // If custom date is set, use it
      if (sub.customNextRenewalAt) {
        return new Date(sub.customNextRenewalAt);
      }
      // Otherwise use strategy logic
      const intervalDays = sub.intervalDays || 30;
      const lastRenewal = sub.lastRenewalAt ? new Date(sub.lastRenewalAt) : new Date(sub.currentCycleStartAt);
      return addDays(lastRenewal, intervalDays);
    },
    computeNextRenewalWithoutCustom(sub: Subscription): Date | null {
      // Always use strategy logic, ignore custom dates
      const intervalDays = sub.intervalDays || 30;
      const lastRenewal = sub.lastRenewalAt ? new Date(sub.lastRenewalAt) : new Date(sub.currentCycleStartAt);
      return addDays(lastRenewal, intervalDays);
    },
    onRenew(sub: Subscription): Partial<Subscription> {
      const now = getNowInTunisia();
      const intervalDays = sub.intervalDays || 30;
      const nextRenewal = addDays(now, intervalDays);
      return {
        currentCycleStartAt: now.toISOString(),
        lastRenewalAt: now.toISOString(),
        nextRenewalAt: nextRenewal.toISOString(),
        customNextRenewalAt: undefined, // Clear custom override after renewal
        iterationsDone: (sub.iterationsDone || 0) + 1
      };
    }
  }
};

// Pool-aware strategy functions
export const computeNextRenewalWithPoolAwareness = async (sub: Subscription): Promise<Date | null> => {
  // If subscription is linked to a pool, always use the pool's end date
  const poolEndDate = await getPoolEndDate(sub);
  if (poolEndDate) {
    return poolEndDate;
  }

  // Otherwise use the standard strategy logic
  const strategyHandler = STRATEGIES[sub.strategy];
  if (!strategyHandler?.computeNextRenewal) {
    return null;
  }

  return strategyHandler.computeNextRenewal(sub);
};

export const computeNextRenewalWithoutCustomWithPoolAwareness = async (sub: Subscription): Promise<Date | null> => {
  // If subscription is linked to a pool, always use the pool's end date
  const poolEndDate = await getPoolEndDate(sub);
  if (poolEndDate) {
    return poolEndDate;
  }

  // Otherwise use the standard strategy logic
  const strategyHandler = STRATEGIES[sub.strategy];
  if (!strategyHandler?.computeNextRenewalWithoutCustom) {
    return null;
  }

  return strategyHandler.computeNextRenewalWithoutCustom(sub);
};

export const onRenewWithPoolAwareness = async (sub: Subscription): Promise<Partial<Subscription>> => {
  const strategyHandler = STRATEGIES[sub.strategy];
  if (!strategyHandler?.onRenew) {
    throw new Error(`Strategy ${sub.strategy} does not support renewals`);
  }

  const updates = strategyHandler.onRenew(sub);
  const now = getNowInTunisia();

  // If subscription is linked to a pool, always use the pool's end date for renewal
  const poolEndDate = await getPoolEndDate(sub);
  if (poolEndDate) {
    // Always use pool end date to keep subscription in sync with pool
    updates.nextRenewalAt = poolEndDate.toISOString();
  }

  return updates;
};

// Utility functions for subscription state
export const isDueToday = (sub: Subscription): boolean => {
  if (!sub.nextRenewalAt) return false;
  return isToday(new Date(sub.nextRenewalAt));
};

export const isDueSoon = (sub: Subscription): boolean => {
  if (!sub.nextRenewalAt) return false;
  return isWithinDays(new Date(sub.nextRenewalAt), 3);
};

export const isOverdue = (sub: Subscription): boolean => {
  if (!sub.nextRenewalAt) return false;
  const nextRenewal = toTunisiaTime(new Date(sub.nextRenewalAt));
  const today = getNowInTunisia();
  return nextRenewal < today && sub.status === 'active';
};

export const computeCycleProgress = (sub: Subscription): { pct: number; msLeft: number; msTotal: number } => {
  if (!sub.targetEndAt) {
    return { pct: 0, msLeft: 0, msTotal: 0 };
  }
  
  const now = getNowInTunisia();
  const startDate = toTunisiaTime(new Date(sub.startedAt));
  const endDate = toTunisiaTime(new Date(sub.targetEndAt));
  
  const msTotal = endDate.getTime() - startDate.getTime();
  const msElapsed = now.getTime() - startDate.getTime();
  const msLeft = endDate.getTime() - now.getTime();
  
  if (msTotal <= 0) {
    return { pct: 100, msLeft: 0, msTotal: 0 };
  }
  
  // Calculate progress as "time remaining" - fills up as we approach the end
  const pct = Math.max(0, Math.min(100, ((msTotal - msLeft) / msTotal) * 100));
  
  return { pct, msLeft: Math.max(0, msLeft), msTotal };
};

export const computeRenewalProgress = (sub: Subscription): { pct: number; msLeft: number; msTotal: number } => {
  if (!sub.nextRenewalAt) {
    return { pct: 0, msLeft: 0, msTotal: 0 };
  }
  
  const now = getNowInTunisia();
  const cycleStart = toTunisiaTime(new Date(sub.currentCycleStartAt));
  const nextRenewal = toTunisiaTime(new Date(sub.nextRenewalAt));
  
  const msTotal = nextRenewal.getTime() - cycleStart.getTime();
  const msElapsed = now.getTime() - cycleStart.getTime();
  const msLeft = nextRenewal.getTime() - now.getTime();
  
  if (msTotal <= 0) {
    return { pct: 100, msLeft: 0, msTotal: 0 };
  }
  
  // Calculate progress as "time remaining" - fills up as we approach renewal
  const pct = Math.max(0, Math.min(100, ((msTotal - msLeft) / msTotal) * 100));
  
  return { pct, msLeft: Math.max(0, msLeft), msTotal };
};
