import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { SITE_BASE } from "./site.config.ts";

// Nested HTML routes must resolve assets from the site root, not their directory.
// Set SITE_URL for a custom domain; development stays at localhost's root.
export default defineConfig(({ command, isPreview }) => ({
  base: command === "serve" && !isPreview ? "/" : SITE_BASE,
  appType: command === "serve" && !isPreview ? "spa" : "mpa",
  plugins: [react()],
}));
