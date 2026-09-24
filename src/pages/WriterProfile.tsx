import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { backendClient } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type WriterAuthor = {
  id: string; slug: string; name: string; designation: string; photo: string;
  short_bio: string; bio: string; expertise: string[];
  linkedin_url: string; twitter_url: string; website_url: string;
};

const blank = {
  name: "", designation: "Content Writer", photo: "", short_bio: "", bio: "",
  expertise: "", linkedin_url: "", twitter_url: "", website_url: "",
};

export default function WriterProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["writer-profile", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await backendClient.functions.invoke("writer-profile", { method: "GET" });
      if (error) throw error;
      return data as { author: WriterAuthor | null; suggested_name: string };
    },
  });

  useEffect(() => {
    if (!data) return;
    const author = data.author;
    setForm({
      name: author?.name || data.suggested_name || "",
      designation: author?.designation || "Content Writer",
      photo: author?.photo || "",
      short_bio: author?.short_bio || "",
      bio: author?.bio || "",
      expertise: Array.isArray(author?.expertise) ? author.expertise.join(", ") : "",
      linkedin_url: author?.linkedin_url || "",
      twitter_url: author?.twitter_url || "",
      website_url: author?.website_url || "",
    });
  }, [data]);

  const set = (key: keyof typeof blank, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!form.name.trim()) return toast.error("Enter your byline name");
    setSaving(true);
    try {
      const { error } = await backendClient.functions.invoke("writer-profile", {
        method: "POST",
        body: { ...form, expertise: form.expertise.split(",").map((item) => item.trim()).filter(Boolean) },
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["writer-profile", user?.id] });
      toast.success("Your writer profile is saved. New submissions will use this byline automatically.");
    } catch (error: any) {
      toast.error(error?.message || "Could not save your profile");
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (file?: File) => {
    if (!file || !user) return;
    if (!/^(image\/jpeg|image\/png|image\/webp)$/.test(file.type) || file.size > 3 * 1024 * 1024) {
      return toast.error("Use a JPG, PNG or WebP under 3 MB");
    }
    setUploading(true);
    try {
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `writer-profiles/${user.id}/${Date.now()}.${extension}`;
      const { error } = await backendClient.storage.from("admin-uploads").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      set("photo", backendClient.storage.from("admin-uploads").getPublicUrl(path).data.publicUrl);
      toast.success("Photo uploaded. Save your profile to apply it.");
    } catch (error: any) {
      toast.error(error?.message || "Photo upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <AdminLayout title="My Writer Profile">
      <div className="max-w-3xl space-y-5 rounded-2xl border bg-card p-5 sm:p-7">
        <div>
          <h2 className="text-xl font-bold">Your public byline</h2>
          <p className="mt-1 text-sm text-muted-foreground">Only this account can edit this writer profile. Your user ID is attached to new articles, colleges, courses and exams automatically.</p>
        </div>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading profile…</p> : <>
          {data?.author?.slug && <a className="text-sm text-primary underline" href={`/author/${data.author.slug}`} target="_blank" rel="noreferrer">View public author page</a>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="writer-name">Byline name</Label><Input id="writer-name" value={form.name} onChange={(event) => set("name", event.target.value)} maxLength={120} /></div>
            <div><Label htmlFor="writer-designation">Designation</Label><Input id="writer-designation" value={form.designation} onChange={(event) => set("designation", event.target.value)} maxLength={120} /></div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="writer-photo">Profile photo</Label>
            <div className="flex flex-wrap items-center gap-3">
              {form.photo && <img src={form.photo} alt="Your writer profile" className="h-16 w-16 rounded-full object-cover" />}
              <Input id="writer-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadPhoto(event.target.files?.[0])} disabled={uploading} className="max-w-xs" />
            </div>
          </div>
          <div><Label htmlFor="writer-short-bio">Short bio</Label><textarea id="writer-short-bio" value={form.short_bio} onChange={(event) => set("short_bio", event.target.value)} maxLength={400} rows={2} className="w-full rounded-md border bg-background p-3 text-sm" /></div>
          <div><Label htmlFor="writer-bio">Full bio</Label><textarea id="writer-bio" value={form.bio} onChange={(event) => set("bio", event.target.value)} maxLength={5000} rows={5} className="w-full rounded-md border bg-background p-3 text-sm" /></div>
          <div><Label htmlFor="writer-expertise">Expertise (comma-separated)</Label><Input id="writer-expertise" value={form.expertise} onChange={(event) => set("expertise", event.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="writer-linkedin">LinkedIn URL</Label><Input id="writer-linkedin" value={form.linkedin_url} onChange={(event) => set("linkedin_url", event.target.value)} /></div>
            <div><Label htmlFor="writer-website">Website URL</Label><Input id="writer-website" value={form.website_url} onChange={(event) => set("website_url", event.target.value)} /></div>
          </div>
          <Button onClick={() => void save()} disabled={saving || uploading}>{saving ? "Saving…" : "Save my profile"}</Button>
        </>}
      </div>
    </AdminLayout>
  );
}
