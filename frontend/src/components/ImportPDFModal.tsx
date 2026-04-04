import { useState, useRef } from 'react'
import { Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { api, type OcrResult, type OcrItem } from '@/lib/api'

// ─── Constants ────────────────────────────────────────────────────────────────

const MATERIALES = [
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

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = 'select' | 'loading' | 'preview'
type InvoiceType = 'domiciliary' | 'recyclable'

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImportPDFModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen:    boolean
  onClose:   () => void
  onSuccess: () => void
}) {
  const [stage, setStage]             = useState<Stage>('select')
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('domiciliary')
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [certFile, setCertFile]       = useState<File | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)
  const [raw, setRaw]                 = useState<OcrResult | null>(null)
  const [form, setForm]               = useState<OcrResult | null>(null)

  const invoiceRef = useRef<HTMLInputElement>(null)
  const certRef    = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStage('select')
    setInvoiceType('domiciliary')
    setInvoiceFile(null)
    setCertFile(null)
    setError(null)
    setSaving(false)
    setRaw(null)
    setForm(null)
  }

  const handleClose = () => { reset(); onClose() }

  // ── Parse ─────────────────────────────────────────────────────────────────

  const handleParse = async () => {
    if (!invoiceFile) return
    setStage('loading')
    setError(null)
    try {
      const result = await api.parsePdf(
        invoiceFile,
        invoiceType,
        invoiceType === 'recyclable' ? certFile ?? undefined : undefined,
      )
      setRaw(result)
      setForm(structuredClone(result))
      setStage('preview')
    } catch (e: any) {
      setError(e.message ?? 'Error al analizar el PDF')
      setStage('select')
    }
  }

  // ── Form helpers ──────────────────────────────────────────────────────────

  const setField = <K extends keyof OcrResult>(k: K, v: OcrResult[K]) =>
    setForm(f => f ? { ...f, [k]: v } : f)

  const setTotals = (k: keyof OcrResult['totals'], v: string) =>
    setForm(f => f ? { ...f, totals: { ...f.totals, [k]: parseFloat(v) || 0 } } : f)

  const setItem = (i: number, k: keyof OcrItem, v: string | number) =>
    setForm(f => {
      if (!f) return f
      const items = f.items.map((item, idx) =>
        idx === i ? { ...item, [k]: typeof v === 'string' && k !== 'residue_category' && k !== 'unit' && k !== 'description'
          ? parseFloat(v) || 0
          : v
        } : item
      )
      return { ...f, items }
    })

  const addItem = () =>
    setForm(f => f ? {
      ...f,
      items: [...f.items, {
        description: '',
        residue_category: f.type === 'recyclable' ? 'plastico' : 'relleno_sanitario',
        unit: 'TON',
        quantity: 0,
        amount: 0,
      }]
    } : f)

  const removeItem = (i: number) =>
    setForm(f => f ? { ...f, items: f.items.filter((_, idx) => idx !== i) } : f)

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form || !invoiceFile) return
    setSaving(true)
    setError(null)
    try {
      const invoice = await api.createInvoice({
        number:   form.number,
        provider: form.provider,
        date:     form.date,
        currency: form.currency,
        type:     form.type,
        items:    form.items,
        totals:   form.totals,
      } as any)

      await api.uploadDocument(invoice.id, invoiceFile, 'invoice')

      if (certFile && form.type === 'recyclable') {
        await api.uploadDocument(invoice.id, certFile, 'certificate')
      }

      if (raw && (
        raw.provider !== form.provider ||
        JSON.stringify(raw.items) !== JSON.stringify(form.items)
      )) {
        await api.saveOcrCorrection(raw, form).catch(() => {/* non-critical */})
      }

      onSuccess()
      handleClose()
    } catch (e: any) {
      setError(e.message ?? 'Error al guardar la factura')
    } finally {
      setSaving(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && handleClose()}>
      <DialogContent
        className="max-h-[90vh] overflow-hidden flex flex-col p-0"
        style={{ width: '92vw', maxWidth: '960px' }}
      >
        {/* ── Header ── */}
        <DialogHeader className="px-8 pt-7 pb-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-600" />
            <DialogTitle className="text-xl font-bold text-slate-900">
              Importar factura desde PDF
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="h-px bg-slate-100 mx-8 mt-5" />

        {/* ── Content ── */}
        <div className="overflow-y-auto flex-1 px-8 py-6">

          {/* Stage: select */}
          {stage === 'select' && (
            <div className="grid gap-6">
              <p className="text-sm text-slate-500">
                Indica el tipo de factura y sube los archivos PDF. La IA extraerá y normalizará los datos automáticamente.
              </p>

              {/* Type selector */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Tipo de factura</label>
                <div className="flex gap-3 max-w-md">
                  {(['domiciliary', 'recyclable'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => { setInvoiceType(t); setCertFile(null) }}
                      className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                        invoiceType === t
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {t === 'domiciliary' ? '🏘 Domiciliario' : '♻️ Reciclable'}
                    </button>
                  ))}
                </div>
              </div>

              {/* File zones */}
              <div className={`grid gap-4 ${invoiceType === 'recyclable' ? 'grid-cols-2' : 'grid-cols-1 max-w-md'}`}>
                {/* Invoice PDF */}
                <div
                  className="border-2 border-dashed border-slate-200 rounded-xl p-6 space-y-3 hover:border-indigo-300 transition-colors bg-slate-50/50 cursor-pointer"
                  onClick={() => invoiceRef.current?.click()}
                >
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="text-2xl">📄</span>
                    <span className="font-semibold text-sm">Factura Comercial (PDF)</span>
                    <Badge variant="outline" className="text-[10px] ml-auto border-red-200 text-red-600 bg-red-50">Requerido</Badge>
                  </div>
                  <p className="text-xs text-slate-400">Documento SII emitido por el proveedor.</p>
                  {invoiceFile
                    ? <p className="text-xs text-emerald-600 font-medium">✓ {invoiceFile.name}</p>
                    : <p className="text-xs text-slate-400">Haz clic para seleccionar</p>
                  }
                  <input
                    ref={invoiceRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setInvoiceFile(f) }}
                  />
                </div>

                {/* Certificate PDF — recyclable only */}
                {invoiceType === 'recyclable' && (
                  <div
                    className="border-2 border-dashed border-indigo-200 rounded-xl p-6 space-y-3 hover:border-indigo-400 transition-colors bg-indigo-50/30 cursor-pointer"
                    onClick={() => certRef.current?.click()}
                  >
                    <div className="flex items-center gap-2 text-indigo-700">
                      <span className="text-2xl">♻️</span>
                      <span className="font-semibold text-sm">Certificado de Reciclaje (PDF)</span>
                      <Badge variant="outline" className="text-[10px] ml-auto border-slate-200 text-slate-500">Opcional</Badge>
                    </div>
                    <p className="text-xs text-indigo-500">Mejora la extracción de categorías y cantidades.</p>
                    {certFile
                      ? <p className="text-xs text-emerald-600 font-medium">✓ {certFile.name}</p>
                      : <p className="text-xs text-indigo-400">Haz clic para seleccionar</p>
                    }
                    <input
                      ref={certRef}
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) setCertFile(f) }}
                    />
                  </div>
                )}
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-2 rounded-lg">{error}</p>
              )}
            </div>
          )}

          {/* Stage: loading */}
          {stage === 'loading' && (
            <div className="py-16 text-center space-y-4">
              <div className="inline-block w-10 h-10 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-sm font-medium text-slate-600">Analizando PDF con IA…</p>
              <p className="text-xs text-slate-400">
                {invoiceType === 'recyclable' && certFile
                  ? 'Procesando factura y certificado'
                  : 'Consultando proveedores y categorías registradas'}
              </p>
            </div>
          )}

          {/* Stage: preview */}
          {stage === 'preview' && form && (
            <div className="grid gap-5">

              {/* Date warning */}
              {form.date_confidence !== 'high' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                  <span className="font-semibold">Fecha con confianza {form.date_confidence}:</span>{' '}
                  {form.date_notes ?? 'Revisa que la fecha sea correcta antes de guardar.'}
                </div>
              )}

              {/* Certificate notice */}
              {certFile && form.type === 'recyclable' && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
                  Certificado adjunto: <span className="font-medium">{certFile.name}</span> — se subirá junto con la factura.
                </div>
              )}

              {/* Basic fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">N° Factura</label>
                  <Input
                    value={form.number}
                    onChange={e => setField('number', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Fecha</label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={e => setField('date', e.target.value)}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Proveedor</label>
                  <Input
                    value={form.provider}
                    onChange={e => setField('provider', e.target.value)}
                  />
                  {form.provider_rut && (
                    <p className="text-xs text-slate-400">RUT: {form.provider_rut}</p>
                  )}
                  {raw && raw.provider !== form.provider && (
                    <p className="text-xs text-indigo-500">
                      Original detectado: "{raw.provider}" → se aprenderá esta corrección
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Tipo</label>
                  <Select value={form.type} onValueChange={v => setField('type', v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="domiciliary">Domiciliario</SelectItem>
                      <SelectItem value="recyclable">Reciclable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Moneda</label>
                  <Select value={form.currency} onValueChange={v => setField('currency', v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLP">CLP – Peso Chileno</SelectItem>
                      <SelectItem value="UF">UF – Unidad de Fomento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700">Ítems / Residuos</label>
                  <Button variant="outline" size="sm" className="bg-white text-xs h-8" onClick={addItem}>
                    + Añadir ítem
                  </Button>
                </div>

                {/* Column headers */}
                {form.type === 'recyclable' ? (
                  <div className="grid grid-cols-[2fr_1fr_1fr_1.5fr_auto] gap-3 px-1">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Categoría</span>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Unidad</span>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cantidad</span>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Monto</span>
                    <span />
                  </div>
                ) : (
                  <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-3 px-1">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Categoría</span>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Unidad</span>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cantidad</span>
                    <span />
                  </div>
                )}

                {form.items.map((item, i) => (
                  <div
                    key={i}
                    className={`grid gap-3 items-center bg-white border border-slate-200 rounded-lg p-3 ${
                      form.type === 'recyclable'
                        ? 'grid-cols-[2fr_1fr_1fr_1.5fr_auto]'
                        : 'grid-cols-[2fr_1fr_1fr_auto]'
                    }`}
                  >
                    <Select
                      value={item.residue_category ?? ''}
                      onValueChange={v => setItem(i, 'residue_category', v ?? '')}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {form.type === 'recyclable'
                          ? MATERIALES.map(m => (
                              <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                            ))
                          : <SelectItem value="relleno_sanitario">Relleno sanitario</SelectItem>
                        }
                      </SelectContent>
                    </Select>

                    <Select value={item.unit ?? 'TON'} onValueChange={v => setItem(i, 'unit', v ?? 'TON')}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TON">TON</SelectItem>
                        <SelectItem value="KG">KG</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      type="number"
                      step="0.001"
                      value={item.quantity}
                      onChange={e => setItem(i, 'quantity', e.target.value)}
                      className="h-9 text-sm"
                    />

                    {form.type === 'recyclable' && (
                      <Input
                        type="number"
                        value={item.amount}
                        onChange={e => setItem(i, 'amount', e.target.value)}
                        className="h-9 text-sm"
                      />
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-red-500"
                      onClick={() => removeItem(i)}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="grid grid-cols-3 gap-4">
                {(['subtotal', 'tax', 'total'] as const).map(k => (
                  <div key={k} className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">
                      {k === 'subtotal' ? 'Monto Neto' : k === 'tax' ? 'IVA (19%)' : 'Total Factura'}
                    </label>
                    <Input
                      type="number"
                      value={form.totals[k]}
                      onChange={e => setTotals(k, e.target.value)}
                    />
                  </div>
                ))}
              </div>

              {/* Summary badges */}
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {form.type === 'domiciliary' ? 'Domiciliario' : 'Reciclable'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Total: {form.currency} {form.totals.total.toLocaleString('es-CL')}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {form.items.length} ítem{form.items.length !== 1 ? 's' : ''}
                </Badge>
                {certFile && form.type === 'recyclable' && (
                  <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">
                    + certificado
                  </Badge>
                )}
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-2 rounded-lg">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="h-px bg-slate-100" />
        <div className="flex items-center justify-between px-8 py-4 bg-white">
          {stage === 'select' && (
            <>
              <Button variant="ghost" onClick={handleClose} className="text-slate-600">Cancelar</Button>
              <Button
                onClick={handleParse}
                disabled={!invoiceFile}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm"
              >
                <Sparkles size={14} className="mr-1.5" />
                Analizar con IA
              </Button>
            </>
          )}
          {stage === 'loading' && (
            <>
              <span />
              <span />
            </>
          )}
          {stage === 'preview' && (
            <>
              <Button variant="ghost" onClick={reset} className="text-slate-600">
                ← Volver
              </Button>
              <div className="flex gap-2">
                {invoiceFile && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs text-slate-600 border-slate-200 bg-white"
                    onClick={() => window.open(URL.createObjectURL(invoiceFile), '_blank')}
                  >
                    📄 Ver factura
                  </Button>
                )}
                {certFile && form?.type === 'recyclable' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs text-emerald-700 border-emerald-200 bg-emerald-50"
                    onClick={() => window.open(URL.createObjectURL(certFile), '_blank')}
                  >
                    ♻️ Ver certificado
                  </Button>
                )}
              </div>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm px-6"
              >
                {saving ? 'Guardando…' : '✓ Guardar Factura'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
