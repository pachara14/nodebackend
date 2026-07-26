# nodebackend

Minimal Node.js backend service.

## Run

```bash
npm start
```

The server starts on `PORT` (default `3000`).

## Endpoints

- `GET /` -> `{ "message": "backend ready" }`
- `GET /health` -> `{ "status": "ok" }`

## Test

```bash
npm test
```
