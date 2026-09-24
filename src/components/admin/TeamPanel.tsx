import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Mail, Phone, EyeOff, Eye, X, CheckCircle2, Clock, LogIn } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AddTeamMemberDialog } from "./AddTeamMemberDialog";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  content_head: "Content Head",
  content: "Content Editor",
  content_writer: "Content Writer",
  editor: "Editor",
  contributor: "Contributor",
  lead_push: "Lead Push Only",
};

export function TeamPanel({ onOpenAsUser }: { onOpenAsUser?: (invite: any) => void }) {
  const qc = useQueryClient();
  const [viewingInvite, setViewingInvite] = useState<any | null>(null);
  const { data: invites = [], isLoading } = useQuery({
    queryKey: ["team_invites"],
    queryFn: async () => {
      const { data, error } = await (backendClient as any)
        .from("team_invites")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const revoke = async (id: string) => {
    if (!confirm("Revoke this team member? They will lose admin-panel access on next login.")) return;
    const invite = invites.find((item: any) => item.id === id);
    const { error } = invite?.role === "content_writer"
      ? await backendClient.functions.invoke("admin-users", { method: "POST", body: { action: "revoke_writer", invite_id: id } })
      : await (backendClient as any).from("team_invites").update({ status: "revoked" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Revoked");
    qc.invalidateQueries({ queryKey: ["team_invites"] });
  };

  const setWriterPublish = async (id: string, directPublish: boolean) => {
    const { error } = await backendClient.functions.invoke("admin-users", {
      method: "POST", body: { action: "set_writer_publish", invite_id: id, direct_publish: directPublish },
    });
    if (error) return toast.error(error.message);
    toast.success(directPublish ? "Direct publishing enabled. Writer should sign in again to refresh the editor." : "Approval required for new submissions.");
    qc.invalidateQueries({ queryKey: ["team_invites"] });
  };

  const reactivate = async (id: string) => {
    const { error } = await (backendClient as any)
      .from("team_invites")
      .update({ status: "pending", accepted_user_id: null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Re-activated. They'll get access on next sign-in.");
    qc.invalidateQueries({ queryKey: ["team_invites"] });
  };

  const pending = invites.filter((i: any) => i.status === "pending");
  const accepted = invites.filter((i: any) => i.status === "accepted");

  return (
    <Card className="mb-6 border-primary/30">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Team Dekhocampus
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pre-approved teammates. Add an email or mobile here - when they sign in with that ID, they'll automatically get admin-panel access with the role &amp; permissions you set.
            </p>
          </div>
          <AddTeamMemberDialog onSaved={() => qc.invalidateQueries({ queryKey: ["team_invites"] })} />
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-4">Loading team…</div>
        ) : invites.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4">No teammates yet. Click "Add Teammate" to invite the first one.</div>
        ) : (
          <div className="space-y-4">
            {accepted.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Active ({accepted.length})</div>
                <div className="grid gap-2">
                  {accepted.map((i: any) => <Row key={i.id} invite={i} onInspect={() => setViewingInvite(i)} onOpenAsUser={onOpenAsUser && i.accepted_user_id ? () => onOpenAsUser(i) : undefined} onRevoke={() => revoke(i.id)} onSetWriterPublish={(value) => setWriterPublish(i.id, value)} />)}
                </div>
              </div>
            )}
            {pending.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Pending sign-in ({pending.length})</div>
                <div className="grid gap-2">
                  {pending.map((i: any) => <Row key={i.id} invite={i} onInspect={() => setViewingInvite(i)} onRevoke={() => revoke(i.id)} onSetWriterPublish={(value) => setWriterPublish(i.id, value)} />)}
                </div>
              </div>
            )}
            {invites.filter((i: any) => i.status === "revoked").length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Revoked</div>
                <div className="grid gap-2">
                  {invites.filter((i: any) => i.status === "revoked").map((i: any) => (
                    <Row key={i.id} invite={i} onInspect={() => setViewingInvite(i)} onReactivate={() => reactivate(i.id)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <Dialog open={Boolean(viewingInvite)} onOpenChange={(open) => { if (!open) setViewingInvite(null); }}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{viewingInvite?.display_name || viewingInvite?.phone || viewingInvite?.email || "Team access"}</DialogTitle>
              <DialogDescription>Read-only access inspection. This does not sign you in as the teammate.</DialogDescription>
            </DialogHeader>
            {viewingInvite && <div className="space-y-3 text-sm">
              <p><span className="text-muted-foreground">Status:</span> {viewingInvite.status === "pending" ? "Awaiting first sign-in" : viewingInvite.status}</p>
              <p><span className="text-muted-foreground">Role:</span> {ROLE_LABEL[viewingInvite.role] || viewingInvite.role}</p>
              <p><span className="text-muted-foreground">Phone:</span> {viewingInvite.phone || "Not provided"}</p>
              <p><span className="text-muted-foreground">Email:</span> {viewingInvite.email || "Not provided"}</p>
              {viewingInvite.accepted_user_id && <p><span className="text-muted-foreground">Linked user ID:</span> <span className="break-all font-mono text-xs">{viewingInvite.accepted_user_id}</span></p>}
              {viewingInvite.status === "pending" && <p className="rounded-lg bg-muted p-3 text-xs">The account profile does not exist yet. The listed permissions activate when this phone or email signs in.</p>}
              <div><p className="mb-2 font-semibold">Configured permissions</p><div className="space-y-2">{(viewingInvite.permissions || []).map((permission: any, index: number) => <div key={`${permission.resource}-${index}`} className="rounded-lg border px-3 py-2">
                <span className="font-medium">{permission.resource}</span><span className="ml-2 text-xs text-muted-foreground">{[permission.can_view && "view", permission.can_create && "create", permission.can_edit && "edit", permission.can_publish && "publish", permission.can_delete && "delete"].filter(Boolean).join(", ") || "none"}</span>
              </div>)}</div></div>
              {viewingInvite.role === "content_writer" && <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">Also includes creating short links for review and editing only their own public writer profile. Existing content and links cannot be edited or deleted.</p>}
            </div>}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function Row({ invite, onInspect, onOpenAsUser, onRevoke, onReactivate, onSetWriterPublish }: { invite: any; onInspect?: () => void; onOpenAsUser?: () => void; onRevoke?: () => void; onReactivate?: () => void; onSetWriterPublish?: (value: boolean) => void }) {
  const directPublish = Array.isArray(invite.permissions) && invite.permissions.some((permission: any) => permission?.can_publish === true);
  return (
    <div className="border border-border rounded-lg p-3 flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-3 min-w-0">
        <div className="font-medium text-sm">{invite.display_name || invite.email || invite.phone}</div>
        <Badge variant={invite.role === "admin" ? "default" : "secondary"} className="text-[10px]">
          {ROLE_LABEL[invite.role] || invite.role}
        </Badge>
        {invite.mask_leads ? (
          <Badge variant="outline" className="text-[10px] gap-1"><EyeOff className="w-3 h-3" /> Masked leads</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] gap-1"><Eye className="w-3 h-3" /> Full leads</Badge>
        )}
        {invite.status === "accepted" && <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 border gap-1"><CheckCircle2 className="w-3 h-3" />Active</Badge>}
        {invite.status === "pending" && <Badge variant="outline" className="text-[10px] gap-1"><Clock className="w-3 h-3" />Awaiting sign-in</Badge>}
        {invite.status === "revoked" && <Badge variant="destructive" className="text-[10px]">Revoked</Badge>}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {onOpenAsUser && <Button size="icon" variant="outline" className="h-7 w-7" title="Open this account for testing" aria-label={`Open account as ${invite.display_name || invite.phone || invite.email || "teammate"}`} onClick={onOpenAsUser}><LogIn className="h-3.5 w-3.5" /></Button>}
        {onInspect && <Button size="icon" variant="ghost" className="h-7 w-7" title="View profile and access (read-only)" aria-label={`View access for ${invite.display_name || invite.phone || invite.email || "teammate"}`} onClick={onInspect}><Eye className="h-3.5 w-3.5" /></Button>}
        {invite.role === "content_writer" && invite.status !== "revoked" && onSetWriterPublish && (
          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => onSetWriterPublish(!directPublish)}>
            {directPublish ? "Direct publish: On" : "Approval required: On"}
          </Button>
        )}
        {invite.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{invite.email}</span>}
        {invite.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{invite.phone}</span>}
        {invite.permissions?.length > 0 && <span>+{invite.permissions.length} custom perms</span>}
        {invite.status !== "revoked" && onRevoke && (
          <Button size="sm" variant="ghost" className="h-7 text-[10px] text-destructive" onClick={onRevoke}>
            <X className="w-3 h-3 mr-1" /> Revoke
          </Button>
        )}
        {invite.status === "revoked" && onReactivate && (
          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={onReactivate}>
            Re-activate
          </Button>
        )}
      </div>
    </div>
  );
}
