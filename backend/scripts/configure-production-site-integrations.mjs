import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { DEFAULT_BLOG_COVER_TEMPLATE_KEY } from "../src/blog-ai.mjs";
import { prisma } from "../src/db.mjs";
import { uploadStorageObject } from "../src/storage.mjs";

const integrations = [
  ["ga4_measurement_id", "Google Analytics 4 Measurement ID", "analytics", "G-Y8E5HHTXLX"],
  ["gtm_container_id", "Google Tag Manager Container ID", "analytics", "GTM-5PF56SJF"],
  ["gsc_verification", "Google Search Console Verification", "seo", "3DDCGwQFHjNYmfDh2mU98784SkP9Qnoe5biD8wpA0Zk"],
  ["ms_clarity_id", "Microsoft Clarity Project ID", "analytics", "y9bvg8jdmr"],
  ["facebook_pixel_id", "Meta Pixel / Dataset ID", "analytics", "28062999866677764"],
];

try {
  for (const [key, label, category, value] of integrations) {
    const updated = await prisma.site_integrations.updateMany({ where: { key }, data: { label, category, value, enabled: true, notes: "Production tracking configuration", updated_at: new Date() } });
    if (!updated.count) {
      await prisma.site_integrations.create({ data: { id: randomUUID(), key, label, category, value, enabled: true, notes: "Production tracking configuration" } });
    }
  }
  const templateBytes = await readFile(new URL("../assets/dekhocampus-blog-cover-template-v1.png", import.meta.url));
  const templatePath = DEFAULT_BLOG_COVER_TEMPLATE_KEY.replace(/^admin-uploads\//, "");
  const template = await uploadStorageObject("admin-uploads", templatePath, templateBytes, "image/png", {
    upsert: true,
    cacheControl: "public,max-age=31536000,immutable",
  });
  const updated = await prisma.blog_auto_agent_settings.updateMany({
    where: { id: "default" },
    data: {
      image_mode: "template",
      image_template_url: DEFAULT_BLOG_COVER_TEMPLATE_KEY,
      include_logo: false,
      image_aspect_ratio: "16:9",
      output_resolution: "web",
      updated_at: new Date(),
    },
  });
  if (updated.count !== 1) throw new Error("Auto Blog Agent default settings are missing");
  const providerSettings = await prisma.blog_ai_provider_settings.updateMany({
    where: { id: "default" },
    data: { image_quality: "low", updated_at: new Date() },
  });

  console.log(JSON.stringify({
    configured: integrations.map(([key]) => key),
    blog_cover_template: template.publicUrl,
    blog_cover_settings_updated: updated.count,
    low_cost_image_quality_updated: providerSettings.count,
  }));
} finally {
  await prisma.$disconnect();
}
