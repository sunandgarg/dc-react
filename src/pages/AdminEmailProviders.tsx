import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { backendClient } from "@/integrations/backend/client";
import { Cloud, Loader2, Mail, Plus, RefreshCw, Save, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface EmailProvider {
  id: string;
  provider_name: string;
  display_name: string;
  region: string | null;
  from_email: string | null;
  from_name: string | null;
  reply_to: string | null;
  is_active: boolean;
  config_json: Record<string, unknown>;
}

interface SesStatus {
  configured: boolean;
  available: boolean;
  credential_source: string;
  region: string;
  identity: string;
  from_email: string;
  active: boolean;
  production_access?: boolean;
  sending_enabled?: boolean;
  sent_last_24_hours?: number;
  max_24_hour_send?: number;
  max_send_rate?: number;
  verification_status?: string;
  verified_for_sending?: boolean;
  dkim_status?: string;
  message?: string;
}

const providerFields = "id,provider_name,display_name,region,from_email,from_name,reply_to,is_active,config_json";

export default function AdminEmailProviders() {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, Partial<EmailProvider>>>({});
  const [testTo, setTestTo] = useState("");

  const { data: providers, isLoading } = useQuery({
    queryKey: ["email-providers"],
    queryFn: async () => {
      const { data, error } = await backendClient.from("email_providers" as any).select(providerFields).order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as EmailProvider[];
    },
  });

  const { data: status, isFetching: statusLoading, refetch: refreshStatus } = useQuery<SesStatus>({
    queryKey: ["aws-ses-status"],
    queryFn: async () => {
      const { data, error } = await backendClient.functions.invoke("send-email", { body: { action: "status" } });
      if (error || data?.error || (data?.message && !data?.credential_source)) {
        throw new Error(error?.message || data?.error || data?.message || "Unable to read SES status");
      }
      return data as SesStatus;
    },
    retry: false,
  });

  const addAws = useMutation({
    mutationFn: async () => {
      const { error } = await backendClient.from("email_providers" as any).insert({
        provider_name: "aws_ses",
        display_name: "Amazon SES",
        region: status?.region || "ap-south-1",
        from_email: status?.from_email || "noreply@dekhocampus.com",
        from_name: "DekhoCampus",
        config_json: { credential_source: "iam_runtime", identity: "dekhocampus.com", mode: "transactional" },
        is_active: Boolean(status?.configured),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-providers"] });
      refreshStatus();
      toast.success("Amazon SES provider added");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const save = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<EmailProvider> }) => {
      const allowed = { from_email: updates.from_email, from_name: updates.from_name, reply_to: updates.reply_to };
      const { error } = await backendClient.from("email_providers" as any).update(allowed as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-providers"] });
      refreshStatus();
      toast.success("Email identity settings saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setActive = useMutation({
    mutationFn: async ({ provider, next }: { provider: EmailProvider; next: boolean }) => {
      if (next && (!status?.configured || !provider.from_email)) {
        throw new Error("The AWS runtime and From email must be configured before activation.");
      }
      if (next) await backendClient.from("email_providers" as any).update({ is_active: false } as any).neq("id", provider.id);
      const { error } = await backendClient.from("email_providers" as any).update({ is_active: next } as any).eq("id", provider.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-providers"] });
      refreshStatus();
      toast.success("Amazon SES status updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sendTest = useMutation({
    mutationFn: async () => {
      if (!testTo.trim()) throw new Error("Enter a test email address");
      const { data, error } = await backendClient.functions.invoke("send-email", {
        body: {
          action: "send_test",
          to: testTo.trim(),
          subject: "DekhoCampus Amazon SES test",
          text: "Amazon SES is connected to the DekhoCampus AWS backend.",
          html: "<p>Amazon SES is connected to the <strong>DekhoCampus AWS backend</strong>.</p>",
        },
      });
      if (error || data?.error || data?.code && !data?.sent) throw new Error(error?.message || data?.message || data?.error || "Email failed");
      return data;
    },
    onSuccess: (data) => {
      refreshStatus();
      toast.success(`Test email sent${data?.message_id ? `: ${data.message_id}` : ""}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setField = (id: string, key: keyof EmailProvider, value: string) => {
    setEdits((current) => ({ ...current, [id]: { ...(current[id] || {}), [key]: value } }));
  };

  return (
    <AdminLayout title="Email Providers">
      <section className="mb-6 border border-primary/20 bg-primary/5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold text-foreground">Transactional email via Amazon SES</p>
              <p className="text-sm text-muted-foreground">
                AWS credentials stay on the backend and are supplied by the scoped Lightsail IAM identity. No access key or secret is stored in this database.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refreshStatus()} disabled={statusLoading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${statusLoading ? "animate-spin" : ""}`} /> Refresh status
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatusItem label="Runtime IAM" value={status?.configured ? "Connected" : "Not configured"} ok={status?.configured} />
          <StatusItem label="Domain identity" value={status?.verification_status || "Pending"} ok={status?.verified_for_sending} />
          <StatusItem label="DKIM" value={status?.dkim_status || "Pending"} ok={status?.dkim_status === "SUCCESS"} />
          <StatusItem label="SES account" value={status?.production_access ? "Production" : "Sandbox"} ok={status?.sending_enabled} />
        </div>

        {status?.message && <p className="mt-3 text-xs text-destructive">{status.message}</p>}
        {status?.available && (
          <p className="mt-3 text-xs text-muted-foreground">
            Region {status.region} · Identity {status.identity} · Sent {status.sent_last_24_hours || 0} of {status.max_24_hour_send || 0} in the last 24 hours · Maximum {status.max_send_rate || 0}/second
          </p>
        )}
      </section>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !providers?.length ? (
        <div className="border border-border bg-card p-5">
          <p className="mb-3 text-sm text-muted-foreground">The AWS runtime is ready. Add its database configuration to enable transactional email.</p>
          <Button onClick={() => addAws.mutate()} disabled={addAws.isPending} className="gap-2">
            {addAws.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add Amazon SES
          </Button>
        </div>
      ) : (
        providers.map((provider) => {
          const fields = edits[provider.id] || {};
          const hasChanges = Object.keys(fields).length > 0;
          return (
            <section key={provider.id} className={`mb-4 border bg-card p-5 ${provider.is_active ? "border-primary/40" : "border-border"}`}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center bg-primary/10 text-primary"><Cloud className="h-5 w-5" /></span>
                  <div>
                    <h3 className="font-semibold">{provider.display_name}</h3>
                    <p className="text-xs text-muted-foreground">{provider.region || status?.region} · IAM runtime credentials</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={status?.available ? "border-emerald-300 text-emerald-700" : "border-amber-300 text-amber-700"}>
                    {status?.available ? "AWS reachable" : "Needs verification"}
                  </Badge>
                  <Switch checked={provider.is_active} onCheckedChange={(next) => setActive.mutate({ provider, next })} aria-label="Activate Amazon SES" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor={`from-email-${provider.id}`}>From email</label>
                  <Input id={`from-email-${provider.id}`} value={String(fields.from_email ?? provider.from_email ?? "")} onChange={(event) => setField(provider.id, "from_email", event.target.value)} placeholder="noreply@dekhocampus.com" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor={`from-name-${provider.id}`}>From name</label>
                  <Input id={`from-name-${provider.id}`} value={String(fields.from_name ?? provider.from_name ?? "")} onChange={(event) => setField(provider.id, "from_name", event.target.value)} placeholder="DekhoCampus" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor={`reply-to-${provider.id}`}>Reply-To email</label>
                  <Input id={`reply-to-${provider.id}`} value={String(fields.reply_to ?? provider.reply_to ?? "")} onChange={(event) => setField(provider.id, "reply_to", event.target.value)} placeholder="support@dekhocampus.com" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Credential source</label>
                  <div className="mt-1 flex h-10 items-center gap-2 border border-border bg-muted/30 px-3 text-sm">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" /> Scoped AWS IAM runtime identity
                  </div>
                </div>
              </div>

              {hasChanges && (
                <div className="mt-3 flex justify-end">
                  <Button size="sm" onClick={() => {
                    save.mutate({ id: provider.id, updates: fields });
                    setEdits((current) => ({ ...current, [provider.id]: {} }));
                  }} disabled={save.isPending}>
                    <Save className="mr-1 h-4 w-4" /> Save changes
                  </Button>
                </div>
              )}
            </section>
          );
        })
      )}

      <section className="border border-border bg-card p-5">
        <h3 className="font-semibold">Send a test email</h3>
        <p className="mb-3 text-xs text-muted-foreground">SES sandbox accounts can send only to verified recipients. Every attempt is recorded in the email delivery log.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input type="email" value={testTo} onChange={(event) => setTestTo(event.target.value)} placeholder="verified-recipient@example.com" />
          <Button onClick={() => sendTest.mutate()} disabled={sendTest.isPending || !status?.active} className="gap-2 sm:shrink-0">
            {sendTest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send test
          </Button>
        </div>
      </section>
    </AdminLayout>
  );
}

function StatusItem({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="border border-border/80 bg-background px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${ok ? "text-emerald-700" : "text-amber-700"}`}>{value}</p>
    </div>
  );
}
