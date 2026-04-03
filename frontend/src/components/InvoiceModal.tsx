import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResiduoItem {
  material: string
  unit: 'kg' | 'ton'
  quantity: string
  destination: string
}

interface FormData {
  numero: string
  proveedor: string
  fecha: string
  currency: string
  type: string
  sinaderStatus: string
  paymentStatus: string
  subtotal: string
  impuestos: string
  total: string
  // Domiciliario
  toneladas: string
  // Reciclable
  residuos: ResiduoItem[]
  invoiceFile: File | null
  certFile: File | null
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Datos' },
  { id: 2, label: 'Clasificación' },
  { id: 3, label: 'Residuos' },
  { id: 4, label: 'Documentos' },
  { id: 5, label: 'Resumen' },
]

const MATERIALES_RECICLABLES = [
  { key: 'plastico',  label: 'Plástico' },
  { key: 'carton',    label: 'Cartón' },
  { key: 'papel',     label: 'Papel' },
  { key: 'vidrio',    label: 'Vidrio' },
  { key: 'metal',     label: 'Metales' },
  { key: 'tetrapak',  label: 'Tetrapak' },
  { key: 'organico',  label: 'Orgánico' },
  { key: 'textil',    label: 'Textil' },
  { key: 'raee',      label: 'RAEE' },
  { key: 'otros',     label: 'Otros' },
]

const getMaterialLabel = (key: string) =>
  MATERIALES_RECICLABLES.find(m => m.key === key)?.label ?? key

const emptyResiduo = (): ResiduoItem => ({
  material: 'plastico',
  unit: 'kg',
  quantity: '',
  destination: 'Reciclaje',
})

// ─── Component ─────────────────────────────────────────────────────────────────

export default function InvoiceModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>({
    numero: '',
    proveedor: '',
    fecha: '',
    currency: 'CLP',
    type: 'domiciliary',
    sinaderStatus: 'pending',
    paymentStatus: 'pending',
    subtotal: '',
    impuestos: '',
    total: '',
    toneladas: '',
    residuos: [emptyResiduo()],
    invoiceFile: null,
    certFile: null,
  })

  const set = <K extends keyof FormData>(field: K, value: FormData[K]) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleClose = () => {
    setStep(1)
    onClose()
  }

  const updateResiduo = (idx: number, field: keyof ResiduoItem, value: string) => {
    const updated = form.residuos.map((r, i) => i === idx ? { ...r, [field]: value } : r)
    set('residuos', updated)
  }

  const addResiduo = () => set('residuos', [...form.residuos, emptyResiduo()])
  const removeResiduo = (idx: number) => set('residuos', form.residuos.filter((_, i) => i !== idx))

  const next = () => setStep(s => Math.min(s + 1, STEPS.length))
  const back = () => setStep(s => Math.max(s - 1, 1))

  const totalResiduosKg = form.residuos.reduce((acc, r) => {
    const q = parseFloat(r.quantity) || 0
    return acc + (r.unit === 'ton' ? q * 1000 : q)
  }, 0)

  const handleSave = async () => {
    try {
      const isDom = form.type === 'domiciliary'
      const items = isDom ? [
        {
          description: 'Recolección domiciliaria general',
          residue_category: 'relleno_sanitario',
          unit: 'TON',
          quantity: parseFloat(form.toneladas) || 0,
          amount: parseFloat(form.subtotal) || 0
        }
      ] : form.residuos.filter(r => r.quantity).map(r => ({
          description: getMaterialLabel(r.material),
          residue_category: r.material,
          unit: r.unit.toUpperCase() as 'TON' | 'KG',
          quantity: parseFloat(r.quantity) || 0,
          amount: 0
      }))

      const payload = {
        number: form.numero || `FACT-${Date.now().toString().slice(-4)}`,
        provider: form.proveedor,
        date: form.fecha,
        currency: form.currency as 'CLP' | 'UF',
        type: form.type as 'domiciliary' | 'recyclable',
        items: items as any,
        totals: {
          subtotal: parseFloat(form.subtotal) || 0,
          tax: parseFloat(form.impuestos) || 0,
          total: parseFloat(form.total) || 0
        },
        payment_status: form.paymentStatus as 'pending' | 'paid' | 'overdue',
        sinader_status: form.sinaderStatus as 'pending' | 'declared' | 'overdue'
      }

      const inv = await api.createInvoice(payload)
      if (form.invoiceFile) await api.uploadDocument(inv.id, form.invoiceFile, 'invoice')
      if (form.certFile) await api.uploadDocument(inv.id, form.certFile, 'certificate')

      handleClose()
      window.location.reload()
    } catch (e) {
      console.error(e)
      alert('Error al guardar: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-h-[90vh] overflow-hidden flex flex-col p-0"
        style={{ width: '92vw', maxWidth: '960px' }}
      >
        {/* ── Header ── */}
        <DialogHeader className="px-8 pt-7 pb-0">
          <DialogTitle className="text-xl font-bold text-slate-900">Registrar factura</DialogTitle>
        </DialogHeader>

        {/* ── Step indicators ── */}
        <div className="flex items-center px-8 pt-5 pb-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1 min-w-0">
              <button type="button" onClick={() => step > s.id && setStep(s.id)} className="flex items-center gap-2 shrink-0">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                  ${step === s.id ? 'bg-indigo-600 text-white shadow-md' : ''}
                  ${step > s.id ? 'bg-emerald-500 text-white' : ''}
                  ${step < s.id ? 'bg-slate-100 text-slate-400 border border-slate-200' : ''}
                `}>
                  {step > s.id ? '✓' : s.id}
                </span>
                <span className={`text-xs font-medium whitespace-nowrap hidden sm:inline transition-colors
                  ${step === s.id ? 'text-indigo-700' : step > s.id ? 'text-emerald-600' : 'text-slate-400'}
                `}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-[2px] mx-2 rounded transition-colors ${step > s.id ? 'bg-emerald-400' : 'bg-slate-100'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="h-px bg-slate-100 mx-8 mt-4" />

        {/* ── Step Content ── */}
        <div className="overflow-y-auto flex-1 px-8 py-6">

          {/* STEP 1: Datos básicos */}
          {step === 1 && (
            <div className="grid gap-5">
              <p className="text-sm text-slate-500">Ingresa los datos principales de la factura recibida.</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Nº Factura</label>
                  <Input placeholder="Ej. 4638" value={form.numero} onChange={e => set('numero', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Proveedor</label>
                  <Input placeholder="Nombre del proveedor" value={form.proveedor} onChange={e => set('proveedor', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Fecha de emisión</label>
                  <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Moneda</label>
                  <Select value={form.currency} onValueChange={v => v && set('currency', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLP">CLP – Peso Chileno</SelectItem>
                      <SelectItem value="UF">UF – Unidad de Fomento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Monto Neto</label>
                  <Input type="number" placeholder="0" value={form.subtotal} onChange={e => set('subtotal', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">IVA (19%)</label>
                  <Input type="number" placeholder="0" value={form.impuestos} onChange={e => set('impuestos', e.target.value)} />
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Total Factura</label>
                  <Input type="number" placeholder="0" value={form.total} onChange={e => set('total', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Clasificación */}
          {step === 2 && (
            <div className="grid gap-5">
              <p className="text-sm text-slate-500">Clasifica el tipo de operación y define los estados de cumplimiento normativo.</p>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Tipo de operación</label>
                <Select value={form.type} onValueChange={v => v && set('type', v)}>
                  <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="min-w-[200px]">
                    <SelectItem value="domiciliary">Domiciliario</SelectItem>
                    <SelectItem value="recyclable">Reciclable</SelectItem>
                  </SelectContent>
                </Select>
                {form.type === 'domiciliary' && (
                  <p className="text-xs text-slate-400 mt-1">Residuos van a relleno sanitario. Se mide en toneladas.</p>
                )}
                {form.type === 'recyclable' && (
                  <p className="text-xs text-indigo-500 mt-1">Materiales van a planta de reciclaje. Se mide por tipo de material en kg.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="border border-amber-100 bg-amber-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🏛️</span>
                    <span className="text-sm font-semibold text-amber-900">Declaración SINADER</span>
                  </div>
                  <p className="text-xs text-amber-700">Plazo máximo: <strong>10 días hábiles</strong></p>
                  <Select value={form.sinaderStatus} onValueChange={v => v && set('sinaderStatus', v)}>
                    <SelectTrigger className="bg-white border-amber-200 text-amber-900"><SelectValue /></SelectTrigger>
                    <SelectContent className="min-w-[240px]">
                      <SelectItem value="pending">Pendiente (10 días máx.)</SelectItem>
                      <SelectItem value="declared">Declarado en Ventanilla Única</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="border border-blue-100 bg-blue-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">💳</span>
                    <span className="text-sm font-semibold text-blue-900">Estado de Pago</span>
                  </div>
                  <p className="text-xs text-blue-700">Plazo máximo: <strong>30 días corridos</strong></p>
                  <Select value={form.paymentStatus} onValueChange={v => v && set('paymentStatus', v)}>
                    <SelectTrigger className="bg-white border-blue-200 text-blue-900"><SelectValue /></SelectTrigger>
                    <SelectContent className="min-w-[200px]">
                      <SelectItem value="pending">Pendiente de pago</SelectItem>
                      <SelectItem value="paid">Pagado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Residuos – el corazón de la app */}
          {step === 3 && (
            <div className="grid gap-5">
              {form.type === 'domiciliary' ? (
                <>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 mb-1">Residuos Domiciliarios — Relleno Sanitario</p>
                    <p className="text-xs text-slate-500">Ingresa el peso total retirado según la factura (en toneladas).</p>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-6 bg-slate-50/50 space-y-4 max-w-sm">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Toneladas retiradas</label>
                      <div className="flex items-center gap-3">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          className="text-lg font-semibold"
                          value={form.toneladas}
                          onChange={e => set('toneladas', e.target.value)}
                        />
                        <span className="text-sm font-medium text-slate-500 whitespace-nowrap">ton</span>
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-500 space-y-1">
                      <p className="font-semibold text-slate-700">Destino</p>
                      <p>🏔️ Relleno sanitario</p>
                    </div>
                  </div>
                  {form.toneladas && (
                    <div className="flex items-center gap-2 text-sm text-emerald-600">
                      <span className="text-base">✓</span>
                      <span className="font-medium">{parseFloat(form.toneladas).toFixed(2)} toneladas registradas</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 mb-1">Materiales Reciclables — Planta de Reciclaje</p>
                      <p className="text-xs text-slate-500">Ingresa cada tipo de material y su peso (en kg) según el certificado de disposición sustentable.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="bg-white shrink-0" onClick={addResiduo}>
                      + Añadir material
                    </Button>
                  </div>

                  {/* Column headers */}
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 px-1">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Material</span>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cantidad</span>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Unidad</span>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Destino</span>
                    <span />
                  </div>

                  <div className="space-y-3">
                    {form.residuos.map((r, idx) => (
                      <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 items-center bg-white border border-slate-200 rounded-lg p-3">
                        <Select value={r.material} onValueChange={v => updateResiduo(idx, 'material', v || '')}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent className="min-w-[200px]">
                            {MATERIALES_RECICLABLES.map(m => (
                              <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          className="h-9 text-sm"
                          value={r.quantity}
                          onChange={e => updateResiduo(idx, 'quantity', e.target.value)}
                        />
                        <Select value={r.unit} onValueChange={v => updateResiduo(idx, 'unit', v || '')}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="kg">kg</SelectItem>
                            <SelectItem value="ton">ton</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={r.destination} onValueChange={v => updateResiduo(idx, 'destination', v || '')}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Reciclaje">Reciclaje</SelectItem>
                            <SelectItem value="Relleno sanitario">Relleno sanitario</SelectItem>
                            <SelectItem value="Compostaje">Compostaje</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-500"
                          onClick={() => form.residuos.length > 1 && removeResiduo(idx)}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Total summary */}
                  {totalResiduosKg > 0 && (
                    <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3">
                      <span className="text-sm font-semibold text-indigo-800">Total reciclado</span>
                      <div className="text-right">
                        <span className="text-lg font-bold text-indigo-700">{totalResiduosKg.toLocaleString('es-CL')} kg</span>
                        <span className="text-xs text-indigo-500 ml-2">({(totalResiduosKg / 1000).toFixed(3)} ton)</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* STEP 4: Documentos */}
          {step === 4 && (
            <div className="grid gap-5">
              <p className="text-sm text-slate-500">Adjunta los archivos PDF originales que respaldan esta operación.</p>
              <div className={`grid gap-4 ${form.type === 'recyclable' ? 'grid-cols-2' : 'grid-cols-1 max-w-md'}`}>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 space-y-3 hover:border-indigo-300 transition-colors bg-slate-50/50">
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="text-2xl">📄</span>
                    <span className="font-semibold text-sm">Factura Comercial (PDF)</span>
                    <Badge variant="outline" className="text-[10px] ml-auto border-red-200 text-red-600 bg-red-50">Requerido</Badge>
                  </div>
                  <p className="text-xs text-slate-400">Documento SII emitido por el proveedor.</p>
                  <Input type="file" accept="application/pdf" className="cursor-pointer bg-white text-sm"
                    onChange={e => set('invoiceFile', e.target.files?.[0] ?? null)} required />
                  {form.invoiceFile && <p className="text-xs text-emerald-600 font-medium">✓ {form.invoiceFile.name}</p>}
                </div>
                {form.type === 'recyclable' && (
                  <div className="border-2 border-dashed border-indigo-200 rounded-xl p-6 space-y-3 hover:border-indigo-400 transition-colors bg-indigo-50/30">
                    <div className="flex items-center gap-2 text-indigo-700">
                      <span className="text-2xl">♻️</span>
                      <span className="font-semibold text-sm">Certificado de Reciclaje (PDF)</span>
                      <Badge variant="outline" className="text-[10px] ml-auto border-red-200 text-red-600 bg-red-50">Requerido</Badge>
                    </div>
                    <p className="text-xs text-indigo-500">Certificado de Disposición Sustentable del gestor.</p>
                    <Input type="file" accept="application/pdf" className="cursor-pointer bg-white text-sm border-indigo-200"
                      onChange={e => set('certFile', e.target.files?.[0] ?? null)} required />
                    {form.certFile && <p className="text-xs text-emerald-600 font-medium">✓ {form.certFile.name}</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: Resumen */}
          {step === 5 && (
            <div className="grid gap-5">
              <p className="text-sm text-slate-500">Revisa todos los datos antes de guardar la factura.</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-50 rounded-lg p-4 space-y-2 border border-slate-100">
                  <p className="font-semibold text-slate-600 text-xs uppercase tracking-wide mb-3">Datos</p>
                  <div className="flex justify-between"><span className="text-slate-500">Nº Factura</span><span className="font-medium">#{form.numero || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Proveedor</span><span className="font-medium">{form.proveedor || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Fecha</span><span className="font-medium">{form.fecha || '—'}</span></div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 mt-1"><span className="font-semibold">Total</span><span className="font-bold text-indigo-700">{form.currency} ${form.total || '0'}</span></div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 space-y-2 border border-slate-100">
                  <p className="font-semibold text-slate-600 text-xs uppercase tracking-wide mb-3">Clasificación</p>
                  <div className="flex justify-between"><span className="text-slate-500">Tipo</span><span className="font-medium">{form.type === 'domiciliary' ? 'Domiciliario' : 'Reciclable'}</span></div>
                  <div className="flex justify-between items-center"><span className="text-slate-500">SINADER</span>
                    <Badge className={`text-xs ${form.sinaderStatus === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {form.sinaderStatus === 'pending' ? 'Pendiente' : 'Declarado'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center"><span className="text-slate-500">Pago</span>
                    <Badge className={`text-xs ${form.paymentStatus === 'pending' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {form.paymentStatus === 'pending' ? 'Pendiente' : 'Pagado'}
                    </Badge>
                  </div>
                </div>

                {/* Residuos summary */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 col-span-2">
                  <p className="font-semibold text-slate-600 text-xs uppercase tracking-wide mb-3">Residuos</p>
                  {form.type === 'domiciliary' ? (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Relleno sanitario</span>
                      <span className="font-bold text-slate-800">{form.toneladas || '0'} toneladas</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {form.residuos.filter(r => r.quantity).map((r, i) => (
                        <div key={i} className="flex justify-between items-center">
                          <span className="text-slate-500">{getMaterialLabel(r.material)}</span>
                          <div className="text-right">
                            <span className="font-bold text-slate-800">{r.quantity} {r.unit}</span>
                            <span className="text-xs text-slate-400 ml-2">→ {r.destination}</span>
                          </div>
                        </div>
                      ))}
                      {totalResiduosKg > 0 && (
                        <div className="flex justify-between border-t border-slate-200 pt-2 mt-1">
                          <span className="font-semibold text-indigo-700">Total</span>
                          <span className="font-bold text-indigo-700">{totalResiduosKg.toLocaleString('es-CL')} kg</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 rounded-lg p-4 space-y-2 border border-slate-100 col-span-2">
                  <p className="font-semibold text-slate-600 text-xs uppercase tracking-wide mb-3">Documentos</p>
                  <div className="flex justify-between"><span className="text-slate-500">Factura PDF</span>{form.invoiceFile ? <span className="text-emerald-600 font-medium text-xs">✓ Adjunto</span> : <span className="text-red-500 text-xs">⚠ Falta</span>}</div>
                  {form.type === 'recyclable' && (
                    <div className="flex justify-between"><span className="text-slate-500">Certificado</span>{form.certFile ? <span className="text-emerald-600 font-medium text-xs">✓ Adjunto</span> : <span className="text-red-500 text-xs">⚠ Falta</span>}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="h-px bg-slate-100" />
        <div className="flex items-center justify-between px-8 py-4 bg-white">
          <Button type="button" variant="ghost" onClick={step === 1 ? handleClose : back} className="text-slate-600">
            {step === 1 ? 'Cancelar' : '← Atrás'}
          </Button>
          <div className="flex items-center gap-1.5">
            {STEPS.map(s => (
              <span key={s.id} className={`h-2 rounded-full transition-all duration-300 ${step === s.id ? 'bg-indigo-600 w-5' : step > s.id ? 'bg-emerald-400 w-2' : 'bg-slate-200 w-2'}`} />
            ))}
          </div>
          {step < STEPS.length ? (
            <Button type="button" onClick={next} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm">
              Siguiente →
            </Button>
          ) : (
            <Button type="button" onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm px-6">
              ✓ Guardar Factura
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
