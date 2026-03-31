# Guía de instalación paso a paso — PC nuevo

Esta guía asume que acabas de encender tu otro PC (Windows) y necesitas dejar la app corriendo desde cero.

---

## 1. Requisitos previos (instalar una sola vez)

### 1.1 Python 3.10+

1. Descarga el instalador desde <https://www.python.org/downloads/>.
2. Al ejecutar el instalador **marca la casilla "Add python.exe to PATH"** (muy importante).
3. Haz clic en **Install Now**.
4. Verifica en una terminal (PowerShell o CMD):
   ```powershell
   python --version   # debería mostrar Python 3.1x.x
   pip --version
   ```

### 1.2 Git

1. Descarga desde <https://git-scm.com/download/win>.
2. Instala con las opciones por defecto.
3. Verifica:
   ```powershell
   git --version
   ```

> **Opcional**: si prefieres una interfaz gráfica, instala [GitHub Desktop](https://desktop.github.com/).

---

## 2. Clonar el repositorio

Abre una terminal y ejecuta:

```powershell
cd ~\Desktop
git clone https://github.com/<tu-usuario>/app-ambiental.git
cd app-ambiental
```

Esto creará la carpeta `app-ambiental` en tu escritorio con todo el código.

---

## 3. Levantar el backend (Flask)

### 3.1 Crear entorno virtual e instalar dependencias

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

> Si ves `(.venv)` al inicio de la línea del terminal, el entorno está activo.

### 3.2 Iniciar el servidor

```powershell
python -m flask --app app:create_app --debug run
```

Deberías ver algo como:

```
 * Running on http://127.0.0.1:5000
```

**No cierres esta terminal.** El backend necesita seguir corriendo.

### 3.3 Verificar que funciona

Abre el navegador y visita:

```
http://127.0.0.1:5000/api/health
```

Deberías ver `{"status":"ok"}`.

---

## 4. Levantar el frontend

Abre **otra terminal** (deja la del backend abierta) y ejecuta:

```powershell
cd ~\Desktop\app-ambiental\frontend
python -m http.server 4173
```

Luego abre en el navegador:

```
http://localhost:4173
```

¡Listo! Ya tienes la app funcionando.

---

## 5. Resumen de terminales

| Terminal | Carpeta                         | Comando                                              |
|----------|---------------------------------|------------------------------------------------------|
| 1        | `app-ambiental\backend`         | `.venv\Scripts\activate` → `python -m flask --app app:create_app --debug run` |
| 2        | `app-ambiental\frontend`        | `python -m http.server 4173`                         |

---

## 6. Uso diario (cuando vuelvas a abrir el PC)

Cada vez que quieras usar la app solo necesitas repetir los pasos 3.2 y 4:

```powershell
# Terminal 1 — backend
cd ~\Desktop\app-ambiental\backend
.venv\Scripts\activate
python -m flask --app app:create_app --debug run

# Terminal 2 — frontend
cd ~\Desktop\app-ambiental\frontend
python -m http.server 4173
```

No necesitas volver a instalar dependencias ni crear el venv; ya está todo ahí.

---

## 7. Solución de problemas comunes

| Problema | Solución |
|----------|----------|
| `python` no se reconoce | Reinstala Python marcando "Add to PATH", o usa `py` en lugar de `python`. |
| El puerto 5000 ya está en uso | Ejecuta `python -m flask --app app:create_app --debug run -p 5001` y actualiza `API_BASE` en `frontend/main.js`. |
| El frontend no conecta con la API | Asegúrate de que la terminal del backend siga corriendo y que `API_BASE` en `main.js` apunte a `http://127.0.0.1:5000/api`. |
| Error de permisos en `.venv` | Ejecuta PowerShell como administrador o usa CMD. |

---

## 8. Actualizar el código desde GitHub

Cuando hagas cambios en el otro PC y los subas a GitHub:

```powershell
cd ~\Desktop\app-ambiental
git pull origin main
```

Si cambiaron dependencias del backend:

```powershell
cd backend
.venv\Scripts\activate
pip install -r requirements.txt
```

Luego reinicia el servidor Flask.
