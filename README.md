# EcoMetrics · Gestor Ambiental

Aplicación web ligera para centralizar facturas de gestión de residuos domiciliarios y reciclables. El backend expone una API REST en Flask que persiste los datos en archivos JSON y maneja adjuntos PDF de las facturas. El frontend es una SPA vanilla (HTML/CSS/JS + Chart.js) que consume la API para registrar, listar y analizar toneladas y montos.

## Características principales

- ✏️ CRUD completo de facturas con validaciones por tipo de residuo.
- 📎 Carga y descarga de documentos PDF asociados a cada factura.
- 📊 Dashboard analítico con indicadores, gráficos comparativos y tablas por categoría.
- 🗂️ Persistencia local basada en archivos (`backend/data`) para simplificar la instalación.
- 🔌 Arquitectura desacoplada (API Flask + frontend estático) ideal para desplegar en servicios gratuitos.

## Estructura del proyecto

```
app-ambiental/
├── backend/
│   ├── app.py                 # Punto de entrada Flask (create_app)
│   ├── requirements.txt       # Dependencias del backend
│   ├── repositories/          # Capa de acceso a datos JSON
│   ├── services/              # Reglas de negocio y analytics
│   ├── storage/               # Manejo de archivos adjuntos
│   └── data/                  # invoices.json + documentos
└── frontend/
    ├── index.html             # UI principal
    ├── styles.css             # Estilos (tema inspirado en shadcn)
    ├── main.js                # Lógica y llamadas a la API
    └── components/            # Componentes reutilizables del formulario
```

## Requisitos

- Python ≥ 3.10 (probado en 3.11)
- pip (incluido en instalaciones recientes de Python)
- Navegador moderno. Para servir el frontend puedes usar `python -m http.server`, `npx serve`, Live Server, etc.

## Instalación y ejecución rápida

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/<tu-usuario>/app-ambiental.git
   cd app-ambiental
   ```

2. **Preparar el backend (Flask)**
   ```bash
   cd backend
   python -m venv .venv
   # Windows
   .venv\Scripts\activate
   # macOS / Linux
   source .venv/bin/activate

   pip install -r requirements.txt
   python -m flask --app app:create_app --debug run
   ```
   El servidor expone la API en `http://127.0.0.1:5000/api`. Los directorios `backend/data` y `backend/data/documents` se crean automáticamente si no existen.

3. **Servir el frontend** (en otra terminal)
   ```bash
   cd frontend
   # opción rápida con Python
   python -m http.server 4173
   ```
   Luego abre `http://localhost:4173` en el navegador. El frontend consume la API definida en `main.js` (`const API_BASE = "http://127.0.0.1:5000/api"`). Ajusta ese valor si expones la API en otra URL.

## Datos y almacenamiento

- Las facturas se almacenan en `backend/data/invoices.json`. Puedes incluir un archivo de ejemplo en el repositorio o mantenerlo vacío para comenzar desde cero.
- Los PDF se guardan en `backend/data/documents/` y se nombran automáticamente según el ID de la factura. Este directorio puede excluirse del control de versiones si no deseas compartir adjuntos reales.

## API (resumen)

| Método | Ruta                                 | Descripción                              |
|--------|--------------------------------------|------------------------------------------|
| GET    | `/api/health`                        | Ping de salud                            |
| GET    | `/api/invoices`                      | Lista facturas (parámetros `type`, `year`, `month` opcionales) |
| POST   | `/api/invoices`                      | Crea una factura                         |
| PUT    | `/api/invoices/<invoice_id>`         | Actualiza una factura                    |
| DELETE | `/api/invoices/<invoice_id>`         | Elimina una factura                      |
| POST   | `/api/invoices/<invoice_id>/document`| Adjunta un PDF                           |
| GET    | `/api/invoices/<invoice_id>/document`| Descarga el PDF asociado                 |
| GET    | `/api/analytics?year=YYYY`           | Indicadores y series para dashboards     |

Consulta `services/invoice_service.py` para ver la estructura exacta de los objetos esperados y calculados.

## Personalización

- **Origen de la API**: cambia `API_BASE` en `frontend/main.js` si sirves la API detrás de un dominio o puerto distinto.
- **Tipos de residuos**: ajusta los catálogos en `frontend/components/items.js` y `validators/invoice_validator.py` para reflejar tus categorías reales.
- **Persistencia**: si deseas usar una base de datos, reemplaza `LocalInvoiceRepository` por un repositorio acorde y mantiene la misma interfaz (`list_all`, `insert`, `update`, etc.).

## Contribuir

1. Crea un branch descriptivo (`feature/nueva-metrica`).
2. Asegúrate de que el servidor Flask inicie sin errores y que el frontend cargue sin warnings en consola.
3. Abre un Pull Request describiendo el cambio y adjunta capturas si modificaste la UI.

## Licencia

Define la licencia que prefieras (MIT, GPL, etc.) antes de publicar el repositorio. Añade el archivo `LICENSE` correspondiente y actualiza esta sección.
