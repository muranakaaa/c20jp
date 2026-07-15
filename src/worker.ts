// 静的アセット配信の入口。html_handling: none で原本どおりの .html 付き URL を
// リダイレクトなしで直接配信し、ミス時だけこの Worker が動く。
// ディレクトリアクセス（/ や /p/）は index.html に解決し、見つからないものは 404.html を返す。
// （assets 側の not_found_handling はナビゲーション時に Worker を素通りさせるため使わない）
interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/")) {
      url.pathname += "index.html";
    }
    const res = await env.ASSETS.fetch(new Request(url, request));
    if (res.status !== 404) {
      return res;
    }
    const notFound = await env.ASSETS.fetch(new Request(new URL("/404.html", url), request));
    return new Response(notFound.body, { status: 404, headers: notFound.headers });
  },
};
