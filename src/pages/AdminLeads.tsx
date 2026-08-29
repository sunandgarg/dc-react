import { useState, useMemo, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Download, Upload, Users, TrendingUp, Phone, Mail, Calendar as CalendarIcon, MapPin, Star, Flame, ChevronRight, ChevronDown, ChevronLeft, ChevronsLeft, ChevronsRight, Layers, FileText, MessageCircle, ArrowUpDown, ArrowUp, ArrowDown, Filter, ShieldCheck, Zap, Trophy, GraduationCap, Copy, ExternalLink, GitMerge, CheckSquare, Square, X as XIcon, Tag, Trash2, Maximize2, Minimize2 } from "lucide-react";
import { differenceInCalendarDays, format, subDays, isAfter } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useLeadMask } from "@/hooks/useLeadMask";
import { SearchableSelect } from "@/components/SearchableSelect";
import { LeadsColumnCustomizer, type LeadColumnDef } from "@/components/LeadsColumnCustomizer";
import { toast } from "sonner";

import { CSVTools } from "@/components/CSVTools";
import { LeadIntentDrawer } from "@/components/LeadIntentDrawer";
import { LeadDetailDrawer, LEAD_STATUSES, statusBadge } from "@/components/leads/LeadDetailDrawer";
import { MergeLeadsDialog } from "@/components/leads/MergeLeadsDialog";
import { LeadFilterPresets } from "@/components/leads/LeadFilterPresets";
import { Sparkles } from "lucide-react";
import { leadConsentLabel } from "@/lib/leadConsent";
import { groupLeadsByIdentity, type LeadIdentityGroup } from "@/lib/leadIdentity";

/** Compact labeled chip wrapper - CRM-style floating-label field. */
function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative bg-card border border-border rounded-lg px-3 pt-3 pb-1 hover:border-primary/40 focus-within:border-primary transition-colors">
      <span className="absolute -top-2 left-2 bg-card px-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      {children}
    </div>
  );
}

type LeadGroup = LeadIdentityGroup<any>;

/**
 * AdminLeads - Interactive dashboard for managing inbound leads with:
 * - Top stat cards (total, today, this week, conversion-ready)
 * - Source/city filters and search
 * - CSV export of the filtered set
 * - Color-coded source badges and quick contact actions
 */
export default function AdminLeads() {
  const queryClient = useQueryClient();
  const { mask, maskPhone, maskEmail, maskName } = useLeadMask();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [collegeFilter, setCollegeFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<string>("all"); // all | regular | online
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [deviceFilter, setDeviceFilter] = useState<string>("all"); // all | mobile | tablet | desktop
  const [rangeFilter, setRangeFilter] = useState<string>("all"); // all|1d|2d|7d|15d|30d|custom
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState<number>(1);
  const [intentLead, setIntentLead] = useState<{ id: string; name?: string | null; phone?: string | null } | null>(null);
  const [customSize, setCustomSize] = useState<string>("");

  // New: row selection (bulk actions), detail drawer, merge dialog, status filter, import panel, owner filter
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailLead, setDetailLead] = useState<any | null>(null);
  const [mergeRows, setMergeRows] = useState<any[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showImport, setShowImport] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isFullscreen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setIsFullscreen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [isFullscreen]);

  const deleteLeads = async (ids: string[], label: string) => {
    const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
    if (!uniqueIds.length || !confirm(`Delete ${label} (${uniqueIds.length} submission${uniqueIds.length === 1 ? "" : "s"})? This cannot be undone.`)) return;
    setDeleteBusy(true);
    let deleteError: any = null;
    for (let index = 0; index < uniqueIds.length; index += 200) {
      const { error } = await (backendClient as any).from("leads").delete().in("id", uniqueIds.slice(index, index + 200));
      if (error) { deleteError = error; break; }
    }
    setDeleteBusy(false);
    if (deleteError) return toast.error(deleteError.message);
    toast.success(`Deleted ${uniqueIds.length} lead submission${uniqueIds.length === 1 ? "" : "s"}`);
    setSelectedIds(new Set());
    await queryClient.invalidateQueries({ queryKey: ["admin-leads"] });
  };


  // Default view is intentionally minimal (8 essentials). Admins can re-enable extras
  // via the column customizer; preferences persist per-admin in localStorage.
  const ALL_COLUMNS: LeadColumnDef[] = [
    { key: "instances", label: "History", defaultVisible: true },
    { key: "name", label: "Name", defaultVisible: true },
    { key: "phone", label: "Mobile", defaultVisible: true },
    { key: "email", label: "Email", defaultVisible: true },
    { key: "state", label: "State", defaultVisible: true },
    { key: "city", label: "City", defaultVisible: true },
    { key: "course", label: "Course / Interest", defaultVisible: true },
    { key: "source", label: "Source", defaultVisible: true },
    { key: "source_category", label: "Category", defaultVisible: false },
    { key: "device_type", label: "Device", defaultVisible: false },
    { key: "program_mode", label: "Mode", defaultVisible: false },
    { key: "otp_verified", label: "OTP Verified", defaultVisible: false },
    { key: "consent", label: "Consent", defaultVisible: true },
    { key: "status", label: "Status", defaultVisible: true },
    { key: "campus", label: "Campus", defaultVisible: false },
    { key: "exam", label: "Exam", defaultVisible: false },
    { key: "cta", label: "CTA Source", defaultVisible: false },
    { key: "landing_page", label: "Landing Page", defaultVisible: false },
    { key: "page_url", label: "Page", defaultVisible: false },
    { key: "initial_query", label: "Last Query", defaultVisible: false },
    { key: "first_at", label: "First Instance Date", defaultVisible: false },
    { key: "created_at", label: "Last Date", defaultVisible: true },
    { key: "registered_at", label: "Date of Registration", defaultVisible: false },
    { key: "actions", label: "Actions", defaultVisible: true },
  ];
  const STORAGE_KEY = "admin_leads_columns_v4"; // bump key so the Consent default column appears once
  const defaultOrder = ALL_COLUMNS.map((c) => c.key);
  const defaultVisible = Object.fromEntries(ALL_COLUMNS.map((c) => [c.key, c.defaultVisible !== false])) as Record<string, boolean>;
  const [columnOrder, setColumnOrder] = useState<string[]>(defaultOrder);
  const [columnVisible, setColumnVisible] = useState<Record<string, boolean>>(defaultVisible);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // merge with defaults so new columns appear automatically
        const order = Array.isArray(parsed.order)
          ? [...parsed.order.filter((k: string) => defaultOrder.includes(k)), ...defaultOrder.filter((k) => !parsed.order.includes(k))]
          : defaultOrder;
        const vis = { ...defaultVisible, ...(parsed.visible || {}) };
        setColumnOrder(order);
        setColumnVisible(vis);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistColumns = (order: string[], visible: Record<string, boolean>) => {
    setColumnOrder(order);
    setColumnVisible(visible);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ order, visible })); } catch { /* ignore */ }
  };
  const resetColumns = () => {
    setColumnOrder(defaultOrder);
    setColumnVisible(defaultVisible);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };


  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["admin-leads"],
    queryFn: async () => {
      const rows: any[] = [];
      const batchSize = 1000;
      for (let from = 0; ; from += batchSize) {
        const { data, error } = await backendClient.from("leads").select("*").order("created_at", { ascending: false }).range(from, from + batchSize - 1);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < batchSize) break;
      }
      return rows;
    },
  });

  const sources = useMemo(() => Array.from(new Set(leads.map(l => l.source).filter(Boolean))), [leads]);
  const cities = useMemo(() => Array.from(new Set(leads.map(l => l.city).filter(Boolean))), [leads]);
  const states = useMemo(() => Array.from(new Set(leads.map((l: any) => l.state).filter(Boolean))) as string[], [leads]);
  const collegeSlugs = useMemo(() => Array.from(new Set(leads.map((l: any) => l.interested_college_slug).filter(Boolean))) as string[], [leads]);
  const categories = useMemo(() => Array.from(new Set(leads.map((l: any) => l.source_category).filter(Boolean))) as string[], [leads]);

  const allLeadGroups = useMemo<LeadGroup[]>(() => groupLeadsByIdentity(leads as any[]), [leads]);
  const identityKeyById = useMemo(() => new Map(allLeadGroups.flatMap((group) => group.instances.map((lead) => [lead.id, group.key]))), [allLeadGroups]);
  const dupKey = useCallback((lead: any) => identityKeyById.get(lead.id) || `id:${lead.id}`, [identityKeyById]);
  const dupCounts = useMemo(() => new Map(allLeadGroups.map((group) => [group.key, group.instances.length])), [allLeadGroups]);
  const [dupOnly, setDupOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const dupTotal = useMemo(() => allLeadGroups.filter((group) => group.instances.length > 1).length, [allLeadGroups]);

  // Tier color by repeat count (2 → 10+)
  const dupTier = (n: number) => {
    if (n <= 1) return null;
    if (n === 2) return { ring: "ring-yellow-300", bg: "bg-yellow-50", chip: "bg-yellow-100 text-yellow-800 border-yellow-300", label: "2× Duplicate" };
    if (n === 3) return { ring: "ring-amber-300", bg: "bg-amber-50", chip: "bg-amber-100 text-amber-800 border-amber-300", label: "3× Repeat" };
    if (n === 4) return { ring: "ring-orange-300", bg: "bg-orange-50", chip: "bg-orange-100 text-orange-800 border-orange-300", label: "4× Repeat" };
    if (n === 5) return { ring: "ring-rose-300", bg: "bg-rose-50", chip: "bg-rose-100 text-rose-800 border-rose-300", label: "5× Repeat" };
    if (n <= 7) return { ring: "ring-pink-400", bg: "bg-pink-50", chip: "bg-pink-100 text-pink-800 border-pink-400", label: `${n}× Hot` };
    if (n <= 9) return { ring: "ring-fuchsia-400", bg: "bg-fuchsia-50", chip: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-400", label: `${n}× Very Hot` };
    return { ring: "ring-purple-500", bg: "bg-purple-50", chip: "bg-purple-100 text-purple-800 border-purple-500", label: `${n}× 🔥 Top Lead` };
  };

  const filtered = useMemo(() => {
    const now = new Date();
    return leads.filter((l: any) => {
      if (search) {
        const q = search.toLowerCase();
        const hit = l.name?.toLowerCase().includes(q) || l.phone?.includes(q) || l.email?.toLowerCase().includes(q) || l.city?.toLowerCase().includes(q) || l.source?.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
      if (cityFilter !== "all" && l.city !== cityFilter) return false;
      if (stateFilter !== "all" && (l as any).state !== stateFilter) return false;
      if (collegeFilter !== "all" && l.interested_college_slug !== collegeFilter) return false;
      if (modeFilter !== "all" && (l.program_mode || "regular") !== modeFilter) return false;
      if (categoryFilter !== "all" && (l.source_category || "") !== categoryFilter) return false;
      if (deviceFilter !== "all" && (l.device_type || "") !== deviceFilter) return false;
      if (statusFilter !== "all" && (l.status || "new") !== statusFilter) return false;
      if (rangeFilter !== "all") {
        const d = l.created_at ? new Date(l.created_at) : null;
        if (!d) return false;
        if (rangeFilter === "custom") {
          if (customFrom && d < new Date(customFrom)) return false;
          if (customTo && d > new Date(customTo + "T23:59:59")) return false;
        } else {
          const days = rangeFilter === "1d" ? 1 : rangeFilter === "2d" ? 2 : rangeFilter === "7d" ? 7 : rangeFilter === "15d" ? 15 : 30;
          if (!isAfter(d, subDays(now, days))) return false;
        }
      }
      if (dupOnly) {
        const k = dupKey(l);
        if (!k || (dupCounts.get(k) || 0) < 2) return false;
      }
      return true;
    });
  }, [leads, search, sourceFilter, cityFilter, stateFilter, collegeFilter, modeFilter, categoryFilter, deviceFilter, statusFilter, rangeFilter, customFrom, customTo, dupOnly, dupCounts, dupKey]);

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [search, sourceFilter, cityFilter, collegeFilter, modeFilter, categoryFilter, deviceFilter, statusFilter, rangeFilter, customFrom, customTo, dupOnly, sortBy, sortDir, pageSize]);

  const filteredLeadGroups = useMemo<LeadGroup[]>(() => {
    const matchingIds = new Set(filtered.map((lead: any) => lead.id));
    const groups = allLeadGroups.filter((group) => group.instances.some((lead) => matchingIds.has(lead.id)));
    groups.sort((a, b) => {
      const av = a.primary?.[sortBy]; const bv = b.primary?.[sortBy];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (sortBy === "created_at") {
        return (new Date(av).getTime() - new Date(bv).getTime()) * (sortDir === "asc" ? 1 : -1);
      }
      return String(av).localeCompare(String(bv)) * (sortDir === "asc" ? 1 : -1);
    });
    return groups;
  }, [allLeadGroups, filtered, sortBy, sortDir]);
  const filteredSubmissionIds = useMemo(() => filteredLeadGroups.flatMap((group) => group.instances.map((lead) => lead.id)), [filteredLeadGroups]);
  const selectedPersonCount = useMemo(() => allLeadGroups.filter((group) => group.instances.some((lead) => selectedIds.has(lead.id))).length, [allLeadGroups, selectedIds]);


  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const latestLeads = allLeadGroups.map((group) => group.primary);
    const today = latestLeads.filter((l: any) => l.created_at && isAfter(new Date(l.created_at), subDays(now, 1))).length;
    const week = latestLeads.filter((l: any) => l.created_at && isAfter(new Date(l.created_at), subDays(now, 7))).length;
    const yesterday = latestLeads.filter((l: any) => {
      if (!l.created_at) return false;
      const d = new Date(l.created_at);
      return isAfter(d, subDays(now, 2)) && !isAfter(d, subDays(now, 1));
    }).length;
    const withPhone = allLeadGroups.filter((group) => group.instances.some((lead) => lead.phone)).length;
    const verified = allLeadGroups.filter((group) => group.instances.some((lead) => lead.otp_verified)).length;
    const online = latestLeads.filter((l: any) => (l.program_mode || "regular") === "online").length;
    const verifiedPct = allLeadGroups.length ? Math.round((verified / allLeadGroups.length) * 100) : 0;
    const avgPerDay = Math.round(week / 7);
    const dayDelta = yesterday > 0 ? Math.round(((today - yesterday) / yesterday) * 100) : (today > 0 ? 100 : 0);
    return { total: allLeadGroups.length, today, week, withPhone, verified, verifiedPct, online, avgPerDay, dayDelta };
  }, [allLeadGroups]);

  // Top sources & cities
  const topSources = useMemo(() => {
    const map = new Map<string, number>();
    allLeadGroups.forEach(({ primary: l }) => map.set(l.source || "unknown", (map.get(l.source || "unknown") || 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [allLeadGroups]);

  const exportCSV = () => {
    const headers = ["Name", "Phone", "Email", "City", "State", "Source", "Mode", "OTP Verified", "Consent", "Query", "Latest Created", "Submission Count"];
    const rows = filteredLeadGroups.map(({ primary: l, instances }) => [l.name, l.phone, l.email, l.city, l.state, l.source, (l.program_mode || "regular"), l.otp_verified ? "Yes" : "No", leadConsentLabel(l), (l.initial_query || "").replace(/[\r\n,]+/g, " "), l.created_at, instances.length]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `leads-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const sourceColor = (s: string) => {
    const colors: Record<string, string> = {
      chatbot: "bg-primary/10 text-primary border-primary/30",
      ai_search: "bg-violet-500/10 text-violet-600 border-violet-500/30",
      college_detail: "bg-blue-500/10 text-blue-600 border-blue-500/30",
      sidebar: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    };
    return colors[s] || "bg-muted text-muted-foreground border-border";
  };

  // Active filter count for the "Advanced" toggle badge
  const activeAdvCount = [
    sourceFilter !== "all",
    cityFilter !== "all",
    stateFilter !== "all",
    collegeFilter !== "all",
    categoryFilter !== "all",
    deviceFilter !== "all",
    modeFilter !== "all",
    dupOnly,
  ].filter(Boolean).length;

  const lastSync = leads[0]?.created_at ? new Date(leads[0].created_at) : new Date();

  return (
    <AdminLayout title="Lead Manager">
      <div className={isFullscreen ? "fixed inset-0 z-[100] overflow-auto bg-background p-4 md:p-6" : ""}>
      {/* ─── Header: title · Quick View · last sync · tools ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Lead Manager</h1>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Quick View :</span>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 w-auto min-w-[110px] gap-1.5 border-0 bg-transparent px-1 text-primary font-semibold focus:ring-0 hover:underline">
                <SelectValue placeholder="Origin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Origins</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">{c.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-[11px] text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <div className="leading-tight">
              <div className="font-medium text-foreground">Last sync on:</div>
              <div>{format(lastSync, "MMM d, yyyy hh:mm a")}</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, email…" className="pl-9 h-9 rounded-lg text-sm" />
          </div>
          <LeadsColumnCustomizer
            columns={ALL_COLUMNS}
            order={columnOrder}
            visible={columnVisible}
            onChange={({ order, visible }) => persistColumns(order, visible)}
            onReset={resetColumns}
          />
          <LeadFilterPresets
            current={{ search, sourceFilter, cityFilter, stateFilter, collegeFilter, modeFilter, categoryFilter, deviceFilter, statusFilter, rangeFilter, customFrom, customTo, dupOnly }}
            onApply={(f: any) => {
              setSearch(f.search ?? ""); setSourceFilter(f.sourceFilter ?? "all"); setCityFilter(f.cityFilter ?? "all"); setStateFilter(f.stateFilter ?? "all");
              setCollegeFilter(f.collegeFilter ?? "all"); setModeFilter(f.modeFilter ?? "all"); setCategoryFilter(f.categoryFilter ?? "all");
              setDeviceFilter(f.deviceFilter ?? "all"); setStatusFilter(f.statusFilter ?? "all"); setRangeFilter(f.rangeFilter ?? "all");
              setCustomFrom(f.customFrom ?? ""); setCustomTo(f.customTo ?? ""); setDupOnly(!!f.dupOnly);
            }}
          />
          <Button onClick={() => setShowImport((v) => !v)} variant="outline" size="sm" className="rounded-lg gap-1.5 h-9">
            <Upload className="w-3.5 h-3.5" /> Import
          </Button>
          <Button onClick={exportCSV} variant="outline" size="sm" className="rounded-lg gap-1.5 h-9">
            <Download className="w-3.5 h-3.5" /> Export
          </Button>
          <Button onClick={() => setIsFullscreen((value) => !value)} variant="outline" size="icon" className="h-9 w-9 rounded-lg" title={isFullscreen ? "Exit full page (Esc)" : "Open full page"}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

        </div>
      </div>

      {/* ─── Top filter strip ─── */}
      <div className="bg-card border border-border rounded-2xl px-4 py-3 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Filter className="w-4 h-4 text-primary" />
          </div>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0">
            <FilterField label="User Registration Date">
              <Select value={rangeFilter} onValueChange={setRangeFilter}>
                <SelectTrigger className="h-9 rounded-lg border-0 bg-transparent px-0 text-sm focus:ring-0"><SelectValue placeholder="Select Here" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="1d">Last 1 day</SelectItem>
                  <SelectItem value="2d">Last 2 days</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="15d">Last 15 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="custom">Custom range…</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Lead Stage">
              <Select value={modeFilter} onValueChange={setModeFilter}>
                <SelectTrigger className="h-9 rounded-lg border-0 bg-transparent px-0 text-sm focus:ring-0"><SelectValue placeholder="Select Here" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stages</SelectItem>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Lead Origin">
              <SearchableSelect
                options={["All sources", ...(sources as string[])]}
                value={sourceFilter === "all" ? "All sources" : sourceFilter}
                onChange={(v) => setSourceFilter(!v || v === "All sources" ? "all" : v)}
                placeholder="Select Here"
                className="border-0 bg-transparent px-0 h-9"
              />
            </FilterField>
          </div>

          <button
            onClick={() => setFiltersOpen((o) => !o)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium transition ${filtersOpen ? "bg-primary/10 text-primary border border-primary/30" : "text-primary hover:bg-primary/5 border border-transparent"}`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            {activeAdvCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">{activeAdvCount}</span>
            )}
            {filtersOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>

        {filtersOpen && (
          <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {rangeFilter === "custom" && (
              <>
                <FilterField label="From">
                  <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 rounded-lg border-0 bg-transparent px-0 text-sm focus-visible:ring-0" />
                </FilterField>
                <FilterField label="To">
                  <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 rounded-lg border-0 bg-transparent px-0 text-sm focus-visible:ring-0" />
                </FilterField>
              </>
            )}
            <FilterField label="City">
              <SearchableSelect
                options={["All cities", ...(cities as string[])]}
                value={cityFilter === "all" ? "All cities" : cityFilter}
                onChange={(v) => setCityFilter(!v || v === "All cities" ? "all" : v)}
                placeholder="Search city…"
                className="border-0 bg-transparent px-0 h-9"
              />
            </FilterField>
            <FilterField label="State">
              <SearchableSelect
                options={["All states", ...(states as string[])]}
                value={stateFilter === "all" ? "All states" : stateFilter}
                onChange={(v) => setStateFilter(!v || v === "All states" ? "all" : v)}
                placeholder="Search state…"
                className="border-0 bg-transparent px-0 h-9"
              />
            </FilterField>
            <FilterField label="College Interested In">
              <SearchableSelect
                options={["All colleges", ...collegeSlugs]}
                value={collegeFilter === "all" ? "All colleges" : collegeFilter}
                onChange={(v) => setCollegeFilter(!v || v === "All colleges" ? "all" : v)}
                placeholder="Search college…"
                className="border-0 bg-transparent px-0 h-9"
              />
            </FilterField>
            <FilterField label="Device">
              <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                <SelectTrigger className="h-9 rounded-lg border-0 bg-transparent px-0 text-sm focus:ring-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All devices</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="tablet">Tablet</SelectItem>
                  <SelectItem value="desktop">Desktop (System)</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <div className="flex items-center gap-3 px-3 rounded-lg border border-border bg-card">
              <Layers className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground flex-1">Email/mobile identity matching is always on</span>
            </div>
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "today", label: "Today", active: rangeFilter === "1d", apply: () => setRangeFilter(rangeFilter === "1d" ? "all" : "1d") },
              { id: "7d", label: "Last 7d", active: rangeFilter === "7d", apply: () => setRangeFilter(rangeFilter === "7d" ? "all" : "7d") },
              { id: "repeat", label: `Repeat (${dupTotal})`, active: dupOnly, apply: () => setDupOnly((v) => !v) },
              { id: "online", label: "Online", active: modeFilter === "online", apply: () => setModeFilter(modeFilter === "online" ? "all" : "online") },
            ].map((c) => (
              <button
                key={c.id}
                onClick={c.apply}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${c.active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"}`}
              >
                {c.label}
              </button>
            ))}
            {(activeAdvCount > 0 || rangeFilter !== "all" || search) && (
              <button
                onClick={() => { setRangeFilter("all"); setSourceFilter("all"); setCityFilter("all"); setCollegeFilter("all"); setModeFilter("all"); setCategoryFilter("all"); setDeviceFilter("all"); setDupOnly(false); setSearch(""); }}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-dashed border-border text-muted-foreground hover:text-destructive hover:border-destructive/40"
              >
                Reset all
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{filteredLeadGroups.length.toLocaleString()}</span> of {allLeadGroups.length.toLocaleString()} unique leads
            <span className="mx-2 text-border">·</span>
            <span className="font-semibold text-emerald-600">{stats.today}</span> last 24h
            <span className="mx-2 text-border">·</span>
            <span className="font-semibold text-violet-600">{stats.week}</span> last 7d
            <span className="mx-2 text-border">·</span>
            Verified <span className="font-semibold text-emerald-600">{stats.verifiedPct}%</span>
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
        {[
          { label: "Total", value: stats.total, icon: Users, color: "text-primary", bg: "bg-primary/10" },
          { label: "24h", value: stats.today, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-500/10", sub: `${stats.dayDelta >= 0 ? "+" : ""}${stats.dayDelta}%` },
          { label: "7 days", value: stats.week, icon: CalendarIcon, color: "text-violet-600", bg: "bg-violet-500/10" },
          { label: "With Phone", value: stats.withPhone, icon: Phone, color: "text-orange-600", bg: "bg-orange-500/10" },
          { label: "Verified", value: stats.verified, icon: ShieldCheck, color: "text-emerald-700", bg: "bg-emerald-500/10", sub: `${stats.verifiedPct}%` },
          { label: "Avg/Day", value: stats.avgPerDay, icon: Zap, color: "text-blue-600", bg: "bg-blue-500/10" },
          { label: "Repeat", value: dupTotal, icon: Flame, color: "text-rose-600", bg: "bg-rose-500/10", onClick: () => setDupOnly((v) => !v), active: dupOnly },
        ].map((s: any) => (
          <button
            key={s.label}
            onClick={s.onClick}
            className={`text-left bg-card border rounded-xl px-3 py-2 transition flex items-center gap-2.5 ${s.active ? "border-rose-400 ring-1 ring-rose-200" : "border-border"} ${s.onClick ? "hover:border-primary/50 cursor-pointer" : "cursor-default"}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.bg}`}>
              <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold text-foreground leading-tight">{s.value.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground leading-tight truncate">
                {s.label}{s.sub ? <span className="ml-1 opacity-70">· {s.sub}</span> : null}
              </p>
            </div>
          </button>
        ))}
      </div>

      <details className="mb-3">
        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground inline-flex items-center gap-1">
          <ChevronRight className="w-3 h-3" /> Bulk CSV import / export
        </summary>
        <div className="mt-2"><CSVTools table="leads" filename="leads.csv" columns="*" upsertKey="id" /></div>
      </details>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2.5">
        <span className="text-xs text-muted-foreground">{selectedPersonCount} people · {selectedIds.size} submissions selected</span>
        <Button size="sm" variant="destructive" disabled={deleteBusy || !selectedIds.size} onClick={() => deleteLeads(Array.from(selectedIds), `${selectedPersonCount} selected lead${selectedPersonCount === 1 ? "" : "s"}`)} className="gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Delete selected</Button>
        <Button size="sm" variant="outline" disabled={deleteBusy || !filteredLeadGroups.length} onClick={() => deleteLeads(filteredSubmissionIds, `${filteredLeadGroups.length} filtered lead${filteredLeadGroups.length === 1 ? "" : "s"}`)} className="gap-1.5 text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete all filtered ({filteredLeadGroups.length})</Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading leads...</div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              {(() => {
                const visibleCols = columnOrder
                  .map((k) => ALL_COLUMNS.find((c) => c.key === k))
                  .filter((c): c is LeadColumnDef => !!c && columnVisible[c.key] !== false);

                const renderCell = (key: string, lead: any, dn: number, t: ReturnType<typeof dupTier>, isOpen: boolean, rowKey: string, instances: any[]) => {
                  const firstAt = instances.length > 0
                    ? instances.reduce((min, it) => !min || new Date(it.created_at) < new Date(min) ? it.created_at : min, null as string | null)
                    : lead.created_at;
                  switch (key) {
                    case "instances": {
                      const latestGapDays = instances.length > 1 && instances[0]?.created_at && instances[1]?.created_at
                        ? differenceInCalendarDays(new Date(instances[0].created_at), new Date(instances[1].created_at))
                        : 0;
                      return (
                        <div className="flex items-center gap-2 whitespace-nowrap">

                          {dn > 1 && (
                            <button onClick={(event) => { event.stopPropagation(); toggle(rowKey); }} className="w-5 h-5 rounded hover:bg-muted flex items-center justify-center flex-shrink-0" title={isOpen ? "Collapse" : "Expand"}>
                              {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {dn > 1 ? (
                            <Badge className={`text-[10px] border ${t?.chip || "bg-muted"}`}><Flame className="w-3 h-3 mr-1" />{dn} submissions</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">1</span>
                          )}
                          {latestGapDays >= 10 && <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-200">Returned after {latestGapDays}d</Badge>}
                        </div>
                      );
                    }
                    case "name":
                      return <span className="font-semibold text-primary hover:underline cursor-pointer">{maskName(lead.name) || "-"}</span>;
                    case "phone":
                      return lead.phone ? (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Phone className="w-3.5 h-3.5" />+91 {mask ? maskPhone(lead.phone) : lead.phone.replace(/\D/g, "").slice(-10)}</span>
                      ) : "-";
                    case "email":
                      return lead.email ? (
                        <span className="flex items-center gap-1 text-muted-foreground"><Mail className="w-3 h-3" />{mask ? maskEmail(lead.email) : lead.email}</span>
                      ) : "-";
                    case "state":
                      return <span className="text-xs">{lead.state || "-"}</span>;
                    case "city":
                      return <span className="text-xs">{lead.city || "-"}</span>;
                    case "course":
                      return <span className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]" title={lead.current_situation || ""}>{lead.current_situation || "-"}</span>;
                    case "source":
                      return <Badge className={`text-[10px] border ${sourceColor(lead.source || "")}`}>{lead.source || "unknown"}</Badge>;
                    case "source_category":
                      return <Badge variant="outline" className="text-[10px] capitalize">{(lead.source_category || "-").replace(/_/g, " ")}</Badge>;
                    case "device_type":
                      return <Badge variant="outline" className={`text-[10px] capitalize ${lead.device_type === "mobile" ? "bg-amber-500/10 text-amber-700 border-amber-500/30" : lead.device_type === "tablet" ? "bg-violet-500/10 text-violet-700 border-violet-500/30" : "bg-slate-500/10 text-slate-700 border-slate-500/30"}`}>{lead.device_type === "desktop" ? "System" : (lead.device_type || "-")}</Badge>;
                    case "program_mode":
                      return <Badge className={`text-[10px] border ${(lead.program_mode || "regular") === "online" ? "bg-blue-500/10 text-blue-600 border-blue-500/30" : "bg-primary/10 text-primary border-primary/30"}`}>{(lead.program_mode || "regular") === "online" ? "Online" : "Regular"}</Badge>;
                    case "otp_verified":
                      return lead.otp_verified ? <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 border">✓ Verified</Badge> : <Badge className="text-[10px] bg-muted text-muted-foreground border">Unverified</Badge>;
                    case "consent": {
                      const accepted = lead.consent_terms_accepted !== false;
                      return <Badge className={`text-[10px] border ${accepted ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" : "bg-rose-500/10 text-rose-700 border-rose-500/30"}`}>Consent: {accepted ? "Y" : "N"}</Badge>;
                    }
                    case "status": {
                      if (t) return <Badge className={`text-[10px] border ${t.chip}`}>🔥 {t.label}</Badge>;
                      if (lead.otp_verified) return <Badge className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30 border">Qualified</Badge>;
                      return <Badge className="text-[10px] bg-blue-500/10 text-blue-700 border-blue-500/30 border">New</Badge>;
                    }
                    case "campus":
                      return <span className="text-xs text-muted-foreground truncate max-w-[160px] inline-block" title={lead.interested_college_slug || ""}>{lead.interested_college_slug || "-"}</span>;
                    case "exam":
                      return <span className="text-xs text-muted-foreground">{lead.interested_exam_slug || "-"}</span>;
                    case "cta":
                      return <span className="text-xs text-muted-foreground">{lead.cta || "-"}</span>;
                    case "landing_page":
                      return lead.page_url ? (
                        <a href={lead.page_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 max-w-[220px] truncate" title={lead.page_url}>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" /><span className="truncate">{lead.page_url}</span>
                        </a>
                      ) : "-";
                    case "page_url":
                      return <span className="text-xs text-muted-foreground max-w-[160px] truncate inline-block" title={lead.page_url || ""}>{lead.page_url || "-"}</span>;
                    case "initial_query":
                      return <span className="text-xs text-muted-foreground line-clamp-2 max-w-[240px] inline-block">{lead.initial_query || "-"}</span>;
                    case "first_at":
                      return <span className="text-xs text-muted-foreground whitespace-nowrap">{firstAt ? format(new Date(firstAt), "MMM d, HH:mm") : "-"}</span>;
                    case "created_at":
                      return <span className="text-xs text-muted-foreground whitespace-nowrap">{lead.created_at ? format(new Date(lead.created_at), "MMM d, HH:mm") : "-"}</span>;
                    case "registered_at":
                      return <span className="text-xs text-muted-foreground whitespace-nowrap">{firstAt ? format(new Date(firstAt), "MMM d, yyyy") : "-"}</span>;
                    case "actions": {
                      const tel = lead.phone ? lead.phone.replace(/\D/g, "").slice(-10) : "";
                      return (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setIntentLead({ id: lead.id, name: lead.name, phone: lead.phone })}
                            className="w-7 h-7 rounded hover:bg-muted flex items-center justify-center"
                            title="Intent analysis"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                          </button>
                          <button
                            onClick={() => {
                              const text = `${lead.name || ""} ${tel ? "+91" + tel : ""} ${lead.email || ""}`.trim();
                              navigator.clipboard?.writeText(text);
                              toast.success("Lead details copied");
                            }}
                            className="w-7 h-7 rounded hover:bg-muted flex items-center justify-center" title="Copy details"
                          >
                            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => deleteLeads(instances.map((instance) => instance.id), `this lead and its full history`)}
                            disabled={deleteBusy}
                            className="w-7 h-7 rounded hover:bg-destructive/10 flex items-center justify-center" title="Delete lead"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        </div>
                      );
                    }
                    default:
                      return null;
                  }
                };

                const rows = filteredLeadGroups;
                const toggle = (k: string) => {
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(k)) next.delete(k);
                    else next.add(k);
                    return next;
                  });
                };
                const effectivePageSize = pageSize === -1 ? Math.max(1, rows.length) : pageSize;
                const totalPages = Math.max(1, Math.ceil(rows.length / effectivePageSize));
                const safePage = Math.min(page, totalPages);
                const visibleRows = rows.slice((safePage - 1) * effectivePageSize, safePage * effectivePageSize);
                const visibleIds = visibleRows.flatMap((row) => row.instances.map((lead) => lead.id));
                const allOnPageSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
                const toggleAllOnPage = () => {
                  const next = new Set(selectedIds);
                  if (allOnPageSelected) visibleIds.forEach((id) => next.delete(id));
                  else visibleIds.forEach((id) => next.add(id));
                  setSelectedIds(next);
                };
                const toggleRowSel = (ids: string[]) => {
                  const next = new Set(selectedIds);
                  const allSelected = ids.every((id) => next.has(id));
                  ids.forEach((id) => allSelected ? next.delete(id) : next.add(id));
                  setSelectedIds(next);
                };

                // Map column key → sortable field on the row
                const sortKeyFor = (k: string) => {
                  switch (k) {
                    case "instances": return null;
                    case "actions": return null;
                    case "course": return "current_situation";
                    case "campus": return "interested_college_slug";
                    case "exam": return "interested_exam_slug";
                    case "landing_page": case "page_url": return "page_url";
                    case "first_at": case "registered_at": return "created_at";
                    case "consent": return "consent_terms_accepted";
                    default: return k;
                  }
                };

                return (
                  <>
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-border bg-muted/60 backdrop-blur">
                        <th className="w-8"></th>
                        <th className="w-10 px-2">
                          <Checkbox checked={allOnPageSelected} onCheckedChange={toggleAllOnPage} aria-label="Select page" />
                        </th>

                        {visibleCols.map((col) => {
                          const sortField = sortKeyFor(col.key);
                          const active = sortField && sortBy === sortField;
                          const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
                          return (
                            <th
                              key={col.key}
                              onClick={() => {
                                if (!sortField) return;
                                if (sortBy === sortField) setSortDir(d => d === "asc" ? "desc" : "asc");
                                else { setSortBy(sortField); setSortDir("desc"); }
                              }}
                              className={`text-left p-3 text-xs font-semibold uppercase tracking-wide select-none whitespace-nowrap ${sortField ? "cursor-pointer" : ""} ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                            >
                              <span className="inline-flex items-center gap-1">{col.label} {sortField && <Icon className="w-3 h-3 opacity-60" />}</span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.length === 0 ? null : visibleRows.flatMap(({ key, primary, instances }) => {
                        const lead = primary;
                        const dn = instances.length;
                        const t = dupTier(dn);
                        const isOpen = expanded.has(key);
                        const instanceIds = instances.map((instance) => instance.id);
                        const selectedInGroup = instanceIds.filter((id) => selectedIds.has(id)).length;
                        const groupChecked = selectedInGroup === instanceIds.length ? true : selectedInGroup > 0 ? "indeterminate" : false;
                        const head = (
                          <tr
                            key={key}
                            onClick={() => setDetailLead(lead)}
                            className={`border-b border-border last:border-0 hover:bg-primary/5 transition-colors cursor-pointer ${t ? `${t.bg}` : "odd:bg-muted/20"}`}
                          >
                            <td className="p-0 w-1">
                              <div className={`w-1 h-10 ${t ? "bg-rose-500" : "bg-primary/60"}`} />
                            </td>
                            <td className="w-10 px-2" onClick={(e) => e.stopPropagation()}>
                              <Checkbox checked={groupChecked} onCheckedChange={() => toggleRowSel(instanceIds)} aria-label={`Select all submissions for ${lead.name || "lead"}`} />
                            </td>
                            {visibleCols.map((col) => (
                              <td key={col.key} className="px-3 py-2 align-middle" onClick={(e) => { if (col.key === "actions") e.stopPropagation(); }}>
                                {renderCell(col.key, lead, dn, t, isOpen, key, instances)}
                              </td>
                            ))}
                          </tr>
                        );

                        if (!isOpen || dn <= 1) return [head];
                        const children = (
                          <tr key={key + "-d"} className="bg-muted/20">
                            <td></td>
                            <td></td>
                            <td colSpan={visibleCols.length} className="p-3">

                              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5"><FileText className="w-3 h-3" /> Submission history · latest first</div>
                                  <p className="mt-0.5 text-[10px] text-muted-foreground">Uncheck submissions you want to keep, then delete the selected history.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-muted-foreground">{selectedInGroup} of {dn} selected</span>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-7 gap-1.5 text-[11px]"
                                    disabled={deleteBusy || selectedInGroup === 0}
                                    onClick={() => deleteLeads(instanceIds.filter((id) => selectedIds.has(id)), `selected history for ${lead.name || "this lead"}`)}
                                  >
                                    <Trash2 className="h-3 w-3" /> Delete selected history
                                  </Button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                {instances.map((it, index) => (
                                  <div key={it.id} className="bg-card border border-border rounded-lg p-2 grid md:grid-cols-4 gap-2 text-[11px]">
                                    <div className="md:col-span-4 flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-2">
                                        <Checkbox checked={selectedIds.has(it.id)} onCheckedChange={() => toggleRowSel([it.id])} aria-label={`Select submission ${index + 1}`} />
                                        <strong>{index === 0 ? "Latest" : `Previous ${index}`} · {maskName(it.name) || "Unknown"}</strong>
                                      </div>
                                      <span className="text-muted-foreground">{it.created_at ? format(new Date(it.created_at), "MMM d, yyyy HH:mm") : "-"}</span>
                                    </div>
                                    <div><span className="text-muted-foreground">Phone:</span> {it.phone ? `+91 ${mask ? maskPhone(it.phone) : String(it.phone).replace(/\D/g, "").slice(-10)}` : "-"}</div>
                                    <div><span className="text-muted-foreground">Email:</span> {it.email ? (mask ? maskEmail(it.email) : it.email) : "-"}</div>
                                    <div><span className="text-muted-foreground">Course:</span> {it.current_situation || it.interested_course_slug || "-"}</div>
                                    <div><span className="text-muted-foreground">Location:</span> {[it.city, it.state].filter(Boolean).join(", ") || "-"} · {it.program_mode || "unknown"}</div>
                                    <div><span className="text-muted-foreground">Source:</span> <Badge className={`text-[10px] border ${sourceColor(it.source || "")}`}>{it.source || "-"}</Badge></div>
                                    <div><span className="text-muted-foreground">CTA:</span> {it.cta || "-"}</div>
                                    <div className="md:col-span-2 truncate" title={it.page_url || ""}><span className="text-muted-foreground">Page:</span> {it.page_url || "-"}</div>
                                    <div className="md:col-span-3"><span className="text-muted-foreground">Query:</span> {it.initial_query || "-"}</div>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                        return [head, children];
                      })}
                    </tbody>
                  </>
                );
              })()}
            </table>
          </div>
          {filteredLeadGroups.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No leads match your filters.</div>
          )}

          {/* Bottom bar - true pagination */}
          {(() => {
            const effectivePageSize = pageSize === -1 ? Math.max(1, filteredLeadGroups.length) : pageSize;
            const totalPages = Math.max(1, Math.ceil(filteredLeadGroups.length / effectivePageSize));
            const safePage = Math.min(page, totalPages);
            const start = filteredLeadGroups.length === 0 ? 0 : (safePage - 1) * effectivePageSize + 1;
            const end = Math.min(safePage * effectivePageSize, filteredLeadGroups.length);
            return (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border bg-muted/30">
                <div className="text-xs text-muted-foreground">
                  Showing <span className="font-semibold text-foreground">{start}-{end}</span> of <span className="font-semibold text-foreground">{filteredLeadGroups.length.toLocaleString()}</span> unique leads
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(1)} disabled={safePage <= 1}><ChevronsLeft className="w-3.5 h-3.5" /></Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}><ChevronLeft className="w-3.5 h-3.5" /></Button>
                  <span className="px-3 text-xs text-muted-foreground">Page <span className="font-semibold text-foreground">{safePage}</span> of {totalPages}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}><ChevronRight className="w-3.5 h-3.5" /></Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(totalPages)} disabled={safePage >= totalPages}><ChevronsRight className="w-3.5 h-3.5" /></Button>
                </div>


            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground">Show Rows</span>
              <Select
                value={pageSize === -1 ? "all" : [10, 20, 50, 100].includes(pageSize) ? String(pageSize) : "custom"}
                onValueChange={(v) => {
                  if (v === "all") {
                    setPageSize(-1); setCustomSize(""); setPage(1);
                  } else if (v === "custom") {
                    setCustomSize(String(pageSize));
                  } else {
                    setPageSize(Number(v));
                    setCustomSize("");
                  }
                }}
              >
                <SelectTrigger className="h-8 w-[110px] rounded-lg text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="custom">Custom…</SelectItem>
                  <SelectItem value="all">All rows</SelectItem>
                </SelectContent>
              </Select>
              {pageSize !== -1 && (![10, 20, 50, 100].includes(pageSize) || customSize !== "") ? (
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  value={customSize || pageSize}
                  onChange={(e) => {
                    setCustomSize(e.target.value);
                    const n = Math.max(1, Math.min(10000, Number(e.target.value) || 1));
                    setPageSize(n);
                  }}
                  className="h-8 w-[90px] rounded-lg text-xs"
                  placeholder="Custom"
                />
              ) : null}
            </div>
              </div>
            );
          })()}
        </div>
      )}
      <LeadIntentDrawer
        leadId={intentLead?.id ?? null}
        leadName={intentLead?.name}
        leadPhone={intentLead?.phone}
        onClose={() => setIntentLead(null)}
      />
      <LeadDetailDrawer lead={detailLead} onClose={() => setDetailLead(null)} onChanged={() => { /* react-query will refetch on next tick */ }} />
      {mergeRows && <MergeLeadsDialog leads={mergeRows} open={!!mergeRows} onClose={() => setMergeRows(null)} onMerged={() => { setSelectedIds(new Set()); setMergeRows(null); }} />}
      </div>
    </AdminLayout>

  );
}
