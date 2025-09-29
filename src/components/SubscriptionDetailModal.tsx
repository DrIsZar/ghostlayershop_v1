import { useState, useEffect } from 'react';
import { X, Edit, Clock, Calendar, Package, CheckCircle, RefreshCw, Trash2, Mail } from 'lucide-react';
import { Subscription, SubscriptionEvent } from '../types/subscription';
import { subscriptionService } from '../lib/subscriptionService';
import { getStrategyDisplayName, formatDate, formatFullPeriodCountdown, formatRenewalCountdown, formatElapsedTime, getStatusBadge, getProgressBarColor, formatServiceTitleWithDuration } from '../lib/subscriptionUtils';
import { computeCycleProgress, computeRenewalProgress } from '../lib/subscriptionStrategies';
import { supabase } from '../lib/supabase';
import { getServiceLogo } from '../lib/fileUtils';

interface SubscriptionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: Subscription | null;
  onUpdate: (subscription: Subscription) => void;
  onDelete: (subscriptionId: string) => void;
  onEdit?: (subscription: Subscription) => void;
}

export default function SubscriptionDetailModal({ 
  isOpen, 
  onClose, 
  subscription,
  onUpdate,
  onDelete,
  onEdit
}: SubscriptionDetailModalProps) {
  // Remove edit state - this modal is now read-only
  const [isLoading, setIsLoading] = useState(false);
  const [events, setEvents] = useState<SubscriptionEvent[]>([]);
  const [serviceName, setServiceName] = useState('');
  const [clientName, setClientName] = useState('');
  const [serviceLogo, setServiceLogo] = useState<string | null>(null);
  const [serviceDuration, setServiceDuration] = useState<string>('');
  // Remove edit data - editing is handled by SubscriptionEditModal
  const [countdown, setCountdown] = useState<string>('');
  const [fullPeriodCountdown, setFullPeriodCountdown] = useState<string>('');

  useEffect(() => {
    if (isOpen && subscription) {
      fetchSubscriptionData();
    }
  }, [isOpen, subscription]);

  // Live countdown
  useEffect(() => {
    if (!subscription) return;

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
  }, [subscription]);


const fetchSubscriptionData = async () => {
    if (!subscription) return;

    try {
      // Fetch service name, duration, and logo
      const { data: service } = await supabase
        .from('services')
        .select('product_service, duration, logo_url')
        .eq('id', subscription.serviceId)
        .single();
      
      if (service) {
        setServiceName(service.product_service);
        setServiceDuration(service.duration || '');
        // Get the logo using the service name
        const logoUrl = getServiceLogo(service.product_service);
        setServiceLogo(logoUrl);
      }

      // Fetch client name
      const { data: client } = await supabase
        .from('clients')
        .select('name')
        .eq('id', subscription.clientId)
        .single();
      
      if (client) {
        setClientName(client.name);
      }


      // Fetch real events from the service
      try {
        const realEvents = await subscriptionService.getSubscriptionHistory(subscription.id);
        setEvents(realEvents);
      } catch (error) {
        console.error('Error fetching subscription events:', error);
        // Fallback to mock events if service fails
        const mockEvents: SubscriptionEvent[] = [
          {
            id: '1',
            subscriptionId: subscription.id,
            type: 'created',
            at: subscription.createdAt,
            createdAt: subscription.createdAt,
            meta: { strategy: subscription.strategy }
          }
        ];



        setEvents(mockEvents);
      }
    } catch (error) {
      console.error('Error fetching subscription data:', error);
    }
  };

  // handleSave removed - editing is now handled by SubscriptionEditModal

  const handleRenew = async () => {
    if (!subscription) return;

    setIsLoading(true);
    try {
      const updated = await subscriptionService.renewNow(subscription.id);
      onUpdate(updated);
      fetchSubscriptionData(); // Refresh events
    } catch (error) {
      console.error('Error renewing subscription:', error);
      alert('Failed to renew subscription');
    } finally {
      setIsLoading(false);
    }
  };



  const handleComplete = async () => {
    if (!subscription) return;

    setIsLoading(true);
    try {
      const updated = await subscriptionService.complete(subscription.id);
      onUpdate(updated);
      fetchSubscriptionData();
    } catch (error) {
      console.error('Error completing subscription:', error);
      alert('Failed to complete subscription');
    } finally {
      setIsLoading(false);
    }
  };



  const handleRevert = async () => {
    if (!subscription) return;

    if (!confirm(`Revert this subscription back to active? This will change the status from "${subscription.status}" to "active" and recalculate the next renewal date.`)) return;

    setIsLoading(true);
    try {
      const updated = await subscriptionService.revert(subscription.id);
      onUpdate(updated);
      fetchSubscriptionData();
    } catch (error) {
      console.error('Error reverting subscription:', error);
      alert('Failed to revert subscription');
    } finally {
      setIsLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!subscription) return;

    if (!confirm(`Archive this subscription? This will change the status to "archived" and stop all renewal tracking. You can revert this action later.`)) return;

    setIsLoading(true);
    try {
      const updated = await subscriptionService.archive(subscription.id);
      onUpdate(updated);
      fetchSubscriptionData();
    } catch (error) {
      console.error('Error archiving subscription:', error);
      alert('Failed to archive subscription');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Delete this event? This action cannot be undone.')) return;

    setIsLoading(true);
    try {
      // Note: This would require adding a deleteEvent method to the subscription service
      // For now, we'll just remove it from the local state
      setEvents(events.filter(event => event.id !== eventId));
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!subscription) return;

    if (!confirm('Delete this subscription? This action cannot be undone and will remove all subscription history.')) return;

    console.log('Starting subscription deletion process from detail modal:', subscription.id);
    setIsLoading(true);
    try {
      // Call the service to delete the subscription
      await subscriptionService.delete(subscription.id);
      console.log('Subscription service delete completed for:', subscription.id);
      
      // Notify parent component
      onDelete(subscription.id);
      console.log('Parent component notified of deletion:', subscription.id);
      
      // Close the modal
      onClose();
    } catch (error) {
      console.error('Error deleting subscription:', subscription.id, error);
      alert(`Failed to delete subscription: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Removed unused functions - editing is now handled by SubscriptionEditModal

  // handleResourceLinked removed - resource linking is now handled by SubscriptionEditModal

  if (!isOpen || !subscription) return null;

  const statusBadge = getStatusBadge(subscription.status);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100]" style={{ top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', margin: 0, padding: '16px' }}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-700 flex items-center justify-center border border-gray-600">
              {serviceLogo ? (
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
              ) : null}
              <div className={`w-full h-full flex items-center justify-center text-gray-400 ${serviceLogo ? 'hidden' : ''}`}>
                <Package className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Subscription Details
              </h2>
              <p className="text-gray-400 text-sm">
                {serviceName && serviceDuration ? formatServiceTitleWithDuration(serviceName, serviceDuration) : serviceName} • {clientName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && subscription && (
              <button
                onClick={() => onEdit(subscription)}
                className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                title="Edit subscription"
              >
                <Edit className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700/50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Status and Strategy */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${statusBadge.bgColor}`} />
                <span className={`text-sm font-medium ${statusBadge.color}`}>
                  {statusBadge.text}
                </span>
              </div>
              <p className="text-gray-400 text-sm">Status</p>
            </div>

            <div className="p-4 bg-gray-800/50 rounded-lg">
              <div className="text-white font-medium mb-2">
                {getStrategyDisplayName(subscription.strategy)}
              </div>
              <p className="text-gray-400 text-sm">Strategy</p>
            </div>

            <div className="p-4 bg-gray-800/50 rounded-lg">
              <div className="text-white font-medium mb-2">
                {subscription.isAutoRenew ? 'Auto-renew' : 'Manual'}
              </div>
              <p className="text-gray-400 text-sm">Renewal</p>
            </div>
          </div>

          {/* Timeline Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Timeline</h3>
            
            {/* Main Countdown */}
            {(subscription.nextRenewalAt || subscription.targetEndAt) && (
              <div className="p-4 bg-gradient-to-r from-blue-900/20 to-indigo-900/20 rounded-xl border border-blue-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-300 flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-blue-500" />
                    {subscription.customNextRenewalAt ? 'Custom renewal' : 
                     subscription.targetEndAt ? 'Subscription ends' : 'Next renewal'}
                  </span>
                  {(subscription.nextRenewalAt || subscription.targetEndAt) && (
                    <span className="text-xs font-medium text-blue-400 bg-blue-900/50 px-2 py-1 rounded-full">
                      {formatDate(subscription.nextRenewalAt || subscription.targetEndAt!)}
                    </span>
                  )}
                </div>
                
                <div className="text-2xl font-bold text-white mb-3 text-center">
                  {countdown}
                </div>
                
                {(subscription.nextRenewalAt || subscription.targetEndAt) && (
                  <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ease-out ${getProgressBarColor(computeRenewalProgress(subscription).pct)} shadow-sm`}
                      style={{ width: `${Math.min(computeRenewalProgress(subscription).pct, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Full Period Timeline */}
            {subscription.targetEndAt && (
              <div className="p-4 bg-gradient-to-r from-green-900/20 to-emerald-900/20 rounded-xl border border-green-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-300 flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-green-500" />
                    Full Period Timeline
                  </span>
                  <span className="text-xs font-medium text-green-400 bg-green-900/50 px-2 py-1 rounded-full">
                    {formatDate(subscription.targetEndAt)}
                  </span>
                </div>
                
                {/* Timeline Dates */}
                <div className="flex justify-between items-center mb-3 text-xs text-gray-400">
                  <div className="text-center">
                    <div className="font-medium">Start</div>
                    <div>{formatDate(subscription.startedAt)}</div>
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ease-out ${getProgressBarColor(computeCycleProgress(subscription).pct)} shadow-sm`}
                        style={{ width: `${Math.min(computeCycleProgress(subscription).pct, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">End</div>
                    <div>{formatDate(subscription.targetEndAt)}</div>
                  </div>
                </div>
                
                <div className="text-xl font-bold text-white mb-3 text-center">
                  {fullPeriodCountdown}
                </div>
                
                {/* Timeline Stats */}
                <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                  <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                    <div className="text-gray-400">Elapsed</div>
                    <div className="font-semibold text-white">
                      {(() => {
                        const now = new Date();
                        const startDate = new Date(subscription.startedAt);
                        const elapsedMs = now.getTime() - startDate.getTime();
                        return formatElapsedTime(elapsedMs);
                      })()}
                    </div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                    <div className="text-gray-400">Remaining</div>
                    <div className="font-semibold text-white">
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
                <div className="text-center">
                  <span className="text-xs font-medium text-green-400">
                    {Math.round(computeCycleProgress(subscription).pct)}% complete
                  </span>
                </div>
              </div>
            )}

            {/* No Target End Date Warning */}
            {!subscription.targetEndAt && (
              <div className="p-4 bg-yellow-900/20 border border-yellow-800 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium text-yellow-400">No Target End Date Set</span>
                </div>
                <p className="text-xs text-yellow-300">
                  This subscription doesn't have a target end date. Use the Edit button to set one and see the full period timeline.
                </p>
              </div>
            )}

            {/* Basic Timeline Info */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Started:</span>
                <span className="text-white">{formatDate(subscription.startedAt)}</span>
              </div>
              
              {subscription.nextRenewalAt && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Next Renewal:</span>
                  <span className="text-white">{formatDate(subscription.nextRenewalAt)}</span>
                </div>
              )}
              
              {subscription.targetEndAt && (
                <div className="flex justify-between">
                  <span className="text-gray-400">End Date:</span>
                  <span className="text-white">{formatDate(subscription.targetEndAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
              
              <div className="grid grid-cols-2 gap-2">
                {subscription.status === 'active' && (
                  <>
                    <button
                      onClick={handleRenew}
                      disabled={isLoading}
                      className="p-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm rounded-lg transition-colors flex items-center gap-2 justify-center"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Renew
                    </button>
                    
                    <button
                      onClick={handleComplete}
                      disabled={isLoading}
                      className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded-lg transition-colors flex items-center gap-2 justify-center"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Complete
                    </button>
                  </>
                )}
                
                {subscription.status === 'active' && (
                  <button
                    onClick={handleArchive}
                    disabled={isLoading}
                    className="p-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-600 text-white text-sm rounded-lg transition-colors flex items-center gap-2 justify-center"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-14 0h14" />
                    </svg>
                    Archive
                  </button>
                )}

                {subscription.status !== 'active' && subscription.status !== 'archived' && (
                  <button
                    onClick={handleRevert}
                    disabled={isLoading}
                    className="p-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white text-sm rounded-lg transition-colors flex items-center gap-2 justify-center"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Revert
                  </button>
                )}

                {subscription.status === 'archived' && (
                  <button
                    onClick={handleRevert}
                    disabled={isLoading}
                    className="p-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white text-sm rounded-lg transition-colors flex items-center gap-2 justify-center"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Unarchive
                  </button>
                )}

              </div>
            </div>

          {/* Subscription Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Subscription Information</h3>
            
            <div className="space-y-4">
              {/* Notes */}
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Notes
                </h4>
                <p className="text-white">
                  {subscription.notes || 'No notes provided.'}
                </p>
              </div>


              {/* Subscription Details */}
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Subscription Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Strategy:</span>
                    <span className="text-white">{getStrategyDisplayName(subscription.strategy)}</span>
                  </div>
                  {subscription.intervalDays && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Interval:</span>
                      <span className="text-white">{subscription.intervalDays} days</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Auto-renew:</span>
                    <span className="text-white">{subscription.isAutoRenew ? 'Yes' : 'No'}</span>
                  </div>
                  {subscription.targetEndAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Target End:</span>
                      <span className="text-white">{formatDate(subscription.targetEndAt)}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Show Custom Renewal Date if set */}
              {subscription.customNextRenewalAt && (
                <div className="p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-yellow-400 font-medium">📅 Custom Renewal Date Set</span>
                    <span className="text-yellow-300">
                      {formatDate(subscription.customNextRenewalAt)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Events Timeline */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Event History</h3>
            
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-4 bg-gray-800/50 rounded-lg">
                  <div className={`w-3 h-3 rounded-full mt-1 ${
                    event.type === 'renewed' ? 'bg-green-500' :
                    event.type === 'created' ? 'bg-blue-500' :
                    event.type === 'completed' ? 'bg-blue-500' :
                    event.type === 'overdue' ? 'bg-red-500' :
                    event.type === 'custom_date_set' ? 'bg-purple-500' :
                    event.type === 'archived' ? 'bg-gray-500' :
                    event.type === 'reverted' ? 'bg-orange-500' :
                    'bg-gray-500'
                  }`} />
                  <div className="flex-1">
                    <div className="text-white font-medium capitalize">
                      {event.type === 'renewed' ? `Renewal #${event.meta?.renewalNumber || 'N/A'}` : 
                       event.type.replace('_', ' ')}
                    </div>
                    <div className="text-gray-400 text-sm">
                      {formatDate(event.at)}
                    </div>
                    
                    {/* Show detailed info for renewal events */}
                    {event.type === 'renewed' && event.meta && (
                      <div className="mt-2 space-y-1 text-xs text-gray-300">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-gray-400">Renewal Date:</span>
                            <div className="font-medium">{formatDate(event.meta.renewalDate || event.at)}</div>
                          </div>
                          <div>
                            <span className="text-gray-400">Next Renewal:</span>
                            <div className="font-medium">
                              {event.meta.nextRenewalDate ? formatDate(event.meta.nextRenewalDate) : 'Not set'}
                            </div>
                          </div>
                        </div>
                        {event.meta.intervalDays && (
                          <div>
                            <span className="text-gray-400">Interval:</span>
                            <span className="font-medium ml-1">{event.meta.intervalDays} days</span>
                          </div>
                        )}
                        {event.meta.strategy && (
                          <div>
                            <span className="text-gray-400">Strategy:</span>
                            <span className="font-medium ml-1">{event.meta.strategy}</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Show info for custom date events */}
                    {event.type === 'custom_date_set' && event.meta && (
                      <div className="mt-2 text-xs text-gray-300">
                        <div>
                          <span className="text-gray-400">Custom Date:</span>
                          <span className="font-medium ml-1">
                            {event.meta.customDate ? formatDate(event.meta.customDate) : 'Not set'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Show info for archived events */}
                    {event.type === 'archived' && event.meta && (
                      <div className="mt-2 text-xs text-gray-300">
                        <div>
                          <span className="text-gray-400">Previous Status:</span>
                          <span className="font-medium ml-1 capitalize">
                            {event.meta.previousStatus || 'Unknown'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Archived At:</span>
                          <span className="font-medium ml-1">
                            {event.meta.archivedAt ? formatDate(event.meta.archivedAt) : formatDate(event.at)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteEvent(event.id)}
                    disabled={isLoading}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete event"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              
              {events.length === 0 && (
                <div className="p-4 bg-gray-800/50 rounded-lg text-center text-gray-400">
                  No events recorded yet.
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              onClick={handleDelete}
              disabled={isLoading}
              className="px-4 py-3 bg-red-800 hover:bg-red-900 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors duration-200 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
            <button
              onClick={onClose}
              className="ml-auto px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors duration-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
