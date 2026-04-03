# CLAUDE.md — EcoMetrics · Gestor Ambiental

## Qué es este proyecto

App web para gestionar facturas de residuos (domiciliarios y reciclables) con fines de declaración SINADER. Permite CRUD de facturas, adjuntar PDFs, y analizar datos con dashboard y analytics.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite 8 + Tailwind 4 + shadcn/ui (base-ui) |
| Backend | Flask 3 + Python 3.11 |
| Persistencia | JSON local (`backend/data/invoices.json`) |
| Archivos PDF | Disco local (`backend/data/documents/`) |

## Estructura

```
app-declaraciones/
├── backend/
│   ├── app.py                  # Flask app factory (create_app)
│   ├── requirements.txt
│   ├── repositories/           # LocalInvoiceRepository (JSON)
│   ├── services/               # InvoiceService + analytics
│   ├── storage/                # FileManager (PDFs locales)
│   ├── validators/             # Tipos de residuos + validación
│   └── data/                   # invoices.json + documents/ (en .gitignore)
├── frontend/
│   ├── src/
│   │   ├── views/              # Dashboard, Analytics, History, Archivos, WordAssistant
│   │   ├── components/         # InvoiceModal, InvoiceDetailModal, ui/
│   │   └── lib/                # api.ts, types.ts, utils.ts
│   ├── vite.config.ts          # Proxy /api → :5000 en dev
│   └── package.json
├── start_dev.ps1               # Levanta backend + frontend en Windows
├── INSTALACION.md
└── README.md
```

## API del backend

Base URL en producción: `https://sirhector.pythonanywhere.com/api`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Ping |
| GET | `/api/invoices` | Lista facturas (filtros: type, year, month) |
| POST | `/api/invoices` | Crear factura |
| PUT | `/api/invoices/<id>` | Actualizar factura |
| DELETE | `/api/invoices/<id>` | Eliminar factura |
| POST | `/api/invoices/<id>/document` | Subir PDF |
| GET | `/api/invoices/<id>/document` | Descargar PDF |
| GET | `/api/analytics?year=YYYY` | Analytics filtrados por año |

## Deploy actual

| Servicio | URL | Notas |
|---|---|---|
| Frontend | https://app-declaraciones.vercel.app | Auto-deploy en push a main |
| Backend | https://sirhector.pythonanywhere.com | **Deploy manual** — requiere git pull + Reload en PythonAnywhere |

### Flujo deploy backend (manual por ahora)
1. Push a GitHub
2. En PythonAnywhere Bash: `cd ~/app-declaraciones && git pull origin main`
3. Si cambiaron deps: `cd backend && source .venv/bin/activate && pip install -r requirements.txt`
4. Web → "Reload SirHector.pythonanywhere.com"

## Variable de entorno en Vercel

| Variable | Valor |
|---|---|
| `VITE_API_URL` | `https://sirhector.pythonanywhere.com/api` |

En dev local no se necesita — Vite proxea `/api` → `http://127.0.0.1:5000` automáticamente.

## Tarea pendiente — CI/CD backend

Automatizar el deploy del backend con GitHub Actions:
- Crear `.github/workflows/deploy.yml`
- Usar la API de PythonAnywhere para hacer `git pull` + reload automático en cada push a `main`
- Requiere agregar 2 secrets en GitHub: `PYTHONANYWHERE_USERNAME` y `PYTHONANYWHERE_API_TOKEN`
- El API token se obtiene en PythonAnywhere → Account → API Token

## Comandos de desarrollo local

```powershell
# Opción rápida
.\start_dev.ps1

# Manual
# Terminal 1 — backend
cd backend && .venv\Scripts\activate && python -m flask --app app:create_app --debug run

# Terminal 2 — frontend
cd frontend && npm run dev
```

## Convenciones del proyecto

- Los botones de acción usan `variant="outline"` con `bg-white shadow-sm font-medium h-9 text-xs`
- El selector de año en Dashboard y Analytics usa `new Date().getFullYear()` como default
- `invoices.json` está en `.gitignore` — no se commitea nunca
- PythonAnywhere se desactiva si no se inicia sesión en 1 mes — recordar hacer clic en "Run until 1 month from today"
