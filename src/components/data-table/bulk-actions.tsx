import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { type Table, type Row, type Column } from '@tanstack/react-table'
import { 
  X, 
  Check, 
  ChevronDown, 
  Filter,
  Sparkles,
  Download,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  MoreVertical
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/components/ui/use-toast'
import { useDebounce } from '@/hooks/use-debounce'
import { useLocalStorage } from '@/hooks/use-local-storage'

type BulkAction<TData> = {
  id: string
  label: string
  icon?: React.ReactNode
  handler: (selectedRows: Row<TData>[], table: Table<TData>) => Promise<void> | void
  confirmMessage?: string
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  shortcut?: string
  disabled?: (selectedRows: Row<TData>[]) => boolean
}

type ColumnVisibilityConfig = Record<string, boolean>
type ExportFormat = 'csv' | 'json' | 'excel'

interface DataTableBulkActionsProps<TData> {
  table: Table<TData>
  entityName: string
  entityNamePlural?: string
  customActions?: BulkAction<TData>[]
  onSelectionChange?: (selectedRows: Row<TData>[]) => void
  enableColumnVisibility?: boolean
  enableExport?: boolean
  exportFormats?: ExportFormat[]
  onExport?: (format: ExportFormat, selectedRows: Row<TData>[]) => Promise<void> | void
  enableSmartActions?: boolean
  smartActionsThreshold?: number
  persistSelection?: boolean
  storageKey?: string
  position?: 'bottom' | 'top' | 'sticky' | 'inline'
  className?: string
  children?: React.ReactNode
  animationConfig?: {
    duration?: number
    easing?: string
    enterScale?: number
    exitScale?: number
  }
}

type SelectionState = {
  selectedIds: string[]
  timestamp: number
}

/**
 * Advanced bulk actions toolbar with smart features:
 * - Custom actions with async handlers
 * - Column visibility controls
 * - Export functionality
 * - Smart action suggestions
 * - Keyboard navigation & shortcuts
 * - Selection persistence
 * - Advanced animations
 * - Performance optimizations
 */
export function DataTableBulkActions<TData>({
  table,
  entityName,
  entityNamePlural,
  customActions = [],
  onSelectionChange,
  enableColumnVisibility = true,
  enableExport = true,
  exportFormats = ['csv', 'json'],
  onExport,
  enableSmartActions = true,
  smartActionsThreshold = 100,
  persistSelection = false,
  storageKey = 'data-table-selection',
  position = 'bottom',
  className,
  children,
  animationConfig = {
    duration: 300,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    enterScale: 1.05,
    exitScale: 0.95,
  }
}: DataTableBulkActionsProps<TData>): React.ReactNode | null {
  const { toast } = useToast()
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [announcement, setAnnouncement] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityConfig>({})
  const [smartActionSuggestion, setSmartActionSuggestion] = useState<string | null>(null)
  const [showColumnVisibility, setShowColumnVisibility] = useState(false)
  
  // Use localStorage for persistence
  const [storedSelection, setStoredSelection] = useLocalStorage<SelectionState | null>(
    storageKey,
    null
  )

  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedCount = selectedRows.length
  const totalRows = table.getFilteredRowModel().rows.length
  const isAllSelected = selectedCount === totalRows && totalRows > 0
  const isPartialSelection = selectedCount > 0 && !isAllSelected

  // Debounce selection changes for performance
  const debouncedSelectionChange = useDebounce((rows: Row<TData>[]) => {
    onSelectionChange?.(rows)
  }, 300)

  // Memoize derived values
  const { selectedIds, selectedData } = useMemo(() => ({
    selectedIds: selectedRows.map(row => row.id),
    selectedData: selectedRows.map(row => row.original)
  }), [selectedRows])

  // Load persisted selection
  useEffect(() => {
    if (persistSelection && storedSelection?.selectedIds) {
      const { selectedIds, timestamp } = storedSelection
      // Clear if older than 24 hours
      if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
        const rows = table.getRowModel().rows
        rows.forEach(row => {
          if (selectedIds.includes(row.id)) {
            row.toggleSelected(true)
          }
        })
      }
    }
  }, [persistSelection, storedSelection, table])

  // Save selection to localStorage
  useEffect(() => {
    if (persistSelection && selectedIds.length > 0) {
      setStoredSelection({
        selectedIds,
        timestamp: Date.now()
      })
    } else if (persistSelection && selectedIds.length === 0) {
      setStoredSelection(null)
    }
  }, [persistSelection, selectedIds, setStoredSelection])

  // Announce selection changes with smart detection
  useEffect(() => {
    if (selectedCount > 0) {
      const pluralName = entityNamePlural || `${entityName}s`
      const message = `${selectedCount} ${selectedCount > 1 ? pluralName : entityName} selected. Bulk actions available.`
      
      queueMicrotask(() => {
        setAnnouncement(message)
      })

      const timer = setTimeout(() => setAnnouncement(''), 3000)
      return () => clearTimeout(timer)
    }
  }, [selectedCount, entityName, entityNamePlural])

  // Smart action suggestions based on selection patterns
  useEffect(() => {
    if (!enableSmartActions || selectedCount === 0) return

    const analyzeSelection = () => {
      if (selectedCount > smartActionsThreshold) {
        return `You've selected ${selectedCount} items. Consider exporting or batch operations.`
      }

      // Check for common patterns in selected data
      const statusCounts: Record<string, number> = {}
      selectedRows.forEach(row => {
        const status = (row.original as any).status
        if (status) {
          statusCounts[status] = (statusCounts[status] || 0) + 1
        }
      })

      const commonStatus = Object.entries(statusCounts)
        .sort(([, a], [, b]) => b - a)[0]

      if (commonStatus && commonStatus[1] / selectedCount > 0.8) {
        return `Most selected items have status "${commonStatus[0]}". Apply bulk status update?`
      }

      return null
    }

    const suggestion = analyzeSelection()
    setSmartActionSuggestion(suggestion)
  }, [selectedRows, selectedCount, enableSmartActions, smartActionsThreshold])

  const handleClearSelection = useCallback(() => {
    table.resetRowSelection()
    if (persistSelection) {
      setStoredSelection(null)
    }
    toast({
      title: "Selection cleared",
      description: `${selectedCount} ${selectedCount > 1 ? 'items' : 'item'} deselected`,
      duration: 2000,
    })
  }, [table, persistSelection, setStoredSelection, selectedCount, toast])

  const handleSelectAll = useCallback(() => {
    table.toggleAllRowsSelected()
  }, [table])

  const handleInvertSelection = useCallback(() => {
    const allRows = table.getRowModel().rows
    allRows.forEach(row => {
      row.toggleSelected(!row.getIsSelected())
    })
  }, [table])

  const handleColumnVisibilityChange = useCallback((columnId: string, visible: boolean) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnId]: visible
    }))
    table.getColumn(columnId)?.toggleVisibility(visible)
  }, [table])

  const handleExport = useCallback(async (format: ExportFormat) => {
    if (!onExport) {
      // Default export implementation
      const data = JSON.stringify(selectedData, null, 2)
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${entityName}-export-${new Date().toISOString().split('T')[0]}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      await onExport(format, selectedRows)
    }

    toast({
      title: "Export started",
      description: `Exporting ${selectedCount} items as ${format.toUpperCase()}`,
      duration: 3000,
    })
  }, [selectedData, selectedRows, selectedCount, entityName, onExport, toast])

  const executeAction = useCallback(async (action: BulkAction<TData>) => {
    if (action.disabled?.(selectedRows)) return

    try {
      setIsProcessing(true)
      
      if (action.confirmMessage && !window.confirm(action.confirmMessage)) {
        return
      }

      await action.handler(selectedRows, table)

      toast({
        title: "Action completed",
        description: `${action.label} applied to ${selectedCount} items`,
        duration: 3000,
      })

      // Clear selection after destructive actions
      if (action.variant === 'destructive') {
        table.resetRowSelection()
      }
    } catch (error) {
      toast({
        title: "Action failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setIsProcessing(false)
    }
  }, [selectedRows, selectedCount, table, toast])

  // Keyboard navigation with enhanced shortcuts
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const buttons = toolbarRef.current?.querySelectorAll('button, [role="menuitem"]')
    if (!buttons) return

    const currentIndex = Array.from(buttons).findIndex(
      (el) => el === document.activeElement
    )

    // Check for global shortcuts
    if (event.ctrlKey || event.metaKey) {
      switch (event.key.toLowerCase()) {
        case 'a':
          event.preventDefault()
          handleSelectAll()
          return
        case 'd':
          event.preventDefault()
          handleClearSelection()
          return
        case 'i':
          event.preventDefault()
          handleInvertSelection()
          return
        case 'e':
          if (event.shiftKey && enableExport) {
            event.preventDefault()
            handleExport('csv')
            return
          }
          break
      }
    }

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        const nextIndex = (currentIndex + 1) % buttons.length
        ;(buttons[nextIndex] as HTMLElement)?.focus()
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        const prevIndex = currentIndex === 0 ? buttons.length - 1 : currentIndex - 1
        ;(buttons[prevIndex] as HTMLElement)?.focus()
        break
      case 'Home':
        event.preventDefault()
        ;(buttons[0] as HTMLElement)?.focus()
        break
      case 'End':
        event.preventDefault()
        ;(buttons[buttons.length - 1] as HTMLElement)?.focus()
        break
      case 'Escape':
        if (!event.target?.closest('[data-radix-dropdown-menu-content]')) {
          event.preventDefault()
          handleClearSelection()
        }
        break
      case ' ':
      case 'Enter':
        if (document.activeElement?.hasAttribute('role')) {
          event.preventDefault()
          ;(document.activeElement as HTMLElement).click()
        }
        break
    }
  }, [handleSelectAll, handleClearSelection, handleInvertSelection, handleExport, enableExport])

  // Register global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (selectedCount === 0) return
      
      // Ctrl/Cmd + Shift + A for select all
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'A') {
        event.preventDefault()
        handleSelectAll()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [selectedCount, handleSelectAll])

  // Default actions
  const defaultActions: BulkAction<TData>[] = useMemo(() => [
    {
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 className="h-4 w-4" />,
      handler: async (rows) => {
        // Implement your delete logic here
        console.log('Deleting rows:', rows.map(r => r.id))
      },
      confirmMessage: `Are you sure you want to delete ${selectedCount} ${selectedCount > 1 ? 'items' : 'item'}?`,
      variant: 'destructive',
      shortcut: 'Del',
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: <Copy className="h-4 w-4" />,
      handler: async (rows) => {
        // Implement duplicate logic
        console.log('Duplicating rows:', rows.map(r => r.id))
      },
      variant: 'secondary',
      shortcut: 'Ctrl+D',
    },
    {
      id: 'archive',
      label: 'Archive',
      icon: <EyeOff className="h-4 w-4" />,
      handler: async (rows) => {
        // Implement archive logic
        console.log('Archiving rows:', rows.map(r => r.id))
      },
      variant: 'outline',
    },
  ], [selectedCount])

  const allActions = [...defaultActions, ...customActions]

  if (selectedCount === 0) {
    return null
  }

  const positionClasses = {
    bottom: 'fixed bottom-6 left-1/2 -translate-x-1/2',
    top: 'fixed top-6 left-1/2 -translate-x-1/2',
    sticky: 'sticky top-4 mx-auto',
    inline: 'relative mx-auto',
  }

  return (
    <>
      {/* Live region for screen reader announcements */}
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {announcement}
      </div>

      {/* Smart suggestion banner */}
      {smartActionSuggestion && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 backdrop-blur-sm rounded-lg border border-primary/20">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm text-primary">{smartActionSuggestion}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSmartActionSuggestion(null)}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      <div
        ref={toolbarRef}
        role="toolbar"
        aria-label={`Bulk actions for ${selectedCount} selected ${selectedCount > 1 ? entityNamePlural || entityName + 's' : entityName}`}
        aria-describedby="bulk-actions-description"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          positionClasses[position],
          'z-50',
          'transition-all duration-300 ease-out',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          'animate-in fade-in slide-in-from-bottom-2 duration-500',
          className
        )}
        style={{
          animationDuration: `${animationConfig.duration}ms`,
          animationTimingFunction: animationConfig.easing,
        }}
      >
        <div
          className={cn(
            'p-3 shadow-2xl',
            'rounded-xl border border-border/50',
            'bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80',
            'flex items-center gap-2',
            'min-w-[400px] max-w-[90vw]',
            isProcessing && 'opacity-70 cursor-wait'
          )}
        >
          {/* Selection controls */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleClearSelection}
                  className="h-8 w-8 rounded-full"
                  aria-label="Clear selection"
                  title="Clear selection (Esc)"
                  disabled={isProcessing}
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Clear selection (Esc)</p>
              </TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-4" />

            <div className="flex items-center gap-1">
              <Badge
                variant="secondary"
                className="min-w-[32px] justify-center font-mono"
                aria-label={`${selectedCount} selected`}
              >
                {selectedCount}
              </Badge>
              
              <span className="text-sm font-medium whitespace-nowrap">
                {entityName}
                {selectedCount !== 1 && 's'} selected
                {isPartialSelection && ' (partial)'}
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={isProcessing}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={handleSelectAll}>
                    <Check className={cn(
                      "mr-2 h-4 w-4",
                      isAllSelected ? "opacity-100" : "opacity-0"
                    )} />
                    Select all ({totalRows})
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleInvertSelection}>
                    Invert selection
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleClearSelection}>
                    Clear selection
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Action buttons */}
          <div className="flex items-center gap-1 flex-1 overflow-x-auto">
            {allActions.slice(0, 3).map((action) => (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={action.variant || 'default'}
                    size="sm"
                    onClick={() => executeAction(action)}
                    disabled={isProcessing || action.disabled?.(selectedRows)}
                    className="whitespace-nowrap"
                  >
                    {action.icon}
                    <span className="ml-2 hidden md:inline">{action.label}</span>
                    {action.shortcut && (
                      <span className="ml-2 text-xs opacity-60 hidden lg:inline">
                        {action.shortcut}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{action.label}</p>
                  {action.shortcut && <p className="text-xs opacity-75">{action.shortcut}</p>}
                </TooltipContent>
              </Tooltip>
            ))}

            {/* More actions dropdown */}
            {allActions.length > 3 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isProcessing}
                  >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">More actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {allActions.slice(3).map((action) => (
                    <DropdownMenuItem
                      key={action.id}
                      onClick={() => executeAction(action)}
                      disabled={action.disabled?.(selectedRows)}
                      className={cn(
                        action.variant === 'destructive' && 'text-destructive'
                      )}
                    >
                      {action.icon}
                      <span className="ml-2">{action.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Export dropdown */}
            {enableExport && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isProcessing}
                  >
                    <Download className="h-4 w-4" />
                    <span className="ml-2 hidden md:inline">Export</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {exportFormats.map((format) => (
                    <DropdownMenuItem
                      key={format}
                      onClick={() => handleExport(format)}
                    >
                      Export as {format.toUpperCase()}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Column visibility */}
            {enableColumnVisibility && (
              <Popover open={showColumnVisibility} onOpenChange={setShowColumnVisibility}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isProcessing}
                  >
                    <Filter className="h-4 w-4" />
                    <span className="ml-2 hidden md:inline">Columns</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56" align="end">
                  <div className="space-y-2">
                    <h4 className="font-medium">Visible columns</h4>
                    <ScrollArea className="h-72">
                      <div className="space-y-2 p-1">
                        {table.getAllColumns()
                          .filter(column => column.getCanHide())
                          .map(column => (
                            <div key={column.id} className="flex items-center justify-between">
                              <Label htmlFor={`col-${column.id}`} className="text-sm">
                                {typeof column.columnDef.header === 'string' 
                                  ? column.columnDef.header 
                                  : column.id}
                              </Label>
                              <Switch
                                id={`col-${column.id}`}
                                checked={column.getIsVisible()}
                                onCheckedChange={(checked) => 
                                  handleColumnVisibilityChange(column.id, checked)
                                }
                              />
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Custom children */}
            {children && (
              <>
                <Separator orientation="vertical" className="h-6" />
                {children}
              </>
            )}
          </div>
        </div>

        {/* Progress indicator */}
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl">
            <div className="h-1 w-24 bg-primary/20 overflow-hidden rounded-full">
              <div className="h-full w-1/2 bg-primary animate-pulse rounded-full" />
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// Custom hook for debouncing
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

// Custom hook for localStorage
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch {
      // Ignore errors
    }
  }, [key, storedValue])

  return [storedValue, setValue] as const
}
