'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import {
  MENU_IMPORT_EVENTS,
  useTenantRealtime,
  type RealtimeEvent,
} from '@/lib/realtime';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface JobResultItem {
  name: string;
  description?: string;
  priceCents: number;
  allergens?: string[];
}
interface JobResultCategory {
  name: string;
  items: JobResultItem[];
}
interface JobResult {
  currency: string;
  categories: JobResultCategory[];
}
interface ImportJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  modelUsed: string | null;
  result: JobResult | null;
  errorMessage: string | null;
  appliedAt: string | null;
}

async function readAsBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

export function ImportMenuDialog({
  slug,
  open,
  onOpenChange,
  onApplied,
}: {
  slug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [applying, setApplying] = useState(false);

  const refresh = useCallback(async () => {
    if (!job) return;
    try {
      const updated = await api.get<ImportJob>(`/v1/manage/menu/import/${job.id}`, {
        tenantSlug: slug,
      });
      setJob(updated);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [job, slug]);

  useTenantRealtime(
    open && job ? slug : null,
    MENU_IMPORT_EVENTS,
    useCallback(
      (event: RealtimeEvent, payload: Record<string, unknown>) => {
        if (payload.importId !== job?.id) return;
        if (event === 'menu.import.failed') {
          toast.error('AI extraction failed');
        }
        void refresh();
      },
      [job?.id, refresh],
    ),
  );

  // Reset state when the dialog closes.
  useEffect(() => {
    if (!open) {
      setFile(null);
      setJob(null);
      setApplying(false);
    }
  }, [open]);

  async function upload() {
    if (!file) return;
    setUploading(true);
    try {
      const imageBase64 = await readAsBase64(file);
      const created = await api.post<ImportJob>(
        '/v1/manage/menu/import',
        { imageBase64, mimeType: file.type || 'image/jpeg' },
        { tenantSlug: slug },
      );
      setJob(created);
      toast.success('Uploaded — AI is reading the menu');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function apply() {
    if (!job) return;
    setApplying(true);
    try {
      const summary = await api.post<{ createdCategories: number; createdItems: number }>(
        `/v1/manage/menu/import/${job.id}/apply`,
        {},
        { tenantSlug: slug },
      );
      toast.success(
        `Added ${summary.createdCategories} categor${summary.createdCategories === 1 ? 'y' : 'ies'} and ${summary.createdItems} items`,
      );
      onApplied();
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setApplying(false);
    }
  }

  const totalItems = job?.result?.categories.reduce((n, c) => n + c.items.length, 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Import menu from photo or PDF</DialogTitle>
          <DialogDescription>
            Upload an image of your existing menu. AI will extract the categories and items so you can review and accept.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {!job ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="menu-file">Menu file</Label>
                <Input
                  id="menu-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">
                  JPEG, PNG, WebP, GIF, or PDF. Max 8 MB.
                </p>
              </div>
              {file && (
                <p className="text-xs text-muted-foreground">
                  Selected: <span className="font-mono">{file.name}</span> (
                  {(file.size / 1024).toFixed(0)} KB)
                </p>
              )}
            </div>
          ) : job.status === 'queued' || job.status === 'processing' ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
              <p className="mt-4 text-sm font-medium">
                {job.status === 'queued' ? 'Queued…' : 'Reading menu with AI…'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                This usually takes 5-20 seconds. The dialog updates automatically.
              </p>
            </div>
          ) : job.status === 'failed' ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive">Extraction failed</p>
              <p className="mt-2 text-xs text-muted-foreground">{job.errorMessage}</p>
            </div>
          ) : job.result ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Detected <span className="font-medium text-foreground">{job.result.categories.length}</span> categories ·{' '}
                  <span className="font-medium text-foreground">{totalItems}</span> items · currency{' '}
                  <span className="font-mono">{job.result.currency}</span>
                </span>
                {job.modelUsed && <span className="font-mono">{job.modelUsed}</span>}
              </div>
              <Separator />
              <div className="space-y-4">
                {job.result.categories.map((c, ci) => (
                  <section key={ci}>
                    <h3 className="mb-2 text-sm font-semibold">{c.name}</h3>
                    <ul className="space-y-1 text-sm">
                      {c.items.map((it, ii) => (
                        <li key={ii} className="flex items-start justify-between gap-3 border-b border-border/50 pb-1">
                          <div className="flex-1">
                            <p>{it.name}</p>
                            {it.description && (
                              <p className="text-xs text-muted-foreground">{it.description}</p>
                            )}
                          </div>
                          <span className="font-mono tabular-nums text-sm">
                            {(it.priceCents / 100).toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border px-6 py-3">
          {!job ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={upload} disabled={!file || uploading}>
                {uploading ? 'Uploading…' : 'Extract menu'}
              </Button>
            </>
          ) : job.status === 'completed' ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Discard
              </Button>
              <Button onClick={apply} disabled={applying}>
                {applying ? 'Adding…' : `Add ${totalItems} items to my menu`}
              </Button>
            </>
          ) : job.status === 'failed' ? (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
