import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const policy =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "production-content-policy",
      apply: "build",
      transformIndexHtml: () => [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: policy },
          injectTo: "head-prepend",
        },
      ],
    },
  ],
  base: "./",
});
