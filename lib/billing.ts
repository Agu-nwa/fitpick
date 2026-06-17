export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.FITPICK_PLUS_PRICE_ID);
}

export function checkoutPlaceholder(plan: string) {
  return {
    provider: "stripe_placeholder",
    ready: false,
    plan,
    message: "Billing checkout is not configured yet.",
    nextAction: "configure_stripe_or_app_store"
  };
}
