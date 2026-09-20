#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const AWS_PUBLIC_PREFIX = "https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/";

const FIELD_BY_KIND = {
  hero: "heroImage",
  logo: "instituteLogo",
  certificate: "certificateImage",
};

// These source assets failed manual quality or semantic review. They remain in
// the upload archive, but must not replace the corresponding database fallback.
const EXCLUDED_FIELDS = new Map([
  [
    "advanced-general-management-program-from-imt-ghaziabad-imt-ghaziabad",
    new Set(["heroImage", "certificateImage"]),
  ],
  [
    "generative-ai-mastery-certificate-for-content-creation-microsoft",
    new Set(["heroImage"]),
  ],
  [
    "generative-ai-mastery-certificate-for-managerial-excellence-microsoft",
    new Set(["heroImage"]),
  ],
]);

function fail(message) {
  throw new Error(`[upgrad-program-media] ${message}`);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`Could not read ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseArgs(argv) {
  const options = {
    check: false,
    verifyRemote: false,
    plan: resolve(REPO_ROOT, "../upgrad-sync/upgrad-media-upload-plan.json"),
    uploads: resolve(REPO_ROOT, "scripts/upgrad-media-browser-upload-map.json"),
    output: resolve(REPO_ROOT, "src/lib/upgradProgramMedia.generated.ts"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--check") {
      options.check = true;
      continue;
    }
    if (argument === "--verify-remote") {
      options.verifyRemote = true;
      continue;
    }
    if (["--plan", "--uploads", "--output"].includes(argument)) {
      const value = argv[index + 1];
      if (!value) fail(`${argument} requires a path`);
      options[argument.slice(2)] = resolve(process.cwd(), value);
      index += 1;
      continue;
    }
    fail(`Unknown argument: ${argument}`);
  }

  return options;
}

async function verifyRemoteUploads(uploadedUrlBySha) {
  const pending = [...uploadedUrlBySha.entries()];
  const failures = [];
  const workerCount = Math.min(8, pending.length);

  async function verifyNext() {
    while (pending.length > 0) {
      const [sha256, publicUrl] = pending.shift();
      try {
        const response = await fetch(publicUrl, { redirect: "follow" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        const remoteSha256 = createHash("sha256").update(bytes).digest("hex");
        if (remoteSha256 !== sha256) {
          throw new Error(`SHA-256 mismatch (expected ${sha256}, received ${remoteSha256})`);
        }
      } catch (error) {
        failures.push(`${publicUrl}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => verifyNext()));
  if (failures.length > 0) fail(`Remote verification failed:\n${failures.join("\n")}`);
}

function validateInputs(plan, uploads) {
  if (plan?.schema_version !== 1 || !Array.isArray(plan.assets) || !Array.isArray(plan.programmes)) {
    fail("Upload plan has an unsupported schema");
  }
  if (uploads?.schema_version !== 1 || !Array.isArray(uploads.assets)) {
    fail("Browser upload map has an unsupported schema");
  }

  const planAssetsBySha = new Map();
  for (const asset of plan.assets) {
    if (!/^[a-f0-9]{64}$/.test(asset.sha256)) fail(`Invalid plan SHA-256: ${asset.sha256}`);
    if (!Object.hasOwn(FIELD_BY_KIND, asset.kind)) fail(`Unsupported media kind: ${asset.kind}`);
    if (planAssetsBySha.has(asset.sha256)) fail(`Duplicate plan SHA-256: ${asset.sha256}`);
    planAssetsBySha.set(asset.sha256, asset);
  }

  const uploadedUrlBySha = new Map();
  const seenUrls = new Set();
  for (const uploaded of uploads.assets) {
    const prefix = uploaded.sha256_prefix;
    const publicUrl = uploaded.public_url;
    if (!/^[a-f0-9]{16}$/.test(prefix)) fail(`Invalid upload SHA prefix: ${prefix}`);
    if (typeof publicUrl !== "string" || !publicUrl.startsWith(AWS_PUBLIC_PREFIX)) {
      fail(`Non-AWS programme media URL: ${publicUrl}`);
    }
    if (seenUrls.has(publicUrl)) fail(`Duplicate uploaded URL: ${publicUrl}`);
    seenUrls.add(publicUrl);

    const matches = [...planAssetsBySha.keys()].filter((sha256) => sha256.startsWith(prefix));
    if (matches.length !== 1) {
      fail(`SHA prefix ${prefix} matched ${matches.length} plan assets; expected exactly one`);
    }
    const [sha256] = matches;
    if (uploadedUrlBySha.has(sha256)) fail(`Duplicate upload mapping for ${sha256}`);
    uploadedUrlBySha.set(sha256, publicUrl);
  }

  const missingUploads = [...planAssetsBySha.keys()].filter((sha256) => !uploadedUrlBySha.has(sha256));
  if (missingUploads.length > 0) {
    fail(`${missingUploads.length} planned assets have no browser-upload URL: ${missingUploads.join(", ")}`);
  }
  if (uploadedUrlBySha.size !== planAssetsBySha.size) {
    fail(`Upload count ${uploadedUrlBySha.size} does not match plan count ${planAssetsBySha.size}`);
  }

  return { planAssetsBySha, uploadedUrlBySha };
}

function buildProgrammeMap(plan, planAssetsBySha, uploadedUrlBySha) {
  const programmes = {};
  const sortedProgrammes = [...plan.programmes].sort((left, right) => left.slug.localeCompare(right.slug));

  for (const programme of sortedProgrammes) {
    if (typeof programme.slug !== "string" || !programme.slug) fail("Programme is missing a slug");
    if (Object.hasOwn(programmes, programme.slug)) fail(`Duplicate programme slug: ${programme.slug}`);

    const output = {};
    const excluded = EXCLUDED_FIELDS.get(programme.slug) ?? new Set();
    for (const [kind, field] of Object.entries(FIELD_BY_KIND)) {
      const media = programme.media?.[kind];
      if (!media || excluded.has(field)) continue;

      const plannedAsset = planAssetsBySha.get(media.sha256);
      if (!plannedAsset) fail(`${programme.slug} ${kind} references an unknown SHA-256`);
      if (plannedAsset.kind !== kind) {
        fail(`${programme.slug} ${kind} references a ${plannedAsset.kind} plan asset`);
      }

      const uploadedUrl = uploadedUrlBySha.get(media.sha256);
      if (!uploadedUrl) fail(`${programme.slug} ${kind} has not been uploaded`);
      output[field] = uploadedUrl;
    }

    programmes[programme.slug] = output;
  }

  return programmes;
}

function renderTypeScript(programmes, plan, uploads) {
  const lines = [
    "/**",
    " * AUTO-GENERATED by scripts/generate-upgrad-program-media-map.mjs.",
    " * Do not hand-edit: update the audited upload plan/map and regenerate.",
    ` * Plan generated: ${plan.generated_at}`,
    ` * Browser upload completed: ${uploads.uploaded_at}`,
    " */",
    "export type UpgradProgramMedia = Readonly<{",
    "  heroImage?: string;",
    "  instituteLogo?: string;",
    "  certificateImage?: string;",
    "}>;",
    "",
    "export const UPGRAD_PROGRAM_MEDIA = {",
  ];

  for (const [slug, media] of Object.entries(programmes)) {
    lines.push(`  ${JSON.stringify(slug)}: {`);
    for (const field of ["heroImage", "instituteLogo", "certificateImage"]) {
      if (media[field]) lines.push(`    ${field}: ${JSON.stringify(media[field])},`);
    }
    lines.push("  },");
  }

  lines.push(
    "} as const satisfies Readonly<Record<string, UpgradProgramMedia>>;",
  );
  return `${lines.join("\n")}\n`;
}

const options = parseArgs(process.argv.slice(2));
const plan = readJson(options.plan);
const uploads = readJson(options.uploads);
const { planAssetsBySha, uploadedUrlBySha } = validateInputs(plan, uploads);
if (options.verifyRemote) await verifyRemoteUploads(uploadedUrlBySha);
const programmes = buildProgrammeMap(plan, planAssetsBySha, uploadedUrlBySha);
const generated = renderTypeScript(programmes, plan, uploads);

if (options.check) {
  const existing = readFileSync(options.output, "utf8");
  if (existing !== generated) fail(`${options.output} is stale; regenerate it`);
  console.log(`Validated ${Object.keys(programmes).length} programmes and ${uploadedUrlBySha.size} AWS assets.`);
} else {
  writeFileSync(options.output, generated);
  console.log(`Generated ${options.output} with ${Object.keys(programmes).length} programmes.`);
}
