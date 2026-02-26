$ErrorActionPreference = "Stop"

Push-Location (Join-Path $PSScriptRoot "..")
try {
    docker compose down
    Write-Host "Server stopped"
} finally {
    Pop-Location
}
