import { useState, useRef } from 'react'

const PROFILE_KEY = 'app_user_profile'

interface Profile {
  name: string
  role: string
  photo: string | null
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { name: '', role: '', photo: null }
}

function saveProfile(profile: Profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

export default function UserProfile() {
  const [profile, setProfile] = useState<Profile>(loadProfile)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [draft, setDraft] = useState<Profile>(profile)
  const fileRef = useRef<HTMLInputElement>(null)

  const openModal = () => {
    setDraft({ ...profile })
    setIsModalOpen(true)
  }

  const handleSave = () => {
    saveProfile(draft)
    setProfile(draft)
    setIsModalOpen(false)
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setDraft((d) => ({ ...d, photo: ev.target?.result as string }))
    }
    reader.readAsDataURL(file)
  }

  const removePhoto = () => setDraft((d) => ({ ...d, photo: null }))

  const initials = profile.name ? getInitials(profile.name) : 'HV'
  const draftInitials = draft.name ? getInitials(draft.name) : 'HV'

  return (
    <>
      {/* Sidebar bottom profile card */}
      <button
        onClick={openModal}
        className="group mx-3 mb-3 mt-auto flex items-center gap-3 rounded-xl p-3 border border-slate-200 bg-white hover:bg-slate-50 transition-all text-left w-[calc(100%-24px)] shrink-0"
      >
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center overflow-hidden bg-slate-900 text-white text-[13px] font-semibold select-none">
          {profile.photo ? (
            <img src={profile.photo} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-slate-900 truncate leading-tight">
            {profile.name || 'Tu nombre'}
          </p>
          <p className="text-[11px] text-slate-500 truncate leading-tight mt-0.5">
            {profile.role || 'Tu cargo'}
          </p>
        </div>

        {/* Edit hint */}
        <svg
          className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0 transition-colors"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M16.862 3.487a2.25 2.25 0 013.182 3.182L6.75 19.963l-4.5 1.125 1.125-4.5L16.862 3.487z" />
        </svg>
      </button>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Editar perfil</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-5">
              {/* Photo upload */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-900 flex items-center justify-center text-white text-2xl font-bold select-none">
                  {draft.photo ? (
                    <img src={draft.photo} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <span>{draftInitials}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="text-xs font-medium text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    {draft.photo ? 'Cambiar foto' : 'Subir foto'}
                  </button>
                  {draft.photo && (
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="text-xs font-medium text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
                {!draft.photo && (
                  <p className="text-xs text-slate-400 text-center">
                    Sin foto se mostrarán tus iniciales ({draftInitials})
                  </p>
                )}
              </div>

              {/* Fields */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Nombre completo</label>
                  <input
                    type="text"
                    value={draft.name}
                    placeholder="Ej: Hector Valdes"
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    className="h-9 px-3 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 w-full"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Cargo</label>
                  <input
                    type="text"
                    value={draft.role}
                    placeholder="Ej: Gerente de Finanzas"
                    onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
                    className="h-9 px-3 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 w-full"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 flex gap-2 justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="h-9 px-4 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="h-9 px-4 text-sm font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
