// ─── EcoMetrics API client ────────────────────────────────────────────────────
// In dev: calls /api proxied by Vite to localhost:5000
// In prod: calls VITE_API_URL (set in Vercel env vars)

import type { AnalyticsData, CreateInvoicePayload, Invoice } from './types'

const BASE = (import.meta.env.VITE_API_URL ?? '/api') as string

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + path, {
      headers: { 'Content-Type': 'application/json', ...opts.headers },
      ...opts,
    })
  } catch {
    // Network error (no connection, server down, CORS, etc.)
    // Do NOT log the raw error to avoid exposing the API URL
    throw new Error('No se pudo conectar al servidor. Verifica tu conexión o que el backend esté activo.')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg = (body as { error?: string }).error
    if (res.status === 401) throw new Error('Sesión expirada. Recarga la página.')
    if (res.status === 403) throw new Error('No tienes permisos para realizar esta acción.')
    if (res.status === 404) throw new Error('El recurso solicitado no existe.')
    if (res.status >= 500) throw new Error('Error interno del servidor. Intenta nuevamente en unos momentos.')
    throw new Error(msg ?? `Error inesperado (${res.status})`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export interface InvoiceFilters {
  type?:  string
  year?:  string
  month?: string
}

export const api = {
  /** List all invoices, optionally filtered */
  listInvoices: (filters: InvoiceFilters = {}): Promise<Invoice[]> => {
    const params = new URLSearchParams()
    if (filters.type)  params.set('type',  filters.type)
    if (filters.year)  params.set('year',  filters.year)
    if (filters.month) params.set('month', filters.month)
    const qs = params.toString()
    return req<Invoice[]>(`/invoices${qs ? '?' + qs : ''}`)
  },

  /** Create a new invoice */
  createInvoice: (data: CreateInvoicePayload): Promise<Invoice> =>
    req<Invoice>('/invoices', { method: 'POST', body: JSON.stringify(data) }),

  /** Partially update an invoice (status changes, folio, etc.) */
  updateInvoice: (id: string, patch: Partial<Invoice>): Promise<Invoice> =>
    req<Invoice>(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),

  /** Delete an invoice and its document */
  deleteInvoice: (id: string): Promise<void> =>
    req<void>(`/invoices/${id}`, { method: 'DELETE' }),

  // ─── Documents ──────────────────────────────────────────────────────────────

  /** Attach a PDF to an existing invoice (doc_type: 'invoice' | 'certificate') */
  uploadDocument: (invoiceId: string, file: File, docType: 'invoice' | 'certificate' = 'invoice'): Promise<{ filename: string }> => {
    const fd = new FormData()
    fd.append('file', file)
    return req<{ filename: string }>(`/invoices/${invoiceId}/document?doc_type=${docType}`, {
      method:  'POST',
      headers: {},           // let browser set multipart boundary
      body:    fd,
    })
  },

  /** Returns the download URL for an invoice document */
  documentUrl: (invoiceId: string): string =>
    `${BASE}/invoices/${invoiceId}/document?doc_type=invoice`,

  /** Returns the download URL for a recycling certificate */
  certificateUrl: (invoiceId: string): string =>
    `${BASE}/invoices/${invoiceId}/document?doc_type=certificate`,

  // ─── Analytics ──────────────────────────────────────────────────────────────

  /** Fetch aggregated analytics, optionally for a specific year */
  getAnalytics: (year?: string): Promise<AnalyticsData> => {
    const qs = year ? `?year=${year}` : ''
    return req<AnalyticsData>(`/analytics${qs}`)
  },

  // ─── OCR ────────────────────────────────────────────────────────────────────

  /** Parse a PDF invoice using AI — returns extracted + normalized data */
  parsePdf: (file: File): Promise<OcrResult> => {
    const fd = new FormData()
    fd.append('file', file)
    return req<OcrResult>('/invoices/parse-pdf', {
      method:  'POST',
      headers: {},
      body:    fd,
    })
  },

  /** Save user corrections so future OCR learns from them */
  saveOcrCorrection: (raw: OcrResult, corrected: OcrResult): Promise<void> =>
    req<void>('/invoices/ocr-correction', {
      method: 'POST',
      body:   JSON.stringify({ raw, corrected }),
    }),

  // ─── Health ─────────────────────────────────────────────────────────────────

  health: (): Promise<{ status: string }> =>
    req<{ status: string }>('/health'),

  // ─── AI Chat ─────────────────────────────────────────────────────────────────

  /** Send a conversation to the SINADER AI assistant */
  chat: (messages: ChatMessage[]): Promise<ChatResponse> =>
    req<ChatResponse>('/chat', { method: 'POST', body: JSON.stringify({ messages }) }),
}

// ─── OCR types ────────────────────────────────────────────────────────────────

export interface OcrItem {
  description: string
  residue_category: string
  unit: 'TON' | 'KG'
  quantity: number
  amount: number
}

export interface OcrResult {
  number: string
  provider: string
  provider_rut: string | null
  date: string
  type: 'domiciliary' | 'recyclable'
  currency: 'CLP' | 'UF'
  items: OcrItem[]
  totals: { subtotal: number; tax: number; total: number }
  date_confidence: 'high' | 'medium' | 'low'
  date_notes: string | null
}

// ─── Chat types ───────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChartSpec {
  type: 'bar' | 'line' | 'pie' | 'multibar'
  title: string
  data: Record<string, number | string>[]
  xKey: string
  yKey?: string
  keys?: string[]
  color?: string
  colors?: string[]
  unit?: string
}

export interface ChatResponse {
  content: string
  charts: ChartSpec[]
}
