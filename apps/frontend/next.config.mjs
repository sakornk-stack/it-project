/** @type {import('next').NextConfig} */
const nextConfig = {
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
};

export default nextConfig;
