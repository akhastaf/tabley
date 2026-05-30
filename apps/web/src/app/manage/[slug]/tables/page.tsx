'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Download, Printer } from 'lucide-react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DashboardShell } from '@/components/dashboard-shell';
import { useConfirm } from '@/components/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';

interface Table {
  id: string;
  label: string;
  capacity: number;
  tokenHash: string;
  isActive: boolean;
  assignedWaiterId: string | null;
}

interface Waiter {
  userId: string;
  name: string | null;
  email: string | null;
  invitedEmail: string | null;
}

// Sentinel for the "no zone — any waiter" option, since Radix Select can't use
// an empty string as a value.
const UNASSIGNED = '__none__';

const newTableSchema = z.object({
  label: z.string().min(1).max(40),
  capacity: z.coerce.number().int().positive().max(40),
});
type NewTableInput = z.infer<typeof newTableSchema>;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3010';
// Human-readable host shown on the printed sticker as a typed-URL fallback.
const APP_HOST = APP_URL.replace(/^https?:\/\//, '');

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function safeFileName(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

export default function ManageTablesPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: session } = authClient.useSession();
  const confirmDialog = useConfirm();

  const [tables, setTables] = useState<Table[]>([]);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [tenant, setTenant] = useState<{ name: string; logoUrl: string | null } | null>(null);
  // The logo fetched and re-encoded as a same-origin data URL, so it can be
  // baked into the QR canvas without tainting it (which would break PNG export).
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  // When set, the off-screen print sheet renders these tables and the browser
  // print dialog opens (one table = single sticker; all = full sheet).
  const [printTables, setPrintTables] = useState<Table[] | null>(null);
  // Off-screen <canvas> per table, used as the QR source when exporting a PNG.
  const qrCanvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const form = useForm<NewTableInput>({
    resolver: zodResolver(newTableSchema),
    defaultValues: { label: '', capacity: 4 },
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, team, settings] = await Promise.all([
        api.get<Table[]>('/v1/manage/tables', { tenantSlug: slug }),
        api.get<{ members: (Waiter & { role: string })[] }>('/v1/manage/team', {
          tenantSlug: slug,
        }),
        api.get<{ name: string; logoUrl: string | null }>('/v1/manage/settings', {
          tenantSlug: slug,
        }),
      ]);
      setTables(list);
      setWaiters(team.members.filter((m) => m.role === 'waiter'));
      setTenant({ name: settings.name, logoUrl: settings.logoUrl });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  async function assignWaiter(tableId: string, value: string) {
    const waiterId = value === UNASSIGNED ? null : value;
    // Optimistic — reflect the choice immediately, roll back on failure.
    setTables((prev) =>
      prev.map((t) => (t.id === tableId ? { ...t, assignedWaiterId: waiterId } : t)),
    );
    try {
      await api.patch(`/v1/manage/tables/${tableId}/assignee`, { waiterId }, { tenantSlug: slug });
    } catch (err) {
      toast.error((err as Error).message);
      await load();
    }
  }

  function waiterName(w: Waiter): string {
    return w.name ?? w.email ?? w.invitedEmail ?? w.userId.slice(0, 8);
  }

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  // Re-encode the remote logo as a data URL once, so it can be embedded in the
  // QR (canvas + SVG) without a cross-origin canvas taint. If the fetch fails
  // (e.g. storage CORS not configured) we simply render QR codes without a logo.
  useEffect(() => {
    let cancelled = false;
    const url = tenant?.logoUrl;
    if (!url) {
      setLogoDataUrl(null);
      return;
    }
    void (async () => {
      try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error('logo fetch failed');
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result as string);
          fr.onerror = () => reject(fr.error ?? new Error('read failed'));
          fr.readAsDataURL(blob);
        });
        if (!cancelled) setLogoDataUrl(dataUrl);
      } catch {
        if (!cancelled) setLogoDataUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenant?.logoUrl]);

  // Opening the native print dialog needs the off-screen sheet in the DOM first;
  // the small delay lets the QR SVGs (and embedded logo) paint before printing.
  useEffect(() => {
    if (!printTables || printTables.length === 0) return;
    const id = window.setTimeout(() => {
      window.print();
      setPrintTables(null);
    }, 200);
    return () => window.clearTimeout(id);
  }, [printTables]);

  const qrUrl = useCallback((t: Table) => `${APP_URL}/r/${slug}/t/${t.tokenHash}`, [slug]);

  // Center-logo settings for qrcode.react, scaled to the QR size. Returns
  // undefined (no logo) when we don't have a usable data URL.
  const logoSettings = useCallback(
    (size: number) => {
      if (!logoDataUrl) return undefined;
      const s = Math.round(size * 0.2);
      return { src: logoDataUrl, height: s, width: s, excavate: true } as const;
    },
    [logoDataUrl],
  );

  // Compose a printable PNG "sticker": restaurant name, QR (with logo), table
  // label and a typed-URL fallback — drawn on a 2× canvas for crisp printing.
  function downloadSticker(t: Table) {
    const qr = qrCanvasRefs.current.get(t.id);
    if (!qr) {
      toast.error('QR is still rendering — try again in a moment');
      return;
    }
    const scale = 2;
    const W = 480;
    const H = 600;
    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);
    const cx = W / 2;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    roundRect(ctx, 10, 10, W - 20, H - 20, 22);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f172a';
    ctx.font = '700 30px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.fillText(truncate(tenant?.name ?? '', 22), cx, 72);

    ctx.fillStyle = '#64748b';
    ctx.font = '500 16px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.fillText('Scan to view the menu & order', cx, 102);

    const qrSize = 300;
    ctx.drawImage(qr, cx - qrSize / 2, 132, qrSize, qrSize);

    ctx.fillStyle = '#0f172a';
    ctx.font = '700 26px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.fillText(t.label, cx, 132 + qrSize + 54);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '400 13px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.fillText(`${APP_HOST}/r/${slug}`, cx, H - 28);

    let dataUrl: string;
    try {
      dataUrl = canvas.toDataURL('image/png');
    } catch {
      toast.error('Could not render the QR image');
      return;
    }
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${safeFileName(slug)}-${safeFileName(t.label)}-qr.png`;
    a.click();
  }

  async function createTable(values: NewTableInput) {
    try {
      await api.post('/v1/manage/tables', values, { tenantSlug: slug });
      form.reset({ label: '', capacity: 4 });
      toast.success('Table created');
      setAddOpen(false);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function rotate(id: string) {
    try {
      await api.post(`/v1/manage/tables/${id}/rotate`, {}, { tenantSlug: slug });
      toast.success('Token rotated — print the new QR');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function remove(id: string) {
    const ok = await confirmDialog({
      title: 'Delete this table?',
      description: 'Any future QR scans will fail until a new table is created.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/v1/manage/tables/${id}`, { tenantSlug: slug });
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <DashboardShell
      slug={slug}
      active="tables"
      title="Tables"
      subtitle="Generate a QR code for each table, and assign a waiter to its zone. Unassigned tables are covered by any waiter without a zone."
      actions={
        <div className="flex flex-wrap gap-2">
          {tables.length > 0 && (
            <Button variant="outline" onClick={() => setPrintTables(tables)}>
              <Printer className="size-4" />
              Print all
            </Button>
          )}
          <Button onClick={() => setAddOpen(true)}>+ Add table</Button>
        </div>
      }
    >
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : tables.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">No tables yet.</p>
            <Button onClick={() => setAddOpen(true)}>+ Add your first table</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {tables.map((t) => {
            const url = qrUrl(t);
            return (
              <Card key={t.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{t.label}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      seats {t.capacity}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-4">
                    <div className="rounded-md bg-white p-2">
                      <QRCodeSVG
                        value={url}
                        size={128}
                        level={logoDataUrl ? 'H' : 'M'}
                        marginSize={1}
                        imageSettings={logoSettings(128)}
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="break-all font-mono text-xs text-muted-foreground">{url}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPrintTables([t])}>
                          <Printer className="size-3.5" />
                          Print
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => downloadSticker(t)}>
                          <Download className="size-3.5" />
                          PNG
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => rotate(t.id)}>
                          Rotate
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => remove(t.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5 border-t border-border pt-3">
                    <Label className="text-xs text-muted-foreground">Served by</Label>
                    <Select
                      value={t.assignedWaiterId ?? UNASSIGNED}
                      onValueChange={(v) => assignWaiter(t.id, v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>Any waiter (no zone)</SelectItem>
                        {waiters.map((w) => (
                          <SelectItem key={w.userId} value={w.userId}>
                            {waiterName(w)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a table</DialogTitle>
            <DialogDescription>
              You can rotate the token later if a sticker is compromised.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(createTable)} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input id="label" placeholder="e.g. T1, Patio 3" autoFocus {...form.register('label')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity">Capacity</Label>
              <Input id="capacity" type="number" min={1} max={40} {...form.register('capacity')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create table</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Off-screen QR canvases — the PNG export reads pixels from these. Rendered
          at 600px (drawn to a 2× sticker) so the printed code stays sharp. */}
      <div aria-hidden className="pointer-events-none fixed left-[-10000px] top-0">
        {tables.map((t) => (
          <QRCodeCanvas
            key={t.id}
            value={qrUrl(t)}
            size={600}
            level={logoDataUrl ? 'H' : 'M'}
            marginSize={2}
            imageSettings={logoSettings(600)}
            ref={(el: HTMLCanvasElement | null) => {
              if (el) qrCanvasRefs.current.set(t.id, el);
              else qrCanvasRefs.current.delete(t.id);
            }}
          />
        ))}
      </div>

      {/* Print sheet — isolated from the rest of the page by the print CSS below. */}
      {printTables && (
        <div id="qr-print-root">
          <div className="qr-print-grid">
            {printTables.map((t) => (
              <div className="qr-sticker" key={t.id}>
                <h3>{tenant?.name}</h3>
                <div className="cap">Scan to view the menu &amp; order</div>
                <div className="qr-box">
                  <QRCodeSVG
                    value={qrUrl(t)}
                    size={184}
                    level={logoDataUrl ? 'H' : 'M'}
                    marginSize={1}
                    imageSettings={logoSettings(184)}
                  />
                </div>
                <div className="lbl">{t.label}</div>
                <div className="host">
                  {APP_HOST}/r/{slug}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        #qr-print-root { position: fixed; left: -10000px; top: 0; }
        .qr-print-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; padding: 16px; }
        .qr-sticker { break-inside: avoid; border: 1px dashed #cbd5e1; border-radius: 16px;
          padding: 22px; text-align: center; display: flex; flex-direction: column;
          align-items: center; gap: 8px; color: #0f172a; background: #fff; }
        .qr-sticker h3 { font-size: 20px; font-weight: 700; margin: 0; }
        .qr-sticker .cap { font-size: 13px; color: #64748b; }
        .qr-sticker .qr-box { background: #fff; padding: 8px; border-radius: 12px; }
        .qr-sticker .lbl { font-size: 18px; font-weight: 700; margin-top: 4px; }
        .qr-sticker .host { font-size: 11px; color: #94a3b8; word-break: break-all; }
        @media print {
          body * { visibility: hidden !important; }
          #qr-print-root, #qr-print-root * { visibility: visible !important; }
          #qr-print-root { position: absolute !important; left: 0 !important; top: 0 !important; width: 100%; }
          @page { margin: 12mm; }
        }
      `}</style>
    </DashboardShell>
  );
}
