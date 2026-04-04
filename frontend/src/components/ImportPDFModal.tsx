import { useState, useRef } from 'react'
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

const fmt = (n: number) =>
  n.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

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
  const [stage, setStage]     = useState<'upload' | 'loading' | 'preview'>('upload')
  const [error, setError]     = useState<string | null>(null)
  const [saving, setSaving]   = useState(false)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [raw, setRaw]         = useState<OcrResult | null>(null)
  const [form, setForm]       = useState<OcrResult | null>(null)
  const fileRef               = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStage('upload')
    setError(null)
    setSaving(false)
    setPdfFile(null)
    setRaw(null)
    setForm(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  // ── Upload & parse ───────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setPdfFile(file)
  }

  const handleParse = async () => {
    if (!pdfFile) return
    setStage('loading')
    setError(null)
    try {
      const result = await api.parsePdf(pdfFile)
      setRaw(result)
      setForm(structuredClone(result))
      setStage('preview')
    } catch (e: any) {
      setError(e.message ?? 'Error al analizar el PDF')
      setStage('upload')
    }
  }

  // ── Form helpers ─────────────────────────────────────────────────────────────

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

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form || !pdfFile) return
    setSaving(true)
    setError(null)
    try {
      // 1. Create invoice
      const invoice = await api.createInvoice({
        number:   form.number,
        provider: form.provider,
        date:     form.date,
        currency: form.currency,
        type:     form.type,
        items:    form.items,
        totals:   form.totals,
      } as any)

      // 2. Upload PDF
      await api.uploadDocument(invoice.id, pdfFile, 'invoice')

      // 3. Learn corrections if user changed anything
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

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            Importar factura desde PDF
          </DialogTitle>
        </DialogHeader>

        {/* ── Stage: upload ── */}
        {stage === 'upload' && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-500">
              Sube el PDF de la factura y el sistema extraerá los datos automáticamente
              usando los proveedores y categorías ya registradas como referencia.
            </p>

            <div
              className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center cursor-pointer hover:border-gray-300 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {pdfFile ? (
                <div className="space-y-1">
                  <p className="font-medium text-sm">{pdfFile.name}</p>
                  <p className="text-xs text-gray-400">
                    {(pdfFile.size / 1024).toFixed(0)} KB
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Haz clic para seleccionar un PDF</p>
                  <p className="text-xs text-gray-400">Solo archivos .pdf</p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded">{error}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleParse} disabled={!pdfFile}>
                Analizar PDF
              </Button>
            </div>
          </div>
        )}

        {/* ── Stage: loading ── */}
        {stage === 'loading' && (
          <div className="py-12 text-center space-y-3">
            <div className="inline-block w-8 h-8 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
            <p className="text-sm text-gray-500">
              Analizando PDF con IA…
            </p>
            <p className="text-xs text-gray-400">
              Consultando proveedores y categorías registradas
            </p>
          </div>
        )}

        {/* ── Stage: preview ── */}
        {stage === 'preview' && form && (
          <div className="space-y-5 py-2">
            {/* Date warning */}
            {form.date_confidence !== 'high' && (
              <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs text-amber-800">
                <span className="font-semibold">Fecha con confianza {form.date_confidence}:</span>{' '}
                {form.date_notes ?? 'Revisa que la fecha sea correcta antes de guardar.'}
              </div>
            )}

            {/* Basic fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">N° Factura</label>
                <Input
                  value={form.number}
                  onChange={e => setField('number', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Fecha</label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={e => setField('date', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-medium text-gray-500">Proveedor</label>
                <Input
                  value={form.provider}
                  onChange={e => setField('provider', e.target.value)}
                  className="h-8 text-sm"
                />
                {form.provider_rut && (
                  <p className="text-xs text-gray-400">RUT: {form.provider_rut}</p>
                )}
                {raw && raw.provider !== form.provider && (
                  <p className="text-xs text-blue-500">
                    Original detectado: "{raw.provider}" → se aprenderá esta corrección
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Tipo</label>
                <Select value={form.type} onValueChange={v => setField('type', v as any)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="domiciliary">Domiciliario</SelectItem>
                    <SelectItem value="recyclable">Reciclable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Moneda</label>
                <Select value={form.currency} onValueChange={v => setField('currency', v as any)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLP">CLP</SelectItem>
                    <SelectItem value="UF">UF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-500">
                  Ítems / Residuos
                </label>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={addItem}>
                  + Agregar ítem
                </Button>
              </div>
              {form.items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-1 items-end bg-gray-50 rounded p-2">
                  <div className="col-span-4 space-y-0.5">
                    <label className="text-xs text-gray-400">Categoría</label>
                    <Select
                      value={item.residue_category ?? ''}
                      onValueChange={v => setItem(i, 'residue_category', v as string)}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {form.type === 'recyclable'
                          ? MATERIALES.map(m => (
                              <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                            ))
                          : <SelectItem value="relleno_sanitario">Relleno sanitario</SelectItem>
                        }
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-0.5">
                    <label className="text-xs text-gray-400">Unidad</label>
                    <Select value={item.unit ?? 'TON'} onValueChange={v => setItem(i, 'unit', v as string)}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TON">TON</SelectItem>
                        <SelectItem value="KG">KG</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-0.5">
                    <label className="text-xs text-gray-400">Cantidad</label>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={e => setItem(i, 'quantity', e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="col-span-3 space-y-0.5">
                    <label className="text-xs text-gray-400">Monto</label>
                    <Input
                      type="number"
                      value={item.amount}
                      onChange={e => setItem(i, 'amount', e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={() => removeItem(i)}
                      className="text-gray-300 hover:text-red-400 text-base leading-none mt-1"
                    >×</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="grid grid-cols-3 gap-3">
              {(['subtotal', 'tax', 'total'] as const).map(k => (
                <div key={k} className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 capitalize">
                    {k === 'tax' ? 'IVA' : k.charAt(0).toUpperCase() + k.slice(1)}
                  </label>
                  <Input
                    type="number"
                    value={form.totals[k]}
                    onChange={e => setTotals(k, e.target.value)}
                    className="h-8 text-sm"
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
                Total: {form.currency} {fmt(form.totals.total)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {form.items.length} ítem{form.items.length !== 1 ? 's' : ''}
              </Badge>
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded">{error}</p>
            )}

            <div className="flex justify-between gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={reset}>
                Volver
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar factura'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
