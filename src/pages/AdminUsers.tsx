import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";
import { AdminLayout } from "@/components/AdminLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Loader2, Phone, Mail, MapPin, Calendar, Shield, X, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { AppRole } from "@/lib/rbac";
import { PermissionEditor } from "@/components/admin/PermissionEditor";
import { TeamPanel } from "@/components/admin/TeamPanel";
import { isSyntheticPhoneEmail } from "@/lib/authIdentity";
import { DEFAULT_SITE_SCOPE } from "@/lib/siteScope";
import { normalizeIndianMobile } from "@/lib/phone";

import { CSVTools } from "@/components/CSVTools";
const ASSIGNABLE_ROLES: AppRole[] = ["admin", "manager", "content_head", "content", "editor", "contributor"];

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingUser, setSavingUser] = useState(false);
  const [deletingUser, setDeletingUser] = useState<any | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [roleBusy, setRoleBusy] = useState("");
  const qc = useQueryClient();
  const { isAdmin, user } = useAuth();

  const invokeUserAdmin = async (body: Record<string, unknown>) => {
    const { data, error } = await backendClient.functions.invoke("admin-users", { body });
    if (error) throw error;
    if ((data as any)?.error || ((data as any)?.message && !(data as any)?.success)) {
      throw new Error((data as any).message || (data as any).error);
    }
    return data as any;
  };

  const openEditUser = (target: any) => {
    setEditingUser(target);
    setEditName(target.display_name || "");
    setEditEmail(isSyntheticPhoneEmail(target.email) ? "" : (target.email || ""));
    setEditPhone(normalizeIndianMobile(target.phone || ""));
  };

  const saveUser = async () => {
    if (!editingUser) return;
    setSavingUser(true);
    try {
      await invokeUserAdmin({
        action: "update",
        user_id: editingUser.user_id,
        display_name: editName,
        email: editEmail,
        phone: editPhone,
      });
      toast.success("User details updated");
      setEditingUser(null);
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (error: any) {
      toast.error(error?.message || "Could not update the user");
    } finally {
      setSavingUser(false);
    }
  };

  const deleteUser = async () => {
    if (!deletingUser || deleteConfirmation !== "DELETE") return;
    setSavingUser(true);
    try {
      await invokeUserAdmin({ action: "delete", user_id: deletingUser.user_id, confirm_user_id: deletingUser.user_id });
      toast.success("User and active sessions deleted");
      setDeletingUser(null);
      setDeleteConfirmation("");
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (error: any) {
      toast.error(error?.message || "Could not delete the user");
    } finally {
      setSavingUser(false);
    }
  };

  const toggleRole = async (userId: string, role: AppRole, hasIt: boolean) => {
    const key = `${userId}:${role}`;
    setRoleBusy(key);
    try {
      await invokeUserAdmin({ action: "set_role", user_id: userId, role, enabled: !hasIt });
      toast.success(hasIt ? `Removed ${role}` : `Granted ${role}`);
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (error: any) {
      toast.error(error?.message || "Could not update the role");
    } finally {
      setRoleBusy("");
    }
  };

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [profilesRes, rolesRes, leadsRes, appsRes] = await Promise.all([
        backendClient.from("profiles").select("*").order("created_at", { ascending: false }),
        backendClient.from("user_roles").select("user_id, role"),
        backendClient.from("leads").select("phone, email, source, created_at").eq("site_scope", DEFAULT_SITE_SCOPE),
        backendClient.from("college_applications").select("user_id, college_name, created_at"),
      ]);

      const rolesMap = new Map<string, string[]>();
      (rolesRes.data || []).forEach((r: any) => {
        const arr = rolesMap.get(r.user_id) || [];
        arr.push(r.role);
        rolesMap.set(r.user_id, arr);
      });

      // Aggregate leads & apps per phone/user_id
      const leadCountByPhone = new Map<string, number>();
      const sourceByPhone = new Map<string, string>();
      (leadsRes.data || []).forEach((l: any) => {
        if (l.phone) {
          leadCountByPhone.set(l.phone, (leadCountByPhone.get(l.phone) || 0) + 1);
          if (!sourceByPhone.has(l.phone)) sourceByPhone.set(l.phone, l.source);
        }
      });

      const appsByUser = new Map<string, number>();
      (appsRes.data || []).forEach((a: any) => {
        if (a.user_id) appsByUser.set(a.user_id, (appsByUser.get(a.user_id) || 0) + 1);
      });

      return (profilesRes.data || []).map((p: any) => ({
        ...p,
        roles: rolesMap.get(p.user_id) || [],
        leadCount: p.phone ? (leadCountByPhone.get(p.phone) || 0) : 0,
        loginSource: isSyntheticPhoneEmail(p.email) ? "Mobile OTP" : (p.email ? "Google / Email" : "Unknown"),
        applicationCount: appsByUser.get(p.user_id) || 0,
      }));
    },
  });

  const filtered = users.filter((u: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      u.display_name?.toLowerCase().includes(s) ||
      u.email?.toLowerCase().includes(s) ||
      u.phone?.includes(s)
    );
  });

  return (
    <AdminLayout title="Users">
      <div className="mb-4">
        <CSVTools table="profiles" filename="profiles.csv" columns="*" upsertKey="user_id" />
      </div>

      {isAdmin && <TeamPanel />}
      <div className="mb-2"><h2 className="text-lg font-bold">All Users</h2><p className="text-xs text-muted-foreground">Everyone who signed up on dekhocampus. Team members appear above.</p></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold text-foreground">{users.length}</div>
          <div className="text-xs text-muted-foreground">Total Users</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold text-foreground">{users.filter((u: any) => u.loginSource === "Mobile OTP").length}</div>
          <div className="text-xs text-muted-foreground">Mobile OTP</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold text-foreground">{users.filter((u: any) => u.loginSource === "Google / Email").length}</div>
          <div className="text-xs text-muted-foreground">Google / Email</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold text-foreground">{users.filter((u: any) => u.kyc_completed).length}</div>
          <div className="text-xs text-muted-foreground">KYC Done</div>
        </CardContent></Card>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by name, email, phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.map((u: any) => (
            <Card key={u.id}>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-foreground">{u.display_name || u.phone || "Unnamed"}</h3>
                      {u.roles.map((r: string) => (
                        <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="text-[10px]">{r}</Badge>
                      ))}
                      <Badge variant="outline" className="text-[10px]">{u.loginSource}</Badge>
                      {u.user_id === user?.id && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Current session</Badge>}
                      {u.kyc_completed && <Badge className="text-[10px] bg-success">KYC ✓</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                      {u.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {u.phone}</span>}
                      {u.email && !isSyntheticPhoneEmail(u.email) && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {u.email}</span>}
                      {(u.city || u.state) && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {[u.city, u.state].filter(Boolean).join(", ")}</span>}
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(u.created_at).toLocaleDateString()}</span>
                    </div>
                    {isAdmin && (
                      <div className="mt-3 space-y-2">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground mr-1">Roles:</span>
                          {ASSIGNABLE_ROLES.map(r => {
                            const has = u.roles.includes(r);
                            return (
                              <Button key={r} size="sm" variant={has ? "default" : "outline"} className="h-6 px-2 text-[10px]"
                                disabled={roleBusy === `${u.user_id}:${r}`}
                                onClick={() => toggleRole(u.user_id, r, has)}>
                                {has && <X className="w-2.5 h-2.5 mr-0.5" />}{r}
                              </Button>
                            );
                          })}
                        </div>
                        <PermissionEditor userId={u.user_id} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex gap-4 text-center">
                      <div>
                        <div className="text-lg font-bold text-primary">{u.leadCount}</div>
                        <div className="text-[10px] text-muted-foreground">Leads</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-primary">{u.applicationCount}</div>
                        <div className="text-[10px] text-muted-foreground">Applications</div>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 border-l border-border pl-2">
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" title="Edit user" aria-label={`Edit ${u.display_name || u.phone || "user"}`} onClick={() => openEditUser(u)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" title={u.user_id === user?.id ? "You cannot delete your current account" : "Delete user"} aria-label={`Delete ${u.display_name || u.phone || "user"}`} disabled={u.user_id === user?.id} onClick={() => { setDeletingUser(u); setDeleteConfirmation(""); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => { if (!open && !savingUser) setEditingUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>Update the profile and login identity together.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="admin-user-name">Display name</Label>
              <Input id="admin-user-name" value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={120} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-user-email">Email</Label>
              <Input id="admin-user-email" type="email" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} maxLength={320} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-user-phone">Mobile number</Label>
              <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                <span className="border-r border-border px-3 text-sm text-muted-foreground">+91</span>
                <Input id="admin-user-phone" inputMode="numeric" value={editPhone} onChange={(event) => setEditPhone(normalizeIndianMobile(event.target.value))} maxLength={10} className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0" autoComplete="off" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingUser(null)} disabled={savingUser}>Cancel</Button>
            <Button type="button" onClick={saveUser} disabled={savingUser}>
              {savingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deletingUser)} onOpenChange={(open) => { if (!open && !savingUser) { setDeletingUser(null); setDeleteConfirmation(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              This removes the login, roles, permissions, active sessions, and private profile data. Public editorial and operational records are retained without the user link.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm">
              <span className="font-semibold">{deletingUser?.display_name || deletingUser?.phone || "This user"}</span> will immediately lose access on every device.
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-user-delete-confirm">Type DELETE to confirm</Label>
              <Input id="admin-user-delete-confirm" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value.toUpperCase())} autoComplete="off" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeletingUser(null)} disabled={savingUser}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={deleteUser} disabled={savingUser || deleteConfirmation !== "DELETE"}>
              {savingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
