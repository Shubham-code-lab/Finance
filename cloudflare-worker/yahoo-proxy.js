const ALLOWED_ORIGIN = "https://shubham-code-lab.github.io";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function isAllowedPath(pathname) {
  return (
    pathname === "/v1/finance/search" ||
    pathname.startsWith("/v8/finance/chart/") ||
    pathname.startsWith("/ws/fundamentals-timeseries/v1/finance/timeseries/")
  );
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin");

    if (origin && origin !== ALLOWED_ORIGIN) {
      return new Response("Origin not allowed", { status: 403 });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    const incomingUrl = new URL(request.url);
    if (!isAllowedPath(incomingUrl.pathname)) {
      return new Response("Yahoo endpoint not allowed", { status: 404 });
    }

    const yahooOrigins = [
      "https://query1.finance.yahoo.com",
      "https://query2.finance.yahoo.com",
    ];
    let yahooResponse;

    for (const yahooOrigin of yahooOrigins) {
      const yahooUrl = new URL(
        `${incomingUrl.pathname}${incomingUrl.search}`,
        yahooOrigin,
      );
      yahooResponse = await fetch(yahooUrl, {
        headers: {
          Accept: "application/json",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
          Referer: "https://finance.yahoo.com/",
        },
        cf: {
          cacheEverything: true,
          cacheTtlByStatus: {
            "200-299": 300,
            "400-599": 0,
          },
        },
      });

      if (yahooResponse.status !== 429) break;
    }

    const headers = new Headers(yahooResponse.headers);
    Object.entries(corsHeaders()).forEach(([name, value]) =>
      headers.set(name, value),
    );
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(yahooResponse.body, {
      status: yahooResponse.status,
      headers,
    });
  },
};
