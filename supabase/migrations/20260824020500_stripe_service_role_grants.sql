-- Stripe Edge Functions use the service-role client for authoritative billing
-- state. RLS bypass does not replace the underlying table privileges.
grant select on table public.shop_profiles to service_role;
revoke insert, update, delete on table public.shop_subscriptions from service_role;
grant select on table public.shop_subscriptions to service_role;
grant select, insert, update on table public.stripe_webhook_events to service_role;
