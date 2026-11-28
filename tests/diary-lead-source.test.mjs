import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { normalizeLeadSource, DIARY_LEAD_SOURCES, DIARY_HEARD_FROM_OPTIONS } from "../lib/diary/source.ts";

test("only fixed source keys are kept, never free text from a link", () => {
  assert.equal(normalizeLeadSource("ig_bio"), "ig_bio");
  assert.equal(normalizeLeadSource(" IG_Story "), "ig_story");
  for (const bad of ["", "tanaka@example.com", "toString", "__proto__", "ig_bio<script>", null, 3]) {
    assert.equal(normalizeLeadSource(bad), "", String(bad));
  }
  for (const { value } of DIARY_HEARD_FROM_OPTIONS) assert.ok(Object.hasOwn(DIARY_LEAD_SOURCES, value));
});

test("the form sends the captured source and the optional answer to Netlify", async () => {
  const form = await readFile("app/diary/components/netlify-inquiry-form.tsx", "utf8");
  const html = await readFile("public/__forms.html", "utf8");
  for (const field of ["source", "heard_from"]) {
    assert.ok(html.includes(`name="${field}"`), field);
    assert.ok(form.includes(`"${field}"`), field);
  }
  assert.match(form, /body\.set\("source", readCapturedSource\(\)\)/);
  assert.doesNotMatch(form, /name="heard_from"[^>]*required/);
});

test("every diary page remembers ?ref= for the tab", async () => {
  const layout = await readFile("app/diary/layout.tsx", "utf8");
  assert.match(layout, /<SourceCapture \/>/);
  const capture = await readFile("app/diary/components/source-capture.tsx", "utf8");
  assert.match(capture, /sessionStorage/);
  assert.match(capture, /catch/);
});
