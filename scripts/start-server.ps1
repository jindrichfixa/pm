$ErrorActionPreference = "Stop"

Push-Location (Join-Path $PSScriptRoot "..")
try {
    if (-not (Test-Path ".env")) {
        Write-Warning ".env file not found. Create one from .env.example with your OPENROUTER_API_KEY."
        Pop-Location
        exit 1
    }

    docker compose up --build -d
    Write-Host "Server started at http://localhost:8000"
} finally {
    Pop-Location
}
