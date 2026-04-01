// ─── Shared TypeScript types for EcoMetrics ──────────────────────────────────

export type InvoiceType     = 'domiciliary' | 'recyclable'
export type PaymentStatus   = 'pending' | 'paid' | 'overdue'
export type SinaderStatus   = 'pending' | 'declared' | 'overdue'

export interface InvoiceItem {
  description:      string
  residue_category: string
  unit:             'TON' | 'KG'
  quantity:         number
  quantity_ton:     number
  amount:           number
}

export interface InvoiceTotals {
  subtotal: number
  tax:      number
  total:    number
}

export interface InvoiceAggregates {
  total_amount:    number
  residue_totals:  Record<string, number>
  residue_amounts: Record<string, number>
}

export interface Invoice {
  id:             string
  number:         string
  provider:       string
  date:           string        // ISO yyyy-mm-dd
  currency:       'CLP' | 'UF'
  type:           InvoiceType
  items:          InvoiceItem[]
  totals:         InvoiceTotals
  aggregates?:    InvoiceAggregates
  document?:      string        // filename on backend
  payment_status: PaymentStatus
  payment_note:   string
  sinader_status: SinaderStatus
  sinader_note:   string
  sinader_folio:  string
  created_at:     string
  updated_at:     string
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface MonthSeries {
  month:  number
  amount: number
  tons:   number
}

export interface ResidueCategory {
  category: string
  label:    string
  amount:   number
  tons:     number
}

export interface AnalyticsData {
  year: number | null
  domiciliary: {
    monthly: MonthSeries[]
    totals:  { amount: number; tons: number }
  }
  recyclable: {
    monthly:    MonthSeries[]
    totals:     { amount: number; tons: number }
    categories: ResidueCategory[]
  }
  historical: {
    name: string
    domiciliario: number
    reciclable: number
  }[]
}

// ─── Invoice creation payload ─────────────────────────────────────────────────

export interface CreateInvoicePayload {
  number:   string
  provider: string
  date:     string
  currency: 'CLP' | 'UF'
  type:     InvoiceType
  items:    Omit<InvoiceItem, 'quantity_ton'>[]
  totals:   InvoiceTotals
}
