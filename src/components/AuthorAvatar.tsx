import { useState } from "react";
import { ProfessionalAvatar } from "@/components/ProfessionalAvatar";
import { safeHttpUrl } from "@/lib/safeExternalUrl";

export type AuthorAvatarStyle = "illustration" | "emoji" | "photo";
export const AUTHOR_AVATAR_EMOJIS = ["✍️", "📚", "📝", "🎓", "💡", "🧠", "📖", "🌟"] as const;

export function AuthorAvatar({
  name,
  photo,
  avatarStyle = "illustration",
  avatarEmoji = "✍️",
  className = "",
  size = "md",
}: {
  name: string;
  photo?: string | null;
  avatarStyle?: string | null;
  avatarEmoji?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [failedPhoto, setFailedPhoto] = useState("");
  const imageUrl = avatarStyle === "photo" ? safeHttpUrl(photo) : "";
  if (imageUrl && failedPhoto !== imageUrl) {
    return <img src={imageUrl} alt={`${name} profile photo`} loading="lazy" onError={() => setFailedPhoto(imageUrl)} className={`object-cover ${className}`} />;
  }
  if (avatarStyle === "emoji") {
    const emoji = AUTHOR_AVATAR_EMOJIS.includes(avatarEmoji as typeof AUTHOR_AVATAR_EMOJIS[number]) ? avatarEmoji : "✍️";
    const emojiSize = size === "sm" ? "text-base" : size === "lg" ? "text-6xl" : "text-3xl";
    return <span className={`inline-flex items-center justify-center bg-primary/10 text-primary ${className}`} role="img" aria-label={`${name} illustrated avatar`}><span aria-hidden="true" className={`${emojiSize} leading-none`}>{emoji}</span></span>;
  }
  return <ProfessionalAvatar variant="author" seed={name} className={className} />;
}
