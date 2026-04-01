# EcoMetrics · Gestor Ambiental

Aplicación web para centralizar facturas de gestión de residuos domiciliarios y reciclables. El backend expone una API REST en Flask que persiste los datos en archivos JSON y maneja adjuntos PDF. El frontend es una SPA en React + Vite + Tailwind que consume la API para registrar, listar y analizar toneladas y montos.

## Características principales

- CRUD completo de facturas con validaciones por tipo de residuo.
- Carga y descarga de documentos PDF asociados a cada factura.
- Dashboard analítico con indicadores, gráficos comparativos (Recharts) y tablas por categoría.
- Historial y vista de archivos adjuntos.
- Persistencia local en archivos (`backend/data`) para simplificar la instalación.
- Arquitectura desacoplada: API Flask en `:5000` + frontend Vite en `:5173` con proxy transparente.

## Estructura del proyecto

```
app-declaraciones/
├── backend/
│   ├── app.py                 # Punto de entrada Flask (create_app)
│   ├── requirements.txt       # Dependencias Python
│   ├── repositories/          # Capa de acceso a datos JSON
│   ├── services/              # Reglas de negocio y analytics
│   ├── storage/               # Manejo de archivos adjuntos
│   └── data/                  # invoices.json + documentos PDF
├── frontend/
│   ├── src/
│   │   ├── views/             # Dashboard, Analytics, History, Archivos, WordAssistant
│   │   ├── components/        # InvoiceModal, InvoiceDetailModal, ui/
│   │   └── lib/               # api.ts (cliente HTTP), types.ts, utils.ts
│   ├── index.html
│   ├── vite.config.ts         # Proxy /api → http://127.0.0.1:5000
│   └── package.json
└── start_dev.ps1              # Script para levantar ambos servicios de una vez
```

## Requisitos

- Python >= 3.10
- Node.js >= 18 y npm

## Instalación y ejecución rápida

### Opción A — Script automático (Windows)

```powershell
.\start_dev.ps1
```

Abre dos terminales automáticamente: una para Flask y otra para Vite.

### Opción B — Manual

**Terminal 1 — Backend**
```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m flask --app app:create_app --debug run
```

**Terminal 2 — Frontend**
```powershell
cd frontend
npm install        # solo la primera vez
npm run dev
```

Abre `http://localhost:5173` en el navegador.

## API (resumen)

| Método | Ruta                                  | Descripción                                           |
|--------|---------------------------------------|-------------------------------------------------------|
| GET    | `/api/health`                         | Ping de salud                                         |
| GET    | `/api/invoices`                       | Lista facturas (`type`, `year`, `month` opcionales)   |
| POST   | `/api/invoices`                       | Crea una factura                                      |
| PUT    | `/api/invoices/<id>`                  | Actualiza una factura                                 |
| DELETE | `/api/invoices/<id>`                  | Elimina una factura                                   |
| POST   | `/api/invoices/<id>/document`         | Adjunta un PDF                                        |
| GET    | `/api/invoices/<id>/document`         | Descarga el PDF asociado                              |
| GET    | `/api/analytics?year=YYYY`            | Indicadores y series para dashboards                  |

## Datos y almacenamiento

- Las facturas se almacenan en `backend/data/invoices.json`.
- Los PDF se guardan en `backend/data/documents/` (excluido de git).

## Licencia

Define la licencia antes de publicar (MIT, GPL, etc.) y añade el archivo `LICENSE`.
