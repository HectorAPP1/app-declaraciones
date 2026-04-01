// ─── EcoMetrics API client ────────────────────────────────────────────────────
// In dev: calls /api proxied by Vite to localhost:5000
// In prod: calls VITE_API_URL (set in Vercel env vars)

import type { AnalyticsData, CreateInvoicePayload, Invoice } from './types'

const BASE = (import.meta.env.VITE_API_URL ?? '/api') as string

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
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

  /** Attach a PDF to an existing invoice */
  uploadDocument: (invoiceId: string, file: File): Promise<{ filename: string }> => {
    const fd = new FormData()
    fd.append('file', file)
    return req<{ filename: string }>(`/invoices/${invoiceId}/document`, {
      method:  'POST',
      headers: {},           // let browser set multipart boundary
      body:    fd,
    })
  },

  /** Returns the download URL for an invoice document */
  documentUrl: (invoiceId: string): string =>
    `${BASE}/invoices/${invoiceId}/document`,

  // ─── Analytics ──────────────────────────────────────────────────────────────

  /** Fetch aggregated analytics, optionally for a specific year */
  getAnalytics: (year?: string): Promise<AnalyticsData> => {
    const qs = year ? `?year=${year}` : ''
    return req<AnalyticsData>(`/analytics${qs}`)
  },

  // ─── Health ─────────────────────────────────────────────────────────────────

  health: (): Promise<{ status: string }> =>
    req<{ status: string }>('/health'),
}
