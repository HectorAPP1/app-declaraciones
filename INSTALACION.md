# Guía de instalación paso a paso — PC nuevo

Esta guía asume que acabas de encender un PC con Windows y necesitas dejar la app corriendo desde cero.

---

## 1. Requisitos previos (instalar una sola vez)

### 1.1 Python 3.10+

1. Descarga el instalador desde <https://www.python.org/downloads/>.
2. Al ejecutar el instalador **marca la casilla "Add python.exe to PATH"** (muy importante).
3. Haz clic en **Install Now**.
4. Verifica en PowerShell:
   ```powershell
   python --version   # debe mostrar Python 3.1x.x
   pip --version
   ```

### 1.2 Node.js 18+

1. Descarga el instalador LTS desde <https://nodejs.org/>.
2. Instala con las opciones por defecto (incluye npm automáticamente).
3. Verifica:
   ```powershell
   node --version   # v18.x.x o superior
   npm --version
   ```

### 1.3 Git

1. Descarga desde <https://git-scm.com/download/win>.
2. Instala con las opciones por defecto.
3. Verifica:
   ```powershell
   git --version
   ```

---

## 2. Clonar el repositorio

```powershell
cd ~\Desktop
git clone https://github.com/<tu-usuario>/app-declaraciones.git
cd app-declaraciones
```

---

## 3. Levantar el proyecto

### Opción A — Script automático (recomendado)

Desde la carpeta raíz del proyecto ejecuta:

```powershell
.\start_dev.ps1
```

Esto abre dos terminales automáticamente:
- Una con el servidor Flask en `http://127.0.0.1:5000`
- Otra con el servidor Vite en `http://localhost:5173`

Abre `http://localhost:5173` en el navegador y listo.

---

### Opción B — Manual (dos terminales)

**Terminal 1 — Backend (Flask)**

```powershell
cd ~\Desktop\app-declaraciones\backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m flask --app app:create_app --debug run
```

Deberías ver:
```
 * Running on http://127.0.0.1:5000
```

Verifica que funciona abriendo `http://127.0.0.1:5000/api/health` — debe mostrar `{"status":"ok"}`.

**No cierres esta terminal.**

---

**Terminal 2 — Frontend (Vite + React)**

```powershell
cd ~\Desktop\app-declaraciones\frontend
npm install        # solo la primera vez, instala las dependencias
npm run dev
```

Deberías ver:
```
  VITE v8.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

Abre `http://localhost:5173` en el navegador.

---

## 4. Resumen de terminales

| Terminal | Carpeta                              | Comandos                                                              |
|----------|--------------------------------------|-----------------------------------------------------------------------|
| 1        | `app-declaraciones\backend`          | `.venv\Scripts\activate` → `python -m flask --app app:create_app --debug run` |
| 2        | `app-declaraciones\frontend`         | `npm run dev`                                                         |

> El frontend se comunica con el backend a través de un proxy Vite configurado en `vite.config.ts`. No necesitas cambiar ninguna URL.

---

## 5. Uso diario (cuando vuelvas a abrir el PC)

Solo repite los comandos de inicio (no necesitas reinstalar nada):

```powershell
# Opción rápida
.\start_dev.ps1

# O manualmente:

# Terminal 1
cd ~\Desktop\app-declaraciones\backend
.venv\Scripts\activate
python -m flask --app app:create_app --debug run

# Terminal 2
cd ~\Desktop\app-declaraciones\frontend
npm run dev
```

---

## 6. Solución de problemas comunes

| Problema | Solución |
|----------|----------|
| `python` no se reconoce | Reinstala Python marcando "Add to PATH", o usa `py` en lugar de `python`. |
| `npm` no se reconoce | Reinstala Node.js desde nodejs.org. |
| El puerto 5000 ya está en uso | Ejecuta Flask con `--port 5001` y actualiza el target en `frontend/vite.config.ts`. |
| El frontend no conecta con la API | Asegúrate de que el backend siga corriendo en `:5000`. El proxy Vite reenvía `/api` automáticamente. |
| Error de permisos en `.venv` | Ejecuta PowerShell como administrador. |
| `npm install` falla | Borra `frontend/node_modules` y `frontend/package-lock.json` y vuelve a ejecutar `npm install`. |

---

## 7. Actualizar el código desde GitHub

```powershell
cd ~\Desktop\app-declaraciones
git pull origin main
```

Si cambiaron dependencias del backend:
```powershell
cd backend
.venv\Scripts\activate
pip install -r requirements.txt
```

Si cambiaron dependencias del frontend:
```powershell
cd frontend
npm install
```

Luego reinicia ambos servidores.
