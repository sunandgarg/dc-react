import { randomUUID } from "node:crypto";
import { prisma } from "../src/db.mjs";

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
  console.log(JSON.stringify({ configured: integrations.map(([key]) => key) }));
} finally {
  await prisma.$disconnect();
}
