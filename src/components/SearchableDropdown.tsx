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

const SearchableDropdown = React.memo(function SearchableDropdown({
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

  // Calculate dropdown position with improved modal and mobile handling
  const calculatePosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Check if we're inside a modal
      const modalElement = inputRef.current.closest('[role="dialog"], .modal, [data-modal]');
      const isInModal = !!modalElement;

      // Mobile-specific positioning
      const isMobile = viewportWidth <= 768; // md breakpoint

      let top = rect.bottom + 8; // Use viewport coordinates for better modal support
      let left = rect.left;
      let width = rect.width;

      if (isMobile) {
        // On mobile, use full width with margins for better usability
        left = 16;
        width = viewportWidth - 32;

        // Check if dropdown would go off-screen vertically
        const dropdownHeight = Math.min(320, viewportHeight * 0.6); // Max 60% of viewport height
        const maxHeight = viewportHeight - rect.bottom - 40; // 40px margin from bottom

        // If dropdown would go off-screen, position it above the input
        if (maxHeight < 200) {
          top = rect.top - dropdownHeight - 8;
        }
      } else {
        // Desktop: ensure dropdown doesn't go off the sides
        const minLeft = 16;
        const maxLeft = viewportWidth - width - 16;

        if (left < minLeft) {
          left = minLeft;
        } else if (left > maxLeft) {
          left = maxLeft;
        }

        // For modals, check if dropdown would go off-screen vertically
        if (isInModal) {
          const dropdownHeight = 360; // Max dropdown height (increased for better scrolling)
          const maxHeight = viewportHeight - rect.bottom - 40; // 40px margin from bottom

          // If dropdown would go off-screen, position it above the input
          if (maxHeight < 200) {
            top = rect.top - dropdownHeight - 8;
          }
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
      case 'Escape':
        handleClose();
        inputRef.current?.focus();
        break;
    }
  };

  // Update highlighted index when filtered options change
  useEffect(() => {
    if (highlightedIndex >= filteredOptions.length) {
      setHighlightedIndex(-1);
    }
  }, [filteredOptions.length, highlightedIndex]);

  // Auto-scroll to highlighted option
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0) {
      const optionElement = document.querySelector(`[data-dropdown-portal] [role="option"]:nth-child(${highlightedIndex + 1})`);
      if (optionElement) {
        optionElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [highlightedIndex, isOpen]);

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
      {/* Enhanced Label with consistent styling */}
      {label && (
        <label
          className="block text-sm font-medium text-muted-foreground mb-2"
          htmlFor={dataTestId}
        >
          {label}
          {required && <span className="text-destructive ml-1" aria-label="required">*</span>}
        </label>
      )}

      {/* Enhanced Input Container */}
      <div
        className="relative cursor-pointer"
        onClick={handleOpen}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-labelledby={label ? `${dataTestId}-label` : undefined}
        aria-describedby={error ? `${dataTestId}-error` : undefined}
      >
        <input
          ref={inputRef}
          id={dataTestId}
          type="text"
          value={selectedOption?.label || ''}
          placeholder={placeholder}
          readOnly
          disabled={disabled}
          onKeyDown={handleKeyDown}
          className={`
            w-full py-3 pr-10 bg-secondary border border-border rounded-lg text-base min-h-[48px]
            transition-all duration-200 ease-in-out
            ${icon ? 'pl-10' : 'pl-4'}
            focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20
            disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed
            disabled:border-muted
            ${error ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : ''}
            ${selectedOption ? 'text-foreground' : 'text-muted-foreground'}
            hover:border-muted-foreground/50 hover:bg-secondary/80
            ${isOpen ? 'border-ring ring-2 ring-ring/20' : ''}
          `}
          data-testid={dataTestId}
          aria-autocomplete="list"
          aria-controls={isOpen ? `${dataTestId}-listbox` : undefined}
        />

        {/* Icon */}
        {icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none">
            {icon}
          </div>
        )}

        {/* Clear button with improved accessibility */}
        {allowClear && value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-10 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary min-h-[32px] min-w-[32px] flex items-center justify-center"
            aria-label="Clear selection"
            tabIndex={-1}
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Enhanced Dropdown arrow */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <ChevronDown
            className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''
              }`}
          />
        </div>
      </div>

      {/* Enhanced Error message */}
      {error && (
        <p id={`${dataTestId}-error`} className="mt-2 text-sm text-destructive flex items-center gap-1">
          <span className="w-1 h-1 bg-destructive rounded-full"></span>
          {error}
        </p>
      )}

      {/* Enhanced Dropdown Portal */}
      {isOpen && createPortal(
        <div
          data-dropdown-portal
          className={`
            fixed bg-card border border-border rounded-xl shadow-2xl backdrop-blur-sm
            transition-all duration-200 ease-out
            ${window.innerWidth <= 768 ? 'max-h-[60vh]' : 'max-h-[360px]'}
          `}
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 999999, // Higher z-index to ensure it appears above modals
          }}
          onClick={(e) => e.stopPropagation()}
          role="listbox"
          id={`${dataTestId}-listbox`}
          aria-label={`${label || 'Options'} dropdown`}
        >
          {/* Enhanced Search input */}
          {showSearch && (
            <div className="p-3 border-b border-border/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 z-10" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full pl-10 pr-10 py-3 bg-secondary border border-border rounded-lg text-foreground text-base min-h-[44px] focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all duration-200"
                  aria-label="Search options"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary min-h-[32px] min-w-[32px] flex items-center justify-center transition-colors"
                    aria-label="Clear search"
                    tabIndex={-1}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Enhanced Options list */}
          <div
            className="overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground scrollbar-track-secondary py-2"
            style={{
              maxHeight: window.innerWidth <= 768 ? 'calc(60vh - 80px)' : '280px'
            }}
          >
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <div className="text-muted-foreground text-sm mb-2">
                  {options.length === 0 ? emptyMessage : noResultsMessage}
                </div>
                {options.length === 0 && (
                  <div className="text-xs text-muted-foreground/70">
                    No options are currently available
                  </div>
                )}
              </div>
            ) : (
              filteredOptions.map((option, index) => (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={option.value === value}
                  className={`
                    px-4 py-3 text-base cursor-pointer transition-all duration-200 min-h-[48px] flex items-center
                    relative group
                    ${index === highlightedIndex ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-secondary hover:text-foreground'}
                    ${option.disabled ? 'text-muted-foreground cursor-not-allowed opacity-60' : 'text-foreground'}
                    ${option.value === value ? 'bg-primary/10 text-foreground border-l-4 border-primary' : ''}
                    active:bg-secondary/80
                    focus:outline-none focus:bg-secondary focus:ring-2 focus:ring-ring/20
                  `}
                  onMouseUp={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelect(option, e);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onTouchStart={() => setHighlightedIndex(index)}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelect(option, e);
                  }}
                  tabIndex={-1}
                >
                  <span className="flex-1 truncate">{option.label}</span>
                  {option.value === value && (
                    <div className="ml-2 w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

SearchableDropdown.displayName = 'SearchableDropdown';

export default SearchableDropdown;