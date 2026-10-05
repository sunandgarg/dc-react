import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { backendClient } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { AUTHOR_AVATAR_EMOJIS, AuthorAvatar } from "@/components/AuthorAvatar";

type WriterAuthor = {
  id: string; slug: string; name: string; designation: string; photo: string;
  avatar_style: string; avatar_emoji: string;
  short_bio: string; bio: string; expertise: string[];
  linkedin_url: string; twitter_url: string; website_url: string;
};

const blank = {
  name: "", designation: "Content Writer", photo: "", avatar_style: "illustration", avatar_emoji: "✍️", short_bio: "", bio: "",
  expertise: "", linkedin_url: "", twitter_url: "", website_url: "",
};

export default function WriterProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery({
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
      avatar_style: author?.avatar_style || "illustration",
      avatar_emoji: author?.avatar_emoji || "✍️",
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
        {isLoading ? <p className="text-sm text-muted-foreground">Loading profile…</p> : isError ? <div role="alert" className="space-y-3"><p>Could not load your writer profile. Please retry before editing.</p><Button variant="outline" onClick={() => void refetch()}>Try again</Button></div> : <>
          <div className="flex flex-wrap gap-3">
            {data?.author?.slug && <Button asChild variant="outline"><Link to={`/author/${data.author.slug}#contributions`} target="_blank" rel="noreferrer">View my published work</Link></Button>}
            <Button asChild variant="outline"><Link to="/admin/articles">My articles and drafts</Link></Button>
          </div>
          <p className="text-xs text-muted-foreground">Your public profile includes published articles, including older posts with your byline. Drafts and submissions awaiting approval are available in Articles, not on the public profile.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="writer-name">Byline name</Label><Input id="writer-name" value={form.name} onChange={(event) => set("name", event.target.value)} maxLength={120} /></div>
            <div><Label htmlFor="writer-designation">Designation</Label><Input id="writer-designation" value={form.designation} onChange={(event) => set("designation", event.target.value)} maxLength={120} /></div>
          </div>
          <div className="space-y-3 rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <AuthorAvatar name={form.name || "Writer"} photo={form.photo} avatarStyle={form.avatar_style} avatarEmoji={form.avatar_emoji} className="h-16 w-16 shrink-0 rounded-full overflow-hidden" />
              <p className="text-sm text-muted-foreground">Choose how your byline appears publicly. Your saved photo will not show unless you select Photo.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="writer-avatar-style">Avatar style</Label>
                <select id="writer-avatar-style" value={form.avatar_style} onChange={(event) => set("avatar_style", event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="illustration">Default illustrated avatar</option>
                  <option value="illustration_f">Woman illustration</option>
                  <option value="illustration_m">Man illustration</option>
                  <option value="emoji">Emoji avatar</option>
                  <option value="photo">Profile photo</option>
                </select>
              </div>
              {form.avatar_style === "emoji" && <div><Label htmlFor="writer-avatar-emoji">Emoji</Label>
                <select id="writer-avatar-emoji" value={form.avatar_emoji} onChange={(event) => set("avatar_emoji", event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {AUTHOR_AVATAR_EMOJIS.map((emoji) => <option key={emoji} value={emoji}>{emoji}</option>)}
                </select>
              </div>}
            </div>
            {form.avatar_style === "photo" && <div className="space-y-2">
              <Label htmlFor="writer-photo">Profile photo</Label>
              <Input id="writer-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadPhoto(event.target.files?.[0])} disabled={uploading} className="max-w-xs" />
            </div>}
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
