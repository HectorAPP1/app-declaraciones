import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SparklesIcon, PaperAirplaneIcon, DocumentTextIcon } from '@heroicons/react/24/outline'

export default function WordAssistantView() {
  const [prompt, setPrompt] = useState('')

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <SparklesIcon className="w-6 h-6 text-indigo-600" />
            Word Assistant
          </h2>
          <p className="text-slate-500 text-sm mt-1">Genera reportes corporativos, redacta declaraciones u obtén insights automatizados.</p>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Chat Area */}
        <Card className="flex-1 shadow-sm border-slate-200 flex flex-col bg-white overflow-hidden">
          <CardContent className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            
            <div className="flex gap-4 max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <SparklesIcon className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-sm text-slate-700 leading-relaxed shadow-sm">
                <p>Hola Héctor. Soy tu Word Assistant especializado en sustentabilidad y gestión de residuos.</p>
                <p className="mt-2">Puedo ayudarte a estructurar reportes para el <strong>SINADER</strong>, crear minutas de sustentabilidad corporativa o cruzar los datos de tus facturas históricas. ¿En qué trabajaremos hoy?</p>
              </div>
            </div>

            <div className="flex gap-4 max-w-[85%] self-end flex-row-reverse">
              <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-white">HV</span>
              </div>
              <div className="bg-indigo-600 text-white p-4 rounded-xl text-[14px] leading-relaxed shadow-sm">
                Genera un borrador de reporte ejecutivo sobre las toneladas reciclables valorizadas en el Q2, por favor.
              </div>
            </div>

            <div className="flex gap-4 max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <SparklesIcon className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-sm text-slate-700 leading-relaxed shadow-sm">
                <p className="mb-3">¡Claro! Basado en los registros recientes de EcoMetrics, aquí tienes un esquema adaptado al estándar. He adjuntado el documento fundacional en nuestro formato oficial corporativo:</p>
                <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg font-medium text-indigo-600 cursor-pointer hover:bg-slate-50 transition-colors w-fit">
                  <DocumentTextIcon className="w-5 h-5" />
                  Reporte_Ejecutivo_Q2.docx
                </div>
              </div>
            </div>

          </CardContent>
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
            <div className="relative max-w-4xl mx-auto">
              <Input 
                className="pl-4 pr-12 h-12 bg-white shadow-sm border-slate-200 focus-visible:ring-indigo-500 rounded-xl text-[13px]" 
                placeholder="Escribe instrucciones para generar o analizar documentos..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <Button size="icon" className="absolute right-1.5 top-1.5 h-9 w-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[8px] shadow-sm">
                <PaperAirplaneIcon className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-center text-[11px] text-slate-400 mt-2">La IA puede cometer errores en datos numéricos. Verifica las cifras generadas en el dashboard local.</p>
          </div>
        </Card>

        {/* Suggestion Sidebar */}
        <div className="hidden lg:flex w-72 flex-col gap-4 shrink-0 overflow-y-auto pr-1">
          <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-1">Sugerencias rápidas</h3>
          <Card className="shadow-sm border-slate-200 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-indigo-600 mb-1">Redactar manual 📝</p>
              <p className="text-xs text-slate-500 leading-relaxed">Crea un protocolo para disposición de residuos peligrosos basado en normativas chilenas.</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-slate-200 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-indigo-600 mb-1">Resumir normativas ⚖️</p>
              <p className="text-xs text-slate-500 leading-relaxed">Compara las regulaciones ambientales y decretos entre el 2024 vs el ciclo anterior.</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-slate-200 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-indigo-600 mb-1">Auditoría cruzada 🔍</p>
              <p className="text-xs text-slate-500 leading-relaxed">Analiza consistencias entre facturas de transporte vs certificados en destinos.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
