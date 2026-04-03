import { useState } from 'react'
import { Button } from '@/components/ui/button'
import DashboardView from './views/Dashboard'
import HistoryView from './views/History'
import AnalyticsView from './views/Analytics'
import ArchivosView from './views/Archivos'
import WordAssistantView from './views/WordAssistant'
import LoginView from './views/Login'
import InvoiceModal from './components/InvoiceModal'
import UserProfile from './components/UserProfile'
import { 
  Squares2X2Icon, 
  DocumentTextIcon, 
  ChartBarIcon,
  FolderOpenIcon,
  SparklesIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline'

const APP_PASSWORD = 'Ether25$'
const AUTH_KEY = 'app_authenticated'
const VIEW_KEY = 'app_last_view'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem(AUTH_KEY) === 'true'
  })
  const [currentView, setCurrentView] = useState(() => {
    return localStorage.getItem(VIEW_KEY) || 'dashboard'
  })
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleLogin = (password: string): boolean => {
    if (password === APP_PASSWORD) {
      localStorage.setItem(AUTH_KEY, 'true')
      setIsAuthenticated(true)
      return true
    }
    return false
  }

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY)
    setIsAuthenticated(false)
  }

  const handleViewChange = (view: string) => {
    setCurrentView(view)
    localStorage.setItem(VIEW_KEY, view)
  }

  if (!isAuthenticated) {
    return <LoginView onLogin={handleLogin} />
  }

  return (
    <div className="flex h-screen w-full bg-white text-slate-900 overflow-hidden font-sans">
      <aside className="w-64 bg-[#fcfcfc] border-r border-slate-200 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 p-5 mb-2 border-b border-transparent">
            <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center shrink-0 overflow-hidden bg-white shadow-sm p-0.5">
                <div className="w-3 h-3 bg-slate-900 rounded-full border border-slate-900"></div>
            </div>
            <p className="font-bold text-[15px] leading-tight text-slate-900">EcoMetrics Inc.</p>
          </div>
          
          <div className="px-3 pb-2 pt-2">
            <p className="px-3 text-xs font-semibold text-slate-500 mb-1 tracking-wide">Home</p>
            <nav className="flex flex-col gap-0.5">
              <button 
                onClick={() => handleViewChange('dashboard')}
                className={`flex items-center gap-3 h-9 text-[13px] px-3 rounded-[6px] transition-colors ${currentView === 'dashboard' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'}`}
              >
                <Squares2X2Icon className="w-[18px] h-[18px]" />
                Dashboard
              </button>
              <button 
                onClick={() => handleViewChange('history')}
                className={`flex items-center gap-3 h-9 text-[13px] px-3 rounded-[6px] transition-colors ${currentView === 'history' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'}`}
              >
                <DocumentTextIcon className="w-[18px] h-[18px]" />
                Histórico
              </button>
              <button 
                onClick={() => handleViewChange('analytics')}
                className={`flex items-center gap-3 h-9 text-[13px] px-3 rounded-[6px] transition-colors ${currentView === 'analytics' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'}`}
              >
                <ChartBarIcon className="w-[18px] h-[18px]" />
                Analytics
              </button>
            </nav>
          </div>
          
          <div className="px-3 pt-4">
            <p className="px-3 text-[11px] font-semibold text-slate-500 mb-1 tracking-wide uppercase">Documents</p>
            <nav className="flex flex-col gap-0.5">
              <button 
                onClick={() => handleViewChange('archivos')}
                className={`flex items-center gap-3 text-[13px] px-3 h-8 rounded-[6px] transition-colors ${currentView === 'archivos' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'}`}
              >
                <FolderOpenIcon className="w-[18px] h-[18px]" />
                Archivos
              </button>
              <button 
                onClick={() => handleViewChange('word-assistant')}
                className={`flex items-center gap-3 text-[13px] px-3 h-8 rounded-[6px] transition-colors ${currentView === 'word-assistant' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'}`}
              >
                <SparklesIcon className="w-[18px] h-[18px]" />
                Word Assistant
              </button>
            </nav>
          </div>
        </div>
        <UserProfile />
      </aside>
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white">
        <header className="bg-white border-b border-slate-200 px-8 h-14 flex items-center justify-between shrink-0 shadow-sm">
          <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            {currentView === 'dashboard' && 'Panel de control'}
            {currentView === 'history' && 'Documentos'}
            {currentView === 'analytics' && 'Laboratorio Analytics'}
            {currentView === 'archivos' && 'Data Library'}
            {currentView === 'word-assistant' && 'Word Assistant AI'}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsModalOpen(true)} className="bg-white shadow-sm font-medium h-9 text-xs flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              Quick Create
            </Button>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
            </button>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-16 bg-[#fdfdfd]">
          <div className="w-full min-h-full">
            {currentView === 'dashboard' && <DashboardView />}
            {currentView === 'history' && <HistoryView onOpenModal={() => setIsModalOpen(true)} />}
            {currentView === 'analytics' && <AnalyticsView />}
            {currentView === 'archivos' && <ArchivosView />}
            {currentView === 'word-assistant' && <WordAssistantView />}
          </div>
        </div>
      </main>

      <InvoiceModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  )
}
