// Toast utility for mobile notifications
interface ToastOptions {
  duration?: number;
  type?: 'success' | 'error' | 'info';
}

class ToastManager {
  private queue: Array<{ msg: string; opts: ToastOptions }> = [];
  private showing = false;

  show(msg: string, opts: ToastOptions = {}) {
    this.queue.push({ msg, opts });
    if (!this.showing) {
      this.showNext();
    }
  }

  private showNext() {
    if (!this.queue.length) {
      this.showing = false;
      return;
    }
    
    this.showing = true;
    const { msg, opts } = this.queue.shift()!;
    const container = document.getElementById('toast-container');
    
    if (!container) {
      console.warn('Toast container not found');
      this.showing = false;
      return;
    }

    const el = document.createElement('div');
    el.className = 'toast';
    el.role = 'status';
    el.textContent = msg;
    
    // Add type-specific styling
    if (opts.type === 'error') {
      el.style.background = 'rgba(239, 68, 68, 0.9)';
    } else if (opts.type === 'success') {
      el.style.background = 'rgba(34, 197, 94, 0.9)';
    } else if (opts.type === 'info') {
      el.style.background = 'rgba(59, 130, 246, 0.9)';
    }
    
    container.appendChild(el);
    
    const duration = opts.duration || 2200;
    setTimeout(() => {
      el.remove();
      this.showNext();
    }, duration);
  }
}

// Global toast instance
export const toast = new ToastManager();

// Copy to clipboard utility with fallback
export async function copyToClipboard(text: string, customMessage?: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      toast.show(customMessage || 'Copied to clipboard', { type: 'success' });
      return true;
    } else {
      // Fallback for older browsers or non-secure contexts
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        toast.show(customMessage || 'Copied to clipboard', { type: 'success' });
        return true;
      } else {
        throw new Error('Copy command failed');
      }
    }
  } catch (error) {
    console.error('Failed to copy text: ', error);
    toast.show('Failed to copy', { type: 'error' });
    return false;
  }
}

// Save handler utility
export async function saveData(payload: any, endpoint: string = '/api/save'): Promise<any> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Save failed: ${response.statusText}`);
    }

    toast.show('Saved successfully', { type: 'success' });
    return await response.json();
  } catch (error) {
    console.error('Save failed:', error);
    toast.show('Save failed — try again', { type: 'error' });
    throw error;
  }
}

// Initialize copy handlers for elements with data-copy attribute
export function initializeCopyHandlers() {
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-copy');
      if (text) {
        copyToClipboard(text);
      }
    });
  });
}

// Initialize on DOM ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCopyHandlers);
  } else {
    initializeCopyHandlers();
  }
}
