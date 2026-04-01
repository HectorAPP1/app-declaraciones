$dir = "c:\Users\Hector Valdes\.gemini\antigravity\scratch\app-declaraciones"

Write-Host "Iniciando el entorno backend en una nueva ventana..."
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$dir\backend'; python -m venv .venv; .\.venv\Scripts\activate; pip install -r requirements.txt; python -m flask --app app:create_app --debug run`""

Write-Host "Iniciando el servidor frontend en una nueva ventana..."
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$dir\frontend'; npm run dev`""

Write-Host "¡Listo! Ambas ventanas de terminal deberían abrirse y levantar los servicios."
