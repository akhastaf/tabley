'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api-client';
import { fileToSquareJpegDataUrl } from '@/lib/image-resize';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { DashboardShell } from '@/components/dashboard-shell';
import { useConfirm } from '@/components/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
interface DayHours {
  closed: boolean;
  open: string;
  close: string;
}
type OpeningHours = Record<DayKey, DayHours>;

interface Settings {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  deliveryEnabled: boolean;
  defaultLocale: string;
  posWebhookEnabled: boolean;
  posWebhookUrl: string | null;
  posWebhookSecretSet: boolean;
  posApiKeySet: boolean;
  // Restaurant info
  addressLine: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  openingHours: OpeningHours | null;
  openNow: boolean;
  openReason: 'no_hours_today' | 'before_open' | 'after_close' | null;
}

interface PatchResult extends Settings {
  posWebhookSecret?: string;
  posApiKey?: string;
}

export default function ManageSettingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: session } = authClient.useSession();
  const confirmDialog = useConfirm();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');

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

  return (
    <DashboardShell
      slug={slug}
      active="settings"
      title="Settings"
      subtitle={
        <>
          Configure delivery and POS integration for <span className="font-mono">{slug}</span>.
        </>
      }
    >
      {!settings ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <SettingsBody
          slug={slug}
          settings={settings}
          newSecret={newSecret}
          newApiKey={newApiKey}
          webhookUrl={webhookUrl}
          setWebhookUrl={setWebhookUrl}
          patch={patch}
          confirmDialog={confirmDialog}
        />
      )}
    </DashboardShell>
  );
}

function BrandingCard({
  slug,
  settings,
  patch,
  confirmDialog,
}: {
  slug: string;
  settings: Settings;
  patch: (body: Record<string, unknown>) => Promise<void>;
  confirmDialog: (opts: { title: string; description?: string; confirmLabel?: string; destructive?: boolean }) => Promise<boolean>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onPickFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    setUploading(true);
    try {
      // Square, modest size — it sits in the centre of a QR code and the menu header.
      const dataUrl = await fileToSquareJpegDataUrl(file, 512, 0.9);
      // The upload streams through the API to the (private) bucket; the returned
      // URL points at our own /v1/files serve endpoint, so the browser can load
      // the logo back even though the bucket itself isn't publicly readable.
      const { url } = await api.post<{ url: string }>(
        '/v1/uploads/logo',
        { dataUrl },
        { tenantSlug: slug },
      );
      await patch({ logoUrl: url });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>
          Your logo is placed in the centre of every table&apos;s QR code and shown on the public
          menu. A square image works best.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
            {settings.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logoUrl} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-semibold text-muted-foreground">
                {settings.name.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? 'Uploading…' : settings.logoUrl ? 'Replace logo' : 'Upload logo'}
              </Button>
              {settings.logoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={uploading}
                  onClick={async () => {
                    const ok = await confirmDialog({
                      title: 'Remove the logo?',
                      description: 'Your QR codes will fall back to a plain code.',
                      confirmLabel: 'Remove',
                      destructive: true,
                    });
                    if (ok) void patch({ logoUrl: null });
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">PNG or JPG, up to 2 MB.</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onPickFile(file);
              e.target.value = '';
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Contact ────────────────────────────────────────────────────────────────

function ContactCard({
  settings,
  patch,
}: {
  settings: Settings;
  patch: (body: Record<string, unknown>) => Promise<void>;
}) {
  // Local mirror so the manager can type freely; we only PATCH on blur to
  // avoid a request on every keystroke.
  const [form, setForm] = useState({
    addressLine: settings.addressLine ?? '',
    city: settings.city ?? '',
    postalCode: settings.postalCode ?? '',
    country: settings.country ?? '',
    phone: settings.phone ?? '',
    email: settings.email ?? '',
    websiteUrl: settings.websiteUrl ?? '',
  });

  // Re-sync when the parent reloads settings (e.g. after PATCH success).
  useEffect(() => {
    setForm({
      addressLine: settings.addressLine ?? '',
      city: settings.city ?? '',
      postalCode: settings.postalCode ?? '',
      country: settings.country ?? '',
      phone: settings.phone ?? '',
      email: settings.email ?? '',
      websiteUrl: settings.websiteUrl ?? '',
    });
  }, [settings]);

  function commit(field: keyof typeof form, value: string) {
    const next = value.trim();
    const current = (settings[field] ?? '') as string;
    if (next === current) return;
    void patch({ [field]: next || null });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact &amp; address</CardTitle>
        <CardDescription>
          Shown on your public restaurant page so customers know where to find you.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="addr-line">Street address</Label>
          <Input
            id="addr-line"
            placeholder="12 Rue de la Paix"
            value={form.addressLine}
            onChange={(e) => setForm((f) => ({ ...f, addressLine: e.target.value }))}
            onBlur={(e) => commit('addressLine', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="addr-city">City</Label>
          <Input
            id="addr-city"
            placeholder="Paris"
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            onBlur={(e) => commit('city', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="addr-postal">Postal code</Label>
          <Input
            id="addr-postal"
            placeholder="75002"
            value={form.postalCode}
            onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
            onBlur={(e) => commit('postalCode', e.target.value)}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="addr-country">Country</Label>
          <Input
            id="addr-country"
            placeholder="France"
            value={form.country}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            onBlur={(e) => commit('country', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="contact-phone">Phone</Label>
          <Input
            id="contact-phone"
            placeholder="+33 1 23 45 67 89"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            onBlur={(e) => commit('phone', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="contact-email">Email</Label>
          <Input
            id="contact-email"
            type="email"
            placeholder="hello@your-restaurant.com"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            onBlur={(e) => commit('email', e.target.value)}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="contact-website">Website</Label>
          <Input
            id="contact-website"
            type="url"
            placeholder="https://your-restaurant.com"
            value={form.websiteUrl}
            onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
            onBlur={(e) => commit('websiteUrl', e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Location (map + geocode) ───────────────────────────────────────────────

function buildOsmEmbed(lat: number, lng: number): string {
  // ~600m × 350m window around the marker — tight enough that the restaurant
  // is clearly the focus but customers still see the surrounding streets.
  const dLat = 0.003;
  const dLng = 0.005;
  const bbox = `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

function LocationCard({
  settings,
  patch,
}: {
  settings: Settings;
  patch: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [lat, setLat] = useState(settings.latitude !== null ? String(settings.latitude) : '');
  const [lng, setLng] = useState(settings.longitude !== null ? String(settings.longitude) : '');
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    setLat(settings.latitude !== null ? String(settings.latitude) : '');
    setLng(settings.longitude !== null ? String(settings.longitude) : '');
  }, [settings.latitude, settings.longitude]);

  function commitCoord(field: 'latitude' | 'longitude', value: string) {
    const trimmed = value.trim();
    if (trimmed === '') {
      if (settings[field] === null) return;
      void patch({ [field]: null });
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      toast.error('Invalid coordinate');
      return;
    }
    if (n === settings[field]) return;
    void patch({ [field]: n });
  }

  async function findOnMap() {
    // Build a single search string from whatever the manager has filled in;
    // Nominatim handles partial addresses gracefully.
    const parts = [
      settings.addressLine,
      settings.postalCode,
      settings.city,
      settings.country,
    ].filter((p) => p && p.trim()) as string[];
    if (parts.length === 0) {
      toast.error('Fill in the address first');
      return;
    }
    setGeocoding(true);
    try {
      const q = encodeURIComponent(parts.join(', '));
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`,
        { headers: { Accept: 'application/json' } },
      );
      if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
      const hits = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (hits.length === 0) {
        toast.error('Address not found on the map — refine it and try again');
        return;
      }
      const found = hits[0]!;
      const nextLat = Number(found.lat);
      const nextLng = Number(found.lon);
      setLat(String(nextLat));
      setLng(String(nextLng));
      await patch({ latitude: nextLat, longitude: nextLng });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGeocoding(false);
    }
  }

  const hasCoords = settings.latitude !== null && settings.longitude !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Location on the map</CardTitle>
        <CardDescription>
          A small map preview is shown on your public page. Click <b>Find on map</b> to look up
          coordinates from the address above, or drop them in manually.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1">
            <Label htmlFor="lat">Latitude</Label>
            <Input
              id="lat"
              inputMode="decimal"
              placeholder="48.870"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              onBlur={(e) => commitCoord('latitude', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lng">Longitude</Label>
            <Input
              id="lng"
              inputMode="decimal"
              placeholder="2.331"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              onBlur={(e) => commitCoord('longitude', e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button type="button" variant="outline" disabled={geocoding} onClick={findOnMap}>
              {geocoding ? 'Searching…' : 'Find on map'}
            </Button>
          </div>
        </div>

        {hasCoords && (
          <div className="space-y-2">
            <div className="overflow-hidden rounded-lg border border-border">
              <iframe
                title="Map preview"
                src={buildOsmEmbed(settings.latitude!, settings.longitude!)}
                className="block h-72 w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              <a
                className="underline"
                href={`https://www.google.com/maps/search/?api=1&query=${settings.latitude},${settings.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in Google Maps
              </a>
              {' · '}
              <a
                className="underline"
                href={`https://www.openstreetmap.org/?mlat=${settings.latitude}&mlon=${settings.longitude}#map=18/${settings.latitude}/${settings.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in OpenStreetMap
              </a>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Opening hours ──────────────────────────────────────────────────────────

const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABEL: Record<DayKey, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

function emptyHours(): OpeningHours {
  const out: Partial<OpeningHours> = {};
  for (const d of DAY_KEYS) {
    out[d] = { closed: true, open: '09:00', close: '22:00' };
  }
  return out as OpeningHours;
}

function HoursCard({
  settings,
  patch,
}: {
  settings: Settings;
  patch: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [hours, setHours] = useState<OpeningHours>(
    settings.openingHours ?? emptyHours(),
  );
  const [tz, setTz] = useState(
    settings.timezone ??
      (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'),
  );

  useEffect(() => {
    setHours(settings.openingHours ?? emptyHours());
    setTz(
      settings.timezone ??
        (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'),
    );
  }, [settings.openingHours, settings.timezone]);

  function update(day: DayKey, patchObj: Partial<DayHours>) {
    setHours((curr) => ({ ...curr, [day]: { ...curr[day], ...patchObj } }));
  }

  async function save() {
    // Persist the hours and the timezone in a single PATCH so they can't drift.
    await patch({ openingHours: hours, timezone: tz.trim() || null });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Opening hours</CardTitle>
        <CardDescription>
          Orders are blocked outside these hours. Times use the timezone below.
          {settings.openingHours ? (
            <span
              className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                settings.openNow
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
              }`}
            >
              {settings.openNow ? 'Open now' : 'Closed now'}
            </span>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="tz">Timezone (IANA)</Label>
          <Input
            id="tz"
            placeholder="Europe/Paris"
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Common values: <span className="font-mono">Europe/Paris</span>,{' '}
            <span className="font-mono">Africa/Casablanca</span>,{' '}
            <span className="font-mono">America/New_York</span>.
          </p>
        </div>

        <div className="divide-y rounded-md border border-border">
          {DAY_KEYS.map((d) => {
            const row = hours[d];
            return (
              <div
                key={d}
                className="grid grid-cols-1 items-center gap-3 px-3 py-2 sm:grid-cols-[8rem_auto_1fr_auto_1fr]"
              >
                <div className="text-sm font-medium">{DAY_LABEL[d]}</div>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`day-${d}-open`}
                    checked={!row.closed}
                    onCheckedChange={(v) => update(d, { closed: !v })}
                  />
                  <Label htmlFor={`day-${d}-open`} className="text-xs text-muted-foreground">
                    {row.closed ? 'Closed' : 'Open'}
                  </Label>
                </div>
                <Input
                  type="time"
                  step={300}
                  disabled={row.closed}
                  value={row.open}
                  onChange={(e) => update(d, { open: e.target.value })}
                  className="font-mono text-sm"
                />
                <span className="text-center text-xs text-muted-foreground">to</span>
                <Input
                  type="time"
                  step={300}
                  disabled={row.closed}
                  value={row.close}
                  onChange={(e) => update(d, { close: e.target.value })}
                  className="font-mono text-sm"
                />
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => patch({ openingHours: null })}>
            Clear schedule
          </Button>
          <Button type="button" onClick={save}>
            Save hours
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsBody({
  slug,
  settings,
  newSecret,
  newApiKey,
  webhookUrl,
  setWebhookUrl,
  patch,
  confirmDialog,
}: {
  slug: string;
  settings: Settings;
  newSecret: string | null;
  newApiKey: string | null;
  webhookUrl: string;
  setWebhookUrl: (v: string) => void;
  patch: (body: Record<string, unknown>) => Promise<void>;
  confirmDialog: (opts: { title: string; description?: string; confirmLabel?: string; destructive?: boolean }) => Promise<boolean>;
}) {
  return (
    <>
      <BrandingCard slug={slug} settings={settings} patch={patch} confirmDialog={confirmDialog} />

      <ContactCard settings={settings} patch={patch} />
      <LocationCard settings={settings} patch={patch} />
      <HoursCard settings={settings} patch={patch} />

      <Card>
        <CardHeader>
          <CardTitle>Delivery</CardTitle>
          <CardDescription>Let customers place orders for delivery from /r/{settings.slug}.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="delivery-toggle" className="text-sm font-medium">
                Accept delivery orders
              </Label>
              <p className="text-xs text-muted-foreground">
                Show the delivery form on your public restaurant page.
              </p>
            </div>
            <Switch
              id="delivery-toggle"
              checked={settings.deliveryEnabled}
              onCheckedChange={(v) => patch({ deliveryEnabled: v })}
            />
          </div>
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

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Switch
                id="webhook-toggle"
                checked={settings.posWebhookEnabled}
                disabled={!settings.posWebhookUrl}
                onCheckedChange={(v) => patch({ posWebhookEnabled: v })}
              />
              <Label htmlFor="webhook-toggle" className="text-sm">
                {settings.posWebhookEnabled ? 'Deliveries are on' : 'Deliveries are off'}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => patch({ regenerateWebhookSecret: true })}>
                {settings.posWebhookSecretSet ? 'Rotate secret' : 'Generate secret'}
              </Button>
              {settings.posWebhookSecretSet && (
                <span className="text-xs text-muted-foreground">A secret is set.</span>
              )}
            </div>
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
                  onClick={async () => {
                    const ok = await confirmDialog({
                      title: 'Revoke the POS API key?',
                      description: 'Your POS will immediately lose access until you generate a new key.',
                      confirmLabel: 'Revoke key',
                      destructive: true,
                    });
                    if (ok) void patch({ revokePosApiKey: true });
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
            <Collapsible className="text-xs">
              <CollapsibleTrigger className="cursor-pointer text-muted-foreground hover:text-foreground">
                Inbound endpoints
              </CollapsibleTrigger>
              <CollapsibleContent>
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
              </CollapsibleContent>
            </Collapsible>
          </div>

          <Separator />

          <Collapsible className="text-sm">
            <CollapsibleTrigger className="cursor-pointer text-muted-foreground hover:text-foreground">
              Outbound payload &amp; signature
            </CollapsibleTrigger>
            <CollapsibleContent>
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
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </>
  );
}
