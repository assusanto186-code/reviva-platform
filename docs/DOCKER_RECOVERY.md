# Docker Recovery Record

Status: Environment Blocker Open

Recorded: 2026-07-16

Scope: REV-009 disposable PostgreSQL verification

## Observed Environment

- Docker Desktop: `4.81.0.232925`
- Docker CLI: `29.6.1`, build `8900f1d`
- Docker API client: `1.55`
- WSL: `2.7.10.0`
- WSL kernel: `6.18.33.2-2`
- Default WSL version: `2`
- Windows: `10.0.19045.6466`
- Installed WSL distributions: none reported by `wsl.exe -l -v`
- Docker diagnostic ID: unavailable; no diagnostic executable was discovered
  and the Linux engine did not become available.

## Exact Failures

Docker Desktop Linux engine startup previously returned:

```text
request returned 500 Internal Server Error for API route and version
http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/v1.55/version
```

With Docker Desktop stopped, `docker version` and `docker info` report:

```text
failed to connect to the docker API at npipe:////./pipe/docker_engine;
open //./pipe/docker_engine: The system cannot find the file specified.
```

The CLI also reports:

```text
WARNING: Error loading config file: open C:\Users\hp\.docker\config.json:
Access is denied.
```

## Actions Attempted

1. Inspected the Windows Docker service; it was stopped with manual startup.
2. Attempted to start `com.docker.service`; Windows denied access to the
   service controller.
3. Launched Docker Desktop in the user session without opening an interactive
   window.
4. Polled `docker info` and `docker version`; the Linux engine returned HTTP
   500 or remained unavailable.
5. Stopped the failed Docker Desktop attempt without deleting images, volumes,
   configuration, or application data.
6. Collected WSL status and confirmed that no WSL distribution is installed.

No Docker data reset, factory reset, WSL unregister, image removal, volume
removal, or configuration deletion was performed.

## Recovery Path Requiring User Control

1. Open Docker Desktop interactively and review its startup notification and
   Troubleshoot panel.
2. Resolve the `C:\Users\hp\.docker\config.json` ownership or permission issue
   without deleting unrelated Docker data.
3. Confirm whether Docker Desktop can provision its internal WSL distributions
   on this Windows installation.
4. Run Docker Desktop diagnostics and record the diagnostic ID if the UI makes
   one available.
5. Verify `docker version`, `docker info`, and `docker run --rm hello-world`
   before running `pnpm db:reset`.

Factory reset, Docker data removal, WSL distribution removal, and destructive
reinstallation require explicit user approval.

## Hosted Development Alternative

A dedicated Supabase Development project may be used while Docker is blocked.
It must contain fake data only and must never be a Production project. Store
connection strings in ignored local environment files; never paste them into
chat or commit them to Git.
