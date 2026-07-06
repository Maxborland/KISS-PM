// E2E: политики безопасности применяются (G6-01/G6-10).
import { launch, USERS } from "./browser.mjs";
const BASE = "http://127.0.0.1:3010";
const { browser, context } = await launch();
await context.request.post(`${BASE}/api/auth/login`, { data: USERS.admin });
const H = { "x-kiss-pm-action": "same-origin" };
const out = [];
const check = (n, ok, note = "") => { out.push({ n, ok }); console.log(ok ? "PASS" : "FAIL", n, note); };

// 1) Невалидный домен в политике → 400
let r = await context.request.put(`${BASE}/api/tenant/current/security-policy`, { headers: H, data: { securityPolicy: { twoFactorRequired: false, ssoSamlEnabled: false, sessionTimeoutHours: 24, domainAllowlist: ["это не домен!!"] } } });
check("policy-invalid-domain-400", r.status() === 400, String(r.status()));

// 2) Allowlist сохраняется и применяется к созданию пользователя
r = await context.request.put(`${BASE}/api/tenant/current/security-policy`, { headers: H, data: { securityPolicy: { twoFactorRequired: false, ssoSamlEnabled: false, sessionTimeoutHours: 24, domainAllowlist: ["only-allowed.example"] } } });
check("policy-save-200", r.status() === 200, String(r.status()));
r = await context.request.post(`${BASE}/api/workspace/users`, { headers: H, data: { id: `user-uiux-eval-${Date.now()}`, name: "uiux-eval Тест", email: `blocked-${Date.now()}@evil.example`, accessProfileId: "access-profile-alpha-admin", positionId: null, status: "active", password: "password12345" } });
const blockedBody = await r.text();
check("user-create-blocked-domain", r.status() === 400 && blockedBody.includes("email_domain_not_allowed"), `${r.status()} ${blockedBody.slice(0, 80)}`);
r = await context.request.post(`${BASE}/api/workspace/users`, { headers: H, data: { id: `user-uiux-eval-ok-${Date.now()}`, name: "uiux-eval Ок", email: `ok-${Date.now()}@only-allowed.example`, accessProfileId: "access-profile-alpha-admin", positionId: null, status: "active", password: "password12345" } });
check("user-create-allowed-domain", r.status() === 201, String(r.status()));

// 3) Тайм-аут сессии применяется при входе: ставим 1 час, логинимся свежим контекстом, сверяем expiresAt
r = await context.request.put(`${BASE}/api/tenant/current/security-policy`, { headers: H, data: { securityPolicy: { twoFactorRequired: false, ssoSamlEnabled: false, sessionTimeoutHours: 1, domainAllowlist: [] } } });
check("policy-timeout-save", r.status() === 200, String(r.status()));
const { browser: b2, context: c2 } = await launch();
await c2.request.post(`${BASE}/api/auth/login`, { data: USERS.admin });
const sess = await (await c2.request.get(`${BASE}/api/auth/sessions`)).json();
const current = (sess.sessions ?? []).map((s) => ({ exp: Date.parse(s.expiresAt), created: Date.parse(s.createdAt) })).sort((a, b) => b.created - a.created)[0];
const ttlH = current ? (current.exp - Date.now()) / 3_600_000 : -1;
check("login-ttl-1h", ttlH > 0.9 && ttlH < 1.1, `ttl=${ttlH.toFixed(2)}h`);
await b2.close();

// откат политики к дефолту, чтобы не мешать другим проверкам
r = await context.request.put(`${BASE}/api/tenant/current/security-policy`, { headers: H, data: { securityPolicy: { twoFactorRequired: false, ssoSamlEnabled: false, sessionTimeoutHours: 24, domainAllowlist: [] } } });
check("policy-restore", r.status() === 200, String(r.status()));

console.log(JSON.stringify(out));
await browser.close();
if (out.some((x) => !x.ok)) process.exit(1);
