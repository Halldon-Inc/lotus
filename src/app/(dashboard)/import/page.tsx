'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { LoadingState } from '@/components/shared/loading-state'
import { EmptyState } from '@/components/shared/empty-state'
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Download,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Users,
  Warehouse,
  ClipboardList,
  ShoppingCart,
} from 'lucide-react'

// ---- Types ----

interface FieldDefinition {
  key: string
  label: string
  required: boolean
  type: 'string' | 'number' | 'date' | 'email'
}

interface UploadResult {
  sessionId: string
  headers: string[]
  sampleRows: Record<string, string>[]
  totalRows: number
}

interface PreviewResult {
  validRows: Array<{ rowIndex: number; data: Record<string, string> }>
  invalidRows: Array<{
    rowIndex: number
    data: Record<string, string>
    errors: Array<{ field: string; message: string }>
  }>
  totalValid: number
  totalInvalid: number
}

interface ExecuteResult {
  imported: number
  skipped: number
  errors: Array<{ rowIndex: number; error: string }>
}

type WizardStep = 1 | 2 | 3 | 4

interface EntityOption {
  value: string
  label: string
  description: string
  icon: React.ReactNode
}

// ---- Constants ----

const ENTITY_OPTIONS: EntityOption[] = [
  {
    value: 'clients',
    label: 'Clients',
    description: 'Import client accounts with contact info and details',
    icon: <Users className="h-6 w-6" />,
  },
  {
    value: 'inventory',
    label: 'Inventory Items',
    description: 'Import inventory items with SKUs, quantities, and costs',
    icon: <Warehouse className="h-6 w-6" />,
  },
  {
    value: 'requests',
    label: 'Requests',
    description: 'Import client requests with subjects and priorities',
    icon: <ClipboardList className="h-6 w-6" />,
  },
  {
    value: 'purchase-orders',
    label: 'Purchase Orders',
    description: 'Import purchase orders with PO numbers and amounts',
    icon: <ShoppingCart className="h-6 w-6" />,
  },
]

const ENTITY_NAV_MAP: Record<string, string> = {
  clients: '/clients',
  inventory: '/inventory',
  requests: '/requests',
  'purchase-orders': '/orders',
}

const STEP_LABELS = ['Upload', 'Configure', 'Preview', 'Results'] as const

// ---- Component ----

export default function ImportPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>(1)

  // Step 1: Upload
  const [uploadTab, setUploadTab] = useState<string>('file')
  const [pastedContent, setPastedContent] = useState('')
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [fileName, setFileName] = useState('')

  // Step 2: Configure
  const [entityType, setEntityType] = useState('')
  const [entityFields, setEntityFields] = useState<FieldDefinition[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [fieldsLoading, setFieldsLoading] = useState(false)

  // Step 3: Preview
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)
  const [skipInvalid, setSkipInvalid] = useState(true)

  // Step 4: Results
  const [executeLoading, setExecuteLoading] = useState(false)
  const [executeError, setExecuteError] = useState<string | null>(null)
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null)
  const [errorsExpanded, setErrorsExpanded] = useState(false)

  // Drag-and-drop state
  const [dragOver, setDragOver] = useState(false)

  // ---- Handlers ----

  const readFileContent = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result
        if (typeof text === 'string') {
          resolve(text)
        } else {
          reject(new Error('Failed to read file'))
        }
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsText(file)
    })
  }, [])

  const handleUpload = useCallback(
    async (content: string, name: string) => {
      setUploadLoading(true)
      setUploadError(null)
      try {
        const response = await fetch('/api/v1/import/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, fileName: name }),
        })
        const result = await response.json()
        if (result.success && result.data) {
          setUploadResult(result.data)
          setFileName(name)
        } else {
          setUploadError(result.error || 'Upload failed')
        }
      } catch {
        setUploadError('Network error during upload')
      } finally {
        setUploadLoading(false)
      }
    },
    []
  )

  const handleFileSelect = useCallback(
    async (file: File) => {
      try {
        const content = await readFileContent(file)
        await handleUpload(content, file.name)
      } catch {
        setUploadError('Failed to read file')
      }
    },
    [readFileContent, handleUpload]
  )

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect]
  )

  const handlePasteUpload = useCallback(async () => {
    if (!pastedContent.trim()) return
    await handleUpload(pastedContent, 'pasted-data.csv')
  }, [pastedContent, handleUpload])

  const fetchEntityFields = useCallback(async (entity: string) => {
    setFieldsLoading(true)
    try {
      const response = await fetch(`/api/v1/import/templates?entity=${entity}`)
      const result = await response.json()
      if (result.success && result.data) {
        // Parse template headers to build field list
        // We need the field definitions from our known entity structure
        const fieldMap: Record<string, FieldDefinition[]> = {
          clients: [
            { key: 'name', label: 'Client Name', required: true, type: 'string' },
            { key: 'type', label: 'Type', required: false, type: 'string' },
            { key: 'contactName', label: 'Contact Name', required: false, type: 'string' },
            { key: 'contactEmail', label: 'Contact Email', required: false, type: 'email' },
            { key: 'contactPhone', label: 'Contact Phone', required: false, type: 'string' },
            { key: 'address', label: 'Address', required: false, type: 'string' },
            { key: 'city', label: 'City', required: false, type: 'string' },
            { key: 'state', label: 'State', required: false, type: 'string' },
            { key: 'zip', label: 'Zip', required: false, type: 'string' },
            { key: 'spendingLimit', label: 'Spending Limit', required: false, type: 'number' },
            { key: 'fiscalYearStart', label: 'Fiscal Year Start', required: false, type: 'date' },
          ],
          inventory: [
            { key: 'name', label: 'Item Name', required: true, type: 'string' },
            { key: 'sku', label: 'SKU', required: false, type: 'string' },
            { key: 'description', label: 'Description', required: false, type: 'string' },
            { key: 'category', label: 'Category', required: false, type: 'string' },
            { key: 'quantityOnHand', label: 'Quantity On Hand', required: false, type: 'number' },
            { key: 'reorderPoint', label: 'Reorder Point', required: false, type: 'number' },
            { key: 'location', label: 'Location', required: false, type: 'string' },
            { key: 'unitCost', label: 'Unit Cost', required: false, type: 'number' },
          ],
          requests: [
            { key: 'clientName', label: 'Client Name', required: true, type: 'string' },
            { key: 'subject', label: 'Subject', required: true, type: 'string' },
            { key: 'description', label: 'Description', required: false, type: 'string' },
            { key: 'priority', label: 'Priority', required: false, type: 'string' },
            { key: 'source', label: 'Source', required: false, type: 'string' },
          ],
          'purchase-orders': [
            { key: 'clientName', label: 'Client Name', required: true, type: 'string' },
            { key: 'poNumber', label: 'PO Number', required: true, type: 'string' },
            { key: 'totalAmount', label: 'Total Amount', required: false, type: 'number' },
            { key: 'deliveryMethod', label: 'Delivery Method', required: false, type: 'string' },
            { key: 'notes', label: 'Notes', required: false, type: 'string' },
          ],
        }
        setEntityFields(fieldMap[entity] || [])
      }
    } catch {
      // Silently handle; fields won't load
    } finally {
      setFieldsLoading(false)
    }
  }, [])

  const handleEntitySelect = useCallback(
    (entity: string) => {
      setEntityType(entity)
      fetchEntityFields(entity)

      // Auto-map columns if CSV headers match field labels (case-insensitive)
      if (uploadResult) {
        const newMapping: Record<string, string> = {}
        const fieldMap: Record<string, FieldDefinition[]> = {
          clients: [
            { key: 'name', label: 'Client Name', required: true, type: 'string' },
            { key: 'type', label: 'Type', required: false, type: 'string' },
            { key: 'contactName', label: 'Contact Name', required: false, type: 'string' },
            { key: 'contactEmail', label: 'Contact Email', required: false, type: 'email' },
            { key: 'contactPhone', label: 'Contact Phone', required: false, type: 'string' },
            { key: 'address', label: 'Address', required: false, type: 'string' },
            { key: 'city', label: 'City', required: false, type: 'string' },
            { key: 'state', label: 'State', required: false, type: 'string' },
            { key: 'zip', label: 'Zip', required: false, type: 'string' },
            { key: 'spendingLimit', label: 'Spending Limit', required: false, type: 'number' },
            { key: 'fiscalYearStart', label: 'Fiscal Year Start', required: false, type: 'date' },
          ],
          inventory: [
            { key: 'name', label: 'Item Name', required: true, type: 'string' },
            { key: 'sku', label: 'SKU', required: false, type: 'string' },
            { key: 'description', label: 'Description', required: false, type: 'string' },
            { key: 'category', label: 'Category', required: false, type: 'string' },
            { key: 'quantityOnHand', label: 'Quantity On Hand', required: false, type: 'number' },
            { key: 'reorderPoint', label: 'Reorder Point', required: false, type: 'number' },
            { key: 'location', label: 'Location', required: false, type: 'string' },
            { key: 'unitCost', label: 'Unit Cost', required: false, type: 'number' },
          ],
          requests: [
            { key: 'clientName', label: 'Client Name', required: true, type: 'string' },
            { key: 'subject', label: 'Subject', required: true, type: 'string' },
            { key: 'description', label: 'Description', required: false, type: 'string' },
            { key: 'priority', label: 'Priority', required: false, type: 'string' },
            { key: 'source', label: 'Source', required: false, type: 'string' },
          ],
          'purchase-orders': [
            { key: 'clientName', label: 'Client Name', required: true, type: 'string' },
            { key: 'poNumber', label: 'PO Number', required: true, type: 'string' },
            { key: 'totalAmount', label: 'Total Amount', required: false, type: 'number' },
            { key: 'deliveryMethod', label: 'Delivery Method', required: false, type: 'string' },
            { key: 'notes', label: 'Notes', required: false, type: 'string' },
          ],
        }
        const fields = fieldMap[entity] || []

        for (const csvHeader of uploadResult.headers) {
          const lowerHeader = csvHeader.toLowerCase().trim()
          const match = fields.find(
            (f) =>
              f.label.toLowerCase() === lowerHeader ||
              f.key.toLowerCase() === lowerHeader
          )
          if (match) {
            newMapping[csvHeader] = match.key
          }
        }
        setColumnMapping(newMapping)
      }
    },
    [uploadResult, fetchEntityFields]
  )

  const handleMappingChange = useCallback(
    (csvHeader: string, fieldKey: string) => {
      setColumnMapping((prev) => {
        const updated = { ...prev }
        if (fieldKey === '__none__') {
          delete updated[csvHeader]
        } else {
          updated[csvHeader] = fieldKey
        }
        return updated
      })
    },
    []
  )

  const handleDownloadTemplate = useCallback(async () => {
    if (!entityType) return
    try {
      const response = await fetch(`/api/v1/import/templates?entity=${entityType}`)
      const result = await response.json()
      if (result.success && result.data?.template) {
        const blob = new Blob([result.data.template], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${entityType}-template.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch {
      // Download failed silently
    }
  }, [entityType])

  const handlePreview = useCallback(async () => {
    if (!uploadResult || !entityType) return
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const response = await fetch('/api/v1/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: uploadResult.sessionId,
          entityType,
          columnMapping,
        }),
      })
      const result = await response.json()
      if (result.success && result.data) {
        setPreviewResult(result.data)
        setCurrentStep(3)
      } else {
        setPreviewError(result.error || 'Preview failed')
      }
    } catch {
      setPreviewError('Network error during preview')
    } finally {
      setPreviewLoading(false)
    }
  }, [uploadResult, entityType, columnMapping])

  const handleExecute = useCallback(async () => {
    if (!uploadResult || !entityType) return
    setExecuteLoading(true)
    setExecuteError(null)
    try {
      const response = await fetch('/api/v1/import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: uploadResult.sessionId,
          entityType,
          columnMapping,
          skipInvalid,
        }),
      })
      const result = await response.json()
      if (result.success && result.data) {
        setExecuteResult(result.data)
        setCurrentStep(4)
      } else {
        setExecuteError(result.error || 'Import failed')
      }
    } catch {
      setExecuteError('Network error during import')
    } finally {
      setExecuteLoading(false)
    }
  }, [uploadResult, entityType, columnMapping, skipInvalid])

  const resetWizard = useCallback(() => {
    setCurrentStep(1)
    setUploadTab('file')
    setPastedContent('')
    setUploadLoading(false)
    setUploadError(null)
    setUploadResult(null)
    setFileName('')
    setEntityType('')
    setEntityFields([])
    setColumnMapping({})
    setPreviewLoading(false)
    setPreviewError(null)
    setPreviewResult(null)
    setSkipInvalid(true)
    setExecuteLoading(false)
    setExecuteError(null)
    setExecuteResult(null)
    setErrorsExpanded(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // Check permissions
  const userRole = session?.user?.role
  if (userRole && !['ADMIN', 'MANAGER'].includes(userRole)) {
    return (
      <EmptyState
        icon={<XCircle className="h-8 w-8 text-muted-foreground" />}
        title="Access Denied"
        description="You need Admin or Manager permissions to import data."
      />
    )
  }

  // Compute which required fields are unmapped for step 2 validation
  const requiredFieldsMapped = entityFields
    .filter((f) => f.required)
    .every((f) => Object.values(columnMapping).includes(f.key))

  const canProceedToPreview = entityType && requiredFieldsMapped

  // Get mapped field names for sample preview
  const getMappedHeaders = (): string[] => {
    if (!uploadResult) return []
    return uploadResult.headers.map(
      (h) => {
        const fieldKey = columnMapping[h]
        if (!fieldKey) return h
        const field = entityFields.find((f) => f.key === fieldKey)
        return field ? field.label : h
      }
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Import Data</h1>
        <p className="text-muted-foreground">
          Import records from CSV files into Lotus
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-between">
        {STEP_LABELS.map((label, idx) => {
          const stepNum = (idx + 1) as WizardStep
          const isActive = currentStep === stepNum
          const isCompleted = currentStep > stepNum
          return (
            <div key={label} className="flex items-center flex-1">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-[#0D7377] text-white'
                      : isCompleted
                        ? 'bg-[#0D7377]/20 text-[#0D7377]'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    stepNum
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    isActive
                      ? 'text-[#0D7377]'
                      : isCompleted
                        ? 'text-[#0D7377]/70'
                        : 'text-muted-foreground'
                  }`}
                >
                  {label}
                </span>
              </div>
              {idx < STEP_LABELS.length - 1 && (
                <div
                  className={`flex-1 h-px mx-4 ${
                    currentStep > stepNum ? 'bg-[#0D7377]/40' : 'bg-border'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* STEP 1: Upload */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV File</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={uploadTab} onValueChange={setUploadTab}>
              <TabsList>
                <TabsTrigger value="file">Upload File</TabsTrigger>
                <TabsTrigger value="paste">Paste CSV</TabsTrigger>
              </TabsList>

              <TabsContent value="file">
                <div
                  className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
                    dragOver
                      ? 'border-[#0D7377] bg-[#0D7377]/5'
                      : 'border-border hover:border-[#0D7377]/50'
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground">
                    Drop CSV file here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Accepts .csv, .tsv, and .txt files
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.tsv,.txt"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />
                </div>
              </TabsContent>

              <TabsContent value="paste">
                <div className="space-y-3">
                  <Label htmlFor="csv-paste">Paste your CSV content below</Label>
                  <Textarea
                    id="csv-paste"
                    placeholder="name,email,phone&#10;John Doe,john@example.com,555-0100&#10;Jane Smith,jane@example.com,555-0200"
                    rows={8}
                    value={pastedContent}
                    onChange={(e) => setPastedContent(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <Button
                    onClick={handlePasteUpload}
                    disabled={!pastedContent.trim() || uploadLoading}
                    className="lotus-button"
                  >
                    {uploadLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Upload Pasted Data
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            {uploadLoading && uploadTab === 'file' && (
              <LoadingState message="Processing file..." size="sm" />
            )}

            {uploadError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <p className="text-sm text-red-700">{uploadError}</p>
                </div>
              </div>
            )}

            {uploadResult && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                      <FileText className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-green-800">{fileName}</p>
                      <p className="text-sm text-green-600">
                        {uploadResult.totalRows} rows, {uploadResult.headers.length} columns
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setCurrentStep(2)}
                    className="lotus-button"
                  >
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Configure */}
      {currentStep === 2 && uploadResult && (
        <div className="space-y-6">
          {/* Entity Type Selector */}
          <Card>
            <CardHeader>
              <CardTitle>What are you importing?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {ENTITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleEntitySelect(option.value)}
                    className={`rounded-lg border-2 p-4 text-left transition-all ${
                      entityType === option.value
                        ? 'border-[#0D7377] bg-[#0D7377]/5'
                        : 'border-border hover:border-[#0D7377]/40'
                    }`}
                  >
                    <div className={`mb-2 ${entityType === option.value ? 'text-[#0D7377]' : 'text-muted-foreground'}`}>
                      {option.icon}
                    </div>
                    <p className="font-medium text-sm">{option.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {option.description}
                    </p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Column Mapping */}
          {entityType && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Map Columns</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadTemplate}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Template
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {fieldsLoading ? (
                  <LoadingState message="Loading field definitions..." size="sm" />
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Map your CSV columns to Lotus fields. Required fields are marked with <span className="text-red-500">*</span>
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {entityFields.map((field) => {
                        // Find which CSV header is mapped to this field
                        const mappedHeader = Object.entries(columnMapping).find(
                          ([, v]) => v === field.key
                        )?.[0]

                        return (
                          <div key={field.key} className="space-y-1.5">
                            <Label className="text-sm">
                              {field.label}
                              {field.required && (
                                <span className="text-red-500 ml-0.5">*</span>
                              )}
                              <span className="text-xs text-muted-foreground ml-1">
                                ({field.type})
                              </span>
                            </Label>
                            <Select
                              value={mappedHeader || '__none__'}
                              onValueChange={(val) => {
                                // Clear any previous mapping TO this field
                                const newMapping = { ...columnMapping }
                                for (const [k, v] of Object.entries(newMapping)) {
                                  if (v === field.key) delete newMapping[k]
                                }
                                if (val !== '__none__') {
                                  newMapping[val] = field.key
                                }
                                setColumnMapping(newMapping)
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select CSV column" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">
                                  (unmapped)
                                </SelectItem>
                                {uploadResult.headers.map((header) => (
                                  <SelectItem key={header} value={header}>
                                    {header}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )
                      })}
                    </div>

                    {/* Sample Data Preview */}
                    {uploadResult.sampleRows.length > 0 && Object.keys(columnMapping).length > 0 && (
                      <div className="mt-6">
                        <p className="text-sm font-medium mb-2">
                          Sample data preview (first 3 rows)
                        </p>
                        <div className="overflow-x-auto rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {getMappedHeaders().map((header, i) => (
                                  <TableHead key={i} className="text-xs">
                                    {header}
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {uploadResult.sampleRows.slice(0, 3).map((row, rowIdx) => (
                                <TableRow key={rowIdx}>
                                  {uploadResult.headers.map((header, colIdx) => (
                                    <TableCell key={colIdx} className="text-xs">
                                      {row[header] || ''}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(1)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              className="lotus-button"
              disabled={!canProceedToPreview || previewLoading}
              onClick={handlePreview}
            >
              {previewLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Preview Import
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {previewError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <p className="text-sm text-red-700">{previewError}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 3: Preview */}
      {currentStep === 3 && previewResult && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Valid Rows</p>
                    <p className="text-2xl font-bold text-green-700">
                      {previewResult.totalValid}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <XCircle className="h-6 w-6 text-red-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Invalid Rows</p>
                    <p className="text-2xl font-bold text-red-700">
                      {previewResult.totalInvalid}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Valid Rows Table */}
          {previewResult.validRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-green-700 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Valid Rows (showing up to 10)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-16">Row</TableHead>
                        {entityFields.map((f) => (
                          <TableHead key={f.key} className="text-xs">
                            {f.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewResult.validRows.map((row) => (
                        <TableRow key={row.rowIndex} className="border-l-4 border-l-green-300">
                          <TableCell className="text-xs font-mono">
                            {row.rowIndex}
                          </TableCell>
                          {entityFields.map((f) => (
                            <TableCell key={f.key} className="text-xs">
                              {row.data[f.key] || ''}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Invalid Rows Table */}
          {previewResult.invalidRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-red-700 flex items-center gap-2">
                  <XCircle className="h-5 w-5" />
                  Invalid Rows (showing up to 10)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-16">Row</TableHead>
                        {entityFields.map((f) => (
                          <TableHead key={f.key} className="text-xs">
                            {f.label}
                          </TableHead>
                        ))}
                        <TableHead className="text-xs">Errors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewResult.invalidRows.map((row) => (
                        <TableRow key={row.rowIndex} className="border-l-4 border-l-red-300">
                          <TableCell className="text-xs font-mono">
                            {row.rowIndex}
                          </TableCell>
                          {entityFields.map((f) => (
                            <TableCell key={f.key} className="text-xs">
                              {row.data[f.key] || ''}
                            </TableCell>
                          ))}
                          <TableCell>
                            <div className="space-y-1">
                              {row.errors.map((err, i) => (
                                <p key={i} className="text-xs text-red-600">
                                  {err.message}
                                </p>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Skip Invalid Checkbox */}
          {previewResult.totalInvalid > 0 && (
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipInvalid}
                    onChange={(e) => setSkipInvalid(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-[#0D7377] focus:ring-[#0D7377]"
                  />
                  <div>
                    <p className="text-sm font-medium">Skip invalid rows and import valid ones only</p>
                    <p className="text-xs text-muted-foreground">
                      {previewResult.totalValid} rows will be imported, {previewResult.totalInvalid} will be skipped
                    </p>
                  </div>
                </label>
              </CardContent>
            </Card>
          )}

          {executeError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <p className="text-sm text-red-700">{executeError}</p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(2)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              className="lotus-button"
              size="lg"
              disabled={executeLoading || previewResult.totalValid === 0}
              onClick={handleExecute}
            >
              {executeLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Import {previewResult.totalValid} Records
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: Results */}
      {currentStep === 4 && (
        <div className="space-y-6">
          {executeLoading ? (
            <Card>
              <CardContent className="p-12">
                <LoadingState message="Importing records... This may take a moment." size="lg" />
              </CardContent>
            </Card>
          ) : executeResult ? (
            <>
              {/* Results Summary */}
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="border-l-4 border-l-green-500">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-6 w-6 text-green-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Imported</p>
                        <p className="text-2xl font-bold text-green-700">
                          {executeResult.imported}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-yellow-500">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-6 w-6 text-yellow-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Skipped</p>
                        <p className="text-2xl font-bold text-yellow-700">
                          {executeResult.skipped}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-red-500">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <XCircle className="h-6 w-6 text-red-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Errors</p>
                        <p className="text-2xl font-bold text-red-700">
                          {executeResult.errors.length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Error Details (expandable) */}
              {executeResult.errors.length > 0 && (
                <Card>
                  <CardHeader>
                    <button
                      type="button"
                      className="flex items-center justify-between w-full"
                      onClick={() => setErrorsExpanded(!errorsExpanded)}
                    >
                      <CardTitle className="text-red-700 flex items-center gap-2">
                        <XCircle className="h-5 w-5" />
                        Import Errors ({executeResult.errors.length})
                      </CardTitle>
                      {errorsExpanded ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                  </CardHeader>
                  {errorsExpanded && (
                    <CardContent>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {executeResult.errors.map((err, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50/50 p-3 text-sm"
                          >
                            <Badge variant="destructive" className="shrink-0">
                              Row {err.rowIndex}
                            </Badge>
                            <span className="text-red-700">{err.error}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3">
                <Button onClick={resetWizard} variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Import More
                </Button>
                {entityType && ENTITY_NAV_MAP[entityType] && (
                  <Button
                    className="lotus-button"
                    onClick={() => router.push(ENTITY_NAV_MAP[entityType])}
                  >
                    View {ENTITY_OPTIONS.find((o) => o.value === entityType)?.label || 'Records'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </>
          ) : executeError ? (
            <Card>
              <CardContent className="p-6">
                <EmptyState
                  icon={<XCircle className="h-8 w-8 text-red-500" />}
                  title="Import Failed"
                  description={executeError}
                  action={{ label: 'Try Again', onClick: () => setCurrentStep(3) }}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  )
}
