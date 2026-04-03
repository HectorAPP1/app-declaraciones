import { api } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  DocumentTextIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  TruckIcon,
  ArrowPathRoundedSquareIcon,
  ClipboardDocumentCheckIcon,
  BanknotesIcon,
  DocumentCheckIcon,
  FolderOpenIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

// ─── Types (mirrors History.tsx) ─────────────────────────────────────────────

interface Invoice {
  id: string
  tipo: 'domiciliary' | 'recyclable'
  proveedor: string
  fecha: string
  moneda: string
  neto: string
  monto: string
  residuos: string
  paymentStatus: 'pending' | 'paid' | 'overdue'
  paymentNote: string
  sinaderStatus: 'pending' | 'declared' | 'overdue'
  sinaderNote: string
  folio: string
  backendId: string
  _raw: any
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusChip({ status, note, type }: { status: string; note: string; type: 'payment' | 'sinader' }) {
  const payMap: Record<string, { cls: string; label: string; dot: string }> = {
    pending: { cls: 'text-amber-700 bg-amber-50 border-amber-200',   dot: 'bg-amber-400 animate-pulse', label: 'Pendiente' },
    paid:    { cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', label: 'Pagado' },
    overdue: { cls: 'text-rose-700 bg-rose-50 border-rose-200',     dot: 'bg-rose-500', label: 'Atrasado' },
  }
  const sinMap: Record<string, { cls: string; label: string; dot: string }> = {
    pending:  { cls: 'text-amber-700 bg-amber-50 border-amber-200',   dot: 'bg-amber-400 animate-pulse', label: 'Pendiente' },
    declared: { cls: 'text-indigo-700 bg-indigo-50 border-indigo-200', dot: 'bg-indigo-500', label: 'Declarado' },
    overdue:  { cls: 'text-rose-700 bg-rose-50 border-rose-200',     dot: 'bg-rose-500', label: 'Incumplido' },
  }
  const { cls, label, dot } = (type === 'payment' ? payMap : sinMap)[status] ?? payMap.pending
  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className={`rounded-full px-3 py-1 font-semibold border flex items-center gap-1.5 ${cls}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{label}
      </Badge>
      {note && <span className="text-xs text-slate-400">{note}</span>}
    </div>
  )
}

function Row({ icon: Icon, label, value, className = '' }: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-start gap-3 py-3 border-b border-slate-100 last:border-0 ${className}`}>
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
        <div className="mt-0.5 text-sm font-medium text-slate-800">{value}</div>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  invoice: Invoice | null
  onClose: () => void
}

export default function InvoiceDetailModal({ invoice, onClose }: Props) {
  if (!invoice) return null

  const isRecyclable = invoice.tipo === 'recyclable'
  const hasDoc = !!invoice._raw?.document
  const hasCert = !!invoice._raw?.certificate
  const docUrl = hasDoc ? api.documentUrl(invoice.backendId) : null
  const certUrl = hasCert ? api.certificateUrl(invoice.backendId) : null
  // Show whichever document is available in the PDF viewer (prefer invoice, fallback to cert)
  const previewUrl = docUrl ?? certUrl

  return (
    <Dialog open={!!invoice} onOpenChange={onClose}>
      <DialogContent
        className="max-h-[88vh] overflow-hidden flex flex-col p-0"
        style={{ width: '95vw', maxWidth: previewUrl ? '1152px' : '1024px' }}
      >
        {/* Header */}
        <DialogHeader className="px-8 pt-7 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <DocumentTextIcon className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">Factura {invoice.id}</DialogTitle>
              <p className="text-sm text-slate-500 mt-0.5">
                {isRecyclable ? 'Servicio de reciclaje' : 'Recolección domiciliaria'}
              </p>
            </div>
            <div className="ml-auto">
              <Badge
                variant="outline"
                className={`rounded-full px-3 py-1 font-semibold text-sm border ${
                  isRecyclable
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {isRecyclable ? '♻️ Reciclable' : '🚛 Domiciliario'}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Body Container */}
        <div className={`overflow-hidden flex-1 flex ${previewUrl ? 'flex-col md:flex-row' : 'flex-col'}`}>
          {/* Metadata Sidebar (or full width if no doc) */}
          <div className={`overflow-y-auto px-8 py-4 ${previewUrl ? 'w-full md:w-1/3 border-r border-slate-100 flex-shrink-0' : 'w-full'}`}>
            <div className={hasDoc ? 'flex flex-col gap-6' : 'grid grid-cols-1 lg:grid-cols-3 gap-x-10 gap-y-6'}>
              
              {/* BLOCK 1: Datos & Montos */}
              <div className="flex flex-col gap-6">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Datos del comprobante</p>
                  <Row icon={DocumentTextIcon} label="Nº Factura"     value={<span className="font-mono font-bold">{invoice.id}</span>} />
                  <Row icon={BuildingOffice2Icon} label="Proveedor"   value={invoice.proveedor} />
                  <Row icon={CalendarDaysIcon} label="Fecha Emisión" value={invoice.fecha} />
                </div>

                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Montos</p>
                  <Row icon={CurrencyDollarIcon} label="Moneda"      value={<Badge variant="outline" className="text-xs">{invoice.moneda}</Badge>} />
                  <Row icon={BanknotesIcon}      label="Monto Neto"  value={<span className="text-slate-600">{invoice.neto}</span>} />
                  <Row icon={CurrencyDollarIcon} label="Total (IVA)" value={<span className="text-lg font-bold text-indigo-700">{invoice.monto}</span>} />
                </div>
              </div>

              {/* BLOCK 2: Residuos & Compliance */}
              <div className="flex flex-col gap-6">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Residuos</p>
                  {isRecyclable && invoice._raw?.items?.length > 0 ? (
                    <div className="bg-slate-50 rounded-xl p-3 flex flex-col gap-2">
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowPathRoundedSquareIcon className="w-5 h-5 text-indigo-400 shrink-0" />
                        <p className="text-xs text-slate-500 font-medium">Materiales reciclados · {invoice.residuos}</p>
                      </div>
                      {(invoice._raw.items as any[]).map((item: any, i: number) => {
                        const kg = item.unit === 'TON'
                          ? (item.quantity_ton * 1000).toLocaleString('es-CL', { maximumFractionDigits: 0 })
                          : Number(item.quantity).toLocaleString('es-CL', { maximumFractionDigits: 0 })
                        return (
                          <div key={i} className="flex items-center justify-between text-xs px-1">
                            <span className="text-slate-700 font-medium capitalize">{item.description}</span>
                            <span className="text-slate-500 font-mono">{kg} kg</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-4">
                      <TruckIcon className="w-8 h-8 text-slate-400 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-500 font-medium">A relleno sanitario</p>
                        <p className="text-2xl font-bold text-slate-800 mt-0.5">{invoice.residuos}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Seguimiento normativo</p>
                  <div className="flex flex-col gap-4">
                    <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 text-slate-700 mb-1">
                        <ClipboardDocumentCheckIcon className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-bold uppercase tracking-wide">SINADER (10 días)</span>
                      </div>
                      <StatusChip status={invoice.sinaderStatus} note={invoice.sinaderNote} type="sinader" />
                      {invoice.folio !== '—' && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                          <DocumentCheckIcon className="w-3.5 h-3.5" />
                          Folio: <span className="font-mono font-semibold text-slate-700">{invoice.folio}</span>
                        </div>
                      )}
                    </div>
                    <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 text-slate-700 mb-1">
                        <BanknotesIcon className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-bold uppercase tracking-wide">Pago (30 días)</span>
                      </div>
                      <StatusChip status={invoice.paymentStatus} note={invoice.paymentNote} type="payment" />
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOCK 3: Documents */}
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Documentos adjuntos</p>
                <div className="flex flex-col gap-3">
                  <div className={`flex items-center gap-3 border rounded-xl p-3 ${hasDoc ? 'border-emerald-100 bg-emerald-50/30' : 'border-slate-200 bg-slate-50/50'}`}>
                    <FolderOpenIcon className={`w-5 h-5 shrink-0 ${hasDoc ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${hasDoc ? 'text-emerald-700' : 'text-slate-700'}`}>Factura PDF</p>
                      <p className={`text-xs truncate ${hasDoc ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {hasDoc ? invoice._raw.document : 'No adjunto aún'}
                      </p>
                    </div>
                    {hasDoc
                      ? <DocumentCheckIcon className="w-4 h-4 text-emerald-500 ml-auto shrink-0" title="Adjunto" />
                      : <ExclamationTriangleIcon className="w-4 h-4 text-amber-400 ml-auto shrink-0" title="No adjunto aún" />
                    }
                  </div>
                  {isRecyclable && (
                    <div className={`flex items-center gap-3 border rounded-xl p-3 ${hasCert ? 'border-indigo-100 bg-indigo-50/30' : 'border-slate-200 bg-slate-50/50'}`}>
                      <ArrowPathRoundedSquareIcon className={`w-5 h-5 shrink-0 ${hasCert ? 'text-indigo-400' : 'text-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${hasCert ? 'text-indigo-700' : 'text-slate-700'}`}>Certificado Reciclaje</p>
                        <p className={`text-xs truncate ${hasCert ? 'text-indigo-400' : 'text-slate-400'}`}>
                          {hasCert ? invoice._raw.certificate : 'No adjunto aún'}
                        </p>
                      </div>
                      {hasCert
                        ? <DocumentCheckIcon className="w-4 h-4 text-indigo-500 ml-auto shrink-0" title="Adjunto" />
                        : <ExclamationTriangleIcon className="w-4 h-4 text-amber-400 ml-auto shrink-0" title="No adjunto aún" />
                      }
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* PDF Viewer */}
          {previewUrl && (
             <div className="flex-1 bg-slate-100 flex flex-col min-h-[500px]">
               <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs font-medium text-slate-500">
                 <span>Vista previa · {docUrl ? 'Factura' : 'Certificado'}</span>
                 <div className="flex items-center gap-3">
                   {docUrl && <a href={docUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800 transition-colors">Factura PDF</a>}
                   {certUrl && <a href={certUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800 transition-colors">Certificado PDF</a>}
                 </div>
               </div>
               <iframe src={previewUrl} className="w-full h-full flex-1 border-0" />
             </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-px bg-slate-100" />
        <div className="flex items-center justify-end px-8 py-4 bg-white gap-3">
          <button
            className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            onClick={onClose}
          >
            Cerrar
          </button>
          <button className="flex items-center gap-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-5 py-2 rounded-lg shadow-sm transition-colors">
            <DocumentCheckIcon className="w-4 h-4" />
            Editar factura
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
