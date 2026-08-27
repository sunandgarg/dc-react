import { useEffect, useState, useCallback } from "react";
import { backendClient } from "@/integrations/backend/client";
import { LeadPushModule } from "@/components/leadpush/LeadPushModule";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/AdminLayout";
import { AddUniversityModal, type UniversityFormData } from "@/components/universities/AddUniversityModal";
import { EditUniversityModal, type UniversityEditData } from "@/components/universities/EditUniversityModal";

function rowToEditData(u: any): UniversityEditData {
  return {
    id: u.id,
    name: u.name || "",
    apiUrl: u.apiUrl || u.api_url || "",
    collegeId: u.collegeId || u.college_id || "",
    secretKey: u.secretKey || u.secret_key || "",
    source: u.source || "dekhocampus",
    medium: u.medium || "dekhocampus",
    campaign: u.campaign || "API",
    leadsPerMinute: u.leadsPerMinute ?? u.leads_per_minute ?? 90,
    apiTimeoutSeconds: u.apiTimeoutSeconds ?? u.api_timeout_seconds ?? 30,
    defaultPushConcurrency: u.defaultPushConcurrency ?? u.default_push_concurrency ?? 2,
    dailyLeadLimit: u.dailyLeadLimit ?? u.daily_lead_limit ?? u.daily_limit ?? null,
    status: u.status || (u.is_active === false ? "disabled" : "live"),
    apiType: u.apiType || u.api_type || "nopaperforms",
    utmLink: u.utmLink || u.utm_link || "",
    publisherPanelUrl: u.publisherPanelUrl || u.publisher_panel_url || "",
    publisherId: u.publisherId || u.publisher_id || "",
    authType: u.authType || u.auth_type || "secret_key",
    authHeaderKey: u.authHeaderKey || u.auth_header_key || "Authorization",
    authHeaderValue: u.authHeaderValue || u.auth_header_value || "",
    payloadWrapper: u.payloadWrapper || u.payload_wrapper || "object",
    customHeaders: u.customHeaders || u.custom_headers || {},
    programs: u.programs || [],
    stateCities: u.stateCities || u.state_cities || [],
    courseSpecializations: u.courseSpecializations || u.course_specializations || [],
    customColumns: u.customColumns || u.custom_columns || [],
    columnMapping: u.columnMapping || u.column_mapping || {},
    payloadFields: u.payloadFields || u.payload_fields || undefined,
    sampleCsvContent: u.sampleCsvContent || u.sample_csv_content || "",
    defaultValues: u.defaultValues || u.default_values || {},
  };
}

function formToRow(f: UniversityFormData | UniversityEditData): Record<string, any> {
  return {
    ...(("id" in f && f.id) ? { id: f.id } : {}),
    name: f.name ?? "",
    api_url: f.apiUrl ?? "",
    college_id: f.collegeId ?? "",
    secret_key: f.secretKey ?? "",
    source: f.source ?? "dekhocampus",
    medium: f.medium ?? "dekhocampus",
    campaign: f.campaign ?? "API",
    leads_per_minute: f.leadsPerMinute ?? 90,
    api_timeout_seconds: (f as any).apiTimeoutSeconds ?? 30,
    default_push_concurrency: (f as any).defaultPushConcurrency ?? 2,
    daily_lead_limit: (f as any).dailyLeadLimit ?? (f as any).daily_lead_limit ?? null,
    daily_limit: (f as any).dailyLeadLimit ?? (f as any).daily_lead_limit ?? null,
    status: (f as any).status ?? "live",
    is_active: ((f as any).status ?? "live") !== "disabled",
    api_type: f.apiType ?? "nopaperforms",
    utm_link: f.utmLink || null,
    publisher_panel_url: (f as any).publisherPanelUrl || null,
    publisher_id: (f as any).publisherId || null,
    auth_type: (f as any).authType || "secret_key",
    auth_header_key: (f as any).authHeaderKey || "Authorization",
    auth_header_value: (f as any).authHeaderValue || "",
    payload_wrapper: (f as any).payloadWrapper || "object",
    custom_headers: (f as any).customHeaders || {},
    programs: (f as any).programs || [],
    state_cities: (f as any).stateCities || (f as any).state_cities || [],
    course_specializations: (f as any).courseSpecializations || (f as any).course_specializations || [],
    custom_columns: (f as any).customColumns || (f as any).custom_columns || [],
    payload_fields: (f as any).payloadFields || [],
    sample_csv_content: (f as any).sampleCsvContent || (f as any).sample_csv_content || "",
    column_mapping: f.columnMapping || {},
    default_values: (f as UniversityFormData).defaultValues || {},
  };
}

function importedConfigToRow(c: any): Record<string, any> {
  return {
    ...(c.id ? { id: c.id } : {}),
    name: c.name ?? "",
    api_url: c.apiUrl ?? c.api_url ?? "",
    college_id: c.collegeId ?? c.college_id ?? "",
    secret_key: c.secretKey ?? c.secret_key ?? "",
    source: c.source ?? "dekhocampus",
    medium: c.medium ?? "dekhocampus",
    campaign: c.campaign ?? "API",
    leads_per_minute: c.leadsPerMinute ?? c.leads_per_minute ?? 90,
    api_timeout_seconds: c.apiTimeoutSeconds ?? c.api_timeout_seconds ?? 30,
    default_push_concurrency: c.defaultPushConcurrency ?? c.default_push_concurrency ?? 2,
    daily_lead_limit: c.dailyLeadLimit ?? c.daily_lead_limit ?? c.daily_limit ?? null,
    daily_limit: c.dailyLimit ?? c.daily_limit ?? c.daily_lead_limit ?? null,
    status: c.status ?? "live",
    is_active: (c.status ?? "live") !== "disabled",
    api_type: c.apiType ?? c.api_type ?? "nopaperforms",
    utm_link: c.utmLink ?? c.utm_link ?? null,
    publisher_panel_url: c.publisherPanelUrl ?? c.publisher_panel_url ?? null,
    publisher_id: c.publisherId ?? c.publisher_id ?? null,
    auth_type: c.authType ?? c.auth_type ?? "secret_key",
    auth_header_key: c.authHeaderKey ?? c.auth_header_key ?? "Authorization",
    auth_header_value: c.authHeaderValue ?? c.auth_header_value ?? "",
    payload_wrapper: c.payloadWrapper ?? c.payload_wrapper ?? "object",
    custom_headers: c.customHeaders ?? c.custom_headers ?? {},
    programs: c.programs ?? [],
    state_cities: c.stateCities ?? c.state_cities ?? [],
    course_specializations: c.courseSpecializations ?? c.course_specializations ?? [],
    custom_columns: c.customColumns ?? c.custom_columns ?? [],
    payload_fields: c.payloadFields ?? c.payload_fields ?? [],
    sample_csv_content: c.sampleCsvContent ?? c.sample_csv_content ?? "",
    column_mapping: c.columnMapping ?? c.column_mapping ?? {},
    default_values: c.defaultValues ?? c.default_values ?? {},
  };
}

export default function AdminLeadPushV2() {
  const { toast } = useToast();
  const [universities, setUniversities] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedUploadUniversity, setSelectedUploadUniversity] = useState<any | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UniversityEditData | null>(null);

  const refresh = useCallback(async () => {
    const [u, b, l] = await Promise.all([
      (backendClient as any).from("universities").select("*").order("created_at", { ascending: false }),
      (backendClient as any).from("upload_batches").select("*").order("created_at", { ascending: false }).limit(200),
      (backendClient as any).from("api_logs").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setUniversities(u.data || []);
    setBatches(b.data || []);
    setLogs(l.data || []);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this university?")) return;
    const { error } = await (backendClient as any).from("universities").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Deleted" }); refresh(); }
  };

  const handleAddSave = async (f: UniversityFormData) => {
    const { error } = await (backendClient as any).from("universities").insert(formToRow(f));
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      throw error;
    }
    toast({ title: "University added" });
    await refresh();
  };

  const handleEditSave = async (f: UniversityEditData) => {
    const { error } = await (backendClient as any).from("universities").update(formToRow(f)).eq("id", f.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "University updated" });
    setEditTarget(null);
    await refresh();
  };

  const handleBulkImport = async (configs: any[]) => {
    if (!configs?.length) return;
    const rows = configs.map(importedConfigToRow);

    const BATCH = 200;
    let saved = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const withId = slice.filter((row) => row.id);
      const withoutId = slice.filter((row) => !row.id);

      const { error: upsertError } = withId.length
        ? await (backendClient as any).from("universities").upsert(withId, { onConflict: "id" })
        : { error: null };
      if (upsertError) {
        toast({ title: "Bulk import failed", description: upsertError.message, variant: "destructive" });
        await refresh();
        return;
      }

      const { error } = withoutId.length
        ? await (backendClient as any).from("universities").insert(withoutId)
        : { error: null };
      if (error) {
        toast({ title: "Bulk import failed", description: error.message, variant: "destructive" });
        await refresh();
        return;
      }
      saved += slice.length;
    }
    toast({ title: "Imported", description: `${saved} university config(s) saved` });
    await refresh();
  };

  return (
    <AdminLayout title="Lead Push">
      <LeadPushModule
        universities={universities}
        logs={logs}
        batches={batches}
        onUniversitiesChange={refresh}
        onAddUniversity={() => setAddOpen(true)}
        onEditUniversity={(uni) => setEditTarget(rowToEditData(uni))}
        onDeleteUniversity={handleDelete}
        onSelectUploadUniversity={setSelectedUploadUniversity}
        selectedUploadUniversity={selectedUploadUniversity}
        onBulkImport={handleBulkImport}
      />
      <AddUniversityModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={handleAddSave}
        existingUniversities={universities.map((u) => u.name)}
      />
      <EditUniversityModal
        isOpen={!!editTarget}
        university={editTarget}
        onClose={() => setEditTarget(null)}
        onSave={handleEditSave}
      />
    </AdminLayout>
  );
}
