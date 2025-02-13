import { useState, useEffect, useRef, useCallback, useMemo } from 'react'; // ^18.0.0
import { ChevronDownIcon, SearchIcon, XCircleIcon } from '@heroicons/react/24/outline'; // ^2.0.0
import classNames from 'classnames'; // ^2.3.0
import { useVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0
import { ComponentWithChildren } from '../../lib/types';

/**
 * Interface for dropdown option structure with enhanced features
 */
export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  group?: string;
  description?: string;
  customContent?: React.ReactNode;
}

/**
 * Props interface for the Dropdown component
 */
interface DropdownProps extends ComponentWithChildren {
  options: DropdownOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  isMulti?: boolean;
  isSearchable?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  isLoading?: boolean;
  error?: string;
  renderOption?: (option: DropdownOption) => React.ReactNode;
  maxHeight?: number;
  virtualScroll?: boolean;
}

/**
 * Enhanced dropdown component with comprehensive selection and interaction features
 */
export const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  isMulti = false,
  isSearchable = false,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  isLoading = false,
  error,
  renderOption,
  maxHeight = 300,
  virtualScroll = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Group options by their group property
  const groupedOptions = useMemo(() => {
    const filtered = options.filter(option => 
      option.label.toLowerCase().includes(searchValue.toLowerCase()) ||
      option.description?.toLowerCase().includes(searchValue.toLowerCase())
    );

    return filtered.reduce((acc, option) => {
      const group = option.group || '';
      if (!acc[group]) acc[group] = [];
      acc[group].push(option);
      return acc;
    }, {} as Record<string, DropdownOption[]>);
  }, [options, searchValue]);

  // Setup virtual scrolling
  const rowVirtualizer = useVirtualizer({
    count: virtualScroll ? Object.values(groupedOptions).flat().length : 0,
    getScrollElement: () => listRef.current,
    estimateSize: () => 40,
    overscan: 5,
  });

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    const flatOptions = Object.values(groupedOptions).flat();
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < flatOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          const option = flatOptions[highlightedIndex];
          handleSelect(option);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  }, [isOpen, groupedOptions, highlightedIndex]);

  // Handle option selection
  const handleSelect = useCallback((option: DropdownOption) => {
    if (option.disabled) return;

    if (isMulti) {
      const values = Array.isArray(value) ? value : [];
      const newValue = values.includes(option.value)
        ? values.filter(v => v !== option.value)
        : [...values, option.value];
      onChange(newValue);
    } else {
      onChange(option.value);
      setIsOpen(false);
    }
  }, [value, onChange, isMulti]);

  // Setup event listeners
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Render selected value(s)
  const renderValue = () => {
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return <span className="text-gray-400">{placeholder}</span>;
    }

    if (isMulti) {
      const selectedOptions = options.filter(opt => 
        Array.isArray(value) && value.includes(opt.value)
      );
      return (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.map(option => (
            <span
              key={option.value}
              className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-sm"
            >
              {option.icon && <span className="mr-1">{option.icon}</span>}
              {option.label}
              <XCircleIcon
                className="w-4 h-4 ml-1 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(option);
                }}
              />
            </span>
          ))}
        </div>
      );
    }

    const selectedOption = options.find(opt => opt.value === value);
    return selectedOption ? (
      <div className="flex items-center">
        {selectedOption.icon && <span className="mr-2">{selectedOption.icon}</span>}
        {selectedOption.label}
      </div>
    ) : null;
  };

  return (
    <div
      ref={dropdownRef}
      className={classNames(
        'relative w-full',
        className,
        { 'opacity-50 pointer-events-none': disabled }
      )}
    >
      <div
        className={classNames(
          'flex items-center justify-between w-full px-3 py-2 border rounded-md cursor-pointer',
          {
            'border-red-500': error,
            'border-gray-300': !error,
            'ring-2 ring-blue-500': isOpen,
          }
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        {renderValue()}
        <ChevronDownIcon
          className={classNames(
            'w-5 h-5 text-gray-400 transition-transform',
            { 'transform rotate-180': isOpen }
          )}
        />
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}

      {isOpen && (
        <div
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg"
          style={{ maxHeight }}
        >
          {isSearchable && (
            <div className="p-2 border-b">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  className="w-full pl-9 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Search..."
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          <div
            ref={listRef}
            className="overflow-auto"
            style={{ maxHeight: maxHeight - (isSearchable ? 60 : 0) }}
          >
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : Object.entries(groupedOptions).map(([group, groupOptions], groupIndex) => (
              <div key={group || groupIndex}>
                {group && (
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50">
                    {group}
                  </div>
                )}
                {virtualScroll ? (
                  <div
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const option = Object.values(groupedOptions).flat()[virtualRow.index];
                      return (
                        <div
                          key={virtualRow.index}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          {renderOption ? renderOption(option) : (
                            <DropdownItem
                              option={option}
                              isSelected={Array.isArray(value) ? value.includes(option.value) : value === option.value}
                              isHighlighted={virtualRow.index === highlightedIndex}
                              onSelect={handleSelect}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  groupOptions.map((option, index) => (
                    renderOption ? renderOption(option) : (
                      <DropdownItem
                        key={option.value}
                        option={option}
                        isSelected={Array.isArray(value) ? value.includes(option.value) : value === option.value}
                        isHighlighted={index === highlightedIndex}
                        onSelect={handleSelect}
                      />
                    )
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface DropdownItemProps {
  option: DropdownOption;
  isSelected: boolean;
  isHighlighted: boolean;
  onSelect: (option: DropdownOption) => void;
}

const DropdownItem: React.FC<DropdownItemProps> = ({
  option,
  isSelected,
  isHighlighted,
  onSelect,
}) => (
  <div
    className={classNames(
      'px-3 py-2 cursor-pointer flex items-center',
      {
        'bg-blue-50': isHighlighted,
        'bg-blue-100': isSelected,
        'opacity-50 cursor-not-allowed': option.disabled,
        'hover:bg-gray-100': !option.disabled && !isSelected,
      }
    )}
    onClick={() => onSelect(option)}
  >
    {option.icon && <span className="mr-2">{option.icon}</span>}
    <div>
      <div className="font-medium">{option.label}</div>
      {option.description && (
        <div className="text-sm text-gray-500">{option.description}</div>
      )}
    </div>
    {option.customContent}
  </div>
);

export default Dropdown;