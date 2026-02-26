#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Create one from .env.example with your OPENROUTER_API_KEY." >&2
  exit 1
fi

docker compose up --build -d

echo "Server started at http://localhost:8000"
