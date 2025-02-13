import React, { useCallback, useMemo, useState } from 'react';
import clsx from 'clsx'; // ^2.0.0
import { useVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0
import { useIntersectionObserver } from 'react-intersection-observer'; // ^9.0.0
import { LoadingState } from '../../lib/types';
import Loading from './Loading';

// Column configuration interface
interface ColumnConfig<T = any> {
  id: string;
  header: string;
  accessor: keyof T | ((row: T) => any);
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  cell?: (value: any, row: T) => React.ReactNode;
}

// Sort configuration interface
interface SortConfig {
  columnId: string;
  direction: 'asc' | 'desc';
}

// Table props interface
interface TableProps<T = any> {
  columns: ColumnConfig<T>[];
  data: T[];
  isLoading?: boolean;
  onSort?: (sortConfig: SortConfig) => void;
  pageSize?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  className?: string;
  virtualizeRows?: boolean;
  onRowClick?: (row: T) => void;
  accessibilityLabels?: {
    tableLabel?: string;
    sortAscending?: string;
    sortDescending?: string;
    loading?: string;
    rowsPerPage?: string;
    pagination?: string;
  };
}

/**
 * A highly performant and accessible table component for displaying campaign and analytics data.
 * Supports virtualization, sorting, pagination, and real-time updates.
 */
export const Table = <T extends Record<string, any>>({
  columns,
  data,
  isLoading = false,
  onSort,
  pageSize = 10,
  currentPage = 1,
  onPageChange,
  className,
  virtualizeRows = false,
  onRowClick,
  accessibilityLabels = {}
}: TableProps<T>): JSX.Element => {
  // State for sorting
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // Memoized sorted data
  const sortedData = useMemo(() => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      const column = columns.find(col => col.id === sortConfig.columnId);
      if (!column) return 0;

      const aValue = typeof column.accessor === 'function' 
        ? column.accessor(a) 
        : a[column.accessor];
      const bValue = typeof column.accessor === 'function'
        ? column.accessor(b)
        : b[column.accessor];

      return sortConfig.direction === 'asc'
        ? aValue > bValue ? 1 : -1
        : aValue < bValue ? 1 : -1;
    });
  }, [data, sortConfig, columns]);

  // Virtualization setup
  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: virtualizeRows ? sortedData.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // Estimated row height
    overscan: 5
  });

  // Intersection observer for infinite scroll
  const { ref: intersectionRef } = useIntersectionObserver({
    threshold: 0.5,
    onChange: (inView) => {
      if (inView && onPageChange && currentPage * pageSize < sortedData.length) {
        onPageChange(currentPage + 1);
      }
    }
  });

  // Sort handler
  const handleSort = useCallback((columnId: string) => {
    const column = columns.find(col => col.id === columnId);
    if (!column?.sortable) return;

    setSortConfig(current => {
      const newConfig: SortConfig = {
        columnId,
        direction: current?.columnId === columnId && current.direction === 'asc'
          ? 'desc'
          : 'asc'
      };
      onSort?.(newConfig);
      return newConfig;
    });
  }, [columns, onSort]);

  // Sort icon renderer
  const getSortIcon = (columnId: string): JSX.Element => {
    const isActive = sortConfig?.columnId === columnId;
    const direction = sortConfig?.direction;

    return (
      <span className="ml-2 inline-flex" aria-hidden="true">
        {isActive ? (
          direction === 'asc' ? '↑' : '↓'
        ) : '↕'}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loading 
          size="lg"
          text={accessibilityLabels.loading || 'Loading data...'}
        />
      </div>
    );
  }

  return (
    <div 
      className={clsx('overflow-hidden rounded-lg shadow', className)}
      role="region"
      aria-label={accessibilityLabels.tableLabel || 'Data table'}
    >
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ maxHeight: virtualizeRows ? '600px' : undefined }}
      >
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map(column => (
                <th
                  key={column.id}
                  scope="col"
                  className={clsx(
                    'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
                    column.sortable && 'cursor-pointer hover:bg-gray-100',
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                    column.width
                  )}
                  onClick={() => column.sortable && handleSort(column.id)}
                  aria-sort={
                    sortConfig?.columnId === column.id
                      ? sortConfig.direction
                      : undefined
                  }
                >
                  <span className="flex items-center">
                    {column.header}
                    {column.sortable && getSortIcon(column.id)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {virtualizeRows ? (
              rowVirtualizer.getVirtualItems().map(virtualRow => {
                const row = sortedData[virtualRow.index];
                return (
                  <tr
                    key={virtualRow.index}
                    onClick={() => onRowClick?.(row)}
                    className={clsx(
                      'hover:bg-gray-50',
                      onRowClick && 'cursor-pointer'
                    )}
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`
                    }}
                  >
                    {columns.map(column => (
                      <td
                        key={column.id}
                        className={clsx(
                          'px-6 py-4 whitespace-nowrap',
                          column.align === 'center' && 'text-center',
                          column.align === 'right' && 'text-right'
                        )}
                      >
                        {column.cell
                          ? column.cell(
                              typeof column.accessor === 'function'
                                ? column.accessor(row)
                                : row[column.accessor],
                              row
                            )
                          : typeof column.accessor === 'function'
                            ? column.accessor(row)
                            : row[column.accessor]}
                      </td>
                    ))}
                  </tr>
                );
              })
            ) : (
              sortedData.map((row, index) => (
                <tr
                  key={index}
                  onClick={() => onRowClick?.(row)}
                  className={clsx(
                    'hover:bg-gray-50',
                    onRowClick && 'cursor-pointer'
                  )}
                >
                  {columns.map(column => (
                    <td
                      key={column.id}
                      className={clsx(
                        'px-6 py-4 whitespace-nowrap',
                        column.align === 'center' && 'text-center',
                        column.align === 'right' && 'text-right'
                      )}
                    >
                      {column.cell
                        ? column.cell(
                            typeof column.accessor === 'function'
                              ? column.accessor(row)
                              : row[column.accessor],
                            row
                          )
                        : typeof column.accessor === 'function'
                          ? column.accessor(row)
                          : row[column.accessor]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {onPageChange && (
        <div
          ref={intersectionRef}
          className="flex justify-between items-center px-6 py-3 border-t border-gray-200 bg-gray-50"
          aria-label={accessibilityLabels.pagination}
        >
          <div className="flex items-center">
            <span className="text-sm text-gray-700">
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, sortedData.length)} of{' '}
              {sortedData.length} results
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded-md disabled:opacity-50"
              aria-label="Previous page"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage * pageSize >= sortedData.length}
              className="px-3 py-1 border rounded-md disabled:opacity-50"
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};