import { Subscription, RenewalStrategyKey } from '../types/subscription';

// Format countdown display (for custom renewal timeline - no hours)
export const formatCountdown = (msLeft: number): string => {
  if (msLeft <= 0) return 'Overdue';
  
  const days = Math.floor(msLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((msLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

// Format countdown display for full period timeline (months and days)
export const formatFullPeriodCountdown = (msLeft: number): string => {
  if (msLeft <= 0) return 'Completed';
  
  const totalDays = Math.floor(msLeft / (1000 * 60 * 60 * 24));
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  
  if (months > 0 && days > 0) {
    return `${months}m ${days}d`;
  } else if (months > 0) {
    return `${months}m`;
  } else if (days > 0) {
    return `${days}d`;
  } else {
    return 'Less than 1 day';
  }
};

// Format countdown display for custom renewal timeline (days only, no hours)
export const formatRenewalCountdown = (msLeft: number): string => {
  if (msLeft <= 0) return 'Overdue';
  
  const days = Math.floor(msLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((msLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) {
    return `${days}d`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return 'Less than 1 hour';
  }
};

// Format elapsed time for full period timeline (months and days)
export const formatElapsedTime = (msElapsed: number): string => {
  const totalDays = Math.floor(msElapsed / (1000 * 60 * 60 * 24));
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  
  if (months > 0 && days > 0) {
    return `${months}m ${days}d`;
  } else if (months > 0) {
    return `${months}m`;
  } else if (days > 0) {
    return `${days}d`;
  } else {
    return 'Less than 1 day';
  }
};

// Format date for display
export const formatDate = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

// Get status badge styling
export const getStatusBadge = (status: Subscription['status']) => {
  switch (status) {
    case 'active':
      return { text: 'Active', bgColor: 'bg-green-900/30', color: 'text-green-400' };
    case 'completed':
      return { text: 'Completed', bgColor: 'bg-blue-900/30', color: 'text-blue-400' };
    case 'overdue':
      return { text: 'Overdue', bgColor: 'bg-red-900/30', color: 'text-red-400' };
    case 'archived':
      return { text: 'Archived', bgColor: 'bg-gray-900/30', color: 'text-gray-400' };
    default:
      return { text: 'Unknown', bgColor: 'bg-gray-900/30', color: 'text-green-400' };
  }
};

// Get strategy display name
export const getStrategyDisplayName = (strategy: RenewalStrategyKey): string => {
  switch (strategy) {
    case 'MONTHLY':
      return 'Monthly';
    case 'EVERY_N_DAYS':
      return 'Every N Days';
    default:
      return 'Unknown';
  }
};

// Get strategy pill color
export const getStrategyPillColor = (strategy: RenewalStrategyKey): string => {
  switch (strategy) {
    case 'MONTHLY':
      return 'bg-blue-900/30 text-blue-400 border border-blue-700/50';
    case 'EVERY_N_DAYS':
      return 'bg-purple-900/30 text-purple-400 border border-purple-700/50';
    default:
      return 'bg-gray-900/30 text-gray-400 border border-gray-700/50';
  }
};

// Get progress bar color based on percentage
export const getProgressBarColor = (percentage: number): string => {
  if (percentage >= 90) return 'bg-red-500';
  if (percentage >= 75) return 'bg-orange-500';
  if (percentage >= 50) return 'bg-yellow-500';
  if (percentage >= 25) return 'bg-blue-500';
  return 'bg-green-500';
};

// Check if subscription can be renewed
export const canRenew = (subscription: Subscription): boolean => {
  return subscription.status === 'active' && 
         (subscription.nextRenewalAt !== undefined || subscription.targetEndAt !== undefined) &&
         subscription.isAutoRenew;
};

// Parse service duration string and extract months
export const parseServiceDuration = (durationString: string): number => {
  const lowerDuration = durationString.toLowerCase();
  
  // Extract number from strings like "12 months", "1 month", "6M", etc.
  const match = lowerDuration.match(/(\d+)\s*(month|m|mo)/);
  if (match) {
    return parseInt(match[1]);
  }
  
  // Default to 1 month if no match
  return 1;
};

// Calculate end date based on service duration and start date
export const calculateEndDateFromDuration = (durationString: string, startDate: string): string => {
  const months = parseServiceDuration(durationString);
  const start = new Date(startDate);
  const end = new Date(start);
  
  // Properly handle month addition to avoid date rollover issues
  const targetMonth = end.getMonth() + months;
  const targetYear = end.getFullYear() + Math.floor(targetMonth / 12);
  const finalMonth = targetMonth % 12;
  
  end.setFullYear(targetYear);
  end.setMonth(finalMonth);
  
  // If the day doesn't exist in the target month (e.g., Jan 31 -> Feb 31), 
  // set it to the last day of the target month
  if (end.getDate() !== start.getDate()) {
    end.setDate(0); // This sets to the last day of the previous month
  }
  
  return end.toISOString().split('T')[0];
};

// Format service title with duration
export const formatServiceTitleWithDuration = (serviceName: string, durationString: string): string => {
  const months = parseServiceDuration(durationString);
  
  if (months === 1) {
    return `${serviceName} (1M)`;
  } else if (months === 12) {
    return `${serviceName} (12M)`;
  } else {
    return `${serviceName} (${months}M)`;
  }
};

// Extract base service name (without duration)
export const extractBaseServiceName = (serviceName: string): string => {
  // Remove common duration patterns from service names
  return serviceName
    .replace(/\s*\(\d+[Mm]\)\s*$/, '') // Remove (1M), (3M), etc.
    .replace(/\s*-\s*\d+[Mm]\s*$/, '') // Remove -1M, -3M, etc.
    .replace(/\s*\d+[Mm]\s*$/, '') // Remove 1M, 3M, etc. at the end
    .trim();
};

// Group services by base name
export interface ServiceGroup {
  baseName: string;
  services: Array<{
    id: string;
    product_service: string;
    duration?: string;
    fullName: string;
  }>;
}

export const groupServicesByBaseName = (services: Array<{id: string; product_service: string; duration?: string}>): ServiceGroup[] => {
  const groups = new Map<string, ServiceGroup>();
  
  services.forEach(service => {
    const baseName = extractBaseServiceName(service.product_service);
    const fullName = formatServiceTitleWithDuration(service.product_service, service.duration || '1 month');
    
    if (!groups.has(baseName)) {
      groups.set(baseName, {
        baseName,
        services: []
      });
    }
    
    groups.get(baseName)!.services.push({
      id: service.id,
      product_service: service.product_service,
      duration: service.duration,
      fullName
    });
  });
  
  // Sort services within each group by duration (months)
  groups.forEach(group => {
    group.services.sort((a, b) => {
      const monthsA = parseServiceDuration(a.duration || '1 month');
      const monthsB = parseServiceDuration(b.duration || '1 month');
      return monthsA - monthsB;
    });
  });
  
  // Sort groups alphabetically
  return Array.from(groups.values()).sort((a, b) => a.baseName.localeCompare(b.baseName));
};

// Get available periods for a service group
export const getAvailablePeriods = (serviceGroup: ServiceGroup): Array<{value: string; label: string; months: number}> => {
  return serviceGroup.services.map(service => {
    const months = parseServiceDuration(service.duration || '1 month');
    return {
      value: service.id,
      label: `${months}M`,
      months
    };
  });
};