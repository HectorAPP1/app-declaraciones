import { useState, useEffect, useCallback } from 'react'
import InvoiceDetailModal from '@/components/InvoiceDetailModal'
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge }  from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { api }   from '@/lib/api'
import type { Invoice, PaymentStatus, SinaderStatus, InvoiceType } from '@/lib/types'

// ─── Local view types ─────────────────────────────────────────────────────────

type FilterType = 'all' | 'domiciliary' | 'recyclable' | 'pending' | 'overdue'

// ─── UI adapter: map backend Invoice → flat display shape ─────────────────────

function fmt(inv: Invoice) {
  const d = new Date(inv.date)
  const dateLabel = isNaN(d.getTime())
    ? inv.date
    : d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
  const agg = inv.aggregates
  const residuosTons = agg ? Object.values(agg.residue_totals).reduce((s, v) => s + v, 0) : 0
  const residuosLabel = residuosTons > 0
    ? inv.type === 'domiciliary'
      ? `${residuosTons.toFixed(2)} ton`
      : `${(residuosTons * 1000).toFixed(0)} kg`
    : '—'
  const clp = (n: number) => n > 0 ? `$${Math.round(n).toLocaleString('es-CL')}` : '—'
  return {
    id:            inv.number || inv.id,
    backendId:     inv.id,
    tipo:          inv.type as InvoiceType,
    proveedor:     inv.provider,
    fecha:         dateLabel,
    moneda:        inv.currency,
    neto:          clp(inv.totals?.subtotal ?? 0),
    monto:         clp(inv.totals?.total ?? 0),
    residuos:      residuosLabel,
    paymentStatus: (inv.payment_status || 'pending') as PaymentStatus,
    paymentNote:   inv.payment_note || '',
    sinaderStatus: (inv.sinader_status || 'pending') as SinaderStatus,
    sinaderNote:   inv.sinader_note || '',
    folio:         inv.sinader_folio || '—',
    _raw:          inv,
  }
}

type DisplayInvoice = ReturnType<typeof fmt>

const ROWS_OPTIONS = ['5', '10', '20', '50']

// ─── Payment Badge ────────────────────────────────────────────────────────────

function PaymentBadge({ status, note }: { status: PaymentStatus; note: string }) {
  const cfg = {
    pending: { cls: 'text-amber-700 bg-amber-50 border-amber-100',    dot: 'bg-amber-500 animate-pulse', label: 'Pendiente' },
    paid:    { cls: 'text-emerald-700 bg-emerald-50 border-emerald-100', dot: 'bg-emerald-500',          label: 'Pagado' },
    overdue: { cls: 'text-rose-700 bg-rose-50 border-rose-100',        dot: 'bg-rose-500',               label: 'Atrasado' },
  }[status]
  return (
    <div>
      <Badge variant="secondary" className={`rounded-full font-medium px-3 flex w-fit items-center gap-1.5 shadow-sm ${cfg.cls}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
      </Badge>
      {note && <p className={`text-[10px] mt-1 ml-1 font-medium ${status === 'overdue' ? 'text-rose-400' : 'text-slate-400'}`}>{note}</p>}
    </div>
  )
}

// ─── SINADER Badge ────────────────────────────────────────────────────────────

function SinaderBadge({ status, note }: { status: SinaderStatus; note: string }) {
  const cfg = {
    pending:  { cls: 'text-amber-700 bg-amber-50 border-amber-100',    dot: 'bg-amber-500 animate-pulse', label: 'Pendiente' },
    declared: { cls: 'text-indigo-700 bg-indigo-50 border-indigo-100', dot: 'bg-indigo-500',              label: 'Declarado' },
    overdue:  { cls: 'text-rose-700 bg-rose-50 border-rose-100',       dot: 'bg-rose-500',                label: 'Incumplido' },
  }[status]
  return (
    <div>
      <Badge variant="secondary" className={`rounded-full font-medium px-3 flex w-fit items-center gap-1.5 shadow-sm ${cfg.cls}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
      </Badge>
      {note && <p className={`text-[10px] mt-1 ml-1 ${status === 'overdue' ? 'text-rose-400 font-medium' : 'text-slate-400'}`}>{note}</p>}
    </div>
  )
}

// ─── Row Context Menu ─────────────────────────────────────────────────────────

function RowMenu({ invoice, onUpdate, onDelete, onViewDetail }: {
  invoice: DisplayInvoice
  onUpdate: (backendId: string, patch: Partial<Invoice>) => void
  onDelete: (backendId: string) => void
  onViewDetail: (inv: DisplayInvoice) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md text-slate-400 hover:bg-slate-100 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
        </svg>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 z-50">
        <DropdownMenuItem className="cursor-pointer text-slate-700" onClick={() => onViewDetail(invoice)}>
          👁 Ver detalle
        </DropdownMenuItem>
        
        {invoice.paymentStatus !== 'paid' && (
          <DropdownMenuItem className="cursor-pointer text-emerald-700 focus:text-emerald-800 focus:bg-emerald-50" onClick={() => onUpdate(invoice.backendId, { payment_status: 'paid', payment_note: '' })}>
            ✓ Marcar como Pagado
          </DropdownMenuItem>
        )}
        {invoice.paymentStatus === 'paid' && (
          <DropdownMenuItem className="cursor-pointer text-amber-700 focus:text-amber-800 focus:bg-amber-50" onClick={() => onUpdate(invoice.backendId, { payment_status: 'pending', payment_note: 'Vence en 30 días' })}>
            ↩ Marcar como Pendiente
          </DropdownMenuItem>
        )}
        
        {invoice.sinaderStatus === 'pending' && (
          <DropdownMenuItem className="cursor-pointer text-indigo-700 focus:text-indigo-800 focus:bg-indigo-50" onClick={() => onUpdate(invoice.backendId, { sinader_status: 'declared', sinader_note: 'Folio: pendiente' })}>
            🏛️ Declarar en SINADER
          </DropdownMenuItem>
        )}
        {invoice.sinaderStatus === 'declared' && (
          <DropdownMenuItem className="cursor-pointer text-amber-700 focus:text-amber-800 focus:bg-amber-50" onClick={() => onUpdate(invoice.backendId, { sinader_status: 'pending', sinader_note: 'Vence en 10 días' })}>
            ↩ Revertir SINADER
          </DropdownMenuItem>
        )}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem className="cursor-pointer text-rose-600 focus:text-rose-700 focus:bg-rose-50" onClick={() => onDelete(invoice.backendId)}>
          🗑 Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Column Customizer ────────────────────────────────────────────────────────

const ALL_COLUMNS = [
  { id: 'proveedor', label: 'Proveedor' },
  { id: 'tipo',      label: 'Tipo' },
  { id: 'fecha',     label: 'Fecha Emisión' },
  { id: 'moneda',    label: 'Moneda' },
  { id: 'neto',      label: 'Monto Neto' },
  { id: 'monto',     label: 'Total Factura' },
  { id: 'residuos',  label: 'Residuos (kg/ton)' },
  { id: 'payment',   label: 'Estado Pago (30d)' },
  { id: 'sinader',   label: 'SINADER (10d)' },
  { id: 'folio',     label: 'Folio SINADER' },
]

function ColumnCustomizer({ visible, onToggle }: { visible: Set<string>; onToggle: (id: string) => void }) {
  return (
    <div className="absolute right-0 top-10 z-50 w-52 rounded-xl border border-slate-200 bg-white shadow-lg p-3" onClick={e => e.stopPropagation()}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">Columnas visibles</p>
      <div className="space-y-1">
        {ALL_COLUMNS.map(col => (
          <label key={col.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
            <input type="checkbox" className="rounded border-slate-300 accent-indigo-600"
              checked={visible.has(col.id)} onChange={() => onToggle(col.id)} />
            <span className="text-sm text-slate-700">{col.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ─── Bulk Action Bar ──────────────────────────────────────────────────────────

function BulkActionBar({ count, onMarkPaid, onRevertPaid, onMarkDeclared, onRevertDeclared, onExportCSV, onDeleteSelected, onClear }: {
  count: number
  onMarkPaid: () => void
  onRevertPaid: () => void
  onMarkDeclared: () => void
  onRevertDeclared: () => void
  onExportCSV: () => void
  onDeleteSelected: () => void
  onClear: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-lg animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 rounded-lg px-3 py-1.5 shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <span className="text-sm font-bold">{count}</span>
        <span className="text-xs font-medium hidden sm:inline">seleccionada{count !== 1 ? 's' : ''}</span>
      </div>
      <div className="h-6 w-px bg-slate-200 shrink-0" />
      <div className="flex flex-col gap-0.5">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-1">Pago</span>
        <div className="flex items-center gap-1">
          <button onClick={onMarkPaid} className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md px-2.5 py-1 transition-colors">✓ Pagado</button>
          <button onClick={onRevertPaid} className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md px-2.5 py-1 transition-colors">↩ Pendiente</button>
        </div>
      </div>
      <div className="h-6 w-px bg-slate-200 shrink-0" />
      <div className="flex flex-col gap-0.5">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-1">SINADER</span>
        <div className="flex items-center gap-1">
          <button onClick={onMarkDeclared} className="flex items-center gap-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md px-2.5 py-1 transition-colors">🏛 Declarado</button>
          <button onClick={onRevertDeclared} className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md px-2.5 py-1 transition-colors">↩ Pendiente</button>
        </div>
      </div>
      <div className="h-6 w-px bg-slate-200 shrink-0" />
      <button onClick={onExportCSV} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Excel
      </button>
      <div className="h-6 w-px bg-slate-200 shrink-0" />
      <button onClick={onDeleteSelected} className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg px-3 py-1.5 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        Eliminar
      </button>
      <button onClick={onClear} className="ml-auto text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface HistoryViewProps {
  onOpenModal?: () => void
}

export default function HistoryView({ onOpenModal }: HistoryViewProps) {
  const [filter, setFilter]             = useState<FilterType>('all')
  const [invoices, setInvoices]         = useState<DisplayInvoice[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [page, setPage]                 = useState(1)
  const [rowsPerPage, setRowsPerPage]   = useState('10')
  const [selected, setSelected]         = useState<Set<string>>(new Set())
  const [showCols, setShowCols]         = useState(false)
  const [viewInvoice, setViewInvoice]   = useState<DisplayInvoice | null>(null)

  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('ecometrics_cols')
      if (saved) return new Set<string>(JSON.parse(saved))
    } catch { /* ignore */ }
    return new Set(['tipo', 'fecha', 'monto', 'payment', 'sinader'])
  })

  // ─ Load ────────────────────────────────────────────────────────────────────
  const loadInvoices = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await api.listInvoices()
      setInvoices(data.map(fmt))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar facturas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadInvoices() }, [loadInvoices])

  // ─ Column toggle ───────────────────────────────────────────────────────────
  const toggleCol = (id: string) =>
    setVisibleCols(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      localStorage.setItem('ecometrics_cols', JSON.stringify([...n]))
      return n
    })

  // ─ Update ──────────────────────────────────────────────────────────────────
  const updateInvoice = async (backendId: string, patch: Partial<Invoice>) => {
    try {
      const cur = invoices.find(i => i.backendId === backendId)
      if (!cur) return
      const updated = await api.updateInvoice(backendId, { ...cur._raw, ...patch })
      setInvoices(prev => prev.map(i => i.backendId === backendId ? fmt(updated) : i))
    } catch (e) { console.error('Error actualizando:', e) }
  }

  // ─ Delete ──────────────────────────────────────────────────────────────────
  const deleteInvoice = async (backendId: string) => {
    try {
      await api.deleteInvoice(backendId)
      setInvoices(prev => prev.filter(i => i.backendId !== backendId))
      setSelected(prev => { const n = new Set(prev); n.delete(backendId); return n })
    } catch (e) { console.error('Error eliminando:', e) }
  }

  // ─ Filters ─────────────────────────────────────────────────────────────────
  const filtered = invoices.filter(inv => {
    if (filter === 'domiciliary') return inv.tipo === 'domiciliary'
    if (filter === 'recyclable')  return inv.tipo === 'recyclable'
    if (filter === 'pending')     return inv.paymentStatus === 'pending' || inv.sinaderStatus === 'pending'
    if (filter === 'overdue')     return inv.paymentStatus === 'overdue' || inv.sinaderStatus === 'overdue'
    return true
  })

  const counts = {
    all:         invoices.length,
    domiciliary: invoices.filter(i => i.tipo === 'domiciliary').length,
    recyclable:  invoices.filter(i => i.tipo === 'recyclable').length,
    pending:     invoices.filter(i => i.paymentStatus === 'pending' || i.sinaderStatus === 'pending').length,
    overdue:     invoices.filter(i => i.paymentStatus === 'overdue' || i.sinaderStatus === 'overdue').length,
  }

  // ─ Pagination ──────────────────────────────────────────────────────────────
  const rpp        = parseInt(rowsPerPage)
  const totalPages = Math.max(1, Math.ceil(filtered.length / rpp))
  const paginated  = filtered.slice((page - 1) * rpp, page * rpp)

  // ─ Selection ───────────────────────────────────────────────────────────────
  const allPageSelected = paginated.length > 0 && paginated.every(i => selected.has(i.backendId))
  const toggleAll = () => allPageSelected
    ? setSelected(prev => { const n = new Set(prev); paginated.forEach(i => n.delete(i.backendId)); return n })
    : setSelected(prev => { const n = new Set(prev); paginated.forEach(i => n.add(i.backendId));    return n })
  const toggleRow = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const bulkMarkPaid      = () => selected.forEach(id => updateInvoice(id, { payment_status: 'paid', payment_note: '' }))
  const bulkMarkDeclared  = () => selected.forEach(id => updateInvoice(id, { sinader_status: 'declared', sinader_note: 'Folio: pendiente' }))
  const bulkDelete        = async () => { await Promise.all([...selected].map(id => deleteInvoice(id))); setSelected(new Set()) }

  // ─ CSV Export ──────────────────────────────────────────────────────────────
  const exportToCSV = () => {
    const sel = invoices.filter(i => selected.has(i.backendId))
    const colMap: Record<string, (inv: DisplayInvoice) => string> = {
      proveedor: i => i.proveedor,
      tipo:      i => i.tipo === 'domiciliary' ? 'Domiciliario' : 'Reciclable',
      fecha:     i => i.fecha,
      moneda:    i => i.moneda,
      neto:      i => i.neto,
      monto:     i => i.monto,
      residuos:  i => i.residuos,
      payment:   i => i.paymentStatus,
      sinader:   i => i.sinaderStatus,
      folio:     i => i.folio,
    }
    const activeCols = ALL_COLUMNS.filter(c => visibleCols.has(c.id))
    const headers = ['Comprobante', ...activeCols.map(c => c.label)]
    const rows = sel.map(inv => [inv.id, ...activeCols.map(c => colMap[c.id]?.(inv) ?? '')].join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `facturas_${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const tabCls = (t: FilterType) =>
    `rounded-full text-sm font-medium transition-colors px-4 py-1.5 ${filter === t ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 bg-transparent border-0'}`

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-500" onClick={() => setShowCols(false)}>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <BulkActionBar
          count={selected.size}
          onMarkPaid={bulkMarkPaid}
          onRevertPaid={() => selected.forEach(id => updateInvoice(id, { payment_status: 'pending', payment_note: 'Vence en 30 días' }))}
          onMarkDeclared={bulkMarkDeclared}
          onRevertDeclared={() => selected.forEach(id => updateInvoice(id, { sinader_status: 'pending', sinader_note: 'Vence en 10 días' }))}
          onExportCSV={exportToCSV}
          onDeleteSelected={bulkDelete}
          onClear={() => setSelected(new Set())}
        />
      )}

      {/* Filter tabs + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-1 overflow-x-auto pb-2 sm:pb-0">
          {([
            ['all',         'Todos'],
            ['domiciliary', 'Domiciliarios'],
            ['recyclable',  'Reciclables'],
            ['pending',     'Pendientes'],
            ['overdue',     'Atrasadas'],
          ] as [FilterType, string][]).map(([key, label]) => (
            <button key={key} className={tabCls(key)} onClick={() => { setFilter(key); setPage(1) }}>
              {label}
              {counts[key] > 0 && (
                <span className={`ml-1.5 text-xs font-semibold rounded-full px-1.5 py-0.5 ${
                  key === 'overdue' ? 'bg-rose-100 text-rose-600' :
                  key === 'pending' ? 'bg-amber-100 text-amber-700' :
                  filter === key    ? 'bg-white border border-slate-200 text-slate-800' :
                                      'bg-slate-100 text-slate-500'
                }`}>{counts[key]}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative" onClick={e => e.stopPropagation()}>
            <Button variant="outline" className={`bg-white shadow-sm font-medium h-9 text-xs ${showCols ? 'border-indigo-400 text-indigo-700' : ''}`}
              onClick={() => setShowCols(o => !o)}>
              ⚙ Columnas
            </Button>
            {showCols && <ColumnCustomizer visible={visibleCols} onToggle={toggleCol} />}
          </div>
          <Button variant="outline" className="bg-white shadow-sm font-medium h-9 text-xs" onClick={() => onOpenModal?.()}>
            + Añadir factura
          </Button>
          <Button variant="outline" className="bg-white shadow-sm font-medium h-9 text-xs" onClick={loadInvoices} title="Recargar">
            ↻
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 flex items-center gap-2">
          ⚠️ {error} —{' '}<button className="underline font-medium" onClick={loadInvoices}>Reintentar</button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-white hover:bg-white border-b border-slate-100">
              <TableHead className="w-12 text-center">
                <input type="checkbox" className="rounded border-slate-300" checked={allPageSelected} onChange={toggleAll} />
              </TableHead>
              <TableHead className="h-10 font-semibold text-xs text-slate-600">Comprobante</TableHead>
              {visibleCols.has('proveedor') && <TableHead className="h-10 font-semibold text-xs text-slate-600">Proveedor</TableHead>}
              {visibleCols.has('tipo')      && <TableHead className="h-10 font-semibold text-xs text-slate-600">Tipo</TableHead>}
              {visibleCols.has('fecha')     && <TableHead className="h-10 font-semibold text-xs text-slate-600">Fecha Emisión</TableHead>}
              {visibleCols.has('moneda')    && <TableHead className="h-10 font-semibold text-xs text-slate-600">Moneda</TableHead>}
              {visibleCols.has('neto')      && <TableHead className="h-10 font-semibold text-xs text-slate-600 text-right">Monto Neto</TableHead>}
              {visibleCols.has('monto')     && <TableHead className="h-10 font-semibold text-xs text-slate-600 text-right">Total Factura</TableHead>}
              {visibleCols.has('residuos')  && <TableHead className="h-10 font-semibold text-xs text-slate-600">Residuos</TableHead>}
              {visibleCols.has('payment')   && <TableHead className="h-10 font-semibold text-xs text-slate-600">Estado Pago (30d)</TableHead>}
              {visibleCols.has('sinader')   && <TableHead className="h-10 font-semibold text-xs text-slate-600">SINADER (10d)</TableHead>}
              {visibleCols.has('folio')     && <TableHead className="h-10 font-semibold text-xs text-slate-600">Folio</TableHead>}
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-12 text-slate-400 text-sm">
                  Cargando facturas…
                </TableCell>
              </TableRow>
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-12 text-slate-400 text-sm">
                  No hay facturas en este filtro.
                </TableCell>
              </TableRow>
            ) : paginated.map(inv => (
              <TableRow key={inv.backendId}
                className={`group hover:bg-slate-50/80 transition-colors border-slate-100 ${selected.has(inv.backendId) ? 'bg-indigo-50/40' : ''}`}>
                <TableCell className="text-center">
                  <input type="checkbox" className="rounded border-slate-300 accent-indigo-600"
                    checked={selected.has(inv.backendId)} onChange={() => toggleRow(inv.backendId)} />
                </TableCell>
                <TableCell className="font-medium text-slate-900 py-3">{inv.id}</TableCell>
                {visibleCols.has('proveedor') && <TableCell className="text-slate-600 py-3 text-sm">{inv.proveedor}</TableCell>}
                {visibleCols.has('tipo') && (
                  <TableCell className="py-3">
                    <Badge variant="outline" className="rounded-full font-medium text-slate-600 border-slate-200 bg-white px-3">
                      {inv.tipo === 'domiciliary' ? 'Domiciliario' : 'Reciclable'}
                    </Badge>
                  </TableCell>
                )}
                {visibleCols.has('fecha')    && <TableCell className="text-slate-600 py-3">{inv.fecha}</TableCell>}
                {visibleCols.has('moneda')   && <TableCell className="text-slate-600 py-3 font-medium">{inv.moneda}</TableCell>}
                {visibleCols.has('neto')     && <TableCell className="text-right font-medium text-slate-700 py-3">{inv.neto}</TableCell>}
                {visibleCols.has('monto')    && <TableCell className="text-right font-bold text-slate-900 py-3">{inv.monto}</TableCell>}
                {visibleCols.has('residuos') && <TableCell className="text-slate-600 py-3 text-sm font-medium">{inv.residuos}</TableCell>}
                {visibleCols.has('payment')  && <TableCell className="py-3"><PaymentBadge status={inv.paymentStatus} note={inv.paymentNote} /></TableCell>}
                {visibleCols.has('sinader')  && <TableCell className="py-3"><SinaderBadge status={inv.sinaderStatus} note={inv.sinaderNote} /></TableCell>}
                {visibleCols.has('folio')    && <TableCell className="text-slate-500 py-3 text-sm">{inv.folio}</TableCell>}
                <TableCell className="py-3">
                  <RowMenu
                    invoice={inv}
                    onUpdate={updateInvoice}
                    onDelete={deleteInvoice}
                    onViewDetail={setViewInvoice}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 bg-white">
          <span className="text-[13px] text-slate-500">
            {selected.size > 0
              ? <span className="text-indigo-600 font-medium">{selected.size} seleccionada{selected.size !== 1 ? 's' : ''}</span>
              : <>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</>
            }
          </span>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-slate-700">Filas</span>
              <Select value={rowsPerPage} onValueChange={v => { if (v) { setRowsPerPage(v); setPage(1) } }}>
                <SelectTrigger className="w-[64px] h-8 text-[13px] font-medium border-slate-200 shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROWS_OPTIONS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <span className="text-[13px] font-medium text-slate-700">Pág. {page} de {totalPages}</span>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" className="h-8 w-8 shadow-none rounded-md border-slate-200"
                disabled={page === 1} onClick={() => setPage(1)}>«</Button>
              <Button variant="outline" size="icon" className="h-8 w-8 shadow-none rounded-md border-slate-200"
                disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</Button>
              <Button variant="outline" size="icon" className="h-8 w-8 shadow-none rounded-md border-slate-200"
                disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</Button>
              <Button variant="outline" size="icon" className="h-8 w-8 shadow-none rounded-md border-slate-200"
                disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Detail Modal */}
      <InvoiceDetailModal invoice={viewInvoice} onClose={() => setViewInvoice(null)} />
    </div>
  )
}
