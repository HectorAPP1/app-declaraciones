import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SparklesIcon, PaperAirplaneIcon, ExclamationTriangleIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { api, type ChatMessage, type ChartSpec } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DisplayMessage extends ChatMessage {
  id: string
  charts?: ChartSpec[]
  loading?: boolean
  error?: boolean
}

// ─── Quick actions ────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    emoji: '📋',
    title: 'Declarar en SINADER',
    description: 'Residuos pendientes con sus códigos LER',
    prompt:
      '¿Qué toneladas de residuos tengo pendientes de declarar en SINADER? Muéstrame el detalle por categoría con los códigos LER y un gráfico de torta.',
  },
  {
    emoji: '📈',
    title: 'Tendencia mensual',
    description: '¿Qué mes del año tuvo más reciclaje?',
    prompt:
      'Analiza el año 2025 y dime qué mes tuvo más toneladas de reciclaje. Muéstrame la evolución mensual de domiciliario vs reciclable con un gráfico.',
  },
  {
    emoji: '♻️',
    title: 'Desglose por categoría',
    description: 'Reciclables del año con códigos SINADER',
    prompt:
      'Muéstrame el desglose de mis residuos reciclables por categoría para el año 2025, con sus códigos LER y las toneladas a declarar en SINADER. Incluye un gráfico de torta.',
  },
  {
    emoji: '⚠️',
    title: 'SINADER vencido',
    description: 'Facturas con declaración atrasada',
    prompt:
      '¿Tengo facturas con declaración SINADER pendiente o vencida? Necesito saber cuáles son, sus toneladas y cuánto tiempo llevan sin declarar.',
  },
  {
    emoji: '📊',
    title: 'Reporte ejecutivo',
    description: 'Resumen anual de residuos 2025',
    prompt:
      'Genera un resumen ejecutivo de mi gestión de residuos del año 2025: domiciliarios y reciclables, totales en toneladas y CLP, con un gráfico comparativo por mes.',
  },
  {
    emoji: '🏛️',
    title: 'Guía SINADER',
    description: 'Cómo declarar paso a paso en el portal',
    prompt:
      'Explícame cómo declarar residuos en el portal SINADER de Chile paso a paso: qué datos necesito, qué plazos tengo, y qué códigos LER aplican a mis residuos domiciliarios y reciclables.',
  },
]

// ─── Chart colors ─────────────────────────────────────────────────────────────

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']

// ─── PDF export ───────────────────────────────────────────────────────────────

async function exportMessageToPdf(element: HTMLElement) {
  const [{ default: jsPDF }, { toPng }] = await Promise.all([
    import('jspdf'),
    import('html-to-image'),
  ])

  // html-to-image uses SVG foreignObject — handles oklch (Tailwind 4) correctly
  const imgData = await toPng(element, { pixelRatio: 2, backgroundColor: '#ffffff' })

  // Load image to get pixel dimensions
  const img = new Image()
  await new Promise<void>(res => { img.onload = () => res(); img.src = imgData })

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 15
  const contentW = pageW - margin * 2
  const imgH = (img.height * contentW) / img.width

  // Header
  pdf.setFontSize(10)
  pdf.setTextColor(99, 102, 241)
  pdf.text('EcoMetrics · Asistente SINADER', margin, 10)
  pdf.setTextColor(148, 163, 184)
  pdf.text(new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' }), pageW - margin, 10, { align: 'right' })
  pdf.setDrawColor(226, 232, 240)
  pdf.line(margin, 12, pageW - margin, 12)

  const startY = 18
  let remaining = imgH

  if (remaining <= pageH - startY - margin) {
    pdf.addImage(imgData, 'PNG', margin, startY, contentW, imgH)
  } else {
    // Multi-page: slice via canvas
    let srcY = 0
    let firstPage = true
    while (remaining > 0) {
      const sliceH = firstPage ? pageH - startY - margin : pageH - margin * 2
      const sliceHPx = (sliceH * img.width) / contentW
      const destY = firstPage ? startY : margin

      const sliceCanvas = document.createElement('canvas')
      sliceCanvas.width = img.width
      sliceCanvas.height = Math.min(sliceHPx, img.height - srcY)
      const ctx = sliceCanvas.getContext('2d')!
      ctx.drawImage(img, 0, srcY, img.width, sliceCanvas.height, 0, 0, img.width, sliceCanvas.height)

      const sliceImg = sliceCanvas.toDataURL('image/png')
      const sliceDisplayH = (sliceCanvas.height * contentW) / img.width
      pdf.addImage(sliceImg, 'PNG', margin, destY, contentW, sliceDisplayH)

      srcY += sliceCanvas.height
      remaining -= sliceDisplayH
      firstPage = false
      if (remaining > 0) pdf.addPage()
    }
  }

  pdf.save(`informe-sinader-${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ─── Chart renderer ───────────────────────────────────────────────────────────

function ChartRenderer({ spec }: { spec: ChartSpec }) {
  if (!spec.data?.length) return null
  const color = spec.color || COLORS[0]

  if (spec.type === 'pie') {
    return (
      <div className="mt-3 p-4 bg-white border border-slate-100 rounded-xl">
        <p className="text-xs font-semibold text-slate-600 mb-3">{spec.title}</p>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={spec.data}
              dataKey={spec.yKey || 'value'}
              nameKey={spec.xKey || 'name'}
              cx="50%"
              cy="50%"
              outerRadius={95}
              label={({ name, percent }: { name?: string; percent?: number }) =>
                (percent ?? 0) > 0.04 ? `${name} ${((percent ?? 0) * 100).toFixed(1)}%` : ''
              }
              labelLine={false}
            >
              {spec.data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: unknown) => [
                typeof v === 'number' ? `${v} ton` : String(v ?? ''),
                '',
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value) => <span className="text-slate-600">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (spec.type === 'multibar') {
    const keys = spec.keys || []
    return (
      <div className="mt-3 p-4 bg-white border border-slate-100 rounded-xl">
        <p className="text-xs font-semibold text-slate-600 mb-3">{spec.title}</p>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={spec.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey={spec.xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {keys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={(spec.colors || COLORS)[i]} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (spec.type === 'line') {
    const keys = spec.keys || (spec.yKey ? [spec.yKey] : [])
    return (
      <div className="mt-3 p-4 bg-white border border-slate-100 rounded-xl">
        <p className="text-xs font-semibold text-slate-600 mb-3">{spec.title}</p>
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={spec.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey={spec.xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            {keys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {keys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={(spec.colors || COLORS)[i] || color}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // Default: bar
  const keys = spec.keys || (spec.yKey ? [spec.yKey] : [])
  return (
    <div className="mt-3 p-4 bg-white border border-slate-100 rounded-xl">
      <p className="text-xs font-semibold text-slate-600 mb-3">{spec.title}</p>
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={spec.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey={spec.xKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          {keys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {keys.map((key, i) => (
            <Bar
              key={key}
              dataKey={key}
              fill={(spec.colors || COLORS)[i] || color}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Text formatter ───────────────────────────────────────────────────────────

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return (
        <strong key={i} className="font-semibold text-slate-800">
          {part.slice(2, -2)}
        </strong>
      )
    if (part.startsWith('`') && part.endsWith('`'))
      return (
        <code key={i} className="bg-slate-100 text-indigo-700 text-[11px] px-1.5 py-0.5 rounded font-mono">
          {part.slice(1, -1)}
        </code>
      )
    return <span key={i}>{part}</span>
  })
}

function FormattedText({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/)

  return (
    <div className="space-y-2">
      {paragraphs.map((para, pi) => {
        const trimmed = para.trim()
        if (!trimmed) return null
        const lines = trimmed.split('\n')

        // Heading
        if (/^#{1,3}\s/.test(trimmed)) {
          const content = trimmed.replace(/^#{1,3}\s+/, '')
          return (
            <p key={pi} className="font-semibold text-slate-800 text-sm mt-1">
              {renderInline(content)}
            </p>
          )
        }

        // Markdown table (| col | col |)
        if (lines.length >= 2 && lines[0].includes('|') && lines[1].match(/^\|[-| :]+\|/)) {
          const headers = lines[0].split('|').map(h => h.trim()).filter(Boolean)
          const rows = lines.slice(2).map(row =>
            row.split('|').map(c => c.trim()).filter(Boolean)
          )
          return (
            <div key={pi} className="overflow-x-auto mt-1">
              <table className="text-xs w-full border-collapse">
                <thead>
                  <tr>
                    {headers.map((h, hi) => (
                      <th
                        key={hi}
                        className="text-left px-3 py-2 bg-indigo-50 border border-slate-200 font-semibold text-slate-700"
                      >
                        {renderInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2 border border-slate-200 text-slate-600">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        // Numbered list
        if (lines.some(l => /^\d+\.\s/.test(l.trim()))) {
          return (
            <ol key={pi} className="space-y-1 list-none">
              {lines.map((line, li) => {
                const m = line.trim().match(/^(\d+)\.\s(.+)/)
                if (m)
                  return (
                    <li key={li} className="flex gap-2 text-sm text-slate-700">
                      <span className="text-indigo-600 font-semibold shrink-0 w-5 text-right">{m[1]}.</span>
                      <span>{renderInline(m[2])}</span>
                    </li>
                  )
                return (
                  <li key={li} className="text-sm text-slate-700">
                    {renderInline(line)}
                  </li>
                )
              })}
            </ol>
          )
        }

        // Bullet list
        if (lines.some(l => /^[-•*]\s/.test(l.trim()))) {
          return (
            <ul key={pi} className="space-y-1">
              {lines.map((line, li) => {
                const isBullet = /^[-•*]\s/.test(line.trim())
                if (isBullet)
                  return (
                    <li key={li} className="flex gap-2 text-sm text-slate-700">
                      <span className="text-indigo-400 mt-[3px] shrink-0">•</span>
                      <span>{renderInline(line.trim().replace(/^[-•*]\s+/, ''))}</span>
                    </li>
                  )
                return (
                  <p key={li} className="text-sm text-slate-700">
                    {renderInline(line)}
                  </p>
                )
              })}
            </ul>
          )
        }

        // Regular paragraph
        return (
          <p key={pi} className="text-sm text-slate-700 leading-relaxed">
            {lines.map((line, li) => (
              <span key={li}>
                {renderInline(line)}
                {li < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}

// ─── Loading dots ─────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex gap-1 items-center h-5 px-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

// ─── Welcome message ──────────────────────────────────────────────────────────

const WELCOME: DisplayMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `Hola. Soy el **Asistente SINADER** de EcoMetrics.

Consulto tus datos reales de facturas para ayudarte a:

- Calcular **toneladas por categoría** para declarar en SINADER
- Identificar los **códigos LER** de cada tipo de residuo
- Detectar **facturas con declaración pendiente o vencida**
- Analizar **tendencias mensuales** con gráficos
- Generar **resúmenes ejecutivos** de tu gestión de residuos

¿En qué te ayudo hoy?`,
}

// ─── Assistant bubble ─────────────────────────────────────────────────────────

function AssistantBubble({ msg }: { msg: DisplayMessage }) {
  const [exporting, setExporting] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const handleExport = useCallback(async () => {
    if (!contentRef.current) return
    setExporting(true)
    try {
      await exportMessageToPdf(contentRef.current)
    } finally {
      setExporting(false)
    }
  }, [])

  if (msg.loading) return <TypingDots />
  if (msg.error) return (
    <div className="flex items-start gap-2">
      <ExclamationTriangleIcon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
      <p className="text-sm text-red-700">{msg.content}</p>
    </div>
  )

  return (
    <div>
      <div ref={contentRef} className="p-1">
        <FormattedText text={msg.content} />
        {msg.charts?.map((chart, ci) => (
          <ChartRenderer key={ci} spec={chart} />
        ))}
      </div>
      {msg.id !== 'welcome' && (
        <div className="mt-2 flex justify-end">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="w-3.5 h-3.5" />
            {exporting ? 'Generando PDF…' : 'Descargar PDF'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WordAssistantView() {
  const [messages, setMessages] = useState<DisplayMessage[]>([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: DisplayMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    }
    const placeholderId = crypto.randomUUID()
    const placeholder: DisplayMessage = {
      id: placeholderId,
      role: 'assistant',
      content: '',
      loading: true,
    }

    setMessages(prev => [...prev, userMsg, placeholder])
    setInput('')
    setLoading(true)

    // Build conversation history for API (exclude welcome + placeholders)
    const history: ChatMessage[] = [...messages, userMsg]
      .filter(m => m.id !== 'welcome' && !m.loading)
      .map(m => ({ role: m.role, content: m.content }))

    try {
      const response = await api.chat(history)
      setMessages(prev =>
        prev.map(m =>
          m.id === placeholderId
            ? {
                ...m,
                content: response.content,
                charts: response.charts,
                loading: false,
              }
            : m
        )
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setMessages(prev =>
        prev.map(m =>
          m.id === placeholderId
            ? {
                ...m,
                content: `No pude procesar la solicitud: ${msg}`,
                loading: false,
                error: true,
              }
            : m
        )
      )
    } finally {
      setLoading(false)
      textareaRef.current?.focus()
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-5 animate-in fade-in duration-500">
      {/* Header */}
      <div className="shrink-0">
        <h2 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <SparklesIcon className="w-6 h-6 text-indigo-600" />
          Asistente SINADER
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Consulta tus datos reales, declara en SINADER y analiza tendencias con gráficos.
        </p>
      </div>

      <div className="flex gap-5 flex-1 min-h-0">
        {/* ── Chat area ── */}
        <Card className="flex-1 shadow-sm border-slate-200 flex flex-col bg-white overflow-hidden">
          {/* Messages */}
          <CardContent className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse self-end max-w-[80%]' : 'max-w-[90%]'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === 'user' ? 'bg-slate-900' : 'bg-indigo-100'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <span className="text-[11px] font-bold text-white">HV</span>
                  ) : (
                    <SparklesIcon className="w-4 h-4 text-indigo-600" />
                  )}
                </div>

                {/* Bubble */}
                {msg.role === 'user' ? (
                  <div className="bg-indigo-600 text-white px-4 py-3 rounded-xl text-sm leading-relaxed shadow-sm">
                    {msg.content}
                  </div>
                ) : (
                  <div
                    className={`bg-slate-50 border px-4 py-3 rounded-xl shadow-sm flex-1 ${
                      msg.error ? 'border-red-200 bg-red-50' : 'border-slate-100'
                    }`}
                  >
                    <AssistantBubble msg={msg} />
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </CardContent>

          {/* Input */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
            <div className="relative max-w-4xl mx-auto">
              <textarea
                ref={textareaRef}
                rows={2}
                className="w-full pl-4 pr-14 py-3 bg-white shadow-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl text-[13px] resize-none leading-relaxed placeholder:text-slate-400"
                placeholder="Escribe tu consulta sobre SINADER o tus facturas… (Enter para enviar, Shift+Enter nueva línea)"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
              <Button
                size="icon"
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                className="absolute right-2 bottom-2 h-9 w-9 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg shadow-sm"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-center text-[11px] text-slate-400 mt-2">
              La IA consulta tus datos reales pero puede cometer errores. Verifica cifras críticas en Dashboard o Histórico.
            </p>
          </div>
        </Card>

        {/* ── Sidebar ── */}
        <div className="hidden lg:flex w-72 flex-col gap-3 shrink-0 overflow-y-auto pr-1">
          <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-1">
            Consultas frecuentes
          </h3>
          {QUICK_ACTIONS.map((action, i) => (
            <button
              key={i}
              onClick={() => sendMessage(action.prompt)}
              disabled={loading}
              className="text-left w-full p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-300 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{action.emoji}</span>
                <p className="text-sm font-semibold text-indigo-600 group-hover:text-indigo-700">
                  {action.title}
                </p>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{action.description}</p>
            </button>
          ))}

          <div className="mt-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
            <p className="text-[11px] text-indigo-600 font-semibold mb-1">Alcance del asistente</p>
            <p className="text-[11px] text-indigo-500 leading-relaxed">
              Solo responde sobre SINADER y EcoMetrics. Consultas fuera del ámbito serán redirigidas.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
