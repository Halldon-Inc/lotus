'use client'

import { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingState } from '@/components/shared/loading-state'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DataTableColumn<T = any> {
  key: string
  label: string
  sortable?: boolean
  filterable?: boolean
  searchable?: boolean
  render?: (value: any, row: T, index: number) => React.ReactNode
  width?: string
  className?: string
}

export interface DataTableProps<T = any> {
  data: T[]
  columns: DataTableColumn<T>[]
  loading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyIcon?: React.ReactNode
  searchPlaceholder?: string
  pageSize?: number
  onRowClick?: (row: T, index: number) => void
  rowClassName?: (row: T, index: number) => string
  enableSearch?: boolean
  enablePagination?: boolean
  enableSorting?: boolean
  className?: string
}

type SortDirection = 'asc' | 'desc' | null

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  emptyTitle = 'No data found',
  emptyDescription = 'There are no items to display.',
  emptyIcon,
  searchPlaceholder = 'Search...',
  pageSize = 10,
  onRowClick,
  rowClassName,
  enableSearch = true,
  enablePagination = true,
  enableSorting = true,
  className,
}: DataTableProps<T>) {
  const [filteredData, setFilteredData] = useState<T[]>(data)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // Update filtered data when data changes
  useEffect(() => {
    let result = [...data]

    // Apply search filter
    if (searchTerm && enableSearch) {
      const searchableColumns = columns.filter(col => col.searchable !== false)
      result = result.filter(row =>
        searchableColumns.some(col => {
          const value = row[col.key]
          if (value == null) return false
          return String(value).toLowerCase().includes(searchTerm.toLowerCase())
        })
      )
    }

    // Apply sorting
    if (sortColumn && sortDirection && enableSorting) {
      result.sort((a, b) => {
        const aValue = a[sortColumn]
        const bValue = b[sortColumn]

        let comparison = 0
        if (aValue < bValue) comparison = -1
        if (aValue > bValue) comparison = 1

        return sortDirection === 'desc' ? -comparison : comparison
      })
    }

    setFilteredData(result)
    setCurrentPage(1) // Reset to first page when data changes
  }, [data, searchTerm, sortColumn, sortDirection, columns, enableSearch, enableSorting])

  // Pagination
  const totalItems = filteredData.length
  const totalPages = Math.ceil(totalItems / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)
  const paginatedData = enablePagination 
    ? filteredData.slice(startIndex, endIndex)
    : filteredData

  const handleSort = (columnKey: string) => {
    if (!enableSorting) return

    const column = columns.find(col => col.key === columnKey)
    if (!column?.sortable) return

    if (sortColumn === columnKey) {
      // Cycle through: asc -> desc -> none
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortColumn(null)
        setSortDirection(null)
      }
    } else {
      setSortColumn(columnKey)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (columnKey: string) => {
    if (!enableSorting) return null

    const column = columns.find(col => col.key === columnKey)
    if (!column?.sortable) return null

    if (sortColumn === columnKey) {
      if (sortDirection === 'asc') {
        return <ArrowUp className="h-4 w-4" />
      }
      if (sortDirection === 'desc') {
        return <ArrowDown className="h-4 w-4" />
      }
    }
    return <ArrowUpDown className="h-4 w-4 opacity-50" />
  }

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  const renderCellValue = (column: DataTableColumn<T>, row: T, index: number) => {
    const value = row[column.key]

    if (column.render) {
      return column.render(value, row, index)
    }

    if (value == null) {
      return <span className="text-muted-foreground">—</span>
    }

    if (typeof value === 'boolean') {
      return <Badge variant={value ? 'default' : 'secondary'}>{value ? 'Yes' : 'No'}</Badge>
    }

    if (typeof value === 'number') {
      return <span className="font-mono">{value.toLocaleString()}</span>
    }

    if (value instanceof Date) {
      return <span className="text-sm">{value.toLocaleDateString()}</span>
    }

    return String(value)
  }

  if (loading) {
    return <LoadingState message="Loading data..." />
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search and Filters */}
      {enableSearch && (
        <div className="flex items-center space-x-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      )}

      {/* Table */}
      {paginatedData.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
        />
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => (
                    <TableHead
                      key={column.key}
                      className={cn(
                        column.sortable && enableSorting && 'cursor-pointer hover:bg-muted/50',
                        column.className
                      )}
                      style={{ width: column.width }}
                      onClick={() => column.sortable && handleSort(column.key)}
                    >
                      <div className="flex items-center space-x-2">
                        <span>{column.label}</span>
                        {getSortIcon(column.key)}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((row, index) => (
                  <TableRow
                    key={index}
                    className={cn(
                      onRowClick && 'cursor-pointer hover:bg-muted/50',
                      rowClassName?.(row, startIndex + index)
                    )}
                    onClick={() => onRowClick?.(row, startIndex + index)}
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={column.className}
                      >
                        {renderCellValue(column, row, startIndex + index)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {enablePagination && totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {endIndex} of {totalItems} entries
                {searchTerm && ` (filtered from ${data.length} total entries)`}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </Button>
                    )
                  })}
                  {totalPages > 5 && (
                    <>
                      <span className="text-muted-foreground">...</span>
                      <Button
                        variant={currentPage === totalPages ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handlePageChange(totalPages)}
                      >
                        {totalPages}
                      </Button>
                    </>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
