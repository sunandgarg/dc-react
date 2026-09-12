import { PermGate } from "@/components/PermGate";
import { BlogStudioDialog } from "@/components/admin/BlogStudioDialog";
import { BlogAutoAgentPanel } from "@/components/admin/BlogAutoAgentPanel";
import { EntityResearchBlogPanel } from "@/components/admin/EntityResearchBlogPanel";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useAdminArticles, useSaveArticle, useDeleteArticle, type DbArticle } from "@/hooks/useArticlesData";
import { AdminFormSection } from "@/components/AdminFormSection";
import { RichTextEditor } from "@/components/RichTextEditor";
import { RichText } from "@/components/detail/RichText";
import { ArrayFieldEditor } from "@/components/ArrayFieldEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, Newspaper, Info, FileText, Settings, ExternalLink, HelpCircle, CheckSquare2, Square, Loader2, Eye, EyeOff, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { CSVTools } from "@/components/CSVTools";
import { useAuth } from "@/hooks/useAuth";
import { EntityMultiPicker } from "@/components/admin/EntityMultiPicker";
import { StudyMaterialQuickTagger } from "@/components/admin/StudyMaterialQuickTagger";
import { ArticleLinksEditor } from "@/components/admin/ArticleLinksEditor";
import { LinksSummary } from "@/components/admin/LinksSummary";
import { CollegeStudyTagger } from "@/components/admin/CollegeStudyTagger";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link2 } from "lucide-react";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { ArticleCoverGenerator } from "@/components/admin/ArticleCoverGenerator";
import { AuthorPicker } from "@/components/admin/AuthorPicker";
import { BulkEditToggle } from "@/components/admin/BulkEditToggle";
import { FeaturedRankPicker } from "@/components/admin/FeaturedRankPicker";
import { FeaturedRankPanel } from "@/components/admin/FeaturedRankPanel";
import { FaqInlineEditor } from "@/components/admin/FaqInlineEditor";
import { useQuery } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";
import { Link } from "react-router-dom";
import { useDraftState } from "@/hooks/useDraftState";
import { syncAutoSlug } from "@/lib/slugify";
import { DEFAULT_SITE_SCOPE, type SiteScope } from "@/lib/siteScope";
import { normalizeArticleSlug, validateArticleSave } from "@/lib/articleEditor";

const STATUSES = ["Draft", "Published"];
const VERTICALS = ["Engineering", "Medical", "Management", "Law", "Design", "Science", "General"];
const SARKARI_VERTICALS = ["Government Jobs", "Central Government", "State Government", "Railways", "Banking", "Defence", "Teaching", "Police", "PSU"];
const SARKARI_CATEGORIES = ["Latest Jobs", "Results", "Admit Card", "Answer Key", "Admissions", "Syllabus", "Scholarships"]
  .map((name) => ({ slug: name.toLowerCase().replace(/\s+/g, "-"), name }));

function useArticleCategories(enabled = true) {
  return useQuery({
    queryKey: ["article_categories"],
    staleTime: 5 * 60 * 1000,
    enabled,
    queryFn: async () => {
      const { data } = await (backendClient as any)
        .from("article_categories")
        .select("slug, name, display_order, is_active")
        .eq("is_active", true)
        .order("display_order");
      return (data || []) as { slug: string; name: string }[];
    },
  });
}

const emptyArticle: Partial<DbArticle> = {
  slug: "", title: "", description: "", content: "", vertical: "", category: "", author: "",
  featured_image: "", views: 0, tags: [], meta_title: "", meta_description: "", meta_keywords: "",
  is_active: true, status: "Draft",
};

const normalizeAdminArticleSearch = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

interface AdminArticlesProps {
  siteScope?: SiteScope;
  studioMode?: boolean;
}

export default function AdminArticles({ siteScope = DEFAULT_SITE_SCOPE, studioMode = false }: AdminArticlesProps) {
  const isSarkari = siteScope === "sarkari";
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [customPageSize, setCustomPageSize] = useState(200);
  const { data: articlePage, isLoading, refetch: refetchArticles } = useAdminArticles(deferredSearch, page, pageSize, siteScope);
  const { data: articleCategories = [] } = useArticleCategories(!isSarkari);
  const CATEGORIES = isSarkari ? SARKARI_CATEGORIES : articleCategories;
  const verticalOptions = isSarkari ? SARKARI_VERTICALS : VERTICALS;
  const saveArticle = useSaveArticle(siteScope);
  const deleteArticle = useDeleteArticle(siteScope);
  const [editing, setEditing] = useDraftState<Partial<DbArticle> | null>(`admin.articles.editing.v2.${siteScope}`, null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkVertical, setBulkVertical] = useState("");

  const normalizedSearch = normalizeAdminArticleSearch(deferredSearch);
  const filtered = useMemo(() => {
    return articlePage?.rows ?? [];
  }, [articlePage]);
  const totalArticles = articlePage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalArticles / pageSize));
  const standardPageSizes = [10, 20, 30, 40, 50, 100];

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [normalizedSearch, pageSize, siteScope]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const { can, isAdmin } = useAuth();
  const canPublish = isAdmin || can("articles", "publish");
  const canCreate = isAdmin || can("articles", "create");
  const canEdit = isAdmin || can("articles", "edit");

  const bulkUpdate = async (updates: Record<string, unknown>, label: string, ids = Array.from(selectedIds)) => {
    if (!ids.length) return toast.error("Select at least one article");
    if ("status" in updates && updates.status === "Published" && !canPublish) {
      return toast.error("You do not have permission to publish articles.");
    }
    setBulkBusy(true);
    const { error } = await (backendClient as any).from("articles").update(updates).in("id", ids).eq("site_scope", siteScope);
    setBulkBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${label}: ${ids.length} article(s)`);
    setSelectedIds(new Set());
    void refetchArticles();
  };

  const bulkApplyFields = async () => {
    const updates: Record<string, unknown> = {};
    if (bulkStatus) {
      if (bulkStatus === "Published" && !canPublish) return toast.error("You do not have permission to publish articles.");
      updates.status = bulkStatus;
      if (bulkStatus === "Published") updates.is_active = true;
    }
    if (bulkCategory) updates.category = bulkCategory === "__clear__" ? "" : bulkCategory;
    if (bulkVertical) updates.vertical = bulkVertical === "__clear__" ? "" : bulkVertical;
    if (!Object.keys(updates).length) return toast.error("Choose at least one bulk field to update");
    await bulkUpdate(updates, "Bulk updated");
    setBulkStatus("");
    setBulkCategory("");
    setBulkVertical("");
  };

  const bulkDelete = async (ids = Array.from(selectedIds)) => {
    if (!ids.length || !confirm(`Delete ${ids.length} selected article(s)? This cannot be undone.`)) return;
    setBulkBusy(true);
    const { error } = await (backendClient as any).from("articles").delete().in("id", ids).eq("site_scope", siteScope);
    setBulkBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Deleted ${ids.length} article(s)`);
    setSelectedIds(new Set());
    void refetchArticles();
  };

  const handleSave = () => {
    if (!editing) return;
    const normalizedSlug = normalizeArticleSlug(editing.slug);
    const validationError = validateArticleSave({ ...editing, slug: normalizedSlug }, canPublish);
    if (validationError) { toast.error(validationError); return; }
    const rawRank = (editing as any).featured_rank ?? null;
    const desiredRank = rawRank == null ? null : Number(rawRank);
    if (desiredRank != null && (!Number.isInteger(desiredRank) || desiredRank < 1 || desiredRank > 4)) {
      toast.error("Featured slot must be empty or between #1 and #4.");
      return;
    }
    const { featured_rank: _omit, ...payload } = { ...editing, slug: normalizedSlug } as any;
    if (isSarkari) {
      payload.site_scope = "sarkari";
      payload.vertical = payload.vertical || "Government Jobs";
      payload.category = payload.category || "Latest Jobs";
      payload.author = payload.author || "Sarkari DekhoCampus Desk";
    }
    saveArticle.mutate(payload, {
      onSuccess: async (result) => {
        const id = result.pendingReview ? null : (result.article?.id || (editing as any).id);
        if (id && isAdmin) {
          const { error } = await (backendClient as any).from("articles").update({ featured_rank: desiredRank }).eq("id", id).eq("site_scope", siteScope);
          if (error) toast.error(`Featured: ${error.message}`);
        }
        setEditing(null);
      },
    });
  };

  const saveDraftToEnableTagging = () => {
    if (!editing) return;
    const normalizedSlug = normalizeArticleSlug(editing.slug);
    const validationError = validateArticleSave({ ...editing, slug: normalizedSlug, status: "Draft" }, canPublish);
    if (validationError) { toast.error(validationError); return; }

    const { featured_rank: _omit, ...payload } = { ...editing, slug: normalizedSlug, status: "Draft", site_scope: siteScope } as any;
    saveArticle.mutate(payload, {
      onSuccess: (result) => {
        if (result.pendingReview || !result.article?.id) {
          toast.success("Draft submitted for admin review. Tagging becomes available after approval.");
          setEditing(null);
          return;
        }
        setEditing((current) => current ? { ...current, ...result.article, slug: normalizedSlug, status: "Draft" } : current);
      },
    });
  };

  const update = (field: string, value: any) => setEditing((prev) => {
    if (!prev) return prev;
    const next = { ...prev, [field]: value };
    if (field === "title" && !(prev as any).id) next.slug = syncAutoSlug(prev.slug, prev.title, value);
    return next;
  });

  return (
    <AdminLayout title={isSarkari ? (studioMode ? "Sarkari Job AI Studio" : "Sarkari Articles") : "Articles Manager"}>
      {isSarkari && (
        <div className="mb-4 rounded-2xl border border-orange-200 bg-orange-50/80 p-4 text-sm text-orange-950">
          <p className="font-bold">Sarkari workspace</p>
          <p className="mt-1 text-xs text-orange-800">Only <code>site_scope=sarkari</code> content is listed, imported, edited and deleted here. DekhoCampus articles remain separate.</p>
        </div>
      )}
      {isAdmin && <div className="mb-3 flex flex-wrap gap-2"><BlogStudioDialog siteScope={siteScope} initiallyOpen={studioMode} onSaved={() => { void refetchArticles(); }} /></div>}
      {isAdmin && !isSarkari && <BlogAutoAgentPanel onArticlesCreated={() => { void refetchArticles(); }} />}
      {isAdmin && !isSarkari && <EntityResearchBlogPanel onArticlesCreated={() => { void refetchArticles(); }} />}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search articles..." className="pl-10 rounded-xl h-10" />
        </div>
        {canCreate && <Button onClick={() => setEditing({ ...emptyArticle, site_scope: siteScope, vertical: isSarkari ? "Government Jobs" : "", category: isSarkari ? "Latest Jobs" : "", author: isSarkari ? "Sarkari DekhoCampus Desk" : "", status: canPublish ? "Published" : "Draft" })} className="rounded-xl gap-2">
          <Plus className="w-4 h-4" /> Add {isSarkari ? "Sarkari Article" : "Article"}
        </Button>}
        {isAdmin && <BulkEditToggle
          table="articles"
          searchKeys={["title","slug","author","category"]}
          columns={[
            { key: "title", label: "Title", width: 240 },
            { key: "slug", label: "Slug", width: 180 },
            { key: "category", label: "Category", width: 120 },
            { key: "author", label: "Author", width: 120 },
            { key: "status", label: "Status", type: "select", options: ["Draft","Published"], width: 110 },
            { key: "is_active", label: "Active", type: "boolean", width: 80 },
            { key: "views", label: "Views", type: "number", width: 80 },
          ]}
          scope={{ column: "site_scope", value: siteScope }}
        />}
      </div>

      {isAdmin && <div className="mb-3 space-y-3 rounded-2xl border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setSelectedIds(selectedIds.size === filtered.length ? new Set() : new Set(filtered.map((article) => article.id)))} className="gap-2">
            {selectedIds.size === filtered.length && filtered.length ? <CheckSquare2 className="h-4 w-4" /> : <Square className="h-4 w-4" />} {selectedIds.size === filtered.length && filtered.length ? "Clear page" : `Select this page (${filtered.length})`}
          </Button>
          <span className="text-xs font-medium text-muted-foreground">{selectedIds.size} selected</span>
          {bulkBusy && <span className="inline-flex items-center gap-1 text-xs text-primary"><Loader2 className="h-3 w-3 animate-spin" /> Updating...</span>}
          <Button size="sm" disabled={bulkBusy || !selectedIds.size || !canPublish} onClick={() => bulkUpdate({ status: "Published", is_active: true }, "Published")} className="gap-1">
            <Eye className="h-3.5 w-3.5" /> Publish
          </Button>
          <Button size="sm" variant="outline" disabled={bulkBusy || !selectedIds.size} onClick={() => bulkUpdate({ status: "Draft" }, "Moved to Draft")} className="gap-1">
            <RotateCcw className="h-3.5 w-3.5" /> Move to Draft
          </Button>
          <Button size="sm" variant="outline" disabled={bulkBusy || !selectedIds.size} onClick={() => bulkUpdate({ is_active: false, status: "Draft" }, "Unpublished")} className="gap-1">
            <EyeOff className="h-3.5 w-3.5" /> Unpublish
          </Button>
          <Button size="sm" variant="outline" disabled={bulkBusy || !selectedIds.size} onClick={() => bulkUpdate({ is_active: true }, "Activated")}>Activate</Button>
          <Button size="sm" variant="outline" disabled={bulkBusy || !selectedIds.size} onClick={() => bulkUpdate({ is_active: false }, "Deactivated")}>Deactivate</Button>
          <Button size="sm" variant="destructive" disabled={bulkBusy || !selectedIds.size} onClick={() => bulkDelete()}>Delete</Button>
        </div>

        <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
          <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-3 text-sm">
            <option value="">Bulk status - keep unchanged</option>
            {STATUSES.map((status) => (
              <option key={status} value={status} disabled={status === "Published" && !canPublish}>{status}</option>
            ))}
          </select>
          <select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-3 text-sm">
            <option value="">Bulk category - keep unchanged</option>
            <option value="__clear__">Clear category</option>
            {CATEGORIES.map((category) => <option key={category.slug} value={category.name}>{category.name}</option>)}
          </select>
          <select value={bulkVertical} onChange={(e) => setBulkVertical(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-3 text-sm">
            <option value="">Bulk vertical - keep unchanged</option>
            <option value="__clear__">Clear vertical</option>
            {verticalOptions.map((vertical) => <option key={vertical} value={vertical}>{vertical}</option>)}
          </select>
          <Button size="sm" disabled={bulkBusy || !selectedIds.size} onClick={bulkApplyFields} className="h-9 rounded-lg">
            Apply bulk edit
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Publish makes articles visible and active. Unpublish moves them to Draft and hides them from public article/news listings.
        </p>
      </div>}

      {isAdmin && <div className="mb-4">
        <CSVTools
          table="articles"
          filename={isSarkari ? "sarkari-articles.csv" : "dekhocampus-articles.csv"}
          columns="*"
          typeHints={{ tags: "array", views: "number", is_active: "boolean" }}
          scope={{ column: "site_scope", value: siteScope }}
          onImported={() => { void refetchArticles(); }}
        />
      </div>}

      {isAdmin && <FeaturedRankPanel table="articles" siteScope={siteScope} detailPath={(slug) => isSarkari ? `https://sarkari.dekhocampus.com/news/${slug}` : `/news/${slug}`} />}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <div key={a.id} className={`bg-card rounded-xl border p-4 flex items-center gap-4 ${selectedIds.has(a.id) ? "border-primary bg-primary/5" : "border-border"}`}>
              {isAdmin && <button type="button" onClick={() => setSelectedIds((current) => {
                const next = new Set(current);
                if (next.has(a.id)) next.delete(a.id);
                else next.add(a.id);
                return next;
              })} aria-label={`Select ${a.title}`}>
                {selectedIds.has(a.id) ? <CheckSquare2 className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5 text-muted-foreground" />}
              </button>}
              {a.featured_image && <img src={a.featured_image} alt={a.title} className="w-16 h-10 rounded-lg object-cover hidden sm:block" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground text-sm">{a.title}</span>
                  {a.category && <Badge variant="outline" className="text-[10px]">{a.category}</Badge>}
                  <Badge variant={a.status === "Published" ? "default" : "secondary"} className="text-[10px]">{a.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{a.author} • {a.views} views • {new Date(a.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-1">
                <a href={isSarkari ? `https://sarkari.dekhocampus.com/news/${a.slug}` : `/news/${a.slug}`} target="_blank" rel="noopener noreferrer" title="Open public page" className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted text-muted-foreground hover:text-primary"><ExternalLink className="w-3.5 h-3.5" /></a>
                {canEdit && <Button variant="ghost" size="icon" onClick={() => setEditing({ ...a })} className="w-8 h-8"><Pencil className="w-3.5 h-3.5" /></Button>}
                <PermGate module="articles" action="delete"><Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete?")) deleteArticle.mutate(a.id); }} className="w-8 h-8 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button></PermGate>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground">No articles found</div>}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {totalArticles ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalArticles)} of ${totalArticles}` : "0 articles"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="article-page-size">Rows</label>
          <select
            id="article-page-size"
            value={standardPageSizes.includes(pageSize) ? String(pageSize) : "custom"}
            onChange={(event) => {
              if (event.target.value === "custom") setPageSize(Math.min(500, Math.max(1, customPageSize)));
              else setPageSize(Number(event.target.value));
            }}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            {standardPageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
            <option value="custom">Custom</option>
          </select>
          {!standardPageSizes.includes(pageSize) && <Input
            aria-label="Custom rows per page"
            type="number"
            min={1}
            max={500}
            value={customPageSize}
            onChange={(event) => setCustomPageSize(Number(event.target.value || 1))}
            onBlur={() => setPageSize(Math.min(500, Math.max(1, customPageSize)))}
            className="h-9 w-24"
          />}
          <Button size="sm" variant="outline" disabled={page <= 1 || isLoading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
          <span className="min-w-20 text-center text-xs font-medium">Page {page} of {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages || isLoading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</Button>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="flex h-[94dvh] max-h-[94dvh] w-[min(96vw,1200px)] max-w-[1200px] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-24 sm:px-6">
            <DialogTitle className="flex items-center gap-2"><Newspaper className="w-5 h-5" /> {editing?.id ? "Edit" : "Add"} Article</DialogTitle>
          </DialogHeader>
          {editing && (
            <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
            <div className="mx-auto max-w-6xl space-y-4">
              {editing.id && !isSarkari && <LinksSummary articleId={editing.id as string} tags={editing.tags || []} />}
              {/* ── Basic Info ── */}
              <AdminFormSection title="Basic Information" icon={<Info className="w-4 h-4 text-primary" />}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Status</label>
                    <select value={editing.status || "Draft"} onChange={(e) => update("status", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm h-9">
                      {STATUSES.map((s) => (
                        <option key={s} value={s} disabled={s === "Published" && !canPublish}>
                          {s}{s === "Published" && !canPublish ? " (no permission)" : ""}
                        </option>
                      ))}
                    </select>
                    {!canPublish && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">You can save drafts. A manager can publish.</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Category</label>
                    <select value={editing.category || ""} onChange={(e) => update("category", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm h-9">
                      <option value="">Select</option>
                      {CATEGORIES.map((c) => <option key={c.slug} value={c.name}>{c.name}</option>)}
                    </select>
                    {!isSarkari && <Link to="/admin/article-categories" className="text-[10px] text-primary hover:underline">+ Manage categories</Link>}
                  </div>
                  <div><label className="text-xs font-medium text-muted-foreground">Author (legacy text)</label><Input value={editing.author || ""} onChange={(e) => update("author", e.target.value)} className="rounded-lg h-9 text-sm" /></div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">{isSarkari ? "Department / Area" : "Vertical"}</label>
                    <select value={editing.vertical || ""} onChange={(e) => update("vertical", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm h-9">
                      <option value="">Select</option>
                      {verticalOptions.map((vertical) => <option key={vertical} value={vertical}>{vertical}</option>)}
                    </select>
                  </div>
                  <div><AuthorPicker value={(editing as any).author_id} onChange={(v) => update("author_id" as any, v)} label="Author profile (byline)" /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Title *</label><Input value={editing.title || ""} onChange={(e) => update("title", e.target.value)} className="rounded-lg h-9 text-sm" /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Slug *</label><Input value={editing.slug || ""} onChange={(e) => update("slug", e.target.value)} placeholder="my-article-slug" className="rounded-lg h-9 text-sm" /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Views</label><Input type="number" value={editing.views ?? 0} onChange={(e) => update("views", parseInt(e.target.value) || 0)} className="rounded-lg h-9 text-sm" /></div>
                  <div className="sm:col-span-2 lg:col-span-3"><FeaturedRankPicker value={(editing as any).featured_rank} onChange={(v) => update("featured_rank" as any, v)} label={isSarkari ? "Pin to Sarkari homepage top" : "Pin to News page top"} maxSlots={4} slotLabel={(r) => `#${r}${r === 1 ? " (Big Hero)" : ` (Small ${r - 1})`}`} helpText={isSarkari ? "Controls the four highlighted Sarkari update slots. Rankings are isolated from DekhoCampus news." : "#1 = big hero card on /news. #2-4 = the three small cards beside it. Picking a slot pushes existing pinned items down; anything beyond #4 unpins automatically."} /></div>
                </div>
                <RichTextEditor label="Description *" value={editing.description || ""} onChange={(v) => update("description", v)} rows={3} />
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={editing.is_active !== false} onChange={(e) => update("is_active", e.target.checked)} className="rounded" />
                  <label className="text-sm text-foreground">Active</label>
                </div>
              </AdminFormSection>

              <AdminFormSection title="Featured image and article cover" icon={<Eye className="w-4 h-4 text-primary" />}>
                {editing.featured_image && (
                  <div className="flex aspect-video max-h-[320px] w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/20">
                    <img src={editing.featured_image} alt="Article cover preview" className="h-full w-full object-contain" />
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <ImageUploadField label="Featured image" value={editing.featured_image || ""} onChange={(v) => update("featured_image", v)} preset="article" folder="article-images" />
                  <ArticleCoverGenerator title={editing.title || ""} slug={editing.slug} siteScope={siteScope} onGenerated={(url) => update("featured_image", url)} />
                </div>
              </AdminFormSection>

              {/* ── Content ── */}
              <AdminFormSection title="Content" icon={<FileText className="w-4 h-4 text-primary" />}>
                <RichTextEditor label="Article Content" value={editing.content || ""} onChange={(v) => update("content", v)} rows={12} autoGrow />
              </AdminFormSection>

              {/* ── Links (multi-category) ── */}
              <AdminFormSection title={isSarkari ? "Search and discovery tags" : "Links - tag this article to colleges, courses, exams, news, careers, scholarships & study material"} icon={<Link2 className="w-4 h-4 text-primary" />}>
                <ArrayFieldEditor label="Free-form Tags" values={editing.tags || []} onChange={(v) => update("tags", v)} placeholder="Add tag..." />
                {!isSarkari && (editing.id ? (
                  <Tabs defaultValue="entities" className="mt-4">
                    <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-muted/40 p-1 rounded-xl">
                      <TabsTrigger value="entities" className="rounded-lg text-xs">Colleges / Courses / Exams / News / Careers / Scholarships</TabsTrigger>
                      <TabsTrigger value="study" className="rounded-lg text-xs">Study Material (School)</TabsTrigger>
                      <TabsTrigger value="college-study" className="rounded-lg text-xs">College Study Material</TabsTrigger>
                      <TabsTrigger value="saved" className="rounded-lg text-xs">All Saved Links</TabsTrigger>
                    </TabsList>
                    <TabsContent value="entities" className="mt-3">
                      <EntityMultiPicker articleId={editing.id} />
                    </TabsContent>
                    <TabsContent value="study" className="mt-3">
                      <StudyMaterialQuickTagger tags={editing.tags || []} onChange={(v) => update("tags", v)} articleId={editing.id as string} />
                    </TabsContent>
                    <TabsContent value="college-study" className="mt-3">
                      <CollegeStudyTagger articleId={editing.id as string} onDone={() => setEditing(null)} />
                    </TabsContent>
                    <TabsContent value="saved" className="mt-3">
                      <ArticleLinksEditor ownerId={editing.id as string} label="All saved links for this article (add/remove any entity by slug)" />
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="mt-3 flex flex-col gap-2 bg-muted/40 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Save the article to start tagging colleges, courses, exams, news, careers, scholarships and study material.</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="self-start rounded-lg"
                      disabled={!editing.slug || !editing.title || saveArticle.isPending}
                      onClick={saveDraftToEnableTagging}
                    >
                      {saveArticle.isPending ? "Saving…" : canPublish ? "Save draft to enable tagging" : "Submit draft for review"}
                    </Button>
                    <p className="text-[11px] text-muted-foreground">(Requires Title + Slug above)</p>
                  </div>
                ))}
              </AdminFormSection>

              {/* ── FAQs ── */}
              <AdminFormSection title="FAQs (shown on article page)" icon={<HelpCircle className="w-4 h-4 text-primary" />} defaultOpen={false}>
                <FaqInlineEditor page={isSarkari ? "sarkari_articles" : "articles"} itemSlug={editing.slug || ""} itemName={editing.title} persisted={Boolean(editing.id)} />
              </AdminFormSection>

              {/* ── SEO ── */}
              <AdminFormSection title="SEO" icon={<Search className="w-4 h-4 text-primary" />} defaultOpen={false}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="text-xs font-medium text-muted-foreground">Meta Title</label><Input value={editing.meta_title || ""} onChange={(e) => update("meta_title", e.target.value)} className="rounded-lg h-9 text-sm" /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Meta Keywords</label><Input value={editing.meta_keywords || ""} onChange={(e) => update("meta_keywords", e.target.value)} placeholder="Comma separated" className="rounded-lg h-9 text-sm" /></div>
                </div>
                <div><label className="text-xs font-medium text-muted-foreground">Meta Description</label>
                  <textarea value={editing.meta_description || ""} onChange={(e) => update("meta_description", e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm resize-none" />
                </div>
              </AdminFormSection>

              <AdminFormSection title="Live article preview" icon={<Eye className="w-4 h-4 text-primary" />}>
                <article className="mx-auto w-full max-w-4xl overflow-hidden rounded-lg border border-border bg-background">
                  {editing.featured_image && (
                    <div className="aspect-video w-full border-b border-border bg-muted/20">
                      <img src={editing.featured_image} alt="" className="h-full w-full object-contain" />
                    </div>
                  )}
                  <div className="space-y-3 p-4 sm:p-6">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {editing.category && <Badge variant="secondary">{editing.category}</Badge>}
                      <span>{editing.author || "DekhoCampus Editorial"}</span>
                    </div>
                    <h1 className="text-2xl font-extrabold leading-tight text-foreground sm:text-3xl">{editing.title || "Untitled article"}</h1>
                    {editing.description ? <RichText html={editing.description} className="text-muted-foreground" /> : <p className="text-sm text-muted-foreground">Article description will appear here.</p>}
                    <div className="border-t border-border pt-2">
                      {editing.content ? <RichText html={editing.content} /> : <p className="py-8 text-center text-sm text-muted-foreground">Article content will appear here.</p>}
                    </div>
                  </div>
                </article>
              </AdminFormSection>
            </div>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-background px-5 py-3 sm:px-6">
              <p className="hidden text-xs text-muted-foreground sm:block">{editing.status || "Draft"}</p>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" onClick={() => setEditing(null)} className="rounded-lg">Cancel</Button>
                <Button onClick={handleSave} disabled={saveArticle.isPending} className="rounded-lg">
                  {saveArticle.isPending ? "Saving..." : canPublish ? "Save Article" : "Save as draft"}
                </Button>
              </div>
            </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
