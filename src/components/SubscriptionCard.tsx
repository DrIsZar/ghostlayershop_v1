import React, { useState, useEffect } from 'react';
import { Edit, Eye, Trash2, Copy, EyeOff } from 'lucide-react';
import { Subscription } from '../types/subscription';
import { subscriptionService } from '../lib/subscriptionService';
import { formatFullPeriodCountdown, formatRenewalCountdown, formatElapsedTime, formatDate, getStatusBadge, getStrategyDisplayName, getStrategyPillColor, getProgressBarColor, formatServiceTitleWithDuration } from '../lib/subscriptionUtils';
import { computeCycleProgress, computeRenewalProgress } from '../lib/subscriptionStrategies';
import { supabase } from '../lib/supabase';
import { getServiceLogo } from '../lib/fileUtils';
import { getResourcePool } from '../lib/inventory';
import { ResourcePool } from '../types/inventory';
import { copyToClipboard } from '../lib/toast';

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
  onEdit: (subscription: Subscription) => void;
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  subscription,
  onUpdate,
  onDelete,
  onView,
  onEdit
}) => {
  const [serviceName, setServiceName] = useState<string>('');
  const [serviceDuration, setServiceDuration] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [countdown, setCountdown] = useState<string>('');
  const [fullPeriodCountdown, setFullPeriodCountdown] = useState<string>('');
  const [resourcePool, setResourcePool] = useState<ResourcePool | null>(null);
  const [showSecret, setShowSecret] = useState(false);


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

        // Fetch resource pool information if linked
        if (subscription.resourcePoolId) {
          try {
            const { data: pool, error: poolError } = await getResourcePool(subscription.resourcePoolId);
            if (poolError) throw poolError;
            setResourcePool(pool);
          } catch (error) {
            console.error('Error fetching resource pool:', error);
          }
        }
      } catch (error) {
        console.error('Error fetching names:', error);
      }
    };

    fetchNames();
  }, [subscription.serviceId, subscription.clientId, subscription.resourcePoolId]);

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

  const handleCopy = async (text: string, type: 'login' | 'password') => {
    const message = type === 'login' ? 'Login copied to clipboard' : 'Password copied to clipboard';
    await copyToClipboard(text, message);
  };

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
      className={`w-full max-w-full rounded-2xl border transition-all duration-200 cursor-pointer group ${
        subscription.status === 'completed' 
          ? 'bg-gray-800/30 border-gray-700/50' 
          : subscription.status === 'archived'
          ? 'bg-gray-800/20 border-gray-700/30'
          : 'bg-gray-800/50 border-gray-700/50'
      }`}
    >
      {/* Header - Mobile Viewport Optimized */}
      <div className="p-3 sm:p-4 border-b border-gray-700/30">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg overflow-hidden bg-gray-700 flex items-center justify-center border border-gray-600 flex-shrink-0">
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
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-semibold text-white group-hover:text-blue-400 transition-colors truncate">
                {serviceName && serviceDuration ? formatServiceTitleWithDuration(serviceName, serviceDuration) : serviceName || 'Loading...'}
              </h3>
              <p className="text-xs sm:text-sm text-gray-400 truncate">
                {clientName || 'Loading...'}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col items-end space-y-1 flex-shrink-0 ml-2">
            <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium ${getStrategyPillColor(subscription.strategy)}`}>
              {getStrategyDisplayName(subscription.strategy)}
            </span>
            <StatusBadge status={subscription.status} />
          </div>
        </div>
      </div>

      {/* Main Countdown - Mobile Viewport Optimized */}
      <div className="p-3 sm:p-4 bg-gray-800/30 border-b border-gray-700/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs sm:text-sm font-medium text-gray-300 flex items-center">
            <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="truncate">{displayText}</span>
          </span>
          {targetDate && (
            <span className="text-xs font-medium text-blue-400 bg-blue-900/30 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full flex-shrink-0 ml-2">
              {formatDate(targetDate)}
            </span>
          )}
        </div>
        
        <div className="text-lg sm:text-2xl font-bold text-white mb-2 text-center">
          {countdown}
        </div>
        
        {targetDate && (
          <div className="w-full bg-gray-700 rounded-full h-1 sm:h-1.5 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ease-out ${getProgressBarColor(renewalProgress.pct)}`}
              style={{ width: `${Math.min(renewalProgress.pct, 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Full Period Timeline - Mobile Viewport Optimized */}
      {subscription.targetEndAt && (
        <div className="p-3 sm:p-4 bg-gray-800/20 border-b border-gray-700/30">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-xs sm:text-sm font-medium text-gray-300 flex items-center">
              <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="truncate">Full Period Timeline</span>
            </span>
            <span className="text-xs font-medium text-green-400 bg-green-900/30 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full flex-shrink-0 ml-2">
              {formatDate(subscription.targetEndAt)}
            </span>
          </div>
          
          {/* Timeline Dates - Mobile Stacked */}
          <div className="space-y-1 sm:space-y-2 mb-2 sm:mb-3">
            <div className="flex justify-between text-xs text-gray-400">
              <span className="truncate">Start: {formatDate(subscription.startedAt)}</span>
              <span className="truncate ml-2">End: {formatDate(subscription.targetEndAt)}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1 sm:h-1.5 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ease-out ${getProgressBarColor(cycleProgress.pct)}`}
                style={{ width: `${Math.min(cycleProgress.pct, 100)}%` }}
              />
            </div>
          </div>
          
          {/* Countdown Display */}
          <div className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3 text-center">
            {fullPeriodCountdown}
          </div>
          
          {/* Timeline Stats - Mobile Grid */}
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-xs">
            <div className="bg-gray-700/50 rounded-lg p-1.5 sm:p-2 text-center">
              <div className="text-gray-400 text-xs">Elapsed</div>
              <div className="font-semibold text-white text-xs sm:text-sm">
                {(() => {
                  const now = new Date();
                  const startDate = new Date(subscription.startedAt);
                  const elapsedMs = now.getTime() - startDate.getTime();
                  return formatElapsedTime(elapsedMs);
                })()}
              </div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-1.5 sm:p-2 text-center">
              <div className="text-gray-400 text-xs">Remaining</div>
              <div className="font-semibold text-white text-xs sm:text-sm">
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
          <div className="mt-1 sm:mt-2 text-center">
            <span className="text-xs font-medium text-green-400">
              {Math.round(cycleProgress.pct)}% complete
            </span>
          </div>
        </div>
      )}

      {/* Login Credentials Section - Mobile Viewport Optimized */}
      {resourcePool && (
        <div className="p-3 sm:p-4 bg-gray-800/20 border-b border-gray-700/30">
          <div className="flex items-start gap-2">
            <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
            </svg>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-medium text-gray-400 mb-1 sm:mb-2">Login Credentials</h4>
              
              {/* Login Email */}
              <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2" onClick={(e) => e.stopPropagation()}>
                <span className="text-xs text-gray-400 flex-shrink-0">Email:</span>
                <span className="text-xs sm:text-sm text-gray-300 font-mono flex-1 truncate">
                  {resourcePool.login_email}
                </span>
                <button
                  onClick={() => handleCopy(resourcePool.login_email, 'login')}
                  className="p-0.5 sm:p-1 text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0"
                  title="Copy login email"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>

              {/* Login Password */}
              {resourcePool.login_secret && (
                <div className="flex items-center gap-1 sm:gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className="text-xs text-gray-400 flex-shrink-0">Password:</span>
                  <span className="text-xs sm:text-sm text-gray-300 font-mono flex-1 truncate">
                    {showSecret ? resourcePool.login_secret : '••••••••'}
                  </span>
                  <button
                    onClick={() => setShowSecret(!showSecret)}
                    className="p-0.5 sm:p-1 text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0"
                    title={showSecret ? "Hide password" : "Show password"}
                  >
                    {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={() => handleCopy(resourcePool.login_secret || '', 'password')}
                    className="p-0.5 sm:p-1 text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0"
                    title="Copy password"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notes Section - Mobile Viewport Optimized */}
      {!resourcePool && subscription.notes && (
        <div className="p-3 sm:p-4 bg-gray-800/20 border-b border-gray-700/30">
          <div className="flex items-start gap-2">
            <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-xs font-medium text-gray-400">Notes</h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(subscription.notes || '', 'login');
                  }}
                  className="p-0.5 sm:p-1 text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0"
                  title="Copy notes"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed font-mono break-words">
                {subscription.notes}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Info - Mobile Viewport Optimized */}
      <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {/* Custom Renewal Badge */}
          {subscription.customNextRenewalAt && (
            <div className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 bg-yellow-900/30 text-yellow-400 rounded-full text-xs font-medium">
              <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs">Custom renewal date set</span>
            </div>
          )}

          {/* Renewal History Summary */}
          {subscription.iterationsDone !== undefined && subscription.iterationsDone > 0 && (
            <div className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-900/30 text-blue-400 rounded-full text-xs font-medium">
              <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs">{subscription.iterationsDone} renewal{subscription.iterationsDone !== 1 ? 's' : ''} completed</span>
            </div>
          )}

          {/* Days Used for Completed Subscriptions */}
          {subscription.status === 'completed' && daysUsed > 0 && (
            <div className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 bg-purple-900/30 text-purple-400 rounded-full text-xs font-medium">
              <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs">{daysUsed} day{daysUsed !== 1 ? 's' : ''} used</span>
            </div>
          )}

          {/* Archived Badge */}
          {subscription.status === 'archived' && (
            <div className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-900/30 text-gray-400 rounded-full text-xs font-medium">
              <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-14 0h14" />
              </svg>
              <span className="text-xs">Archived</span>
            </div>
          )}
        </div>

        {/* Full Period Info (if different from renewal) */}
        {subscription.targetEndAt && subscription.targetEndAt !== subscription.nextRenewalAt && (
          <div className="text-xs text-gray-400 break-words">
            Full period: {formatDate(subscription.startedAt)} - {formatDate(subscription.targetEndAt)}
          </div>
        )}

        {/* Action Buttons - Mobile Viewport Optimized */}
        <div className="flex gap-1.5 sm:gap-2 pt-2 sm:pt-3 border-t border-gray-700/30">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onView(subscription);
            }}
            className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-400 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors flex items-center justify-center gap-1 sm:gap-2"
          >
            <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">View</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(subscription);
            }}
            className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-400 hover:text-green-400 hover:bg-green-900/20 rounded-lg transition-colors flex items-center justify-center gap-1 sm:gap-2"
          >
            <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">Edit</span>
          </button>
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (confirm('Are you sure you want to delete this subscription?')) {
                console.log('🗑️ Card delete button clicked for subscription:', subscription.id);
                try {
                  // Actually delete from database
                  await subscriptionService.delete(subscription.id);
                  console.log('✅ Subscription deleted from database via card button');
                  // Then update UI
                  onDelete(subscription.id);
                } catch (error) {
                  console.error('❌ Error deleting subscription from card:', error);
                  alert(`Failed to delete subscription: ${(error as Error).message}`);
                }
              }
            }}
            className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
