'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { ChevronDown, Languages, Sparkles, Loader2, X } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api-client';
import { fileToFittedJpegDataUrl } from '@/lib/image-resize';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DashboardShell } from '@/components/dashboard-shell';
import { useConfirm } from '@/components/confirm-dialog';
import { ImportMenuDialog } from '@/components/import-menu-dialog';
import { useDebouncedSearch } from '@/lib/use-debounced-search';
import { cn } from '@/lib/utils';
import {
  MENU_LABELS,
  LABEL_META,
  LABEL_NAMES_EN,
  LabelIcon,
  type NutritionInfo,
} from '@/lib/menu-labels';

interface Category {
  id: string;
  name: string;
  position: number;
}
interface ItemTranslation {
  name?: string;
  description?: string;
}
interface Item {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  allergens: string[];
  labels: string[];
  nutrition: NutritionInfo | null;
  available: boolean;
  translations?: Record<string, ItemTranslation>;
}
interface Language {
  code: string;
  name: string;
}
interface LanguagesResponse {
  defaultLocale: string;
  base: Language;
  languages: Language[];
  translateEnabled: boolean;
}

const newCategorySchema = z.object({ name: z.string().min(1).max(80) });
type NewCategoryInput = z.infer<typeof newCategorySchema>;

// Editor target: a category to create a new item in, plus the item being
// edited (null = creating).
interface EditorTarget {
  categoryId: string;
  categoryName: string;
  item: Item | null;
}

export default function ManageMenuPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: session } = authClient.useSession();
  const confirmDialog = useConfirm();

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [langInfo, setLangInfo] = useState<LanguagesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  // Categories are expanded by default; this set holds the ones folded shut.
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

  function setCatOpen(id: string, open: boolean) {
    setCollapsedCats((curr) => {
      const next = new Set(curr);
      if (open) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const searchResults = useDebouncedSearch({
    path: '/v1/manage/search/menu',
    q: searchQ,
    options: { tenantSlug: slug },
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, its, langs] = await Promise.all([
        api.get<Category[]>('/v1/manage/menu/categories', { tenantSlug: slug }),
        api.get<Item[]>('/v1/manage/menu/items', { tenantSlug: slug }),
        api.get<LanguagesResponse>('/v1/manage/menu/languages', { tenantSlug: slug }),
      ]);
      setCategories(cats);
      setItems(its);
      setLangInfo(langs);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const reloadLanguages = useCallback(async () => {
    try {
      setLangInfo(await api.get<LanguagesResponse>('/v1/manage/menu/languages', { tenantSlug: slug }));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [slug]);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  async function deleteCategory(id: string) {
    const ok = await confirmDialog({
      title: 'Delete this category?',
      description: 'All items inside this category will be deleted too. This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/v1/manage/menu/categories/${id}`, { tenantSlug: slug });
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function renameCategory(id: string, name: string) {
    try {
      await api.patch(`/v1/manage/menu/categories/${id}`, { name }, { tenantSlug: slug });
      setEditingCatId(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function deleteItem(id: string) {
    const ok = await confirmDialog({
      title: 'Remove this item?',
      description: 'This cannot be undone.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/v1/manage/menu/items/${id}`, { tenantSlug: slug });
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function toggleAvailability(item: Item) {
    const next = !item.available;
    setBusyItemId(item.id);
    try {
      const updated = await api.patch<Item>(
        `/v1/manage/menu/items/${item.id}`,
        { available: next },
        { tenantSlug: slug },
      );
      setItems((curr) => curr.map((i) => (i.id === item.id ? updated : i)));
      toast.success(next ? 'Marked available' : 'Marked out of stock');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyItemId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardShell
      slug={slug}
      active="menu"
      title="Menu"
      subtitle="Manage categories, items, photos, and availability."
      actions={
        <>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            ✨ Import from photo
          </Button>
          <Button onClick={() => setCategoryModalOpen(true)}>+ Add category</Button>
        </>
      }
    >
      {/* Search */}
      <div className="relative">
        <Input
          placeholder="Search items by name, description, or category…"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
        />
        {searchResults.active && (
          <Card className="mt-3">
            <CardHeader>
              <CardTitle className="text-base">
                {searchResults.loading
                  ? 'Searching…'
                  : searchResults.error
                    ? 'Search unavailable'
                    : `${searchResults.hits.length} result${searchResults.hits.length === 1 ? '' : 's'}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {searchResults.error && <p className="text-destructive">{searchResults.error}</p>}
              {!searchResults.loading && !searchResults.error && searchResults.hits.length === 0 && (
                <p className="text-muted-foreground">No matches.</p>
              )}
              {searchResults.hits.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-3 border-b border-border/40 py-2"
                >
                  <div>
                    <p className="font-medium">{h.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.categoryName}
                      {h.description && ` · ${h.description}`}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums text-sm">
                    {(h.priceCents / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Languages */}
      {langInfo && (
        <MenuLanguagesPanel
          slug={slug}
          info={langInfo}
          onChanged={() => void reloadLanguages()}
          onTranslated={() => void load()}
        />
      )}

      {/* Categories */}
      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="mt-2 h-3 w-24" />
              </CardHeader>
              <CardContent className="space-y-2">
                {[0, 1].map((j) => (
                  <Skeleton key={j} className="h-16 w-full" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">No categories yet.</p>
            <Button onClick={() => setCategoryModalOpen(true)}>+ Add your first category</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {categories.map((cat) => {
            const catItems = items.filter((i) => i.categoryId === cat.id);
            const isOpen = !collapsedCats.has(cat.id);
            return (
              <Collapsible
                key={cat.id}
                open={isOpen}
                onOpenChange={(open) => setCatOpen(cat.id, open)}
              >
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <div className="flex-1">
                      {editingCatId === cat.id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const name = editingCatName.trim();
                            if (name) void renameCategory(cat.id, name);
                          }}
                          className="flex max-w-md items-center gap-2"
                        >
                          <Input
                            autoFocus
                            value={editingCatName}
                            onChange={(e) => setEditingCatName(e.target.value)}
                            className="h-9"
                          />
                          <Button type="submit" size="sm">
                            Save
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingCatId(null)}
                          >
                            Cancel
                          </Button>
                        </form>
                      ) : (
                        <>
                          <CardTitle className="flex items-center gap-2">
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                aria-label={isOpen ? `Collapse ${cat.name}` : `Expand ${cat.name}`}
                                className="-ml-1 flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-accent"
                              >
                                <ChevronDown
                                  className={cn(
                                    'size-4 shrink-0 text-muted-foreground transition-transform',
                                    !isOpen && '-rotate-90',
                                  )}
                                />
                                <span>{cat.name}</span>
                              </button>
                            </CollapsibleTrigger>
                            <button
                              type="button"
                              className="text-xs font-normal text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                              onClick={() => {
                                setEditingCatId(cat.id);
                                setEditingCatName(cat.name);
                              }}
                            >
                              Rename
                            </button>
                          </CardTitle>
                          <CardDescription className="pl-6">{catItems.length} items</CardDescription>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          setEditor({ categoryId: cat.id, categoryName: cat.name, item: null })
                        }
                      >
                        + Add item
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteCategory(cat.id)}>
                        Delete
                      </Button>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="space-y-2">
                      {catItems.length === 0 ? (
                        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                          No items yet — add one to get started.
                        </p>
                      ) : (
                        catItems.map((item) => (
                          <ItemRow
                            key={item.id}
                            item={item}
                            isBusy={busyItemId === item.id}
                            onEdit={() =>
                              setEditor({ categoryId: cat.id, categoryName: cat.name, item })
                            }
                            onToggleAvailable={() => void toggleAvailability(item)}
                            onDelete={() => void deleteItem(item.id)}
                          />
                        ))
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}

      <ImportMenuDialog
        slug={slug}
        open={importOpen}
        onOpenChange={setImportOpen}
        onApplied={() => void load()}
      />

      <AddCategoryDialog
        open={categoryModalOpen}
        onOpenChange={setCategoryModalOpen}
        nextPosition={categories.length}
        slug={slug}
        onCreated={() => void load()}
      />

      <ItemEditorDialog
        target={editor}
        slug={slug}
        nextPosition={items.length}
        languages={langInfo?.languages ?? []}
        baseLabel={langInfo?.base.name}
        translateEnabled={langInfo?.translateEnabled ?? false}
        onOpenChange={(open) => !open && setEditor(null)}
        onSaved={() => void load()}
      />
    </DashboardShell>
  );
}

// ── Add-category modal ──────────────────────────────────────────────────────

function AddCategoryDialog({
  open,
  onOpenChange,
  nextPosition,
  slug,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextPosition: number;
  slug: string;
  onCreated: () => void;
}) {
  const form = useForm<NewCategoryInput>({ resolver: zodResolver(newCategorySchema) });

  useEffect(() => {
    if (!open) form.reset({ name: '' });
  }, [open, form]);

  async function submit(values: NewCategoryInput) {
    try {
      await api.post(
        '/v1/manage/menu/categories',
        { ...values, position: nextPosition },
        { tenantSlug: slug },
      );
      toast.success('Category created');
      onCreated();
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add category</DialogTitle>
          <DialogDescription>
            Group menu items under a category like Coffee, Mains, Desserts.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Name</Label>
            <Input id="cat-name" autoFocus placeholder="e.g. Mains" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Add category
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Menu languages panel ─────────────────────────────────────────────────────

function MenuLanguagesPanel({
  slug,
  info,
  onChanged,
  onTranslated,
}: {
  slug: string;
  info: LanguagesResponse;
  onChanged: () => void;
  onTranslated: () => void;
}) {
  const confirmDialog = useConfirm();
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  // Tracks which language code is currently being bulk-translated / removed.
  const [busyCode, setBusyCode] = useState<string | null>(null);

  async function addLanguage(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      await api.post('/v1/manage/menu/languages', { name }, { tenantSlug: slug });
      setNewName('');
      onChanged();
      toast.success(`Added ${name}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function removeLanguage(lang: Language) {
    const ok = await confirmDialog({
      title: `Remove ${lang.name}?`,
      description: 'Existing translations for this language will be deleted from every item.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    setBusyCode(lang.code);
    try {
      await api.delete(`/v1/manage/menu/languages/${encodeURIComponent(lang.code)}`, {
        tenantSlug: slug,
      });
      onChanged();
      onTranslated();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyCode(null);
    }
  }

  async function translateMenu(lang: Language) {
    setBusyCode(lang.code);
    try {
      const res = await api.post<{ items: number; categories: number }>(
        '/v1/manage/menu/translate',
        { code: lang.code },
        { tenantSlug: slug },
      );
      toast.success(`Translated ${res.items} items into ${lang.name}`);
      onTranslated();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Languages className="size-4" />
          Menu languages
        </CardTitle>
        <CardDescription>
          Your menu is written in {info.base.name}. Add languages and let AI translate every
          item — guests pick their language on the public menu.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium">
            {info.base.name}
            <span className="text-muted-foreground">· base</span>
          </span>
          {info.languages.map((lang) => (
            <div
              key={lang.code}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background py-1 pl-3 pr-1 text-xs"
            >
              <span className="font-medium">{lang.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                disabled={busyCode !== null || !info.translateEnabled}
                title={
                  info.translateEnabled
                    ? `AI-translate the whole menu into ${lang.name}`
                    : 'Translation is not configured (GEMINI_API_KEY missing)'
                }
                onClick={() => void translateMenu(lang)}
              >
                {busyCode === lang.code ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Sparkles className="size-3" />
                )}
                Translate
              </Button>
              <button
                type="button"
                aria-label={`Remove ${lang.name}`}
                disabled={busyCode !== null}
                onClick={() => void removeLanguage(lang)}
                className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={addLanguage} className="flex max-w-sm items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Add a language, e.g. Italian, Darija…"
            className="h-9"
            maxLength={40}
          />
          <Button type="submit" size="sm" disabled={adding || !newName.trim()}>
            {adding ? 'Adding…' : 'Add'}
          </Button>
        </form>

        {!info.translateEnabled && (
          <p className="text-xs text-amber-600">
            AI translation is off — set GEMINI_API_KEY to enable one-click translation. You can
            still type translations manually in each item.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Item editor modal (create + edit) ────────────────────────────────────────

interface NutritionForm {
  caloriesKcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  sugarG: string;
  sodiumMg: string;
  servingSize: string;
}

const EMPTY_NUTRITION: NutritionForm = {
  caloriesKcal: '',
  proteinG: '',
  carbsG: '',
  fatG: '',
  sugarG: '',
  sodiumMg: '',
  servingSize: '',
};

function nutritionToForm(n: NutritionInfo | null | undefined): NutritionForm {
  if (!n) return { ...EMPTY_NUTRITION };
  return {
    caloriesKcal: n.caloriesKcal?.toString() ?? '',
    proteinG: n.proteinG?.toString() ?? '',
    carbsG: n.carbsG?.toString() ?? '',
    fatG: n.fatG?.toString() ?? '',
    sugarG: n.sugarG?.toString() ?? '',
    sodiumMg: n.sodiumMg?.toString() ?? '',
    servingSize: n.servingSize ?? '',
  };
}

function buildNutrition(n: NutritionForm): NutritionInfo | null {
  const out: NutritionInfo = {};
  const num = (s: string) => {
    const v = parseFloat(s);
    return Number.isFinite(v) && v >= 0 ? v : undefined;
  };
  const cal = num(n.caloriesKcal);
  if (cal !== undefined) out.caloriesKcal = Math.round(cal);
  const protein = num(n.proteinG);
  if (protein !== undefined) out.proteinG = protein;
  const carbs = num(n.carbsG);
  if (carbs !== undefined) out.carbsG = carbs;
  const fat = num(n.fatG);
  if (fat !== undefined) out.fatG = fat;
  const sugar = num(n.sugarG);
  if (sugar !== undefined) out.sugarG = sugar;
  const sodium = num(n.sodiumMg);
  if (sodium !== undefined) out.sodiumMg = Math.round(sodium);
  const serving = n.servingSize.trim();
  if (serving) out.servingSize = serving;
  return Object.keys(out).length > 0 ? out : null;
}

function ItemEditorDialog({
  target,
  slug,
  nextPosition,
  languages,
  baseLabel,
  translateEnabled,
  onOpenChange,
  onSaved,
}: {
  target: EditorTarget | null;
  slug: string;
  nextPosition: number;
  languages: Language[];
  baseLabel?: string;
  translateEnabled: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const open = target !== null;
  const item = target?.item ?? null;

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [allergens, setAllergens] = useState('');
  const [nutrition, setNutrition] = useState<NutritionForm>({ ...EMPTY_NUTRITION });
  const [nutritionOpen, setNutritionOpen] = useState(false);
  const [translations, setTranslations] = useState<Record<string, ItemTranslation>>({});
  const [translationsOpen, setTranslationsOpen] = useState(false);
  const [translatingCode, setTranslatingCode] = useState<string | null>(null);
  // Newly chosen image, already resized to a JPEG data URL (also used as the
  // preview). `imageRemoved` only matters when editing an item that has one.
  const [stagedDataUrl, setStagedDataUrl] = useState<string | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Re-seed the form every time the dialog opens for a (different) target.
  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? '');
    setPrice(item ? (item.priceCents / 100).toFixed(2) : '');
    setDescription(item?.description ?? '');
    setLabels(item?.labels ?? []);
    setAllergens((item?.allergens ?? []).join(', '));
    const nf = nutritionToForm(item?.nutrition);
    setNutrition(nf);
    setNutritionOpen(Object.values(nf).some((v) => v !== ''));
    setStagedDataUrl(null);
    setImageRemoved(false);
    setSubmitting(false);
    setTranslations(item?.translations ?? {});
    setTranslatingCode(null);
    setTranslationsOpen(false);
  }, [open, item]);

  function setTranslationField(code: string, field: keyof ItemTranslation, value: string) {
    setTranslations((curr) => ({
      ...curr,
      [code]: { ...curr[code], [field]: value },
    }));
  }

  // AI-translate this single item, then merge the server's result into the
  // open editor so the manager can review/tweak before saving.
  async function translateOne(code: string) {
    if (!item) return;
    setTranslatingCode(code);
    try {
      const updated = await api.post<Item>(
        `/v1/manage/menu/items/${item.id}/translate`,
        { code },
        { tenantSlug: slug },
      );
      setTranslations((curr) => ({ ...curr, [code]: updated.translations?.[code] ?? curr[code] }));
      toast.success('Translated');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setTranslatingCode(null);
    }
  }

  function toggleLabel(label: string) {
    setLabels((curr) =>
      curr.includes(label) ? curr.filter((l) => l !== label) : [...curr, label],
    );
  }

  async function onPickFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    try {
      const dataUrl = await fileToFittedJpegDataUrl(file, 1024, 0.82);
      setStagedDataUrl(dataUrl);
      setImageRemoved(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const currentImage = stagedDataUrl ?? (imageRemoved ? null : item?.imageUrl ?? null);

  async function submit() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Name is required');
      return;
    }
    const priceValue = parseFloat(price);
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      toast.error('Enter a valid price');
      return;
    }
    const priceCents = Math.round(priceValue * 100);
    const allergenList = allergens
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
    // Keep only languages with at least a translated name or description.
    const cleanedTranslations: Record<string, ItemTranslation> = {};
    for (const lang of languages) {
      const tr = translations[lang.code];
      const trName = tr?.name?.trim();
      const trDesc = tr?.description?.trim();
      if (trName || trDesc) {
        cleanedTranslations[lang.code] = {
          ...(trName ? { name: trName } : {}),
          ...(trDesc ? { description: trDesc } : {}),
        };
      }
    }

    const payload = {
      name: trimmedName,
      priceCents,
      description: description.trim() || null,
      allergens: allergenList,
      labels,
      nutrition: buildNutrition(nutrition),
      translations: cleanedTranslations,
    };

    setSubmitting(true);
    try {
      let itemId: string;
      if (item) {
        const patch: Record<string, unknown> = { ...payload };
        // Explicit removal only when no replacement is staged.
        if (imageRemoved && !stagedDataUrl) patch.imageUrl = null;
        const updated = await api.patch<Item>(`/v1/manage/menu/items/${item.id}`, patch, {
          tenantSlug: slug,
        });
        itemId = updated.id;
      } else {
        const created = await api.post<Item>(
          '/v1/manage/menu/items',
          {
            ...payload,
            categoryId: target!.categoryId,
            available: true,
            position: nextPosition,
          },
          { tenantSlug: slug },
        );
        itemId = created.id;
      }

      if (stagedDataUrl) {
        try {
          await api.post(
            `/v1/uploads/menu-item/${itemId}`,
            { dataUrl: stagedDataUrl },
            { tenantSlug: slug },
          );
        } catch (err) {
          // The item itself saved fine; surface the image failure but don't
          // throw away the rest of the edit.
          toast.error(`Saved, but image upload failed: ${(err as Error).message}`);
        }
      }

      toast.success(item ? 'Item updated' : 'Item created');
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {item ? 'Edit item' : `Add item to ${target?.categoryName ?? ''}`}
          </DialogTitle>
          <DialogDescription>
            Only a name and price are required — everything else is optional.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-4"
        >
          {/* Photo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={cn(
                'group relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted text-xs',
                'flex items-center justify-center text-muted-foreground transition-colors hover:border-primary hover:bg-accent',
              )}
              aria-label={currentImage ? 'Replace image' : 'Add image'}
            >
              {currentImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentImage} alt={name} className="h-full w-full object-cover" />
              ) : (
                <span className="px-1 text-center leading-tight">+ Photo</span>
              )}
            </button>
            <div className="flex flex-col gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                {currentImage ? 'Replace photo' : 'Upload photo'}
              </Button>
              {currentImage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => {
                    setStagedDataUrl(null);
                    setImageRemoved(true);
                  }}
                >
                  Remove photo
                </Button>
              )}
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

          {/* Name + price */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
            <div className="space-y-2">
              <Label htmlFor="item-name">Name</Label>
              <Input
                id="item-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Margherita pizza"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-price">Price</Label>
              <Input
                id="item-price"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="item-desc">Description</Label>
            <textarea
              id="item-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Ingredients, preparation, anything worth knowing…"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Dietary labels */}
          <div className="space-y-2">
            <Label>Dietary labels</Label>
            <div className="flex flex-wrap gap-2">
              {MENU_LABELS.map((label) => {
                const meta = LABEL_META[label];
                const Icon = meta.icon;
                const active = labels.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleLabel(label)}
                    aria-pressed={active}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                      active
                        ? meta.tone
                        : 'border-border bg-background text-muted-foreground hover:bg-accent',
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden />
                    {LABEL_NAMES_EN[label]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Allergens */}
          <div className="space-y-2">
            <Label htmlFor="item-allergens">Contains (allergens)</Label>
            <Input
              id="item-allergens"
              value={allergens}
              onChange={(e) => setAllergens(e.target.value)}
              placeholder="Comma separated, e.g. nuts, dairy, shellfish"
            />
          </div>

          {/* Nutrition */}
          <Collapsible open={nutritionOpen} onOpenChange={setNutritionOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                <span>Nutrition facts (optional)</span>
                <ChevronDown
                  className={cn('size-4 transition-transform', nutritionOpen && 'rotate-180')}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <NutritionField
                  label="Calories (kcal)"
                  value={nutrition.caloriesKcal}
                  onChange={(v) => setNutrition((n) => ({ ...n, caloriesKcal: v }))}
                />
                <NutritionField
                  label="Protein (g)"
                  value={nutrition.proteinG}
                  onChange={(v) => setNutrition((n) => ({ ...n, proteinG: v }))}
                />
                <NutritionField
                  label="Carbs (g)"
                  value={nutrition.carbsG}
                  onChange={(v) => setNutrition((n) => ({ ...n, carbsG: v }))}
                />
                <NutritionField
                  label="Fat (g)"
                  value={nutrition.fatG}
                  onChange={(v) => setNutrition((n) => ({ ...n, fatG: v }))}
                />
                <NutritionField
                  label="Sugar (g)"
                  value={nutrition.sugarG}
                  onChange={(v) => setNutrition((n) => ({ ...n, sugarG: v }))}
                />
                <NutritionField
                  label="Sodium (mg)"
                  value={nutrition.sodiumMg}
                  onChange={(v) => setNutrition((n) => ({ ...n, sodiumMg: v }))}
                />
                <div className="col-span-2 space-y-1 sm:col-span-3">
                  <Label htmlFor="nut-serving" className="text-xs text-muted-foreground">
                    Serving size
                  </Label>
                  <Input
                    id="nut-serving"
                    value={nutrition.servingSize}
                    onChange={(e) => setNutrition((n) => ({ ...n, servingSize: e.target.value }))}
                    placeholder="e.g. 250g · 1 plate"
                    maxLength={40}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Translations */}
          {languages.length > 0 && (
            <Collapsible open={translationsOpen} onOpenChange={setTranslationsOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
                >
                  <span className="flex items-center gap-2">
                    <Languages className="size-4" />
                    Translations
                    <span className="text-xs font-normal text-muted-foreground">
                      {languages.length} language{languages.length === 1 ? '' : 's'}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn('size-4 transition-transform', translationsOpen && 'rotate-180')}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-3">
                <p className="text-xs text-muted-foreground">
                  Base language ({baseLabel ?? 'default'}) is taken from the fields above. Fill in
                  or AI-translate the others.
                </p>
                {languages.map((lang) => (
                  <div key={lang.code} className="space-y-2 rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{lang.name}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        disabled={!item || !translateEnabled || translatingCode !== null}
                        title={
                          !item
                            ? 'Save the item first, then translate'
                            : !translateEnabled
                              ? 'Translation is not configured (GEMINI_API_KEY missing)'
                              : `AI-translate into ${lang.name}`
                        }
                        onClick={() => void translateOne(lang.code)}
                      >
                        {translatingCode === lang.code ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Sparkles className="size-3" />
                        )}
                        Translate
                      </Button>
                    </div>
                    <Input
                      value={translations[lang.code]?.name ?? ''}
                      onChange={(e) => setTranslationField(lang.code, 'name', e.target.value)}
                      placeholder={`Name in ${lang.name}`}
                      maxLength={120}
                    />
                    <textarea
                      value={translations[lang.code]?.description ?? ''}
                      onChange={(e) => setTranslationField(lang.code, 'description', e.target.value)}
                      rows={2}
                      maxLength={2000}
                      placeholder={`Description in ${lang.name}`}
                      className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : item ? 'Save changes' : 'Add item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NutritionField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
      />
    </div>
  );
}

// ── Item summary row ─────────────────────────────────────────────────────────

function ItemRow({
  item,
  isBusy,
  onEdit,
  onToggleAvailable,
  onDelete,
}: {
  item: Item;
  isBusy: boolean;
  onEdit: () => void;
  onToggleAvailable: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-md border border-border p-3 transition-colors sm:flex-row sm:items-center',
        !item.available && 'border-amber-200 bg-amber-50/40',
      )}
    >
      <button
        type="button"
        onClick={onEdit}
        className="flex flex-1 items-start gap-3 text-left"
        aria-label={`Edit ${item.name}`}
      >
        <span className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
              No photo
            </span>
          )}
        </span>
        <span className="flex flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className={cn('font-medium', !item.available && 'text-muted-foreground line-through')}>
              {item.name}
            </span>
            {!item.available && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                Out of stock
              </span>
            )}
          </span>
          {item.description && (
            <span className="line-clamp-1 text-xs text-muted-foreground">{item.description}</span>
          )}
          {item.labels.length > 0 && (
            <span className="flex flex-wrap items-center gap-1">
              {item.labels.map((l) => (
                <LabelIcon key={l} label={l} />
              ))}
            </span>
          )}
        </span>
      </button>

      <div className="flex items-center gap-2 sm:flex-col sm:items-end">
        <span className="font-mono text-sm tabular-nums">{(item.priceCents / 100).toFixed(2)}</span>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center">
                <Switch
                  checked={item.available}
                  onCheckedChange={onToggleAvailable}
                  disabled={isBusy}
                  aria-label="Item availability"
                />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              {item.available ? 'In stock — click to mark out' : 'Out of stock — click to restock'}
            </TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="sm" onClick={onEdit} className="text-xs">
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-xs">
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}
