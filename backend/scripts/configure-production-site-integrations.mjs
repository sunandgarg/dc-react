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
const BLOG_GPT_5_6_LUNA_EDITORIAL_MIGRATION_KEY = "blog_gpt_5_6_luna_editorial_policy_v1";
const BLOG_EEAT_48_MIGRATION_KEY = "blog_eeat_48_policy_v1";
const BLOG_ALL_COMPETITORS_ACTIVE_MIGRATION_KEY = "blog_all_competitors_active_v1";
const ADSENSE_REQUESTED_PLACEMENTS_MIGRATION_KEY = "adsense_requested_placements_v3";
const CONTENT_COPY_PROTECTION_MIGRATION_KEY = "content_copy_protection_v1";
const ANNOUNCEMENT_CAROUSEL_SEED_MIGRATION_KEY = "announcement_carousel_seed_v1";
const ANNOUNCEMENT_ROTATION_2_2_MIGRATION_KEY = "announcement_rotation_2_2_v1";
const ANNOUNCEMENT_GENERIC_CTA_CLEANUP_MIGRATION_KEY = "announcement_generic_cta_cleanup_v1";

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
  let lunaBlogSettingsUpdated = 0;
  let lunaProviderSettingsUpdated = 0;
  let lunaRuntimeControlsUpdated = 0;
  let providerSettingsUpdated = 0;
  let runtimeControlsUpdated = 0;
  let entitySchedulesUpdated = 0;
  let eeatCadenceUpdated = 0;
  let competitorSourcesActivated = 0;
  let adsenseUnitsSeeded = 0;
  let autoAdsDisabled = 0;
  let copyProtectionUpdated = 0;
  let announcementsSeeded = 0;
  let announcementsUpdated = 0;
  let announcementRotationUpdated = 0;
  let announcementGenericCtasCleared = 0;
  if (!editorialPolicyMigration) {
    const updated = await prisma.blog_auto_agent_settings.updateMany({
      where: { id: "default" },
      data: {
        model_provider: "openai",
        text_model: "gpt-5.6-luna",
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
        image_mode: "rotation",
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
      data: { text_model: "gpt-5.6-luna", image_quality: "low", updated_at: new Date() },
    });
    providerSettingsUpdated = providerSettings.count;
    const runtimeControls = await prisma.ai_runtime_controls.updateMany({
      where: { feature: { in: ["blog-studio", "blog-agent"] } },
      data: { provider: "openai", model: "gpt-5.6-luna", updated_at: new Date() },
    });
    runtimeControlsUpdated = runtimeControls.count;
    const entitySchedules = await prisma.entity_article_schedules.updateMany({
      data: { publish_status: "Published", human_review_required: false, updated_at: new Date() },
    });
    entitySchedulesUpdated = entitySchedules.count;
    await prisma.app_settings.create({
      data: {
        key: BLOG_EDITORIAL_POLICY_MIGRATION_KEY,
        value: JSON.stringify({ model: "gpt-5.6-luna", daily_post_cap: 8, interval_minutes: 180, applied_at: new Date().toISOString() }),
      },
    });
  }
  const lunaEditorialMigration = await prisma.app_settings.findUnique({ where: { key: BLOG_GPT_5_6_LUNA_EDITORIAL_MIGRATION_KEY } });
  if (!lunaEditorialMigration) {
    const blogSettings = await prisma.blog_auto_agent_settings.updateMany({
      data: { model_provider: "openai", text_model: "gpt-5.6-luna", updated_at: new Date() },
    });
    if (!blogSettings.count) throw new Error("Auto Blog Agent settings are missing");
    lunaBlogSettingsUpdated = blogSettings.count;

    const providerSettings = await prisma.blog_ai_provider_settings.updateMany({
      data: { text_model: "gpt-5.6-luna", updated_at: new Date() },
    });
    lunaProviderSettingsUpdated = providerSettings.count;

    const runtimeControls = await prisma.ai_runtime_controls.updateMany({
      where: { feature: { in: ["blog-studio", "blog-agent"] } },
      data: { provider: "openai", model: "gpt-5.6-luna", updated_at: new Date() },
    });
    lunaRuntimeControlsUpdated = runtimeControls.count;

    await prisma.app_settings.create({
      data: {
        key: BLOG_GPT_5_6_LUNA_EDITORIAL_MIGRATION_KEY,
        value: JSON.stringify({
          model: "gpt-5.6-luna",
          source_privacy: "strict",
          human_editorial_score_minimum: 70,
          applied_at: new Date().toISOString(),
        }),
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
    where: { key: ADSENSE_REQUESTED_PLACEMENTS_MIGRATION_KEY },
  });
  if (!adsensePlacementMigration) {
    const disabled = await prisma.adsense_settings.updateMany({
      where: { auto_ads_enabled: true },
      data: { auto_ads_enabled: false, updated_at: new Date() },
    });
    autoAdsDisabled = disabled.count;
    const sourceUnits = await prisma.ad_units.findMany({
      where: { ad_slot_id: { not: null } },
      orderBy: [{ is_active: "desc" }, { priority: "desc" }, { updated_at: "desc" }],
    });
    const sourceUnit = sourceUnits.find((unit) => unit.ad_slot_id?.trim());
    if (sourceUnit) {
      const requestedPlacements = [
        { name: "DekhoCampus Sitewide Header", placement: "header", position: "top", minHeight: 50, priority: 100, adFormat: "horizontal" },
        { name: "DekhoCampus Article Leaderboard", placement: "article", position: "top", minHeight: 50, priority: 95, adFormat: "horizontal" },
        { name: "DekhoCampus Article Midpoint", placement: "article", position: "middle", minHeight: 50, priority: 90, adFormat: "horizontal" },
        { name: "DekhoCampus Article Sidebar", placement: "article", position: "sidebar", minHeight: 250, priority: 85, adFormat: "rectangle" },
      ];
      for (const target of requestedPlacements) {
        const existing = await prisma.ad_units.findFirst({
          where: { placement: target.placement, position: target.position },
          orderBy: [{ priority: "desc" }, { updated_at: "desc" }],
        });
        const data = {
          name: target.name,
          ad_type: "display",
          placement: target.placement,
          position: target.position,
          ad_slot_id: sourceUnit.ad_slot_id,
          ad_format: target.adFormat || sourceUnit.ad_format || "auto",
          full_width_responsive: false,
          priority: target.priority,
          is_active: true,
          target_devices: ["mobile", "desktop", "tablet"],
          target_roles: [],
          target_countries: [],
          target_categories: [],
          url_pattern: null,
          min_width: null,
          min_height: target.minHeight,
          updated_at: new Date(),
        };
        if (existing) await prisma.ad_units.update({ where: { id: existing.id }, data });
        else await prisma.ad_units.create({ data });
        adsenseUnitsSeeded += 1;
      }
    }

    await prisma.app_settings.create({
      data: {
        key: ADSENSE_REQUESTED_PLACEMENTS_MIGRATION_KEY,
        value: JSON.stringify({
          placements: ["header:top", "article:top", "article:middle", "article:sidebar"],
          seeded_from_existing_unit: Boolean(sourceUnit),
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
  const announcementCarouselMigration = await prisma.app_settings.findUnique({
    where: { key: ANNOUNCEMENT_CAROUSEL_SEED_MIGRATION_KEY },
  });
  if (!announcementCarouselMigration) {
    const rotation = await prisma.site_integrations.updateMany({
      where: { key: "announcement_rotation_seconds" },
      data: {
        label: "Announcement rotation interval",
        category: "website",
        value: "2.2",
        enabled: true,
        notes: "Seconds between automatic announcement-bar changes",
        updated_at: new Date(),
      },
    });
    announcementRotationUpdated = rotation.count;
    if (!rotation.count) {
      await prisma.site_integrations.create({
        data: {
          id: randomUUID(),
          key: "announcement_rotation_seconds",
          label: "Announcement rotation interval",
          category: "website",
          value: "2.2",
          enabled: true,
          notes: "Seconds between automatic announcement-bar changes",
        },
      });
      announcementRotationUpdated = 1;
    }

    const heroBanners = await prisma.hero_banners.findMany({
      where: { is_active: true },
      orderBy: [{ display_order: "asc" }, { updated_at: "desc" }],
      take: 4,
    });
    for (const [index, banner] of heroBanners.entries()) {
      const existing = await prisma.ads.findFirst({
        where: {
          link_url: banner.link_url,
          variant: "announcement",
          position: "announcement-bar",
        },
        orderBy: { updated_at: "desc" },
      });
      const sharedData = {
        subtitle: banner.subtitle || null,
        cta_text: "",
        link_url: banner.link_url,
        image_url: null,
        variant: "announcement",
        bg_gradient: "from-slate-700 to-slate-900",
        target_type: "universal",
        target_page: null,
        target_item_slug: null,
        target_city: null,
        position: "announcement-bar",
        priority: 50 - index,
        is_active: true,
        start_date: null,
        end_date: null,
        updated_at: new Date(),
      };
      if (existing) {
        await prisma.ads.update({ where: { id: existing.id }, data: sharedData });
        announcementsUpdated += 1;
      } else {
        await prisma.ads.create({
          data: {
            title: banner.title,
            ...sharedData,
          },
        });
        announcementsSeeded += 1;
      }
    }
    await prisma.app_settings.create({
      data: {
        key: ANNOUNCEMENT_CAROUSEL_SEED_MIGRATION_KEY,
        value: JSON.stringify({
          rotation_seconds: 2.2,
          seeded: announcementsSeeded,
          updated: announcementsUpdated,
          source: "active_hero_banners",
          applied_at: new Date().toISOString(),
        }),
      },
    });
  }
  const announcementRotationMigration = await prisma.app_settings.findUnique({
    where: { key: ANNOUNCEMENT_ROTATION_2_2_MIGRATION_KEY },
  });
  if (!announcementRotationMigration) {
    const rotation = await prisma.site_integrations.updateMany({
      where: { key: "announcement_rotation_seconds" },
      data: {
        label: "Announcement rotation interval",
        category: "website",
        value: "2.2",
        enabled: true,
        notes: "Seconds between automatic announcement-bar changes",
        updated_at: new Date(),
      },
    });
    announcementRotationUpdated = Math.max(announcementRotationUpdated, rotation.count);
    if (!rotation.count) {
      await prisma.site_integrations.create({
        data: {
          id: randomUUID(),
          key: "announcement_rotation_seconds",
          label: "Announcement rotation interval",
          category: "website",
          value: "2.2",
          enabled: true,
          notes: "Seconds between automatic announcement-bar changes",
        },
      });
      announcementRotationUpdated = 1;
    }
    await prisma.app_settings.create({
      data: {
        key: ANNOUNCEMENT_ROTATION_2_2_MIGRATION_KEY,
        value: JSON.stringify({ rotation_seconds: 2.2, applied_at: new Date().toISOString() }),
      },
    });
  }
  const announcementGenericCtaCleanupMigration = await prisma.app_settings.findUnique({
    where: { key: ANNOUNCEMENT_GENERIC_CTA_CLEANUP_MIGRATION_KEY },
  });
  if (!announcementGenericCtaCleanupMigration) {
    const announcementAds = await prisma.ads.findMany({
      where: { variant: "announcement", position: "announcement-bar" },
      select: { id: true, cta_text: true },
    });
    const genericCtaIds = announcementAds
      .filter(({ cta_text }) => ["apply now", "learn more"].includes(cta_text.trim().toLowerCase()))
      .map(({ id }) => id);
    if (genericCtaIds.length) {
      const cleared = await prisma.ads.updateMany({
        where: { id: { in: genericCtaIds } },
        data: { cta_text: "", updated_at: new Date() },
      });
      announcementGenericCtasCleared = cleared.count;
    }
    await prisma.app_settings.create({
      data: {
        key: ANNOUNCEMENT_GENERIC_CTA_CLEANUP_MIGRATION_KEY,
        value: JSON.stringify({
          cleared: announcementGenericCtasCleared,
          preserved_custom_ctas: announcementAds.length - genericCtaIds.length,
          applied_at: new Date().toISOString(),
        }),
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
    blog_gpt_5_6_luna_editorial_policy_migrated: Boolean(lunaEditorialMigration) || lunaBlogSettingsUpdated > 0,
    blog_gpt_5_6_luna_settings_updated: lunaBlogSettingsUpdated,
    blog_gpt_5_6_luna_provider_settings_updated: lunaProviderSettingsUpdated,
    blog_gpt_5_6_luna_runtime_controls_updated: lunaRuntimeControlsUpdated,
    blog_cover_settings_updated: blogSettingsUpdated,
    low_cost_image_quality_updated: providerSettingsUpdated,
    openai_blog_runtime_controls_updated: runtimeControlsUpdated,
    entity_article_schedules_auto_publish_enabled: entitySchedulesUpdated,
    blog_eeat_48_policy_migrated: eeatCadenceUpdated === 1,
    blog_daily_post_cap: 48,
    blog_interval_minutes: 60,
    blog_posts_per_run: 2,
    competitor_sources_activated: competitorSourcesActivated,
    adsense_requested_placements_migrated: Boolean(adsensePlacementMigration) || adsenseUnitsSeeded > 0,
    adsense_units_seeded: adsenseUnitsSeeded,
    adsense_auto_ads_disabled: autoAdsDisabled,
    content_copy_protection_enabled: Boolean(copyProtectionMigration) || copyProtectionUpdated > 0,
    announcement_carousel_migrated: Boolean(announcementCarouselMigration) || announcementsSeeded + announcementsUpdated > 0,
    announcement_rotation_seconds: 2.2,
    announcements_seeded: announcementsSeeded,
    announcements_updated: announcementsUpdated,
    announcement_rotation_updated: announcementRotationUpdated,
    announcement_generic_ctas_cleared: announcementGenericCtasCleared,
    ses_provider_configured: true,
    ses_credential_source: "iam_runtime",
  }));
} finally {
  await prisma.$disconnect();
}
