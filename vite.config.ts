// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "local-preview-database",
      apply: "serve",
      config(_, { mode }) {
        const env = loadEnv(mode, process.cwd(), "VITE_");
        if (env["VITE_LOCAL_PREVIEW"] !== "true" || env["VITE_LOCAL_PREVIEW_DATA"] !== "true")
          return;
        return {
          server: {
            proxy: {
              "/__local-data/": {
                target: "http://127.0.0.1:54331",
                rewrite: (path: string) => path.replace(/^\/__local-data/, ""),
                configure(proxy) {
                  proxy.on("proxyReq", (request) => {
                    request.removeHeader("authorization");
                    request.removeHeader("apikey");
                    request.removeHeader("cookie");
                  });
                },
              },
            },
          },
        };
      },
    },
  ],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
