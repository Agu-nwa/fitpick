# FitPick Frontend Phase 4D

Mobile-first Next.js App Router frontend for FitPick, an occasion-first AI wardrobe and outfit decision assistant.

## Phase 4D status

**Frontend is complete for backend handoff.**

This package finalizes the frontend foundation and adds:

- Final frontend readiness page: `/frontend-complete`
- Backend handoff scope inside the app
- API contract map for backend integration
- Route check script
- Registry-safe `.npmrc` to avoid internal package registry issues
- Mobile-first app shell, safe-area support, bottom navigation, reusable components, and state patterns
- Mock-data layer ready to be replaced by backend APIs

## Run cleanly on Mac

```bash
cd ~/Documents
unzip ~/Downloads/fitpick-frontend-phase4d.zip
cd fitpick-frontend-phase4d
npm install --registry=https://registry.npmjs.org/
npm run dev
```

Open `http://localhost:3000`.

## QA commands

```bash
npm run check:routes
npm run build
```

## Production storage and deployment

FitPick now uses S3 for active image storage and CloudFront for public image delivery. See:

- `docs/deployment/s3-cloudfront.md`
- `docs/deployment/iam-s3-fitpick-policy.json`
- `docs/deployment/ec2-pm2-production.md`

Rotate any AWS key that has been shared in chat, logs, screenshots, or documents.

## Main routes

- `/onboarding`
- `/home`
- `/occasion`
- `/wardrobe`
- `/wardrobe/add`
- `/wardrobe/white-shirt`
- `/outfit`
- `/outfit/work-polished-01`
- `/looks`
- `/profile`
- `/profile/preferences`
- `/plus`
- `/states`
- `/backend-ready`
- `/frontend-complete`

## Backend handoff

The frontend is now ready for the backend prompt. Backend should implement auth, users, wardrobe uploads, image storage, clothing tagging, outfit recommendations, saved/worn looks, ratings, FitPick Plus entitlement, notifications, and API integration using the frontend contract map.
