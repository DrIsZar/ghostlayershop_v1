import { UploadedFile } from './types';
import { supabase } from './supabase';
import { SERVICE_PROVISIONING } from '../constants/provisioning';

/**
 * Upload a service logo and store it by service name (not individual service ID)
 * This ensures all duration variants of the same service share the same logo
 */
export const uploadServiceLogo = async (file: File, serviceName: string): Promise<UploadedFile> => {
  // Create a unique key based on service name (not individual service ID)
  const logoKey = `service_logo_${serviceName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  
  // Create blob URL for immediate use
  const blobUrl = URL.createObjectURL(file);
  
  // Store file info in localStorage
  const uploadedFile: UploadedFile = {
    name: file.name,
    url: blobUrl,
    size: file.size,
    type: file.type,
    timestamp: Date.now()
  };
  
  localStorage.setItem(logoKey, JSON.stringify(uploadedFile));
  
  return uploadedFile;
};

/**
 * Migrate existing database logos to the new service name-based system
 * This ensures existing logos are visible in the new unified system
 */
export const migrateExistingLogos = (services: Array<{ product_service: string; logo_url?: string }>): void => {
  services.forEach(service => {
    if (service.logo_url && service.product_service) {
      const logoKey = `service_logo_${service.product_service.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      
      // Check if we already have a logo for this service
      const existing = localStorage.getItem(logoKey);
      if (!existing) {
        // Migrate the existing logo to the new system
        const migratedLogo = {
          name: 'Migrated Logo',
          url: service.logo_url,
          size: 0,
          type: 'image/migrated',
          timestamp: Date.now()
        };
        
        localStorage.setItem(logoKey, JSON.stringify(migratedLogo));
        console.log(`Migrated logo for service: ${service.product_service}`);
      }
    }
  });
};

/**
 * Get a service logo by service name
 * Returns the logo for any duration variant of the same service
 */
export const getServiceLogo = (serviceName: string): string | null => {
  const logoKey = `service_logo_${serviceName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const stored = localStorage.getItem(logoKey);
  
  if (stored) {
    try {
      const fileInfo: UploadedFile = JSON.parse(stored);
      return fileInfo.url;
    } catch (error) {
      console.error('Error parsing stored logo:', error);
      return null;
    }
  }
  
  return null;
};

/**
 * Convert provider key (e.g., "microsoft_365") to service name format (e.g., "Microsoft 365")
 * This maps inventory provider keys to the service names used in the services table
 */
export const providerKeyToServiceName = (providerKey: string): string => {
  const providerMap: Record<string, string> = {
    'adobe': 'Adobe',
    'acrobat': 'Acrobat',
    'apple_one': 'Apple One',
    'apple_music': 'Apple Music',
    'canva': 'Canva',
    'chatgpt': 'ChatGPT',
    'duolingo': 'Duolingo',
    'icloud': 'iCloud',
    'lastpass': 'LastPass',
    'microsoft_365': 'Microsoft 365',
    'netflix': 'Netflix',
    'spotify': 'Spotify',
    'workspace': 'Workspace',
    'google_workspace': 'Google Workspace',
  };
  
  return providerMap[providerKey.toLowerCase()] || providerKey.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

/**
 * Get service logo by provider key
 * Tries multiple variations to find the logo, and also checks all localStorage keys
 */
export const getProviderLogo = (providerKey: string): string | null => {
  if (!providerKey) return null;
  
  // Try multiple variations of the service name
  const variations = [
    // 1. Mapped service name (e.g., "Microsoft 365")
    providerKeyToServiceName(providerKey),
    // 2. Provider key as-is (e.g., "microsoft_365")
    providerKey,
    // 3. Provider key with spaces instead of underscores (e.g., "microsoft 365")
    providerKey.replace(/_/g, ' '),
    // 4. Capitalized provider key (e.g., "Microsoft_365")
    providerKey.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('_'),
    // 5. Title case with spaces (e.g., "Microsoft 365")
    providerKey.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
    // 6. All lowercase (e.g., "microsoft 365")
    providerKey.toLowerCase().replace(/_/g, ' '),
    // 7. All uppercase (e.g., "MICROSOFT 365")
    providerKey.toUpperCase().replace(/_/g, ' '),
  ];
  
  // Remove duplicates
  const uniqueVariations = Array.from(new Set(variations));
  
  // Try each variation
  for (const variation of uniqueVariations) {
    const logo = getServiceLogo(variation);
    if (logo) {
      return logo;
    }
  }
  
  // If still not found, try to find by checking all localStorage keys
  // This handles cases where service names might be slightly different
  try {
    const normalizedProviderKey = providerKey.toLowerCase().replace(/[^a-z0-9]/g, '_');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('service_logo_')) {
        const serviceNameFromKey = key.replace('service_logo_', '').replace(/_/g, ' ');
        const normalizedServiceName = serviceNameFromKey.toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        // Check if the normalized keys match
        if (normalizedServiceName === normalizedProviderKey || 
            normalizedServiceName.includes(normalizedProviderKey) ||
            normalizedProviderKey.includes(normalizedServiceName)) {
          const stored = localStorage.getItem(key);
          if (stored) {
            try {
              const fileInfo: UploadedFile = JSON.parse(stored);
              if (fileInfo.url) {
                return fileInfo.url;
              }
            } catch (error) {
              console.error('Error parsing stored logo:', error);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error searching localStorage for logo:', error);
  }
  
  return null;
};

/**
 * Get all unique service names from the database
 * This helps with logo lookup when provider keys don't match service names exactly
 */
let cachedServiceNames: string[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getServiceNamesFromDB = async (): Promise<string[]> => {
  const now = Date.now();
  
  // Return cached data if still valid
  if (cachedServiceNames && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedServiceNames;
  }
  
  try {
    const { data, error } = await supabase
      .from('services')
      .select('product_service')
      .order('product_service');
    
    if (error) {
      console.error('Error fetching service names:', error);
      return cachedServiceNames || [];
    }
    
    // Get unique service names
    const uniqueNames = Array.from(new Set((data || []).map(s => s.product_service).filter(Boolean)));
    cachedServiceNames = uniqueNames;
    cacheTimestamp = now;
    
    return uniqueNames;
  } catch (error) {
    console.error('Error fetching service names:', error);
    return cachedServiceNames || [];
  }
};

/**
 * Map service name to provider key
 * This maps service names from the database to provider keys used in pools
 */
const serviceNameToProviderKey = (serviceName: string): string | null => {
  const serviceNameLower = serviceName.toLowerCase();
  const providerMap: Record<string, string> = {
    'adobe': 'adobe',
    'acrobat': 'acrobat',
    'apple one': 'apple_one',
    'apple music': 'apple_music',
    'canva': 'canva',
    'chatgpt': 'chatgpt',
    'duolingo': 'duolingo',
    'icloud': 'icloud',
    'lastpass': 'lastpass',
    'microsoft 365': 'microsoft_365',
    'netflix': 'netflix',
    'spotify': 'spotify',
    'workspace': 'workspace',
    'google workspace': 'google_workspace',
  };
  
  // Try exact match first
  for (const [key, provider] of Object.entries(providerMap)) {
    if (serviceNameLower.includes(key)) {
      return provider;
    }
  }
  
  // Try to convert service name to provider key format
  return serviceNameLower.replace(/\s+/g, '_');
};

/**
 * Get providers filtered by service type
 * Returns provider keys that match services with the specified service_type
 */
let cachedProvidersByType: Record<string, string[]> | null = null;
let cachedProvidersTimestamp: number = 0;

export const getProvidersByServiceType = async (serviceType: 'personal_upgrade' | 'family_invite'): Promise<string[]> => {
  const now = Date.now();
  const cacheKey = serviceType;
  
  // Return cached data if still valid
  if (cachedProvidersByType && (now - cachedProvidersTimestamp) < CACHE_DURATION) {
    if (cachedProvidersByType[cacheKey]) {
      return cachedProvidersByType[cacheKey];
    }
  }
  
  try {
    // First check if any services have types set
    const { data: allServices, error: allError } = await supabase
      .from('services')
      .select('service_type')
      .limit(1);
    
    if (allError) {
      console.error('Error checking services:', allError);
      // Fallback to all providers if database query fails
      return Object.keys(SERVICE_PROVISIONING).filter(p => SERVICE_PROVISIONING[p] !== null);
    }
    
    // Check if any services have service_type set
    const hasAnyTypes = allServices && allServices.some(s => s.service_type !== null);
    
    // If no services have types set yet, show all providers (backwards compatibility)
    if (!hasAnyTypes) {
      const allProviders = Object.keys(SERVICE_PROVISIONING).filter(p => SERVICE_PROVISIONING[p] !== null);
      if (!cachedProvidersByType) {
        cachedProvidersByType = {};
      }
      cachedProvidersByType[cacheKey] = allProviders;
      cachedProvidersTimestamp = now;
      return allProviders;
    }
    
    // Get services with the specified type
    const { data, error } = await supabase
      .from('services')
      .select('product_service, service_type')
      .eq('service_type', serviceType);
    
    if (error) {
      console.error('Error fetching services by type:', error);
      // Fallback to all providers if database query fails
      return Object.keys(SERVICE_PROVISIONING).filter(p => SERVICE_PROVISIONING[p] !== null);
    }
    
    // Map service names to provider keys
    const providers = (data || [])
      .map(service => serviceNameToProviderKey(service.product_service))
      .filter((provider): provider is string => provider !== null && SERVICE_PROVISIONING[provider] !== null)
      .filter((provider, index, self) => self.indexOf(provider) === index); // Remove duplicates
    
    // Cache the result
    if (!cachedProvidersByType) {
      cachedProvidersByType = {};
    }
    cachedProvidersByType[cacheKey] = providers;
    cachedProvidersTimestamp = now;
    
    return providers;
  } catch (error) {
    console.error('Error fetching providers by service type:', error);
    // Fallback to all providers if there's an error
    return Object.keys(SERVICE_PROVISIONING).filter(p => SERVICE_PROVISIONING[p] !== null);
  }
};

/**
 * Get service logo by provider key with database lookup
 * This is the main function to use - it tries multiple strategies to find the logo
 */
export const getProviderLogoAsync = async (providerKey: string): Promise<string | null> => {
  if (!providerKey) return null;
  
  // First try the synchronous method
  const syncLogo = getProviderLogo(providerKey);
  if (syncLogo) return syncLogo;
  
  // If not found, try with actual service names from database
  try {
    const serviceNames = await getServiceNamesFromDB();
    const normalizedProviderKey = providerKey.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    // Find matching service names
    for (const serviceName of serviceNames) {
      const normalizedServiceName = serviceName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      // Check if they match (exact or partial)
      if (normalizedServiceName === normalizedProviderKey ||
          normalizedServiceName.includes(normalizedProviderKey) ||
          normalizedProviderKey.includes(normalizedServiceName)) {
        const logo = getServiceLogo(serviceName);
        if (logo) return logo;
      }
    }
  } catch (error) {
    console.error('Error in async logo lookup:', error);
  }
  
  return null;
};

/**
 * Remove a service logo by service name
 * This removes the logo for all duration variants of the service
 */
export const removeServiceLogo = (serviceName: string): void => {
  const logoKey = `service_logo_${serviceName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const stored = localStorage.getItem(logoKey);
  
  if (stored) {
    try {
      const fileInfo: UploadedFile = JSON.parse(stored);
      // Revoke blob URL to free memory
      URL.revokeObjectURL(fileInfo.url);
    } catch (error) {
      console.error('Error parsing stored logo for removal:', error);
    }
  }
  
  localStorage.removeItem(logoKey);
};

/**
 * Update service logo when service name changes
 * This ensures the logo follows the service if it's renamed
 */
export const updateServiceLogoName = (oldServiceName: string, newServiceName: string): void => {
  const oldLogoKey = `service_logo_${oldServiceName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const newLogoKey = `service_logo_${newServiceName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  
  const stored = localStorage.getItem(oldLogoKey);
  if (stored) {
    localStorage.setItem(newLogoKey, stored);
    localStorage.removeItem(oldLogoKey);
  }
};

/**
 * Get all service logos stored in localStorage
 * Useful for debugging and cleanup
 */
export const getAllServiceLogos = (): Record<string, UploadedFile> => {
  const logos: Record<string, UploadedFile> = {};
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('service_logo_')) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const fileInfo: UploadedFile = JSON.parse(stored);
          logos[key] = fileInfo;
        }
      } catch (error) {
        console.error(`Error parsing logo for key ${key}:`, error);
      }
    }
  }
  
  return logos;
};

/**
 * Debug function to help troubleshoot logo lookup
 * Call this from browser console: window.debugLogoLookup('microsoft_365')
 */
export const debugLogoLookup = (providerKey: string) => {
  console.log('=== Logo Lookup Debug ===');
  console.log('Provider Key:', providerKey);
  
  const allLogos = getAllServiceLogos();
  console.log('All available logos:', Object.keys(allLogos));
  
  const normalizedProviderKey = providerKey.toLowerCase().replace(/[^a-z0-9]/g, '_');
  console.log('Normalized provider key:', normalizedProviderKey);
  
  const variations = [
    providerKeyToServiceName(providerKey),
    providerKey,
    providerKey.replace(/_/g, ' '),
    providerKey.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('_'),
    providerKey.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
    providerKey.toLowerCase().replace(/_/g, ' '),
    providerKey.toUpperCase().replace(/_/g, ' '),
  ];
  
  console.log('Trying variations:', variations);
  
  for (const variation of variations) {
    const logoKey = `service_logo_${variation.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    console.log(`Checking: "${variation}" -> key: "${logoKey}"`);
    const logo = getServiceLogo(variation);
    if (logo) {
      console.log('✓ Found logo for:', variation, logo);
      return logo;
    }
  }
  
  // Check all localStorage keys
  console.log('Searching all localStorage keys...');
  for (const [key, fileInfo] of Object.entries(allLogos)) {
    const serviceNameFromKey = key.replace('service_logo_', '').replace(/_/g, ' ');
    const normalizedServiceName = serviceNameFromKey.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    if (normalizedServiceName === normalizedProviderKey || 
        normalizedServiceName.includes(normalizedProviderKey) ||
        normalizedProviderKey.includes(normalizedServiceName)) {
      console.log('✓ Potential match found:', key, '->', serviceNameFromKey, fileInfo.url);
    }
  }
  
  console.log('=== End Debug ===');
  return null;
};

// Make debug function available globally
if (typeof window !== 'undefined') {
  (window as any).debugLogoLookup = debugLogoLookup;
  (window as any).getAllServiceLogos = getAllServiceLogos;
}

/**
 * Clean up old blob URLs to prevent memory leaks
 * Should be called periodically or when the app starts
 */
export const cleanupUnusedBlobUrls = (): void => {
  const currentTime = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('service_logo_')) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const fileInfo: UploadedFile = JSON.parse(stored);
          
          // Remove old blob URLs
          if (currentTime - fileInfo.timestamp > maxAge) {
            URL.revokeObjectURL(fileInfo.url);
            localStorage.removeItem(key);
          }
        }
      } catch (error) {
        console.error(`Error cleaning up logo for key ${key}:`, error);
        // Remove corrupted entries
        localStorage.removeItem(key);
      }
    }
  }
};

/**
 * Validate logo file format and size
 */
export const validateLogoFile = (file: File): boolean => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  if (!validTypes.includes(file.type)) {
    alert('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
    return false;
  }
  
  if (file.size > maxSize) {
    alert('File size must be less than 5MB');
    return false;
  }
  
  return true;
};
