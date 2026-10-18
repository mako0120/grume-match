import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("native Netlify form must be registered in a static public HTML file", () => {
  const html = read("public/__forms.html");
  const component = read("app/diary/components/netlify-inquiry-form.tsx");
  assert.match(html, /<form name="diary-pr-inquiry" method="POST" data-netlify="true"/);
  assert.match(html, /netlify-honeypot="bot-field"/);
  assert.match(html, /name="form-name" value="diary-pr-inquiry"/);
  const names = [
    "inquiry_kind", "restaurant_name", "contact_name", "email", "service",
    "goal", "featured_menu", "visit_preference", "message",
    "consent", "compliance_confirmed", "bot-field",
  ];
  for (const name of names) {
    assert.ok(html.includes(`name="${name}"`), `Static Netlify form missing ${name}`);
    assert.ok(component.includes(`"${name}"`) || component.includes(`name="${name}"`),
      `Dynamic Netlify form missing ${name}`);
  }
  assert.match(component, /fetch\("\/__forms\.html"/);
  assert.match(component, /application\/x-www-form-urlencoded/);
  assert.match(component, /new URLSearchParams\(\)/);
  assert.doesNotMatch(component, /fetch\("\/api\/diary\/inquiries"/);
});

test("Netlify lead intake does not activate before dashboard enablement", () => {
  const request = read("app/diary/request/page.tsx");
  const mainForm = read("app/diary/components/inquiry-form.tsx");
  const env = read(".env.example");
  assert.match(request, /process\.env\.DIARY_SITE_MODE === "true" && process\.env\.DIARY_NETLIFY_FORMS_ENABLED === "true"/);
  assert.match(env, /DIARY_NETLIFY_FORMS_ENABLED=false/);
  assert.match(mainForm, /if \(netlifyEnabled\)/);
  assert.match(mainForm, /<NetlifyDiaryInquiryForm/);
  assert.match(mainForm, /<InstagramDmFallback/);
  const api = read("app/api/diary/inquiries/route.ts");
  assert.match(api, /DIARY_INQUIRIES_ENABLED !== "true"/);
});

test("form collects only needed contact info and mandatory consent", () => {
  const component = read("app/diary/components/netlify-inquiry-form.tsx");
  for(const attr of [
    'name="restaurant_name" required',
    'name="contact_name" required',
    'name="email" type="email" required',
    'name="message" required minLength={10}',
    'name="consent" type="checkbox" required',
    'name="compliance_confirmed" type="checkbox" required',
  ]) assert.ok(component.includes(attr), attr);
  assert.match(component, /detectProhibitedPRRequest/);
  assert.match(component, /validateDiaryInquiry/);
  assert.match(component, /aria-live="assertive"/);
  assert.match(component, /pending/);
  assert.match(component, /フォームの送信だけでは契約は成立しません/);
  assert.doesNotMatch(component, /(?:stripe|invoice|自動契約|googlemaps|canva\.com)/i);
});

test("Netlify Forms PII processor is disclosed and operator checklist exists", () => {
  const privacy = read("app/legal/privacy/page.tsx");
  const docs = read("docs/DIARY_NETLIFY_FORMS_RUNBOOK.md");
  assert.match(privacy, /Netlify Formsに保存され/);
  assert.match(docs, /Submission notifications/);
  assert.match(docs, /Verified submissions/);
  assert.match(docs, /Spam submissions/);
  assert.match(docs, /実際に保存/);
});
