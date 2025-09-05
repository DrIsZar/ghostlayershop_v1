import React, { useState, useEffect } from 'react';
import { Subscription } from '../types/subscription';
import { subscriptionService } from '../lib/subscriptionService';
import { formatFullPeriodCountdown, formatRenewalCountdown, formatElapsedTime, formatDate, getStatusBadge, getStrategyDisplayName, getStrategyPillColor, getProgressBarColor, formatServiceTitleWithDuration } from '../lib/subscriptionUtils';
import { computeCycleProgress, computeRenewalProgress } from '../lib/subscriptionStrategies';
import { supabase } from '../lib/supabase';
import { getServiceLogo } from '../lib/fileUtils';

// Status Badge Component
const StatusBadge: React.FC<{ status: Subscription['status'] }> = ({ status }) => {
  const badge = getStatusBadge(status);
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.bgColor} ${badge.color}`}>
      {badge.text}
    </span>
  );
};

interface SubscriptionCardProps {
  subscription: Subscription;
  onUpdate: (subscription: Subscription) => void;
  onDelete: (id: string) => void;
  onView: (subscription: Subscription) => void;
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  subscription,
  onUpdate,
  onDelete,
  onView
}) => {
  const [serviceName, setServiceName] = useState<string>('');
  const [serviceDuration, setServiceDuration] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [countdown, setCountdown] = useState<string>('');
  const [fullPeriodCountdown, setFullPeriodCountdown] = useState<string>('');


  // Fetch service and client names
  useEffect(() => {
    const fetchNames = async () => {
      try {
        // Fetch service name and duration
        const { data: serviceData } = await supabase
          .from('services')
          .select('product_service, duration')
          .eq('id', subscription.serviceId)
          .single();
        
        if (serviceData) {
          setServiceName(serviceData.product_service);
          setServiceDuration(serviceData.duration);
        }

        // Fetch client name
        const { data: clientData } = await supabase
          .from('clients')
          .select('name')
          .eq('id', subscription.clientId)
          .single();
        
        if (clientData) {
          setClientName(clientData.name);
        }
      } catch (error) {
        console.error('Error fetching names:', error);
      }
    };

    fetchNames();
  }, [subscription.serviceId, subscription.clientId]);

  // Live countdown
  useEffect(() => {
    const updateCountdown = () => {
      // Update renewal countdown
      const targetDate = subscription.nextRenewalAt || subscription.targetEndAt;
      if (targetDate) {
        const msLeft = new Date(targetDate).getTime() - Date.now();
        setCountdown(formatRenewalCountdown(msLeft));
      }

      // Update full period countdown
      if (subscription.targetEndAt) {
        const fullPeriodMsLeft = new Date(subscription.targetEndAt).getTime() - Date.now();
        setFullPeriodCountdown(formatFullPeriodCountdown(fullPeriodMsLeft));
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [subscription.nextRenewalAt, subscription.targetEndAt]);

  const cycleProgress = computeCycleProgress(subscription);
  const renewalProgress = computeRenewalProgress(subscription);
  const targetDate = subscription.nextRenewalAt || subscription.targetEndAt;
  const displayText = subscription.customNextRenewalAt ? 'Custom renewal' : 
                     subscription.targetEndAt ? 'Subscription ends' : 'Next renewal';

  // Calculate days used for completed subscriptions
  const getDaysUsed = () => {
    if (subscription.status === 'completed' && subscription.startedAt) {
      const startDate = new Date(subscription.startedAt);
      const endDate = subscription.lastRenewalAt ? new Date(subscription.lastRenewalAt) : new Date();
      const diffTime = endDate.getTime() - startDate.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    return 0;
  };

  const daysUsed = getDaysUsed();

  return (
    <div 
      onClick={() => onView(subscription)}
      className={`rounded-xl border p-6 hover:shadow-lg transition-all duration-200 cursor-pointer group ${
        subscription.status === 'completed' 
          ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800' 
          : subscription.status === 'archived'
          ? 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-800/20 border-gray-200 dark:border-gray-700'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center border border-gray-200 dark:border-gray-600 shadow-sm">
            {(() => {
              const serviceLogo = getServiceLogo(serviceName);
              return serviceLogo ? (
                <img 
                  src={serviceLogo} 
                  alt={`${serviceName} logo`} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null;
            })()}
            <div className={`w-full h-full flex items-center justify-center text-gray-400 ${getServiceLogo(serviceName) ? 'hidden' : ''}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div>
                         <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
               {serviceName && serviceDuration ? formatServiceTitleWithDuration(serviceName, serviceDuration) : serviceName || 'Loading...'}
             </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {clientName || 'Loading...'}
            </p>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStrategyPillColor(subscription.strategy)}`}>
            {getStrategyDisplayName(subscription.strategy)}
          </span>
          <StatusBadge status={subscription.status} />
        </div>
      </div>

      {/* Main Countdown */}
      <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
            <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {displayText}
          </span>
          {targetDate && (
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded-full">
              {formatDate(targetDate)}
            </span>
          )}
        </div>
        
        <div className="text-3xl font-bold text-gray-900 dark:text-white mb-3 text-center">
          {countdown}
        </div>
        
        {targetDate && (
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-2 rounded-full transition-all duration-500 ease-out ${getProgressBarColor(renewalProgress.pct)} shadow-sm`}
              style={{ width: `${Math.min(renewalProgress.pct, 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Full Period Timeline */}
      {subscription.targetEndAt && (
        <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
              <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Full Period Timeline
            </span>
            <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded-full">
              {formatDate(subscription.targetEndAt)}
            </span>
          </div>
          
          {/* Timeline Dates */}
          <div className="flex justify-between items-center mb-3 text-xs text-gray-600 dark:text-gray-400">
            <div className="text-center">
              <div className="font-medium">Start</div>
              <div>{formatDate(subscription.startedAt)}</div>
            </div>
            <div className="flex-1 mx-4">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ease-out ${getProgressBarColor(cycleProgress.pct)} shadow-sm`}
                  style={{ width: `${Math.min(cycleProgress.pct, 100)}%` }}
                />
              </div>
            </div>
            <div className="text-center">
              <div className="font-medium">End</div>
              <div>{formatDate(subscription.targetEndAt)}</div>
            </div>
          </div>
          
          {/* Countdown Display */}
          <div className="text-2xl font-bold text-gray-900 dark:text-white mb-3 text-center">
            {fullPeriodCountdown}
          </div>
          
          {/* Timeline Stats */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-2 text-center">
              <div className="text-gray-600 dark:text-gray-400">Elapsed</div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {(() => {
                  const now = new Date();
                  const startDate = new Date(subscription.startedAt);
                  const elapsedMs = now.getTime() - startDate.getTime();
                  return formatElapsedTime(elapsedMs);
                })()}
              </div>
            </div>
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-2 text-center">
              <div className="text-gray-600 dark:text-gray-400">Remaining</div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {(() => {
                  const now = new Date();
                  const endDate = new Date(subscription.targetEndAt);
                  const remainingMs = endDate.getTime() - now.getTime();
                  return formatFullPeriodCountdown(Math.max(0, remainingMs));
                })()}
              </div>
            </div>
          </div>
          
          {/* Progress Percentage */}
          <div className="mt-3 text-center">
            <span className="text-xs font-medium text-green-600 dark:text-green-400">
              {Math.round(cycleProgress.pct)}% complete
            </span>
          </div>
        </div>
      )}

      {/* Notes Section */}
      {subscription.notes && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {subscription.notes.length > 150 
                  ? `${subscription.notes.substring(0, 150)}...` 
                  : subscription.notes
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Info */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {/* Custom Renewal Badge */}
          {subscription.customNextRenewalAt && (
            <div className="inline-flex items-center px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-full text-xs font-medium">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Custom renewal date set
            </div>
          )}

          {/* Renewal History Summary */}
          {subscription.iterationsDone !== undefined && subscription.iterationsDone > 0 && (
            <div className="inline-flex items-center px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {subscription.iterationsDone} renewal{subscription.iterationsDone !== 1 ? 's' : ''} completed
            </div>
          )}

          {/* Days Used for Completed Subscriptions */}
          {subscription.status === 'completed' && daysUsed > 0 && (
            <div className="inline-flex items-center px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded-full text-xs font-medium">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {daysUsed} day{daysUsed !== 1 ? 's' : ''} used
            </div>
          )}

          {/* Archived Badge */}
          {subscription.status === 'archived' && (
            <div className="inline-flex items-center px-3 py-1 bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-200 rounded-full text-xs font-medium">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-14 0h14" />
              </svg>
              Archived
            </div>
          )}
        </div>

        {/* Full Period Info (if different from renewal) */}
        {subscription.targetEndAt && subscription.targetEndAt !== subscription.nextRenewalAt && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Full period: {formatDate(subscription.startedAt)} - {formatDate(subscription.targetEndAt)}
          </div>
        )}
      </div>
    </div>
  );
};
