import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { readFileSync, readdirSync } from "node:fs";

// PDF.js decoders, fonts and CMaps are self-hosted; no third-party viewer/CDN.
const pdfjsRoot = path.resolve(import.meta.dirname, "node_modules/pdfjs-dist");
const pdfjsVersion = JSON.parse(readFileSync(path.join(pdfjsRoot, "package.json"), "utf8")).version;
const pdfAssets = ["cmaps", "standard_fonts", "wasm"].flatMap(folder =>
  readdirSync(path.join(pdfjsRoot, folder)).map(file => ({ name: `assets/pdfjs/${pdfjsVersion}/${folder}/${file}`, path: path.join(pdfjsRoot, folder, file) })));
const pdfAssetsPlugin: Plugin = {
  name: "pdf-viewer-assets",
  generateBundle() {
    pdfAssets.forEach(asset => this.emitFile({ type: "asset", fileName: asset.name, source: readFileSync(asset.path) }));
  },
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const asset = pdfAssets.find(item => `/${item.name}` === request.url?.split("?")[0]);
      if (!asset) return next();
      response.setHeader("Content-Type", asset.name.endsWith(".js") ? "text/javascript" : asset.name.endsWith(".wasm") ? "application/wasm" : "application/octet-stream");
      response.end(readFileSync(asset.path));
    });
  },
};

const buildId =
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  `local-${Date.now().toString(36)}`;

const emitBuildVersionPlugin: Plugin = {
  name: "emit-build-version",
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "version.json",
      source: JSON.stringify({ buildId }),
    });
  },
};

const prioritizeStylesPlugin: Plugin = {
  name: "prioritize-entry-styles",
  enforce: "post",
  transformIndexHtml: {
    order: "post",
    handler(html) {
      const styles = html.match(/<link rel="stylesheet"[^>]*>/g) || [];
      if (!styles.length) return html;
      const withoutStyles = styles.reduce((result, tag) => result.replace(tag, ""), html);
      const firstModulePreload = withoutStyles.indexOf('<link rel="modulepreload"');
      if (firstModulePreload < 0) return html;
      return `${withoutStyles.slice(0, firstModulePreload)}${styles.join("\n  ")}\n  ${withoutStyles.slice(firstModulePreload)}`;
    },
  },
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    // Keep local previews same-origin. Production currently allows only the
    // deployed frontend origin, so direct browser calls from localhost fail
    // CORS even for public read-only data.
    proxy: {
      "/v1": { target: "https://aws-origin.dekhocampus.com", changeOrigin: true },
      // Proxy auth API calls only, not /auth login or /author/... profile pages.
      "^/auth/v1(?:/|$)": { target: "https://aws-origin.dekhocampus.com", changeOrigin: true },
      "/storage": { target: "https://aws-origin.dekhocampus.com", changeOrigin: true },
    },
  },
  preview: {
    // Review builds are static-only and may be shared through an ephemeral
    // Cloudflare hostname. This does not relax the development server.
    allowedHosts: [".trycloudflare.com"],
  },
  plugins: [
    react(),
    pdfAssetsPlugin,
    emitBuildVersionPlugin,
    prioritizeStylesPlugin,
  ].filter(Boolean),
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    minify: "esbuild",
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Group shared runtimes without pulling admin editors or the entire icon catalogue into startup.
            { name: "react", test: /node_modules[\\/](?:react(?:-dom|-router(?:-dom)?)?|scheduler|@tanstack[\\/](?:react-query|query-core))[\\/]/, priority: 20 },
            { name: "motion", test: /node_modules[\\/](?:framer-motion|motion-dom|motion-utils)[\\/]/, priority: 10 },
            { name: "ui", test: /node_modules[\\/]@radix-ui[\\/]/ },
          ],
        },
      },
    },
  },
  // A tiny, explicitly uncached marker lets an already-open tab notice a new
  // deployment without interrupting the page or any operation in progress.
  publicDir: "public",
}));
