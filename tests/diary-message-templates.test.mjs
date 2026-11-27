import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { detectProhibitedPRRequest } from "../lib/diary/inquiry.ts";
import {
  DIARY_MESSAGE_TEMPLATES,
  firstBlankRange,
  hasOwnText,
} from "../lib/diary/message-templates.ts";

test("every template is accepted by the PR policy check and fits both forms", () => {
  assert.ok(DIARY_MESSAGE_TEMPLATES.length >= 4);
  const keys = new Set();
  for (const template of DIARY_MESSAGE_TEMPLATES) {
    assert.equal(detectProhibitedPRRequest(template.body), null, template.key);
    // minLength 10 on both forms, maxLength 600 on the Gmail draft form.
    assert.ok(template.body.length >= 10 && template.body.length <= 600, template.key);
    assert.ok(template.label.length <= 16, template.key);
    assert.ok(!keys.has(template.key), template.key);
    keys.add(template.key);
  }
});

test("each template has a （　） blank to fill, and the first one is selected", () => {
  for (const template of DIARY_MESSAGE_TEMPLATES) {
    const range = firstBlankRange(template.body);
    assert.ok(range, template.key);
    const [start, end] = range;
    assert.equal(template.body[start], "（");
    assert.equal(template.body[end - 1], "）");
  }
  assert.equal(firstBlankRange("空欄なし"), null);
});

test("only the store's own text asks before being replaced", () => {
  assert.equal(hasOwnText(""), false);
  assert.equal(hasOwnText("   \n"), false);
  assert.equal(hasOwnText(DIARY_MESSAGE_TEMPLATES[0].body), false);
  assert.equal(hasOwnText("ランチの紹介をお願いしたいです"), true);
});

test("both message fields offer the templates without submitting the form", async () => {
  const picker = await readFile("app/diary/components/message-template-picker.tsx", "utf8");
  assert.match(picker, /type="button"/);
  assert.doesNotMatch(picker, /name=/);
  assert.match(picker, /window\.confirm/);

  for (const path of [
    "app/diary/components/netlify-inquiry-form.tsx",
    "app/diary/components/email-inquiry-fallback.tsx",
  ]) {
    const source = await readFile(path, "utf8");
    assert.match(source, /<MessageTemplatePicker target=\{messageRef\}/, path);
    assert.match(source, /<textarea ref=\{messageRef\} name="message"/, path);
  }
});
