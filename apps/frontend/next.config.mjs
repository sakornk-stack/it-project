import { fileURLToPath } from 'node:url';

// The Docker image (apps/frontend/Dockerfile) sets NEXT_OUTPUT=standalone to
// get a self-contained server.js with only the files it needs. The tracing
// root is the repo root so the npm-workspace package (shared-types) and the
// hoisted node_modules are included. Local `npm run build/start` is unchanged.
const standalone = process.env.NEXT_OUTPUT === 'standalone';

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(standalone && {
    output: 'standalone',
    outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  }),
  // Separate output dir for `next build`/`next start` so a build run
  // while `next dev` is live never collides with dev's .next — a stray
  // `next build` interleaving production (hashed) chunk/manifest files
  // with dev's (unhashed) ones in the same .next folder was the actual
  // root cause of repeated chunk-404/stuck-loading dev-server incidents.
  // `next dev` always keeps using the default `.next`.
  // Super Admin pages used to live under /admin; keep old bookmarks and ?next= links working.
  async redirects() {
    return ['system-overview', 'organization', 'academic-years'].map((page) => ({
      source: `/admin/${page}`,
      destination: `/superadmin/${page}`,
      permanent: false,
    }));
  },
  distDir: process.env.NEXT_BUILD_MODE === 'production' ? '.next-build' : '.next',
  // Hide the Next.js dev indicator (bottom-left "N" badge) in dev mode.
  devIndicators: false,
};

export default nextConfig;
