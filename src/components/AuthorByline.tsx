import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { backendClient } from "@/integrations/backend/client";
import { AuthorAvatar } from "@/components/AuthorAvatar";

interface Props {
  authorId?: string | null;
  fallbackName?: string;
  className?: string;
}

/** Compact "Written by ..." byline strip. Renders nothing when no author resolved. */
export function AuthorByline({ authorId, fallbackName, className = "" }: Props) {
  const [a, setA] = useState<{ name: string; slug: string; photo: string; avatar_style: string; avatar_emoji: string; designation: string } | null>(null);

  useEffect(() => {
    if (!authorId) { setA(null); return; }
    (backendClient as any)
      .from("authors")
      .select("name,slug,photo,avatar_style,avatar_emoji,designation")
      .eq("id", authorId)
      .maybeSingle()
      .then(({ data }: any) => setA(data || null));
  }, [authorId]);

  if (!a && !fallbackName) return null;

  if (!a && fallbackName) {
    return (
      <div className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
        <AuthorAvatar name={fallbackName} size="sm" className="w-6 h-6 rounded-full overflow-hidden" />
        <span>Written by <span className="font-medium text-foreground">{fallbackName}</span></span>
      </div>
    );
  }

  return (
    <Link to={`/author/${a!.slug}`} className={`inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition ${className}`}>
      <AuthorAvatar name={a!.name} photo={a!.photo} avatarStyle={a!.avatar_style} avatarEmoji={a!.avatar_emoji} size="sm" className="w-6 h-6 shrink-0 rounded-full overflow-hidden" />
      <span>Written by <span className="font-medium text-foreground">{a!.name}</span>{a!.designation ? <span className="hidden sm:inline"> · {a!.designation}</span> : null}</span>
    </Link>
  );
}
