import { useState } from "react";
import { ProfessionalAvatar } from "@/components/ProfessionalAvatar";
import { safeHttpUrl } from "@/lib/safeExternalUrl";

export type AuthorAvatarStyle = "illustration" | "illustration_f" | "illustration_m" | "emoji" | "photo";
export const AUTHOR_AVATAR_EMOJIS = ["✍️", "📚", "📝", "🎓", "💡", "🧠", "📖", "🌟"] as const;

// These are the first names of the current writers who use the masculine portrait.
// Name-based guesses are imperfect, so authors can override the illustration in their profile.
const masculineWriterNames = new Set(["aman", "arjun", "karthik", "ritwik", "rohan", "vivek"]);
export function authorPortraitGender(name: string, avatarStyle?: string | null): "female" | "male" {
  if (avatarStyle === "illustration_m") return "male";
  if (avatarStyle === "illustration_f") return "female";
  return masculineWriterNames.has(name.trim().split(/\s+/)[0]?.toLocaleLowerCase("en-IN") || "") ? "male" : "female";
}

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
  return <ProfessionalAvatar variant="author" gender={authorPortraitGender(name, avatarStyle)} className={className} />;
}
