import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  preview: {
    // Reached through reverse-proxy/scouter-proxy (and optionally a
    // Cloudflare Quick Tunnel) inside the Docker network, never directly
    // from the internet, so the Host header is whatever the outer proxy
    // was addressed as (LAN IP, or a *.trycloudflare.com hostname).
    allowedHosts: true
  }
});
