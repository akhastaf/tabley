'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ManageNav } from '@/components/manage-nav';

interface Settings {
  id: string;
  slug: string;
  name: string;
  deliveryEnabled: boolean;
  defaultLocale: string;
  posWebhookEnabled: boolean;
  posWebhookUrl: string | null;
  posWebhookSecretSet: boolean;
  posApiKeySet: boolean;
}

interface PatchResult extends Settings {
  posWebhookSecret?: string;
  posApiKey?: string;
}

export default function ManageSettingsPage() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  const { data: session, isPending } = authClient.useSession();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    if (!isPending && !session) router.replace('/sign-in');
  }, [isPending, session, router]);

  const load = useCallback(async () => {
    try {
      const s = await api.get<Settings>('/v1/manage/settings', { tenantSlug: slug });
      setSettings(s);
      setWebhookUrl(s.posWebhookUrl ?? '');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [slug]);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  async function patch(body: Record<string, unknown>) {
    try {
      const res = await api.patch<PatchResult>('/v1/manage/settings', body, { tenantSlug: slug });
      setSettings(res);
      setWebhookUrl(res.posWebhookUrl ?? '');
      if (res.posWebhookSecret) {
        setNewSecret(res.posWebhookSecret);
      }
      if (res.posApiKey) {
        setNewApiKey(res.posApiKey);
      }
      toast.success('Settings updated');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (!session || !settings) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure delivery and POS integration for <span className="font-mono">{slug}</span>.
          </p>
        </div>
        <ManageNav slug={slug} active="settings" />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Delivery</CardTitle>
          <CardDescription>Let customers place orders for delivery from /r/{slug}.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant={settings.deliveryEnabled ? 'default' : 'outline'}
            onClick={() => patch({ deliveryEnabled: !settings.deliveryEnabled })}
          >
            {settings.deliveryEnabled ? 'Delivery is on' : 'Enable delivery'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>POS webhook</CardTitle>
          <CardDescription>
            POST every order state change to your existing cashier system. Each request is
            HMAC-SHA256 signed with the secret below — verify it server-side.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="hook-url">Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                id="hook-url"
                placeholder="https://your-pos.example.com/webhooks/tabley"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                onClick={() =>
                  patch({ posWebhookUrl: webhookUrl.trim() ? webhookUrl.trim() : null })
                }
              >
                Save URL
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant={settings.posWebhookEnabled ? 'default' : 'outline'}
              disabled={!settings.posWebhookUrl}
              onClick={() => patch({ posWebhookEnabled: !settings.posWebhookEnabled })}
            >
              {settings.posWebhookEnabled ? 'Deliveries are on' : 'Enable deliveries'}
            </Button>
            <Button variant="ghost" onClick={() => patch({ regenerateWebhookSecret: true })}>
              {settings.posWebhookSecretSet ? 'Rotate secret' : 'Generate secret'}
            </Button>
            {settings.posWebhookSecretSet && (
              <span className="text-xs text-muted-foreground">A secret is set.</span>
            )}
          </div>

          {newSecret && (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
              <p className="font-medium">New secret — copy it now, it won&apos;t be shown again</p>
              <code className="mt-2 block break-all font-mono text-xs">{newSecret}</code>
            </div>
          )}

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-medium">Inbound API key</p>
            <p className="text-xs text-muted-foreground">
              Your POS uses this key in <span className="font-mono">X-Tabley-API-Key</span> to
              transition orders on Tabley from its side (e.g. mark paid after the cashier charges
              the card).
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={settings.posApiKeySet ? 'outline' : 'default'}
                onClick={() => patch({ regeneratePosApiKey: true })}
              >
                {settings.posApiKeySet ? 'Rotate API key' : 'Generate API key'}
              </Button>
              {settings.posApiKeySet && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (confirm('Revoke the current API key? The POS will lose access.')) {
                      void patch({ revokePosApiKey: true });
                    }
                  }}
                >
                  Revoke
                </Button>
              )}
              {settings.posApiKeySet && (
                <span className="text-xs text-muted-foreground">A key is active.</span>
              )}
            </div>
            {newApiKey && (
              <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
                <p className="font-medium">New API key — copy it now</p>
                <code className="mt-2 block break-all font-mono text-xs">{newApiKey}</code>
              </div>
            )}
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Inbound endpoints</summary>
              <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 font-mono">{`# Mark a Tabley order paid (card processed in the POS)
curl -X PATCH https://your-tabley/v1/integrations/pos/orders/<orderId>/paid \\
     -H "X-Tabley-API-Key: $TABLEY_POS_API_KEY"

# Other transitions use the same auth:
#   PATCH /v1/integrations/pos/orders/<id>/confirm   (pending -> in_kitchen)
#   PATCH /v1/integrations/pos/orders/<id>/ready
#   PATCH /v1/integrations/pos/orders/<id>/served
#   PATCH /v1/integrations/pos/orders/<id>/cancel
#   GET   /v1/integrations/pos/orders?status=...     (poll fallback)
#   GET   /v1/integrations/pos/orders/<id>           (single order)`}</pre>
            </details>
          </div>

          <Separator />

          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">Outbound payload &amp; signature</summary>
            <div className="mt-3 space-y-2 text-xs">
              <p>Headers Tabley sends with every webhook:</p>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">{`Content-Type: application/json
X-Tabley-Event: order.confirmed
X-Tabley-Tenant: ${settings.slug}
X-Tabley-Delivery: <unique delivery id>
X-Tabley-Signature: sha256=<hex-hmac>`}</pre>
              <p>Body shape:</p>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">{`{
  "tenantId": "...",
  "tenantSlug": "${settings.slug}",
  "event": "order.confirmed",
  "orderId": "...",
  "status": "in_kitchen",
  "channel": "dine_in",
  "totalCents": 1250,
  "occurredAt": "2026-01-01T12:00:00.000Z"
}`}</pre>
              <p>
                Verify with <span className="font-mono">crypto.createHmac(&quot;sha256&quot;, secret).update(rawBody).digest(&quot;hex&quot;)</span>.
              </p>
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
