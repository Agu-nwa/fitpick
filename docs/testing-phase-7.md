# FitPick Testing Phase 7

## QA Commands

Run static QA:

```bash
npm run check:routes
npm run test:safety-copy
npm run test:secret-scan
npm run build
```

Run backend smoke with a dev server:

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
BACKEND_SMOKE_BASE_URL=http://127.0.0.1:3000 npm run test:backend-smoke
```

If port 3000 is already in use, use the port printed by the dev server:

```bash
BACKEND_SMOKE_BASE_URL=http://127.0.0.1:<port> npm run test:backend-smoke
```

If the dev server repeatedly restarts with local file-watcher limit warnings, close other local dev servers and rerun the smoke test from a fresh terminal.

Optional authenticated QA:

```bash
TEST_USER_EMAIL=qa@example.com TEST_USER_PASSWORD='change-me' TEST_USER_NAME='QA User' npm run test:authenticated-flow
```

## Mobile QA Checklist

- Bottom navigation is visible and usable.
- Tap targets are large enough for thumbs.
- Forms are usable on mobile keyboards.
- Upload buttons are large and clear.
- Take photo works on supported mobile browsers.
- Upload from gallery works.
- Image preview works.
- Tag review form is readable and editable.
- Outfit cards do not overflow.
- Sticky CTA does not cover important content.
- Error states are readable.
- Loading states are readable.
- Premium prompts are respectful.
- No screen turns into a desktop-first layout.

## Manual End-to-End QA

### Auth

- Register.
- Log in.
- Log out.
- Restore session after refresh.

### Wardrobe

- Add item manually.
- Take photo.
- Upload from gallery.
- Confirm signed upload configured and unconfigured behavior.
- Request AI tag suggestions.
- Edit suggested tags.
- Save reviewed wardrobe item.
- Edit item detail.
- Archive item.

### Occasion

- Fetch occasions.
- Create custom occasion.
- Select occasion and continue.

### Outfit

- Generate recommendation.
- Confirm not-enough-items state.
- Confirm Plus daily-limit response routes respectfully to Plus.
- View outfit detail.
- Swap item.
- Save outfit.
- Mark outfit as worn.
- Rate outfit with safe labels.

### Looks

- Saved tab.
- Worn tab.
- Favorites tab.
- Empty state.

### Profile

- Update profile name.
- Save preferences.
- Toggle notifications.
- Confirm logged-out state.

### Plus and Payments

- View plan status.
- View provider readiness.
- Paystack option.
- Stripe option.
- Checkout not configured state.
- Confirm no raw provider errors appear.

## API Contract QA

- Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- Wardrobe: `/api/wardrobe`, `/api/wardrobe/[id]`, `/api/wardrobe/[id]/tags`
- Upload: `/api/uploads/signed-url`, `/api/wardrobe/upload`, `/api/wardrobe/upload/[id]/review-tags`
- AI tags: `/api/wardrobe/upload/[id]/suggest-tags`
- Occasions: `/api/occasions`, `/api/occasions/custom`
- Outfits: `/api/outfits/recommend`, `/api/outfits/[id]`, `/api/outfits/[id]/swap`, `/api/outfits/[id]/save`, `/api/outfits/[id]/wear`, `/api/outfits/[id]/feedback`
- Looks: `/api/looks`
- Preferences: `/api/preferences`
- Notifications: `/api/notifications/preferences`
- Billing: `/api/billing/plus-status`, `/api/billing/checkout`, `/api/billing/providers`
- Webhooks: `/api/billing/webhook/stripe`, `/api/billing/webhook/paystack`

## Safety Checks

- No raw backend errors.
- No stack traces.
- No storage keys in normal UI.
- No S3, AI, Stripe, or Paystack secrets exposed.
- No push tokens exposed.
- No body-critical or appearance-shaming language.

## Production Limitations

- Live Stripe activation remains.
- Live Paystack activation remains.
- Webhook sandbox verification remains.
- Production AI image-understanding provider tuning remains.
- Push notification delivery remains.
- App-store packaging remains.
- Full account deletion execution remains.
- Production monitoring and alerts remain.
- Production domain and HTTPS setup remain.

## Testing Sign-Off

Testing Phase 7 is complete when route check, safety copy scan, secret scan, build, backend smoke, and manual mobile QA pass.
