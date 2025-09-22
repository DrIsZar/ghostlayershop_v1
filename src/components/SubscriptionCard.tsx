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

      {/* Login Credentials Section */}
      {resourcePool && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
            </svg>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Login Credentials</h4>
              
              {/* Login Email */}
              <div className="flex items-center gap-2 mb-2" onClick={(e) => e.stopPropagation()}>
                <span className="text-xs text-gray-500 dark:text-gray-400">Email:</span>
                <span className="text-sm text-gray-700 dark:text-gray-300 font-mono flex-1">
                  {resourcePool.login_email}
                </span>
                <button
                  onClick={() => handleCopy(resourcePool.login_email, 'login')}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  title="Copy login email"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>

              {/* Login Password */}
              {resourcePool.login_secret && (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Password:</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-mono flex-1">
                    {showSecret ? resourcePool.login_secret : '••••••••'}
                  </span>
                  <button
                    onClick={() => setShowSecret(!showSecret)}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    title={showSecret ? "Hide password" : "Show password"}
                  >
                    {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={() => handleCopy(resourcePool.login_secret || '', 'password')}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
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

      {/* Notes Section (if no resource pool but has notes) */}
      {!resourcePool && subscription.notes && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400">Notes</h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(subscription.notes || '', 'login');
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  title="Copy notes"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-mono">
                {subscription.notes}
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

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onView(subscription);
            }}
            className="flex-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Eye className="w-4 h-4" />
            View
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(subscription);
            }}
            className="flex-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit
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
            className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
