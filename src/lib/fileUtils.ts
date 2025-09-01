import { UploadedFile } from './types';

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
