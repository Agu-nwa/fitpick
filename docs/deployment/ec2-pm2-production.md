# FitPick EC2 + PM2 Production Commands

Run these from the FitPick app directory on EC2.

```bash
git pull
```

Pulls the latest committed application code from GitHub.

```bash
npm install
```

Installs dependencies exactly from `package-lock.json`.

```bash
npm run build
```

Builds the Next.js production bundle and catches TypeScript/build issues before restart.

```bash
pm2 restart fitpick --update-env
```

Restarts the FitPick PM2 process and reloads updated environment variables.

```bash
pm2 status
```

Shows process health, uptime, restart count, and memory usage.

```bash
pm2 logs fitpick --lines 100
```

Shows the latest application logs for deployment verification.

```bash
pm2 save
```

Persists the current PM2 process list so it restores on reboot.

## Rollback Basics

If a deployment fails after `git pull`, identify the previous good commit and reset back to it:

```bash
git log --oneline -5
git checkout <previous-good-commit>
npm install
npm run build
pm2 restart fitpick --update-env
pm2 save
```

After rollback, create a follow-up fix branch before returning to the latest main branch.
