import React, { useState, useEffect } from 'react';
import { PersonalAccount } from '../types/inventory';
import { PROVIDER_ICONS } from '../constants/provisioning';
import { Edit, Trash2, Eye, Calendar, Mail, AlertCircle, Copy, Image } from 'lucide-react';
import { copyToClipboard } from '../lib/toast';
import { getProviderLogo, getProviderLogoAsync } from '../lib/fileUtils';

interface PersonalAccountCardProps {
  account: PersonalAccount;
  onView: (account: PersonalAccount) => void;
  onEdit: (account: PersonalAccount) => void;
  onDelete: (accountId: string) => void;
}

export function PersonalAccountCard({ account, onView, onEdit, onDelete }: PersonalAccountCardProps) {
  const [showSecret, setShowSecret] = useState(false);
  const [providerLogo, setProviderLogo] = useState<string | null>(null);

  useEffect(() => {
    // Try to get logo synchronously first
    const logo = getProviderLogo(account.provider);
    setProviderLogo(logo);
    
    // If not found, try async lookup
    if (!logo) {
      getProviderLogoAsync(account.provider).then(setProviderLogo).catch(() => {});
    }
    
    // Listen for logo updates
    const handleLogoUpdate = () => {
      const newLogo = getProviderLogo(account.provider);
      if (newLogo) setProviderLogo(newLogo);
    };
    
    window.addEventListener('logoUpdated', handleLogoUpdate);
    window.addEventListener('storage', handleLogoUpdate);
    
    return () => {
      window.removeEventListener('logoUpdated', handleLogoUpdate);
      window.removeEventListener('storage', handleLogoUpdate);
    };
  }, [account.provider]);

  const isExpired = account.expiry_date && new Date(account.expiry_date) < new Date();
  const isExpiringSoon = account.expiry_date && 
    new Date(account.expiry_date) > new Date() && 
    new Date(account.expiry_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const getStatusColor = () => {
    switch (account.status) {
      case 'available':
        return 'bg-white/10 text-white border-white/30';
      case 'assigned':
        return 'bg-white/20 text-white border-white/30';
      case 'expired':
        return 'bg-red-500/20 text-red-500 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-500 border-gray-500/30';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleCopy = async (text: string, type: 'email' | 'password') => {
    const message = type === 'email' ? 'Email copied to clipboard' : 'Password copied to clipboard';
    await copyToClipboard(text, message);
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gray-700 rounded-xl overflow-hidden flex items-center justify-center">
            {providerLogo ? (
              <img 
                src={providerLogo} 
                alt={`${account.provider} logo`} 
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.classList.remove('hidden');
                  setProviderLogo(null);
                }}
              />
            ) : null}
            <div className={`w-full h-full flex items-center justify-center text-2xl ${providerLogo ? 'hidden' : ''}`}>
              {PROVIDER_ICONS[account.provider] || '📦'}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white capitalize">
              {account.provider.replace('_', ' ')}
            </h3>
            <p className="text-sm text-gray-400 flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {account.login_email}
            </p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getStatusColor()}`}>
          {account.status}
        </span>
      </div>

      {account.expiry_date && (
        <div className={`mb-4 p-3 rounded-lg ${
          isExpired ? 'bg-red-500/10 border border-red-500/20' :
          isExpiringSoon ? 'bg-amber-500/10 border border-amber-500/20' :
          'bg-gray-700/50'
        }`}>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className={`w-4 h-4 ${
              isExpired ? 'text-red-500' :
              isExpiringSoon ? 'text-amber-500' :
              'text-gray-400'
            }`} />
            <span className={isExpired ? 'text-red-400' : isExpiringSoon ? 'text-amber-400' : 'text-gray-300'}>
              Expires: {formatDate(account.expiry_date)}
            </span>
            {isExpired && <AlertCircle className="w-4 h-4 text-red-500" />}
            {isExpiringSoon && !isExpired && <AlertCircle className="w-4 h-4 text-amber-500" />}
          </div>
        </div>
      )}

      {/* Login Info */}
      <div className="mb-4 p-3 bg-gray-800/50 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-400">Email:</span>
          <span className="text-xs text-white font-mono flex-1 truncate">{account.login_email}</span>
          <button
            onClick={() => handleCopy(account.login_email, 'email')}
            className="p-1 text-gray-400 hover:text-white transition-colors"
            aria-label="Copy email"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
        
        {account.login_secret && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Password:</span>
            <span className="text-xs text-white font-mono flex-1 truncate">
              {showSecret ? account.login_secret : '••••••••'}
            </span>
            <button
              onClick={() => setShowSecret(!showSecret)}
              className="p-1 text-gray-400 hover:text-white transition-colors"
              aria-label="Toggle password visibility"
            >
              <Eye className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleCopy(account.login_secret || '', 'password')}
              className="p-1 text-gray-400 hover:text-white transition-colors"
              aria-label="Copy password"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {account.notes && (
        <p className="text-sm text-gray-400 mb-4 line-clamp-2">{account.notes}</p>
      )}

      <div className="text-xs text-gray-500 mb-4">
        Created: {formatDate(account.created_at)}
      </div>

      <div className="flex gap-2 pt-4 border-t border-gray-700">
        <button
          onClick={() => onView(account)}
          className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Eye className="w-4 h-4" />
          View
        </button>
        <button
          onClick={() => onEdit(account)}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          title="Edit"
        >
          <Edit className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            if (confirm('Are you sure you want to delete this personal account?')) {
              onDelete(account.id);
            }
          }}
          className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

