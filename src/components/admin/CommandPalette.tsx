import { useAdminCatalog, fetchCatalogRecord } from "@/hooks/useAdminCatalog";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useAuth } from "@/hooks/useAuth";
import { Module } from "@/lib/rbac";

const ITEMS: Array<{ label: string; href: string; module?: Module; keywords?: string }> = [
  { label: "Dashboard", href: "/admin" },
  { label: "Colleges", href: "/admin/colleges", module: "colleges" },
  { label: "Courses", href: "/admin/courses", module: "courses" },
  { label: "Exams", href: "/admin/exams", module: "exams" },
  { label: "Articles", href: "/admin/articles", module: "articles" },
  { label: "Sarkari Articles", href: "/admin/sarkari/articles", module: "articles", keywords: "government jobs content" },
  { label: "Sarkari Job AI Studio", href: "/admin/sarkari/ai-studio", module: "articles", keywords: "government jobs ai writing" },
  { label: "Study Material", href: "/admin/study-material", module: "study_material" },
  { label: "Leads", href: "/admin/leads", module: "leads" },
  { label: "Sarkari Leads", href: "/admin/sarkari/leads", module: "leads", keywords: "government jobs enquiries" },
  { label: "Applications", href: "/admin/applications", module: "applications" },
  { label: "Referrals", href: "/admin/referrals", module: "referrals" },
  { label: "Users & Roles", href: "/admin/users", module: "users" },
  { label: "Ads Manager", href: "/admin/ads", module: "ads" },
  { label: "Upgrade Yourself with IIT / IIM / Dr. Tag", href: "/admin/promoted-programs", module: "promoted_programs", keywords: "popular premium program categories" },
  { label: "Featured Colleges", href: "/admin/featured", module: "featured" },
  { label: "Banners", href: "/admin/banners", module: "banners" },
  { label: "Integrations (GA / GTM / Clarity)", href: "/admin/integrations", module: "integrations" },
  { label: "AI Providers", href: "/admin/ai-providers", module: "ai_providers" },
  { label: "OTP Providers", href: "/admin/otp-providers", module: "otp_providers" },
  { label: "System Logs", href: "/admin/logs" },
  { label: "Explain System (Dev + Layman + Live Logs)", href: "/admin/explain-system" },
  { label: "Backup & Restore", href: "/admin/backup", module: "backup" },
  { label: "Sitemap", href: "/admin/sitemap", module: "sitemap" },
  { label: "Legal Pages", href: "/admin/legal", module: "legal" },
];

export function CommandPalette({ open, setOpen, query, setQuery, includeSarkari }: { open: boolean; setOpen: (value: boolean) => void; query: string; setQuery: (value: string) => void; includeSarkari: boolean }) {
  const catalog = useAdminCatalog(includeSarkari, open ? query : "");
  const [preview, setPreview] = useState<{ name: string; description: string } | null>(null);
  const navigate = useNavigate();
  const { isAdmin, canAccess, can } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setQuery(""); setOpen(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen, setQuery]);

  const visible = ITEMS.filter((i) => !i.module || isAdmin || canAccess(i.module));

  return (
    <CommandDialog open={open} onOpenChange={value => { setOpen(value); if (!value) setPreview(null); }}>
      <CommandInput value={query} onValueChange={value => { setQuery(value); setPreview(null); }} placeholder="Search records and admin tools…" />
      <CommandList>
        {preview && <div className="p-3"><strong>{preview.name}</strong><p>{preview.description}</p></div>}
        <CommandEmpty>{catalog.isFetching ? "Loading record names…" : catalog.isError ? "Could not load record names." : "No matches."}</CommandEmpty>
        {query.trim() && <CommandGroup heading="Records">
          {catalog.data?.filter(row => row.name?.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 50).map(row =>
            <CommandItem key={row.table + row.id} value={row.name + " " + row.table + " " + row.id} onSelect={async () => {
              if (isAdmin || can(row.table, "edit")) {
                navigate("/admin/" + (row.scope === "sarkari" ? "sarkari/" : "") + row.table + "?record=" + encodeURIComponent(row.id));
                setOpen(false);
              } else {
                try {
                  const record = await fetchCatalogRecord(row.table, row.id, row.scope);
                  setPreview({ name: row.name, description: record.description || record.full_name || record.status || "" });
                } catch { toast.error("Could not open record."); }
              }
            }}>{row.name} <small className="ml-2 text-muted-foreground">{row.scope === "sarkari" ? "Sarkari articles" : row.table}</small></CommandItem>)}
        </CommandGroup>}
        <CommandGroup heading="Navigate">
          {visible.map((i) => (
            <CommandItem
              key={i.href}
              onSelect={() => {
                navigate(i.href);
                setOpen(false);
              }}
            >
              {i.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
