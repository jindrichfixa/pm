# Scripts Agent Notes

This folder contains cross-platform helper scripts for starting/stopping the local Dockerized app.

## Current scripts

- Windows (PowerShell)
	- `start-server.ps1`
	- `stop-server.ps1`
- Mac (bash)
	- `start-server-mac.sh`
	- `stop-server-mac.sh`
- Linux (bash)
	- `start-server-linux.sh`
	- `stop-server-linux.sh`
- Generic bash (optional)
	- `start-server.sh`
	- `stop-server.sh`

## Behavior

- Start scripts:
	- move to project root
	- run `docker compose up --build -d`
	- print local URL (`http://localhost:8000`)
- Stop scripts:
	- move to project root
	- run `docker compose down`
	- print stop confirmation

## Notes

- Scripts are intentionally minimal for MVP scaffolding.
- Future phases may add health checks, log tailing, and validation helpers if needed.
- If start fails due to stale containers or network state, run stop script first, then start again.