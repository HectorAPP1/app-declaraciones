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
│   ├── migrate_categories.py   # Migración de residue_category en reciclables
│   ├── migrate_documents.py    # Migración document → certificate en reciclables
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
| POST | `/api/invoices/<id>/document?doc_type=invoice\|certificate` | Subir PDF (factura o certificado) |
| GET | `/api/invoices/<id>/document?doc_type=invoice\|certificate` | Descargar PDF |
| GET | `/api/analytics?year=YYYY` | Analytics filtrados por año |

### Campos de documentos en Invoice
- `document`: nombre del archivo PDF de factura (`{id}.pdf`)
- `certificate`: nombre del archivo PDF de certificado de reciclaje (`{id}_cert.pdf`)

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

## Variables de entorno

### Vercel (frontend)

| Variable | Valor |
|---|---|
| `VITE_API_URL` | `https://sirhector.pythonanywhere.com/api` |

En dev local no se necesita — Vite proxea `/api` → `http://127.0.0.1:5000` automáticamente.

### PythonAnywhere (backend)

| Variable | Descripción |
|---|---|
| `GROQ_API_KEY` | API key de Groq — requerida para el Asistente SINADER |
| `GROQ_MODEL` | Opcional — modelo a usar. Default: `llama-3.3-70b-versatile` |

Configurar en el archivo WSGI de PythonAnywhere:
```python
import os
os.environ['GROQ_API_KEY'] = 'tu_api_key_aqui'
```

## Asistente SINADER (AI)

- **Servicio:** `backend/services/ai_service.py`
- **Proveedor:** Groq API (OpenAI-compatible)
- **Modelo:** `llama-3.3-70b-versatile` (free tier: ~14,400 req/día)
- **API URL:** `https://api.groq.com/openai/v1/chat/completions`
- **Herramientas (tool calling):** `get_invoice_summary`, `get_monthly_series`, `get_category_breakdown`, `get_pending_sinader`
- **API key:** se obtiene en [console.groq.com](https://console.groq.com)

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

## Estado del modelo de datos (Invoice)

Campos clave más allá del CRUD básico:

| Campo | Tipo | Descripción |
|---|---|---|
| `type` | `domiciliary` \| `recyclable` | Tipo de factura |
| `document` | `string \| null` | Filename del PDF de factura |
| `certificate` | `string \| null` | Filename del PDF de certificado (solo reciclables) |
| `payment_status` | `pending\|paid\|overdue` | Estado de pago (plazo 30 días) |
| `sinader_status` | `pending\|declared\|overdue` | Estado declaración SINADER (plazo 10 días) |
| `sinader_folio` | `string` | Folio de declaración SINADER |
| `aggregates.residue_totals` | `Record<string, number>` | Toneladas por categoría |
| `aggregates.residue_amounts` | `Record<string, number>` | Montos por categoría |

## Historial de migraciones de datos

Scripts ejecutados en PythonAnywhere sobre `invoices.json`:

1. **`migrate_categories.py`** — Corrigió `residue_category` en 22 facturas reciclables (cartón, plástico, metal estaban como "otros")
2. **`migrate_documents.py`** — Movió `document` → `certificate` + renombró `{id}.pdf` → `{id}_cert.pdf` en 22 facturas reciclables (el bug de upload sobreescribía la factura con el certificado)
