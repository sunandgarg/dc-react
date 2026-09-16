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
const BLOG_EDITORIAL_POLICY_MIGRATION_KEY = "blog_editorial_policy_v2";
const BLOG_EEAT_48_MIGRATION_KEY = "blog_eeat_48_policy_v1";
const BLOG_ALL_COMPETITORS_ACTIVE_MIGRATION_KEY = "blog_all_competitors_active_v1";
const ADSENSE_RESTRAINED_PLACEMENTS_MIGRATION_KEY = "adsense_restrained_placements_v1";
const CONTENT_COPY_PROTECTION_MIGRATION_KEY = "content_copy_protection_v1";

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
  const editorialPolicyMigration = await prisma.app_settings.findUnique({ where: { key: BLOG_EDITORIAL_POLICY_MIGRATION_KEY } });
  let blogSettingsUpdated = 0;
  let providerSettingsUpdated = 0;
  let runtimeControlsUpdated = 0;
  let entitySchedulesUpdated = 0;
  let eeatCadenceUpdated = 0;
  let competitorSourcesActivated = 0;
  let adsenseSettingsUpdated = 0;
  let adsenseUnitsMoved = 0;
  let adsenseUnitsDisabled = 0;
  let copyProtectionUpdated = 0;
  if (!editorialPolicyMigration) {
    const updated = await prisma.blog_auto_agent_settings.updateMany({
      where: { id: "default" },
      data: {
        model_provider: "openai",
        text_model: "gpt-5.4-mini",
        interval_minutes: 180,
        posts_per_run: 1,
        daily_post_cap: 8,
        publish_status: "Published",
        word_limit: 0,
        language: "English",
        audience: "Indian students and parents",
        tone: "Clear, practical, trustworthy",
        content_goals: ["SEO", "AEO", "GEO", "LLMO"],
        required_sections: ["Answer first", "Key facts", "Decision guidance", "FAQs"],
        minimum_sources: 2,
        editorial_quality_target: 90,
        human_review_required: false,
        image_mode: "template",
        image_template_url: DEFAULT_BLOG_COVER_TEMPLATE_KEY,
        include_logo: false,
        image_aspect_ratio: "16:9",
        output_resolution: "web",
        google_trends_daily_enabled: true,
        google_trends_daily_posts: 3,
        updated_at: new Date(),
      },
    });
    if (updated.count !== 1) throw new Error("Auto Blog Agent default settings are missing");
    blogSettingsUpdated = updated.count;
    const providerSettings = await prisma.blog_ai_provider_settings.updateMany({
      where: { id: "default" },
      data: { text_model: "gpt-5.4-mini", image_quality: "low", updated_at: new Date() },
    });
    providerSettingsUpdated = providerSettings.count;
    const runtimeControls = await prisma.ai_runtime_controls.updateMany({
      where: { feature: { in: ["blog-studio", "blog-agent"] } },
      data: { provider: "openai", model: "gpt-5.4-mini", updated_at: new Date() },
    });
    runtimeControlsUpdated = runtimeControls.count;
    const entitySchedules = await prisma.entity_article_schedules.updateMany({
      data: { publish_status: "Published", human_review_required: false, updated_at: new Date() },
    });
    entitySchedulesUpdated = entitySchedules.count;
    await prisma.app_settings.create({
      data: {
        key: BLOG_EDITORIAL_POLICY_MIGRATION_KEY,
        value: JSON.stringify({ model: "gpt-5.4-mini", daily_post_cap: 8, interval_minutes: 180, applied_at: new Date().toISOString() }),
      },
    });
  }
  const eeatCadenceMigration = await prisma.app_settings.findUnique({ where: { key: BLOG_EEAT_48_MIGRATION_KEY } });
  if (!eeatCadenceMigration) {
    const updated = await prisma.blog_auto_agent_settings.updateMany({
      where: { id: "default" },
      data: {
        interval_minutes: 60,
        posts_per_run: 2,
        daily_post_cap: 48,
        content_goals: ["SEO", "AEO", "GEO", "LLMO", "E-E-A-T"],
        required_sections: ["Answer first", "Key facts", "Decision guidance", "FAQs"],
        minimum_sources: 2,
        editorial_quality_target: 90,
        publish_status: "Published",
        human_review_required: false,
        updated_at: new Date(),
      },
    });
    if (updated.count !== 1) throw new Error("Auto Blog Agent default settings are missing");
    eeatCadenceUpdated = updated.count;
    await prisma.app_settings.create({
      data: {
        key: BLOG_EEAT_48_MIGRATION_KEY,
        value: JSON.stringify({ daily_post_cap: 48, interval_minutes: 60, posts_per_run: 2, framework: "E-E-A-T", applied_at: new Date().toISOString() }),
      },
    });
  }
  const competitorActivationMigration = await prisma.app_settings.findUnique({ where: { key: BLOG_ALL_COMPETITORS_ACTIVE_MIGRATION_KEY } });
  if (!competitorActivationMigration) {
    const activated = await prisma.blog_research_sources.updateMany({
      where: { source_type: "competitor", is_active: false },
      data: { is_active: true, updated_at: new Date() },
    });
    competitorSourcesActivated = activated.count;
    await prisma.app_settings.create({
      data: {
        key: BLOG_ALL_COMPETITORS_ACTIVE_MIGRATION_KEY,
        value: JSON.stringify({ activated: activated.count, applied_at: new Date().toISOString() }),
      },
    });
  }
  const adsensePlacementMigration = await prisma.app_settings.findUnique({
    where: { key: ADSENSE_RESTRAINED_PLACEMENTS_MIGRATION_KEY },
  });
  if (!adsensePlacementMigration) {
    const settings = await prisma.adsense_settings.updateMany({
      data: {
        auto_ads_enabled: false,
        ads_per_page_limit: 1,
        lazy_load_enabled: true,
        refresh_interval_seconds: 0,
        updated_at: new Date(),
      },
    });
    adsenseSettingsUpdated = settings.count;

    const moved = await prisma.ad_units.updateMany({
      where: { placement: "homepage", position: "middle" },
      data: { position: "bottom", updated_at: new Date() },
    });
    adsenseUnitsMoved = moved.count;

    const disabled = await prisma.ad_units.updateMany({
      where: {
        is_active: true,
        NOT: {
          OR: [
            { placement: "homepage", position: "bottom" },
            { placement: "article", position: "after-content" },
          ],
        },
      },
      data: { is_active: false, updated_at: new Date() },
    });
    adsenseUnitsDisabled = disabled.count;

    await prisma.app_settings.create({
      data: {
        key: ADSENSE_RESTRAINED_PLACEMENTS_MIGRATION_KEY,
        value: JSON.stringify({
          auto_ads_enabled: false,
          ads_per_page_limit: 1,
          placements: ["homepage:bottom", "article:after-content"],
          applied_at: new Date().toISOString(),
        }),
      },
    });
  }
  const copyProtectionMigration = await prisma.app_settings.findUnique({
    where: { key: CONTENT_COPY_PROTECTION_MIGRATION_KEY },
  });
  if (!copyProtectionMigration) {
    const updated = await prisma.site_integrations.updateMany({
      where: { key: "content_copy_protection" },
      data: {
        label: "Content Copy Protection",
        category: "security",
        value: "copy_blocked",
        enabled: true,
        notes: "Public content protection; admin editors and form controls remain usable",
        updated_at: new Date(),
      },
    });
    copyProtectionUpdated = updated.count;
    if (!updated.count) {
      await prisma.site_integrations.create({
        data: {
          id: randomUUID(),
          key: "content_copy_protection",
          label: "Content Copy Protection",
          category: "security",
          value: "copy_blocked",
          enabled: true,
          notes: "Public content protection; admin editors and form controls remain usable",
        },
      });
      copyProtectionUpdated = 1;
    }
    await prisma.app_settings.create({
      data: {
        key: CONTENT_COPY_PROTECTION_MIGRATION_KEY,
        value: JSON.stringify({ enabled: true, applied_at: new Date().toISOString() }),
      },
    });
  }
  const sesProvider = {
    display_name: "Amazon SES",
    api_key: null,
    api_secret: null,
    region: process.env.SES_REGION || process.env.AWS_REGION || "ap-south-1",
    from_email: process.env.SES_FROM_EMAIL || "noreply@dekhocampus.com",
    from_name: process.env.SES_FROM_NAME || "DekhoCampus",
    reply_to: null,
    config_json: {
      credential_source: "iam_runtime",
      identity: process.env.SES_IDENTITY || "dekhocampus.com",
      mode: "transactional",
    },
    is_active: String(process.env.SES_ENABLED || "").toLowerCase() === "true",
    icon_emoji: null,
    updated_at: new Date(),
  };
  const existingSesProviders = await prisma.email_providers.findMany({
    where: { provider_name: "aws_ses" },
    select: { id: true },
    orderBy: { updated_at: "desc" },
  });
  if (existingSesProviders.length) {
    await prisma.email_providers.update({ where: { id: existingSesProviders[0].id }, data: sesProvider });
    if (existingSesProviders.length > 1) {
      await prisma.email_providers.updateMany({
        where: { id: { in: existingSesProviders.slice(1).map(({ id }) => id) } },
        data: { api_key: null, api_secret: null, is_active: false, updated_at: new Date() },
      });
    }
  } else {
    await prisma.email_providers.create({
      data: { id: randomUUID(), provider_name: "aws_ses", ...sesProvider },
    });
  }

  console.log(JSON.stringify({
    configured: integrations.map(([key]) => key),
    blog_cover_template: template.publicUrl,
    blog_editorial_policy_migrated: blogSettingsUpdated === 1,
    blog_cover_settings_updated: blogSettingsUpdated,
    low_cost_image_quality_updated: providerSettingsUpdated,
    openai_blog_runtime_controls_updated: runtimeControlsUpdated,
    entity_article_schedules_auto_publish_enabled: entitySchedulesUpdated,
    blog_eeat_48_policy_migrated: eeatCadenceUpdated === 1,
    blog_daily_post_cap: 48,
    blog_interval_minutes: 60,
    blog_posts_per_run: 2,
    competitor_sources_activated: competitorSourcesActivated,
    adsense_restrained_placements_migrated: Boolean(adsensePlacementMigration) || adsenseSettingsUpdated > 0,
    adsense_settings_updated: adsenseSettingsUpdated,
    adsense_units_moved_to_bottom: adsenseUnitsMoved,
    adsense_units_disabled: adsenseUnitsDisabled,
    content_copy_protection_enabled: Boolean(copyProtectionMigration) || copyProtectionUpdated > 0,
    ses_provider_configured: true,
    ses_credential_source: "iam_runtime",
  }));
} finally {
  await prisma.$disconnect();
}
