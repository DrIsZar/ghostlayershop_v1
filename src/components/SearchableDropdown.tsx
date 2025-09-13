import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface SearchableDropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SearchableDropdownProps {
  options: SearchableDropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  error?: string;
  showSearchThreshold?: number; // Show search when options exceed this number
  emptyMessage?: string;
  noResultsMessage?: string;
  allowClear?: boolean;
  onClear?: () => void;
  icon?: React.ReactNode;
  'data-testid'?: string;
}

export default function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  searchPlaceholder = "Search options...",
  className = "",
  disabled = false,
  required = false,
  label,
  error,
  showSearchThreshold = 5,
  emptyMessage = "No options available",
  noResultsMessage = "No options found",
  allowClear = false,
  onClear,
  icon,
  'data-testid': dataTestId
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  // Find selected option
  const selectedOption = options.find(option => option.value === value);
  

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    
    const searchLower = searchTerm.toLowerCase();
    return options.filter(option => 
      option.label.toLowerCase().includes(searchLower)
    );
  }, [options, searchTerm]);

  // Determine if search should be shown
  const showSearch = options.length > showSearchThreshold;

  // Calculate dropdown position
  const calculatePosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Mobile-specific positioning
      const isMobile = viewportWidth <= 640; // sm breakpoint
      
      let top = rect.bottom + window.scrollY + 4;
      let left = rect.left + window.scrollX;
      let width = rect.width;
      
      if (isMobile) {
        // On mobile, ensure dropdown doesn't go off-screen
        const maxHeight = viewportHeight - rect.bottom - 20; // 20px margin from bottom
        const dropdownHeight = Math.min(256, maxHeight); // max-h-64 = 256px
        
        // If dropdown would go off-screen, position it above the input
        if (maxHeight < 200) {
          top = rect.top + window.scrollY - dropdownHeight - 4;
        }
        
        // Ensure dropdown doesn't go off the sides
        const minLeft = 8; // 8px margin from left edge
        const maxLeft = viewportWidth - width - 8; // 8px margin from right edge
        
        if (left < minLeft) {
          left = minLeft;
        } else if (left > maxLeft) {
          left = maxLeft;
        }
        
        // On very small screens, make dropdown full width with margins
        if (viewportWidth < 400) {
          left = 8;
          width = viewportWidth - 16;
        }
      }
      
      const position = { top, left, width };
      setDropdownPosition(position);
    }
  };

  // Handle opening dropdown
  const handleOpen = () => {
    if (disabled) return;
    setIsOpen(true);
    setSearchTerm('');
    setHighlightedIndex(-1);
    calculatePosition();
  };

  // Handle closing dropdown
  const handleClose = () => {
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  };

  // Handle option selection
  const handleSelect = (option: SearchableDropdownOption, e?: React.MouseEvent) => {
    if (option.disabled) return;
    e?.stopPropagation();
    onChange(option.value);
    // Add a small delay before closing to ensure the click event is processed
    setTimeout(() => {
      handleClose();
    }, 10);
  };

  // Handle clear
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    if (onClear) onClear();
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleOpen();
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        handleClose();
        inputRef.current?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case 'Tab':
        handleClose();
        break;
    }
  };

  // Handle search input key events
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
    }
  };

  // Update highlighted index when filtered options change
  useEffect(() => {
    if (highlightedIndex >= filteredOptions.length) {
      setHighlightedIndex(-1);
    }
  }, [filteredOptions.length, highlightedIndex]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && showSearch && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [isOpen, showSearch]);

  // Handle clicks outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideDropdown = dropdownRef.current?.contains(target);
      const isInsidePortal = document.querySelector('[data-dropdown-portal]')?.contains(target);
      
      if (!isInsideDropdown && !isInsidePortal) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle window resize/scroll
  useEffect(() => {
    if (isOpen) {
      const handleResize = () => calculatePosition();
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleResize, true);
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleResize, true);
      };
    }
  }, [isOpen]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-1">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}

      {/* Input */}
      <div className="relative cursor-pointer" onClick={handleOpen}>
        <input
          ref={inputRef}
          type="text"
          value={selectedOption?.label || ''}
          placeholder={placeholder}
          readOnly
          disabled={disabled}
          onKeyDown={handleKeyDown}
          className={`
            w-full py-3 pr-8 bg-gray-800 border border-gray-600 rounded-lg text-base min-h-[44px]
            ${icon ? 'pl-10' : 'pl-3'}
            focus:outline-none focus:border-green-500
            disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed
            ${error ? 'border-red-500' : ''}
            ${selectedOption ? 'text-white' : 'text-gray-400'}
          `}
          data-testid={dataTestId}
        />
        
        {/* Icon */}
        {icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}

        {/* Clear button */}
        {allowClear && value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Dropdown arrow */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-400">{error}</p>
      )}

      {/* Dropdown Portal */}
      {isOpen && createPortal(
        <div
          data-dropdown-portal
          className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-[60] max-h-64 overflow-hidden sm:max-h-64"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            maxHeight: window.innerWidth <= 640 ? 'min(256px, calc(100vh - 100px))' : '256px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
            {/* Search input */}
            {showSearch && (
              <div className="p-2 border-b border-gray-600">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder={searchPlaceholder}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-base min-h-[44px] focus:outline-none focus:border-green-500"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      aria-label="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Options list */}
            <div className="max-h-48 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-400 text-center">
                  {options.length === 0 ? emptyMessage : noResultsMessage}
                </div>
              ) : (
                filteredOptions.map((option, index) => (
                  <div
                    key={option.value}
                    className={`
                      px-3 py-3 text-base cursor-pointer transition-colors min-h-[48px] sm:min-h-[44px] flex items-center
                      ${index === highlightedIndex ? 'bg-gray-700' : 'hover:bg-gray-700'}
                      ${option.disabled ? 'text-gray-500 cursor-not-allowed' : 'text-white'}
                      ${option.value === value ? 'bg-green-900/30 text-green-400' : ''}
                      active:bg-gray-600
                    `}
                    onMouseUp={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelect(option, e);
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onTouchStart={() => setHighlightedIndex(index)}
                  >
                    {option.label}
                  </div>
                ))
              )}
            </div>
        </div>,
        document.body
      )}
    </div>
  );
}
