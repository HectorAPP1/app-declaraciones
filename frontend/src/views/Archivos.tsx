import { useState, useRef, useEffect } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DocumentIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  ClipboardDocumentCheckIcon,
  ArrowPathRoundedSquareIcon,
  ReceiptPercentIcon,
  TrashIcon,
  CloudArrowUpIcon,
  FolderArrowDownIcon,
} from '@heroicons/react/24/outline'

// ─── Types ────────────────────────────────────────────────────────────────────

type FolderKey = 'sinader' | 'certificados' | 'facturas2026' | 'facturas2025' | 'facturas2024'

interface DocFile {
  id: string
  name: string
  folder: FolderKey
  date: string
  size: string
  url?: string          // real url once backend is connected
}

// ─── No mock files, fetched from API ──────────────────────────────────────────

// ─── Folder config ────────────────────────────────────────────────────────────

const FOLDERS: { key: FolderKey; label: string; sub: string; Icon: React.ElementType; color: string; iconColor: string }[] = [
  { key: 'sinader',      label: 'Declaraciones SINADER', sub: 'PDFs declaración ventanilla', Icon: ClipboardDocumentCheckIcon, color: 'bg-indigo-50 hover:bg-indigo-100', iconColor: 'text-indigo-600' },
  { key: 'certificados', label: 'Certificados Reciclaje', sub: 'PDFs de Ciclo Verde u otro', Icon: ArrowPathRoundedSquareIcon,  color: 'bg-emerald-50 hover:bg-emerald-100', iconColor: 'text-emerald-600' },
  { key: 'facturas2026', label: 'Facturas 2026',          sub: 'Facturas vigentes',          Icon: ReceiptPercentIcon,          color: 'bg-amber-50 hover:bg-amber-100',   iconColor: 'text-amber-600' },
  { key: 'facturas2025', label: 'Facturas 2025',          sub: 'Año anterior',                Icon: ReceiptPercentIcon,          color: 'bg-slate-50 hover:bg-slate-100',   iconColor: 'text-slate-500' },
  { key: 'facturas2024', label: 'Facturas 2024',          sub: 'Archivo histórico',           Icon: ReceiptPercentIcon,          color: 'bg-slate-50 hover:bg-slate-100',   iconColor: 'text-slate-400' },
]

const FOLDER_LABEL: Record<FolderKey, string> = {
  sinader:      'Declaraciones SINADER',
  certificados: 'Certificados Reciclaje',
  facturas2026: 'Facturas 2026',
  facturas2025: 'Facturas 2025',
  facturas2024: 'Facturas 2024',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────


function downloadDocument(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
}

// ─── Document Viewer Modal ────────────────────────────────────────────────────

function DocumentViewerModal({ file, onClose }: { file: DocFile | null; onClose: () => void }) {
  if (!file) return null
  const url = file.url ?? null

  return (
    <Dialog open={!!file} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-6xl w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <DocumentIcon className="w-6 h-6 text-indigo-600" />
            {file.name}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 bg-slate-100 flex flex-col min-h-0 relative">
          {url ? (
            <iframe src={url} className="w-full h-full border-0 absolute inset-0" title={file.name} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <DocumentIcon className="w-12 h-12 mb-2 text-slate-300" />
              <p>Vista previa no disponible</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── SINADER Upload Dialog ────────────────────────────────────────────────────

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)

function SINADERUploader({ onUpload }: { onUpload: (f: DocFile) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [month, setMonth] = useState(String(new Date().getMonth() + 1))   // 1-12
  const [year,  setYear]  = useState(String(CURRENT_YEAR))
  const [error, setError] = useState('')

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    if (!month || !year) { setError('Selecciona el mes y año de la declaración antes de subir.'); return }
    setError('')
    const monthLabel = MONTHS[parseInt(month) - 1]
    const dateStr    = `${year}-${month.padStart(2, '0')}-01`
    Array.from(files).forEach(async file => {
      try {
        // Create a SINADER document entry in backend
        const inv = await api.createInvoice({
          number:   `SINADER-${year}-${month.padStart(2,'0')}`,
          provider: 'SINADER',
          date:     dateStr,
          currency: 'CLP',
          type:     'domiciliary',
          items:    [],
          totals:   { subtotal: 0, tax: 0, total: 0 },
        })
        await api.uploadDocument(inv.id, file)
        onUpload({
          id:     inv.id,
          name:   file.name,
          folder: 'sinader',
          date:   `${monthLabel} ${year}`,
          size:   file.size > 1024 * 1024
            ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
            : `${Math.round(file.size / 1024)} KB`,
          url:    api.documentUrl(inv.id),
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error subiendo archivo')
      }
    })
  }

  return (
    <div className="border border-slate-200 rounded-xl bg-white shadow-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <ClipboardDocumentCheckIcon className="w-5 h-5 text-indigo-500" />
        <p className="text-sm font-bold text-slate-800">Subir declaración SINADER</p>
      </div>

      {/* Date selectors */}
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
          Fecha de la declaración
        </label>
        <div className="flex gap-3">
          <select
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="flex-1 h-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="">Mes…</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1)}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={e => setYear(e.target.value)}
            className="w-28 h-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="">Año…</option>
            {YEARS.map(y => <option key={y} value={String(y)}>{y}</option>)}
          </select>
        </div>
        {error && <p className="text-xs text-rose-500 mt-1.5">{error}</p>}
      </div>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-6 transition-colors text-center cursor-pointer ${dragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-slate-50/50'}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => ref.current?.click()}
      >
        <input ref={ref} type="file" accept=".pdf" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
        <CloudArrowUpIcon className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-700">Arrastra el PDF aquí o haz clic para seleccionar</p>
        <p className="text-xs text-slate-400 mt-1">Solo archivos PDF · SINADER</p>
      </div>
    </div>
  )
}

// ─── Folder Card ──────────────────────────────────────────────────────────────

function FolderCard({
  folder, count, selected, onSelect, onOpen, onExport,
}: {
  folder: typeof FOLDERS[number]
  count: number
  selected: boolean
  onSelect: () => void
  onOpen: () => void
  onExport: () => void
}) {
  const { Icon, label, sub, color, iconColor } = folder
  return (
    <Card
      className={`shadow-sm border-2 transition-all cursor-pointer ${selected ? 'border-indigo-400 shadow-md' : 'border-slate-200'}`}
      onClick={onSelect}
    >
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg transition-colors ${color}`}>
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[13px] text-slate-800 truncate">{label}</p>
            <p className="text-[11px] text-slate-400">{sub}</p>
          </div>
          <Badge variant="secondary" className="text-[10px] px-2 py-0.5 shrink-0">{count}</Badge>
        </div>
        {/* Action buttons - shown always, highlighted when selected */}
        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
          <button
            onClick={onOpen}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 transition-colors"
          >
            <EyeIcon className="w-3.5 h-3.5" /> Abrir
          </button>
          <button
            onClick={onExport}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg px-2 py-1.5 transition-colors"
          >
            <FolderArrowDownIcon className="w-3.5 h-3.5" /> Exportar
          </button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ArchivosView() {
  const [files, setFiles]                 = useState<DocFile[]>([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [activeFolder, setActiveFolder]   = useState<FolderKey | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [showUploader, setShowUploader]   = useState(false)
  const [viewingFile, setViewingFile]     = useState<DocFile | null>(null)

  const loadFiles = async () => {
    setLoading(true)
    try {
      const invoices = await api.listInvoices()
      const loaded: DocFile[] = []

      for (const inv of invoices) {
        const year = inv.date ? new Date(inv.date).getFullYear() : new Date().getFullYear()
        const dateStr = new Date(inv.date || inv.created_at || Date.now()).toLocaleDateString('es-CL')
        const isSinader = inv.provider.toUpperCase() === 'SINADER'

        // Invoice document
        if (inv.document) {
          let folder: FolderKey = 'facturas2026'
          if (isSinader) {
            folder = 'sinader'
          } else if (year === 2024) {
            folder = 'facturas2024'
          } else if (year === 2025) {
            folder = 'facturas2025'
          }
          loaded.push({
            id: `${inv.id}__invoice`,
            name: inv.document,
            folder,
            date: dateStr,
            size: 'PDF',
            url: api.documentUrl(inv.id),
          })
        }

        // Certificate document (recyclable invoices)
        if (inv.certificate) {
          loaded.push({
            id: `${inv.id}__cert`,
            name: inv.certificate,
            folder: 'certificados',
            date: dateStr,
            size: 'PDF',
            url: api.certificateUrl(inv.id),
          })
        }
      }
      setFiles(loaded)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadFiles() }, [])

  // ── Derived ──
  const folderCount = (key: FolderKey) => files.filter(f => f.folder === key).length

  const displayed = files.filter(f => {
    const matchFolder = activeFolder ? f.folder === activeFolder : true
    const matchSearch = f.name.toLowerCase().includes(search.toLowerCase())
    return matchFolder && matchSearch
  })

  // ── Selection ──
  const toggleFile = (id: string) =>
    setSelectedFiles(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () =>
    setSelectedFiles(prev => prev.size === displayed.length ? new Set() : new Set(displayed.map(f => f.id)))
  const allSelected = displayed.length > 0 && selectedFiles.size === displayed.length

  // ── Actions ──
  const addFile = (f: DocFile) => setFiles(prev => [f, ...prev])
  const deleteFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id))

  const exportSelected = () => {
    const toExport = files.filter(f => selectedFiles.has(f.id))
    toExport.forEach(f => {
      const url = f.url ?? (f.id.includes('-') ? api.documentUrl(f.id) : null)
      if (url) downloadDocument(url, f.name)
    })
  }

  const openFolder = (key: FolderKey) => {
    setActiveFolder(key)
    // In production: open files in previewer/modal
  }

  const exportFolder = (key: FolderKey) => {
    files.filter(f => f.folder === key).forEach(f => {
      const url = f.url ?? (f.id.includes('-') ? api.documentUrl(f.id) : null)
      if (url) downloadDocument(url, f.name)
    })
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Archivos y Documentos</h2>
          <p className="text-slate-500 text-sm mt-1">
            Repositorio central de facturas, certificados y declaraciones SINADER.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              className="pl-9 h-9 w-[220px] bg-white shadow-sm"
              placeholder="Buscar documento..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            className="flex items-center gap-2 bg-white shadow-sm font-medium h-9 text-xs"
            onClick={() => setShowUploader(v => !v)}
          >
            <CloudArrowUpIcon className="w-4 h-4" />
            Subir SINADER
          </Button>
        </div>
      </div>

      {/* SINADER uploader (toggled) */}
      {showUploader && (
        <SINADERUploader onUpload={f => { addFile(f); setShowUploader(false) }} />
      )}

      {/* Folder grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Carpetas de almacenamiento</h3>
          {activeFolder && (
            <button
              className="text-xs text-indigo-600 hover:underline font-medium"
              onClick={() => setActiveFolder(null)}
            >
              ← Ver todos
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {FOLDERS.map(folder => (
            <FolderCard
              key={folder.key}
              folder={folder}
              count={folderCount(folder.key)}
              selected={activeFolder === folder.key}
              onSelect={() => setActiveFolder(prev => prev === folder.key ? null : folder.key)}
              onOpen={() => openFolder(folder.key)}
              onExport={() => exportFolder(folder.key)}
            />
          ))}
        </div>
      </div>

      {/* File table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">
            {activeFolder ? FOLDER_LABEL[activeFolder] : 'Todos los documentos'}
            <span className="ml-2 text-xs font-normal text-slate-400">({displayed.length} archivos)</span>
          </h3>

          {/* Bulk toolbar */}
          {selectedFiles.size > 0 && (
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow animate-in slide-in-from-right-2 duration-200">
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">{selectedFiles.size}</span>
              <span className="text-xs text-slate-600 font-medium">seleccionados</span>
              <div className="h-4 w-px bg-slate-200 mx-1" />
              <button
                onClick={exportSelected}
                className="flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-indigo-700 transition-colors"
              >
                <ArrowDownTrayIcon className="w-3.5 h-3.5" /> Descargar
              </button>
              <button
                onClick={() => { selectedFiles.forEach(id => deleteFile(id)); setSelectedFiles(new Set()) }}
                className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors"
              >
                <TrashIcon className="w-3.5 h-3.5" /> Eliminar
              </button>
              <button onClick={() => setSelectedFiles(new Set())} className="text-slate-300 hover:text-slate-500 text-xs ml-1">✕</button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 accent-indigo-600"
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="font-semibold text-xs text-slate-500 h-10 w-[40%]">Nombre del archivo</TableHead>
                <TableHead className="font-semibold text-xs text-slate-500 h-10">Carpeta</TableHead>
                <TableHead className="font-semibold text-xs text-slate-500 h-10">Fecha</TableHead>
                <TableHead className="font-semibold text-xs text-slate-500 h-10">Tamaño</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && displayed.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400 text-sm py-10">
                    Cargando documentos reales...
                  </TableCell>
                </TableRow>
              )}
              {!loading && displayed.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400 text-sm py-10">
                    No se encontraron documentos en la base de datos real.
                  </TableCell>
                </TableRow>
              )}
              {!loading && displayed.map(file => {
                const isChecked = selectedFiles.has(file.id)
                return (
                  <TableRow
                    key={file.id}
                    className={`hover:bg-slate-50 transition-colors ${isChecked ? 'bg-indigo-50/40' : ''}`}
                  >
                    <TableCell className="py-2.5">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 accent-indigo-600"
                        checked={isChecked}
                        onChange={() => toggleFile(file.id)}
                      />
                    </TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-2">
                        <DocumentIcon className="w-4 h-4 text-red-500 shrink-0" />
                        <span className="font-medium text-slate-800 text-[13px]">{file.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Badge variant="outline" className="text-[11px] font-medium text-slate-600 border-slate-200 rounded-full">
                        {FOLDER_LABEL[file.folder]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500 py-2.5 text-[13px]">{file.date}</TableCell>
                    <TableCell className="text-slate-500 py-2.5 text-[13px]">{file.size}</TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          title="Ver"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          onClick={() => {
                            setViewingFile(file)
                          }}
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button
                          title="Descargar"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                          onClick={() => {
                            const url = file.url ?? null
                            if (url) downloadDocument(url, file.name)
                          }}
                        >
                          <ArrowDownTrayIcon className="w-4 h-4" />
                        </button>
                        <button
                          title="Eliminar"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          onClick={() => deleteFile(file.id)}
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Document Viewer Modal */}
      <DocumentViewerModal file={viewingFile} onClose={() => setViewingFile(null)} />
    </div>
  )
}
