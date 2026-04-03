import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api'
import type { AnalyticsData } from '@/lib/types'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, CartesianGrid, XAxis, YAxis } from 'recharts'
import type { ChartConfig } from '@/components/ui/chart'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

const chartConfig = {
  domiciliario: { label: "Domiciliario", color: "#6366f1" },
  reciclable:   { label: "Reciclable",   color: "#0d9488" },
} satisfies ChartConfig

const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default function AnalyticsView() {
  const [focus, setFocus] = useState('combined')
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await api.getAnalytics(year)
      setData(res)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [year])

  const combinedMonthly = useMemo(() => {
    if (!data) return []
    return Array.from({length: 12}).map((_, i) => ({
      name: monthNames[i],
      domiciliario: data.domiciliary.monthly[i]?.amount || 0,
      reciclable: data.recyclable.monthly[i]?.amount || 0,
    }))
  }, [data])

  const historicalData = useMemo(() => {
    if (!data?.historical) return []
    const selectedYear = parseInt(year)
    const targetYears = [selectedYear - 2, selectedYear - 1, selectedYear]
    
    return targetYears.map(y => {
      const found = data.historical.find(h => h.name === String(y))
      return {
        name: String(y),
        domiciliario: found ? found.domiciliario : 0,
        reciclable: found ? found.reciclable : 0,
      }
    })
  }, [data])

  const totalGastoDom = data?.domiciliary.totals.amount || 0
  const totalGastoRec = data?.recyclable.totals.amount || 0
  const totalTonsDom = data?.domiciliary.totals.tons || 0
  const totalTonsRec = data?.recyclable.totals.tons || 0

  const focusGasto = focus === 'combined' ? totalGastoDom + totalGastoRec : 
                     focus === 'domiciliary' ? totalGastoDom : totalGastoRec
  const focusTons = focus === 'combined' ? totalTonsRec : // show valorizadas in combined
                    focus === 'domiciliary' ? totalTonsDom : totalTonsRec
  const shareReciclable = totalTonsDom + totalTonsRec > 0 
    ? (totalTonsRec / (totalTonsDom + totalTonsRec) * 100).toFixed(1) 
    : '0.0'

  const categories = data?.recyclable.categories || []
  const pieColors = ['#0d9488', '#14b8a6', '#2dd4bf', '#0f766e', '#115e59', '#6366f1']

  const prevYearGasto = useMemo(() => {
    if (!data?.historical) return 0
    const prev = data.historical.find(h => h.name === String(parseInt(year) - 1))
    if (!prev) return 0
    if (focus === 'combined') return prev.domiciliario + prev.reciclable
    if (focus === 'domiciliary') return prev.domiciliario
    return prev.reciclable
  }, [data, year, focus])

  const yoyPct = prevYearGasto > 0
    ? ((focusGasto - prevYearGasto) / prevYearGasto * 100)
    : null

  const prevYearRecTons = useMemo(() => {
    if (!data?.historical) return 0
    const prev = data.historical.find(h => h.name === String(parseInt(year) - 1))
    return prev?.rec_tons ?? 0
  }, [data, year])

  const yoyTonsPct = prevYearRecTons > 0
    ? ((totalTonsRec - prevYearRecTons) / prevYearRecTons * 100)
    : null

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="max-w-xl">
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">Laboratorio de Analytics</p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Valorización y performance en un vistazo</h2>
          <p className="text-slate-500 text-sm mt-1 leading-relaxed">Tendencias en gastos y toneladas entre residuos domiciliarios y reciclables con diseño unificado.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Año</span>
            <Select value={year} onValueChange={(v) => v && setYear(v)}>
              <SelectTrigger className="w-[120px] bg-white h-9">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({length: 5}).map((_, i) => {
                  const y = (new Date().getFullYear() - i).toString()
                  return <SelectItem key={y} value={y}>{y}</SelectItem>
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Enfoque</span>
            <Select value={focus} onValueChange={(v) => v && setFocus(v)}>
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue placeholder="Enfoque" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="combined">Combinado</SelectItem>
                <SelectItem value="domiciliary">Solo domiciliarios</SelectItem>
                <SelectItem value="recyclable">Solo reciclables</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
        {/* Card 1 — Gasto con YoY */}
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">Gasto total {year}</p>
            <div className="text-3xl font-bold text-slate-800 tracking-tight">${focusGasto.toLocaleString('es-CL')}</div>
            {yoyPct !== null ? (
              <div className={`flex items-center gap-1.5 mt-2 text-sm font-medium ${yoyPct > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                <span>{yoyPct > 0 ? '↑' : '↓'}</span>
                <span>{yoyPct > 0 ? '+' : ''}{yoyPct.toFixed(1)}% vs {parseInt(year) - 1}</span>
                <span className="text-slate-400 font-normal ml-1">
                  ({yoyPct > 0 ? 'subió el gasto' : 'bajó el gasto'})
                </span>
              </div>
            ) : (
              <p className="text-sm text-slate-400 mt-2">Sin datos del año anterior</p>
            )}
          </CardContent>
        </Card>

        {/* Card 2 — Toneladas con contexto y YoY */}
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">
              {focus === 'domiciliary' ? 'Enviado a vertedero' : 'Reciclado este año'}
            </p>
            <div className="flex items-start justify-between gap-2">
              <div className="text-3xl font-bold text-slate-800 tracking-tight">
                {focusTons.toLocaleString('es-CL', {minimumFractionDigits: 1, maximumFractionDigits: 1})} t
              </div>
              {yoyTonsPct !== null && focus !== 'domiciliary' && (
                <div className={`flex items-center gap-1 text-sm font-semibold mt-1 ${yoyTonsPct >= 0 ? 'text-teal-600' : 'text-rose-500'}`}>
                  <span>{yoyTonsPct >= 0 ? '↑' : '↓'}</span>
                  <span>{yoyTonsPct >= 0 ? '+' : ''}{yoyTonsPct.toFixed(1)}%</span>
                  <span className="text-xs text-slate-400 font-normal">vs {parseInt(year) - 1}</span>
                </div>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-2">
              {focus !== 'domiciliary'
                ? <>{focusTons.toLocaleString('es-CL', {minimumFractionDigits: 1, maximumFractionDigits: 1})} t de un total de{' '}
                    <span className="font-medium text-slate-600">
                      {(totalTonsDom + totalTonsRec).toLocaleString('es-CL', {minimumFractionDigits: 1, maximumFractionDigits: 1})} t
                    </span> de residuos no llegaron al vertedero</>
                : <>{focusTons.toLocaleString('es-CL', {minimumFractionDigits: 1, maximumFractionDigits: 1})} t de un total de{' '}
                    <span className="font-medium text-slate-600">
                      {(totalTonsDom + totalTonsRec).toLocaleString('es-CL', {minimumFractionDigits: 1, maximumFractionDigits: 1})} t
                    </span> fueron a relleno sanitario</>
              }
            </p>
          </CardContent>
        </Card>

        {/* Card 3 — Share con explicación */}
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">Tasa de valorización</p>
            <div className="text-3xl font-bold text-slate-800 tracking-tight">{shareReciclable}%</div>
            <p className="text-sm text-slate-400 mt-2">
              De cada 100 t tratadas, <span className="font-semibold text-teal-600">{shareReciclable} t se reciclan</span> y evitan el vertedero
            </p>
          </CardContent>
        </Card>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
        <Card className="col-span-1 lg:col-span-2 shadow-sm border-slate-200 flex flex-col">
          <div className="p-6 pb-2">
            <h3 className="text-base font-semibold text-slate-800">
              Tendencia {focus === 'combined' ? 'combinada' : focus === 'domiciliary' ? 'domiciliaria' : 'reciclable'}
            </h3>
            <p className="text-sm text-slate-500 mt-1">Gasto mensual apilado: domiciliario + reciclable.</p>
          </div>
          <CardContent className="flex-1 mt-4 border-t border-slate-100 pb-4">
            <ChartContainer config={chartConfig} className="h-[250px] w-full mt-4">
              <BarChart accessibilityLayer data={combinedMonthly} margin={{ left: 0, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} width={56} tickFormatter={v => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : `$${Math.round(v/1000)}k`} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
                {focus !== 'recyclable' && <Bar dataKey="domiciliario" fill="var(--color-domiciliario)" stackId="a" radius={focus === 'domiciliary' ? [4,4,0,0] : [0,0,0,0]} />}
                {focus !== 'domiciliary' && <Bar dataKey="reciclable" fill="var(--color-reciclable)" stackId="a" radius={[4,4,0,0]} />}
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-slate-200 flex flex-col">
          <div className="p-6 pb-2">
            <h3 className="text-base font-semibold text-slate-800">Gasto total</h3>
            <p className="text-sm text-slate-500 mt-1">Comparativo general.</p>
          </div>
          <CardContent className="flex-1 mt-4 border-t border-slate-100 pb-4">
            <ChartContainer config={chartConfig} className="h-[250px] w-full mt-4">
              <BarChart accessibilityLayer data={historicalData} margin={{ left: 0, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} width={56} tickFormatter={v => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : `$${Math.round(v/1000)}k`} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
                {focus !== 'recyclable' && <Bar dataKey="domiciliario" fill="var(--color-domiciliario)" radius={[4, 4, 0, 0]} />}
                {focus !== 'domiciliary' && <Bar dataKey="reciclable" fill="var(--color-reciclable)" radius={[4, 4, 0, 0]} />}
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {focus !== 'domiciliary' && (
          <Card className="shadow-sm border-slate-200 flex flex-col">
            <div className="p-6 pb-2">
              <h3 className="text-base font-semibold text-slate-800">Distribución reciclables</h3>
              <p className="text-sm text-slate-500 mt-1">Tons por categoría.</p>
            </div>
            <CardContent className="flex-1 mt-4 border-t border-slate-100 pb-4 flex items-center justify-center">
              {categories.length > 0 ? (
                <ChartContainer config={{}} className="h-[200px] w-full">
                  <PieChart>
                    <Pie
                      data={categories}
                      dataKey="tons"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {categories.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  </PieChart>
                </ChartContainer>
              ) : (
                <span className="text-slate-400 text-sm mt-8">Sin datos de reciclaje</span>
              )}
            </CardContent>
          </Card>
        )}

        {focus !== 'domiciliary' && (
          <Card className="shadow-sm border-slate-200 lg:col-span-2">
            <div className="p-6 pb-2 flex justify-between items-center">
              <h3 className="text-base font-semibold text-slate-800">Detalle por categoría</h3>
            </div>
            <CardContent className="p-0 border-t border-slate-100 overflow-hidden rounded-b-lg">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-700 h-10">Categoría</TableHead>
                    <TableHead className="font-semibold text-slate-700 h-10 text-right">Kilos</TableHead>
                    <TableHead className="font-semibold text-slate-700 h-10 text-right">Toneladas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center text-slate-500">
                        Sin datos
                      </TableCell>
                    </TableRow>
                  ) : (
                    categories.map((cat, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-slate-800">{cat.label}</TableCell>
                        <TableCell className="text-right text-slate-600">{(cat.tons * 1000).toLocaleString('es-CL', {minimumFractionDigits: 0, maximumFractionDigits: 0})} kg</TableCell>
                        <TableCell className="text-right text-slate-600">{cat.tons.toLocaleString('es-CL', {minimumFractionDigits: 3, maximumFractionDigits: 3})} t</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
