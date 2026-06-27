# FitPick Background Workers

FitPick can run expensive AI jobs in a background worker when `ENABLE_BACKGROUND_JOBS=true`.

Supported v1 jobs:

- `outfit_preview_generation`
- `wardrobe_analysis`

The current queue is MongoDB-backed and shaped so AWS SQS can replace it later.

## Local Development

```bash
npm run worker
```

Runs the worker once as a long-lived polling process.

```bash
npm run worker:dev
```

Runs the worker with file watching for local development.

## EC2 + PM2

```bash
pm2 start npm --name fitpick-worker -- run worker
```

Starts the worker as a separate PM2 process.

```bash
pm2 restart fitpick-worker --update-env
```

Restarts the worker and reloads environment variables.

```bash
pm2 logs fitpick-worker --lines 100
```

Shows the latest worker logs for job processing, retries, and failures.

```bash
pm2 save
```

Persists the PM2 process list so the worker restarts after reboot.

## Environment

```env
ENABLE_BACKGROUND_JOBS=true
WORKER_POLL_MS=5000
AI_CACHE_PROVIDER=memory
RATE_LIMIT_PROVIDER=memory
```

Redis and SQS are not required for this phase. Future adapters should keep the same queue/cache interfaces.
