import { expect, test as base, type Page, type Response } from "@playwright/test";

type RuntimeQaIssue = {
  kind: "console.error" | "pageerror" | "requestfailed" | "response";
  message: string;
};

type ResponseAllowlistEntry = {
  method?: string;
  status: number;
  url: RegExp;
};

const allowedResponseFailures: ResponseAllowlistEntry[] = [
  { status: 404, url: /\/favicon\.ico(?:\?|$)/ },
  {
    method: "POST",
    status: 403,
    url: /\/api\/workspace\/agent-thread\/proposals\/[^/]+\/confirm$/
  },
  { method: "GET", status: 401, url: /\/api\/auth\/me$/ }
];

export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    const issues: RuntimeQaIssue[] = [];

    page.on("pageerror", (error) => {
      issues.push({
        kind: "pageerror",
        message: error.message
      });
    });

    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const location = message.location();
      if (isAllowedConsoleError(message.text(), location.url)) return;
      issues.push({
        kind: "console.error",
        message: `${message.text()} (${location.url}:${location.lineNumber})`
      });
    });

    page.on("requestfailed", (request) => {
      if (!isGatedRequestResource(request.resourceType(), request.url())) return;
      if (isAllowedRequestFailure(request.method(), request.url(), request.failure()?.errorText ?? "")) return;
      issues.push({
        kind: "requestfailed",
        message: `${request.method()} ${request.url()} failed: ${request.failure()?.errorText ?? "unknown"}`
      });
    });

    page.on("response", (response) => {
      if (!isUnexpectedFailureResponse(response)) return;
      issues.push({
        kind: "response",
        message: `${response.status()} ${response.request().method()} ${response.url()}`
      });
    });

    await use(page);

    expect(issues).toEqual([]);
  }
});

export { expect };

function isUnexpectedFailureResponse(response: Response): boolean {
  if (response.status() < 400) return false;
  const request = response.request();
  if (!isGatedRequestResource(request.resourceType(), response.url())) return false;

  return !allowedResponseFailures.some((entry) => {
    const methodMatches = !entry.method || entry.method === request.method();
    return methodMatches && entry.status === response.status() && entry.url.test(response.url());
  });
}

function isAllowedConsoleError(text: string, url: string): boolean {
  return (
    (
      /favicon\.ico/.test(url) &&
      /Failed to load resource|404|not found/i.test(text)
    ) ||
    (
      /\/_next\/static\/chunks\//.test(url) &&
      /WebSocket connection to '.+\/_next\/webpack-hmr.+net::ERR_NO_BUFFER_SPACE/.test(text)
    ) ||
    (
      /\/api\/workspace\/agent-thread\/proposals\/[^/]+\/confirm$/.test(url) &&
      /Failed to load resource: the server responded with a status of 403/.test(text)
    ) ||
    (
      /\/api\/auth\/me$/.test(url) &&
      /Failed to load resource: the server responded with a status of 401/.test(text)
    )
  );
}

function isAllowedRequestFailure(method: string, url: string, errorText: string): boolean {
  if (errorText !== "net::ERR_ABORTED") return false;
  return (
    (method === "GET" && /:\/\/127\.0\.0\.1:\d+\/api\//.test(url)) ||
    /^https:\/\/fonts\.googleapis\.com\//.test(url) ||
    /:\/\/127\.0\.0\.1:\d+\/node_modules\/\.cache\/storybook\//.test(url) ||
    /:\/\/127\.0\.0\.1:\d+\/src\/.+\.(?:ts|tsx)(?:\?|$)/.test(url)
  );
}

function isGatedRequestResource(resourceType: string, url: string): boolean {
  return (
    resourceType === "document" ||
    resourceType === "script" ||
    resourceType === "fetch" ||
    resourceType === "xhr" ||
    url.includes("/api/")
  );
}
