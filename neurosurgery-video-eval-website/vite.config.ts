import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Relative base so the same build works on the GitHub Pages project subpath
// (skblv.github.io/neurosurgery-video-eval-website/) and on a custom domain root.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
