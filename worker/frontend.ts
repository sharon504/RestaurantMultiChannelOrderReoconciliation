const renderApiOrigin = "https://restaurant-reconciliation.onrender.com";

type Assets = { fetch(request: Request): Promise<Response> };

/** Static frontend on Cloudflare; all reconciliation API requests remain on Render. */
export default {
  async fetch(request: Request, env: { ASSETS: Assets }): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const target = new URL(`${url.pathname}${url.search}`, renderApiOrigin);
      return fetch(new Request(target, request));
    }
    return env.ASSETS.fetch(request);
  },
};
