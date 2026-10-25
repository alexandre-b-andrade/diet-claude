import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";

function gitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "local";
  }
}

// GitHub Pages serve o app em /<repo>/. Em dev usamos a raiz.
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(`${gitSha()} · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Diet Coach",
        short_name: "Diet Coach",
        description: "Coach de dieta pessoal com Claude. Seus dados ficam no seu aparelho.",
        lang: "pt-BR",
        theme_color: "#0f766e",
        background_color: "#fafaf9",
        display: "standalone",
        orientation: "portrait",
        start_url: base,
        scope: base,
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "index.html",
        // Nunca cachear chamadas à API da Anthropic.
        runtimeCaching: [],
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
