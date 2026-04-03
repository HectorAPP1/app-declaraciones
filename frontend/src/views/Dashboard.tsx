import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import type { AnalyticsData } from '@/lib/types'
import { AreaChart, Area, BarChart, Bar, CartesianGrid, XAxis, YAxis } from 'recharts'
import type { ChartConfig } from '@/components/ui/chart'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

const domConfig = {
  gasto:     { label: "Gasto",     color: "#6366f1" },
  toneladas: { label: "Toneladas", color: "#818cf8" },
} satisfies ChartConfig

const recConfig = {
  gasto:     { label: "Gasto",     color: "#0d9488" },
  toneladas: { label: "Toneladas", color: "#2dd4bf" },
} satisfies ChartConfig

export default function DashboardView() {
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await api.getAnalytics(year)
      setData(res)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [year])

  const domTotals = data?.domiciliary.totals || { amount: 0, tons: 0 }
  const recTotals = data?.recyclable.totals || { amount: 0, tons: 0 }

  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const domMonthly = data?.domiciliary.monthly.map(m => ({
    name: monthNames[m.month - 1],
    Gasto: m.amount,
    Toneladas: m.tons
  })) || []

  const recMonthly = data?.recyclable.monthly.map(m => ({
    name: monthNames[m.month - 1],
    Gasto: m.amount,
    Toneladas: m.tons
  })) || []

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Indicadores de residuos</h2>
          <p className="text-slate-500 text-sm mt-1">Comparativo anual de gasto y toneladas por módulo</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Año</span>
            <Select value={year} onValueChange={(v) => v && setYear(v)}>
              <SelectTrigger className="w-[120px] bg-white h-9">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({length: new Date().getFullYear() - 2023}).map((_, i) => {
                  const y = (new Date().getFullYear() - i).toString()
                  return <SelectItem key={y} value={y}>{y}</SelectItem>
                })}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" className="shadow-sm bg-white h-9" onClick={loadData}>Actualizar</Button>
        </div>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
        <Card className="shadow-sm border-0 bg-indigo-50">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-indigo-500">Domiciliarios · Gasto</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold text-indigo-700 tracking-tight">${domTotals.amount.toLocaleString('es-CL')}</div>
            <p className="text-[11px] text-indigo-400 mt-0.5 font-medium">Monto total anual</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-indigo-50">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-indigo-500">Domiciliarios · Ton</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold text-indigo-700 tracking-tight">{domTotals.tons.toLocaleString('es-CL', {minimumFractionDigits: 2, maximumFractionDigits: 2})} t</div>
            <p className="text-[11px] text-indigo-400 mt-0.5 font-medium">Toneladas a relleno</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-teal-50">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-teal-600">Reciclables · Gasto</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold text-teal-700 tracking-tight">${recTotals.amount.toLocaleString('es-CL')}</div>
            <p className="text-[11px] text-teal-400 mt-0.5 font-medium">Monto total anual</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-teal-50">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-teal-600">Reciclables · Ton</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold text-teal-700 tracking-tight">{recTotals.tons.toLocaleString('es-CL', {minimumFractionDigits: 2, maximumFractionDigits: 2})} t</div>
            <p className="text-[11px] text-teal-400 mt-0.5 font-medium">Toneladas valorizadas</p>
          </CardContent>
        </Card>
      </div>

      <div className={`grid grid-cols-1 xl:grid-cols-2 gap-4 transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
        <Card className="shadow-sm border-slate-200 flex flex-col">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Gasto mensual domicilios</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 pb-4">
            <ChartContainer config={domConfig} className="h-[200px] w-full">
              <AreaChart accessibilityLayer data={domMonthly} margin={{ left: 0, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} width={56} tickFormatter={v => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : `$${Math.round(v/1000)}k`} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                <Area dataKey="Gasto" type="monotone" fill="var(--color-gasto)" fillOpacity={0.4} stroke="var(--color-gasto)" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-slate-200 flex flex-col">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Toneladas mensuales domicilios</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 pb-4">
            <ChartContainer config={domConfig} className="h-[200px] w-full">
              <BarChart accessibilityLayer data={domMonthly} margin={{ left: 0, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} width={40} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
                <Bar dataKey="Toneladas" fill="var(--color-toneladas)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 flex flex-col">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Gasto mensual reciclables</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 pb-4">
            <ChartContainer config={recConfig} className="h-[200px] w-full">
              <AreaChart accessibilityLayer data={recMonthly} margin={{ left: 0, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} width={56} tickFormatter={v => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : `$${Math.round(v/1000)}k`} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                <Area dataKey="Gasto" type="monotone" fill="var(--color-gasto)" fillOpacity={0.4} stroke="var(--color-gasto)" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 flex flex-col">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Toneladas mensuales reciclables</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 pb-4">
            <ChartContainer config={recConfig} className="h-[200px] w-full">
              <BarChart accessibilityLayer data={recMonthly} margin={{ left: 0, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} width={40} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
                <Bar dataKey="Toneladas" fill="var(--color-toneladas)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
