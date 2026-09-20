import { createHash } from "node:crypto";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const outputDirectory = path.resolve("public/assets/programs/iit-iim");

const sources = {
  iiitbCampus: "https://d2o2utebsixu4k.cloudfront.net/iiitb88kb-f8d61d56e3494e5eaaa1d7415cc16416.jpg",
  iiitbLogo: "https://d2o2utebsixu4k.cloudfront.net/upgrad/new-home/svg/IITB.svg",
  iimuCampus: "https://d2o2utebsixu4k.cloudfront.net/IIMU-54f0327a9e444ac2995ef59299bb530c.jpeg",
  iimuLogo: "https://d2o2utebsixu4k.cloudfront.net/iimu-f708c7282c2e4b0aac4d7da6f22b03c9.svg",
  jointLogo: "https://d2o2utebsixu4k.cloudfront.net/IIMUIIITBDualLogo-a584d4832cfe4bad8aadcc52d39db7bc.svg",
  iitKgpCampus: "https://d2o2utebsixu4k.cloudfront.net/IIT_Kgp_BannerImage%20(1)-18caa86765264137baec6895146b1b10.jpg",
  iitKgpLogo: "https://d2o2utebsixu4k.cloudfront.net/Logo%20(6)%20(2)-db0b6f38da9c485faf76e366793c9b9e.webp",
  iimkCampus: "https://d2o2utebsixu4k.cloudfront.net/IIM_Kohzikode%20(1)-513637d1698243679071f07ef23d434f.webp",
  iimkAiHero: "https://d2o2utebsixu4k.cloudfront.net/1)%20Home%20Section-Desk-2bfec94895714b648627f05bec74dd48-fe15e06da3af4027a4f1a1433ded3b96.webp",
  iimkLogo: "https://d2o2utebsixu4k.cloudfront.net/HRM-IIMK_Banner_IIMKlogo_Desktop-b75d34307bbe47049aecaccf9cff2e1d.svg",
  iimBangaloreHero: "https://d2o2utebsixu4k.cloudfront.net/IIMB-hero-banner_550x572-rename-c0ae086fa86e43f3a8d1c22eb906f3d1.webp",
  iimBangaloreLogo: "https://d2o2utebsixu4k.cloudfront.net/HRM%20EPGP%20-%20LIBA_WhomWillYouLearnFrom%20_IIMBLogo_Desktop-c4583c3894d04aebb58c5a3a92a09076.svg",
  ljmuHero: "https://d2o2utebsixu4k.cloudfront.net/LBS%20Banner-32954befb8fd43e9be8a2488eac7c802.webp",
  ljmuLogo: "https://d2o2utebsixu4k.cloudfront.net/upgrad/new-home/svg/Liverpool+John+Moores.svg",
  psbHero: "https://d2o2utebsixu4k.cloudfront.net/PSB-banner-image1-f53f3992fd414e59baca56bff4bec4fd.webp",
  psbLogo: "https://d2o2utebsixu4k.cloudfront.net/PSB_Final_Logo-c1ab6386c0c74c74af5bfb3ca095de3c.svg",
  iimLucknowLogo: "https://d2o2utebsixu4k.cloudfront.net/IIML%20SCMUT-45d149f519f84fab9314204c3cd038a4.svg",
};

const iiitbSlugs = [
  "executive-post-graduate-programme-in-applied-ai-and-agentic-ai-iiit-bangalore",
  "professional-certificate-programme-in-data-science-and-agentic-ai-iiit-bangalore",
  "executive-programme-in-generative-ai-and-agentic-ai-for-leaders-iiit-bangalore",
  "executive-diploma-in-machine-learning-and-ai-iiit-bangalore",
  "executive-diploma-in-ds-and-ai-the-international-institute-of-information-technology-bangalore",
  "executive-post-graduate-certificate-in-data-science-and-ai-iiit-bangalore",
];

const programmes = Object.fromEntries(iiitbSlugs.map((slug) => [slug, {
  hero: sources.iiitbCampus,
  logo: sources.iiitbLogo,
}]));

Object.assign(programmes, {
  "chief-technology-officer-and-ai-leadership-programme-iiit-b-and-iim-udaipur": {
    splitHero: [sources.iiitbCampus, sources.iimuCampus],
    logo: sources.jointLogo,
  },
  "chief-data-and-ai-officer-program-iiit-b-and-iim-udaipur": {
    splitHero: [sources.iiitbCampus, sources.iimuCampus],
    logo: sources.jointLogo,
  },
  "executive-post-graduate-certificate-in-ai-native-software-engineering-iit-kharagpur-iit-kharagpur": {
    hero: sources.iitKgpCampus,
    logo: sources.iitKgpLogo,
  },
  "executive-post-graduate-certificate-in-building-ai-products-systems-and-services-iit-kharagpur-iit-kharagpur": {
    hero: sources.iitKgpCampus,
    logo: sources.iitKgpLogo,
  },
  "professional-certificate-programme-in-ai-for-business-professionals-iim-kozhikode": {
    hero: sources.iimkAiHero,
    labeledLogo: { source: sources.iimkLogo, label: ["INDIAN INSTITUTE OF", "MANAGEMENT KOZHIKODE"] },
  },
  "professional-certification-in-hr-management-and-analytics-iim-kozhikode": {
    hero: sources.iimkCampus,
    labeledLogo: { source: sources.iimkLogo, label: ["INDIAN INSTITUTE OF", "MANAGEMENT KOZHIKODE"] },
  },
  "certificate-programme-in-general-management-for-young-leaders-ylp-from-iimb-iim-bangalore": {
    hero: sources.iimBangaloreHero,
    logo: sources.iimBangaloreLogo,
  },
  "mba-from-ljmu-with-iim-udaipur-certification-liverpool-john-moores-university": {
    hero: sources.ljmuHero,
    compositeLogo: [sources.ljmuLogo, sources.iimuLogo],
  },
  "mba-from-paris-school-of-business-with-certification-from-iim-lucknow-psb-mba-iiml-certification": {
    hero: sources.psbHero,
    compositeLogo: [sources.psbLogo, sources.iimLucknowLogo],
    compositeRightLabel: "IIM Lucknow",
  },
});

async function download(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "DekhoCampus media preparation/1.0" },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function digest(buffer) {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

async function makeHero(source) {
  const input = await download(source);
  return sharp(input, { failOn: "warning" })
    .rotate()
    .resize(1440, 900, {
      fit: "cover",
      position: sharp.strategy.attention,
      withoutEnlargement: false,
    })
    .webp({ quality: 86, smartSubsample: true, effort: 6 })
    .toBuffer();
}

async function makeSplitHero([leftSource, rightSource]) {
  const [leftInput, rightInput] = await Promise.all([
    download(leftSource),
    download(rightSource),
  ]);
  const [left, right] = await Promise.all([
    sharp(leftInput, { failOn: "warning" })
      .rotate()
      .resize(720, 900, { fit: "cover", position: sharp.strategy.attention })
      .webp({ quality: 88, smartSubsample: true, effort: 6 })
      .toBuffer(),
    sharp(rightInput, { failOn: "warning" })
      .rotate()
      .resize(720, 900, { fit: "cover", position: sharp.strategy.attention })
      .webp({ quality: 88, smartSubsample: true, effort: 6 })
      .toBuffer(),
  ]);
  return sharp({
    create: { width: 1440, height: 900, channels: 3, background: "#ffffff" },
  })
    .composite([
      { input: left, left: 0, top: 0 },
      { input: right, left: 720, top: 0 },
    ])
    .webp({ quality: 86, smartSubsample: true, effort: 6 })
    .toBuffer();
}

async function logoArtwork(source, width = 520, height = 236) {
  const input = await download(source);
  return sharp(input, { density: 240, failOn: "warning" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .trim({ background: "#ffffff", threshold: 10 })
    .resize(width, height, {
      fit: "inside",
      withoutEnlargement: false,
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
}

async function makeLogo(source) {
  const artwork = await logoArtwork(source);
  return sharp({
    create: { width: 640, height: 360, channels: 3, background: "#ffffff" },
  })
    .composite([{ input: artwork, gravity: "centre" }])
    .webp({ quality: 90, smartSubsample: true, effort: 6 })
    .toBuffer();
}

async function makeLabeledLogo({ source, label }) {
  const artwork = await logoArtwork(source, 168, 168);
  const text = Buffer.from(`<svg width="350" height="120" xmlns="http://www.w3.org/2000/svg">
    <style>.line{font-family:Arial,Helvetica,sans-serif;font-weight:700;fill:#171a21;letter-spacing:.4px}</style>
    <text x="0" y="46" class="line" font-size="25">${label[0]}</text>
    <text x="0" y="84" class="line" font-size="25">${label[1]}</text>
  </svg>`);
  return sharp({
    create: { width: 640, height: 360, channels: 3, background: "#ffffff" },
  })
    .composite([
      { input: artwork, left: 52, top: 96 },
      { input: text, left: 236, top: 120 },
    ])
    .webp({ quality: 90, smartSubsample: true, effort: 6 })
    .toBuffer();
}

async function makeCompositeLogo([leftSource, rightSource], rightLabel = "") {
  const [left, right] = await Promise.all([
    logoArtwork(leftSource, 248, 190),
    logoArtwork(rightSource, rightLabel ? 150 : 230, rightLabel ? 150 : 190),
  ]);
  const divider = Buffer.from(
    '<svg width="2" height="180" xmlns="http://www.w3.org/2000/svg"><path d="M1 0v180" stroke="#d9dde5" stroke-width="2"/></svg>',
  );
  const layers = [
    { input: left, left: 42, top: 85 },
    { input: divider, left: 319, top: 90 },
    { input: right, left: rightLabel ? 414 : 365, top: rightLabel ? 70 : 85 },
  ];
  if (rightLabel) layers.push({
    input: Buffer.from(`<svg width="250" height="56" xmlns="http://www.w3.org/2000/svg"><text x="125" y="35" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="24" font-weight="700" fill="#171a21">${rightLabel}</text></svg>`),
    left: 340,
    top: 225,
  });
  return sharp({
    create: { width: 640, height: 360, channels: 3, background: "#ffffff" },
  })
    .composite(layers)
    .webp({ quality: 90, smartSubsample: true, effort: 6 })
    .toBuffer();
}

await mkdir(outputDirectory, { recursive: true });

const sharedAssets = new Map();
async function prepared(kind, sourceKey, builder) {
  const cacheKey = `${kind}:${sourceKey}`;
  if (!sharedAssets.has(cacheKey)) {
    const buffer = await builder();
    const fileName = `${kind}-${digest(buffer)}.webp`;
    await writeFile(path.join(outputDirectory, fileName), buffer);
    sharedAssets.set(cacheKey, { fileName, bytes: buffer.length });
  }
  return sharedAssets.get(cacheKey);
}

const result = {};
for (const [slug, programme] of Object.entries(programmes)) {
  const heroKey = programme.splitHero?.join("|") ?? programme.hero;
  const hero = await prepared("hero", heroKey, () => programme.splitHero
    ? makeSplitHero(programme.splitHero)
    : makeHero(programme.hero));
  const logoKey = programme.compositeLogo?.join("|")
    ?? (programme.labeledLogo ? `${programme.labeledLogo.source}|${programme.labeledLogo.label.join("|")}` : programme.logo);
  const logo = await prepared("logo", logoKey, () => {
    if (programme.compositeLogo) return makeCompositeLogo(programme.compositeLogo, programme.compositeRightLabel);
    if (programme.labeledLogo) return makeLabeledLogo(programme.labeledLogo);
    return makeLogo(programme.logo);
  });
  result[slug] = {
    heroImage: `/assets/programs/iit-iim/${hero.fileName}`,
    instituteLogo: `/assets/programs/iit-iim/${logo.fileName}`,
  };
}

const activeFiles = new Set([...sharedAssets.values()].map(({ fileName }) => fileName));
for (const fileName of await readdir(outputDirectory)) {
  if (/^(?:hero|logo)-[a-f0-9]{16}\.webp$/.test(fileName) && !activeFiles.has(fileName)) {
    await unlink(path.join(outputDirectory, fileName));
  }
}

console.log(JSON.stringify(result, null, 2));
console.error(`Prepared ${Object.keys(result).length} programmes from ${sharedAssets.size} unique assets.`);
