import { RenewalStrategyKey, StrategyHandler, Subscription } from '../types/subscription';

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

// Utility function to check if date is today
const isToday = (date: Date): boolean => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

// Utility function to check if date is within N days
const isWithinDays = (date: Date, days: number): boolean => {
  const today = new Date();
  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= days;
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
      const now = new Date();
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
      const now = new Date();
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
  const nextRenewal = new Date(sub.nextRenewalAt);
  const today = new Date();
  return nextRenewal < today && sub.status === 'active';
};

export const computeCycleProgress = (sub: Subscription): { pct: number; msLeft: number; msTotal: number } => {
  if (!sub.targetEndAt) {
    return { pct: 0, msLeft: 0, msTotal: 0 };
  }
  
  const now = new Date();
  const startDate = new Date(sub.startedAt);
  const endDate = new Date(sub.targetEndAt);
  
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
  
  const now = new Date();
  const cycleStart = new Date(sub.currentCycleStartAt);
  const nextRenewal = new Date(sub.nextRenewalAt);
  
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
