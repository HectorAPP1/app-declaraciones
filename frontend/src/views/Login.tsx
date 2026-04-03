import { useState } from 'react'

interface LoginViewProps {
  onLogin: (password: string) => boolean
}

export default function LoginView({ onLogin }: LoginViewProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const success = onLogin(password)
    if (!success) {
      setError(true)
      setShake(true)
      setPassword('')
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#f8f8f8]">
      <div className="flex flex-col items-center gap-8">
        {/* Logo / Nombre */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full border-2 border-slate-800 flex items-center justify-center bg-white shadow-sm">
            <div className="w-5 h-5 bg-slate-900 rounded-full"></div>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">EcoMetrics Inc.</h1>
          <p className="text-sm text-slate-500">Ingresa tu contraseña para continuar</p>
        </div>

        {/* Card */}
        <div
          className={`bg-white border border-slate-200 rounded-2xl shadow-sm p-8 w-80 flex flex-col gap-5 transition-all ${shake ? 'animate-[shake_0.4s_ease]' : ''}`}
          style={shake ? { animation: 'shake 0.4s ease' } : {}}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600 tracking-wide">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError(false)
                }}
                placeholder="••••••••"
                autoFocus
                className={`w-full h-10 px-4 text-sm rounded-lg border focus:outline-none focus:ring-2 transition-all ${
                  error
                    ? 'border-red-400 focus:ring-red-200 bg-red-50'
                    : 'border-slate-200 focus:ring-slate-200 bg-white'
                }`}
              />
              {error && (
                <p className="text-xs text-red-500 font-medium">Contraseña incorrecta.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!password}
              className="h-10 w-full rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Ingresar
            </button>
          </form>
        </div>

        <p className="text-xs text-slate-400">Solo para uso interno</p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  )
}
