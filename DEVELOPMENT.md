# Desarrollo Local de GREEDYLM

Esta guía explica cómo configurar y correr el proyecto de forma segura en tu máquina local para hacer debugs, sin interferir con el despliegue a producción.

## Requisitos Previos

- **Docker Desktop**: Necesario para correr la base de datos, Redis y Qdrant localmente.
- **Python 3.10+**
- **Node.js 18+** (para el portal/frontend)

## Configuración Rápida (Windows)

Ejecuta el script de configuración automática:

```powershell
.\scripts\setup_dev.ps1
```

Este script:

1. Crea tu archivo `.env` local desde la plantilla `.env.example`.
2. Levanta los contenedores de Docker (PostgreSQL, Redis, Qdrant).

## Estructura de Configuración

El proyecto utiliza `pydantic-settings` para manejar la configuración:

- **`.env`**: Archivo local (ignorado por Git). Aquí es donde pones tus claves API reales para desarrollo.
- **`ENVIRONMENT`**: En tu `.env` local debe ser `local`. Esto activa el modo `DEBUG=True` y usa las URLs de los contenedores locales.
- **`.env.example`**: Plantilla compartida en el repositorio. **Nunca pongas secretos aquí.**

## Ejecución del Backend (Core)

1. **Entorno Virtual**:

   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

2. **Base de Datos**:

   Asegúrate de que Docker esté corriendo y aplica las migraciones:

   ```powershell
   alembic upgrade head
   ```

3. **Iniciar Servidor**:

   ```powershell
   uvicorn core.main:app --reload
   ```

   El API estará disponible en `http://localhost:8000/docs`.

## Ejecución del Frontend (Portal)

1. **Instalar y Correr**:

   ```powershell
   cd portal
   npm install
   npm run dev
   ```

   El portal estará disponible en `http://localhost:3000`.

## Seguridad y Despliegue

- **GitHub**: El archivo `.env` está en `.gitignore`, por lo que nunca se subirá al repositorio.
- **Producción (Render/Vercel)**: Las variables de entorno en producción se configuran directamente en el panel de control de la plataforma (Render para backend, Vercel para frontend). Allí `ENVIRONMENT` debe ser `production`.

## Debugging

El servidor uvicorn corre con `--reload` por defecto en local, permitiéndote ver cambios al instante. Los logs de la base de datos se pueden ver con `docker logs -f greedylm_postgres`.
