# setup_dev.ps1
# Script para configurar el entorno de desarrollo local en Windows

Write-Host "--- GREEDYLM: Configuración de Entorno Local ---" -ForegroundColor Cyan

# 1. Verificar .env
if (-not (Test-Path ".env")) {
    Write-Host "[!] El archivo .env no existe. Creándolo desde .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "[+] .env creado. Por favor, revisa las claves API si es necesario." -ForegroundColor Green
} else {
    Write-Host "[ok] El archivo .env ya existe." -ForegroundColor Gray
}

# 2. Levantar Docker
Write-Host "[>] Levantando servicios locales (PostgreSQL, Redis, Qdrant)..." -ForegroundColor Cyan
docker-compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] Error al levantar Docker. Asegúrate de que Docker Desktop esté corriendo." -ForegroundColor Red
    exit $LASTEXITCODE
}

# 3. Verificar conectividad básica (opcional pero recomendado)
Write-Host "[>] Verificando servicios..." -ForegroundColor Cyan
Start-Sleep -Seconds 2
docker ps --filter "name=greedylm"

# 4. Instrucciones finales
Write-Host "`n--- TODO LISTO ---" -ForegroundColor Green
Write-Host "Para correr el backend:" -ForegroundColor Gray
Write-Host "  1. Activa tu venv: .\venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host "  2. Instala dependencias: pip install -r requirements.txt" -ForegroundColor White
Write-Host "  3. Corre migraciones: alembic upgrade head" -ForegroundColor White
Write-Host "  4. Inicia el servidor: uvicorn core.main:app --reload" -ForegroundColor White

Write-Host "`nPara correr el portal (frontend):" -ForegroundColor Gray
Write-Host "  cd portal; npm install; npm run dev" -ForegroundColor White

Write-Host "`nRevisa DEVELOPMENT.md para más detalles." -ForegroundColor Yellow
