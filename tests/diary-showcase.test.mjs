import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the three operator-supplied Instagram post IDs appear only in the sample gallery", () => {
  const gallery = read("app/diary/components/post-showcase.tsx");
  for (const id of ["DeBsEOaD1C6", "Deglh2WD0XG", "Dd8icENj2aw"]) {
    assert.ok(gallery.includes(id), `missing example ID ${id}`);
  }
  assert.equal((gallery.match(/number: "0[123]"/g) ?? []).length, 3);
  assert.match(gallery, /instagram\.com\/p\//);
  assert.match(gallery, /Instagramで見る/);
});

test("external post embeds load only when a viewer chooses to display them", () => {
  const gallery = read("app/diary/components/post-showcase.tsx");
  assert.match(gallery, /const \[opened, setOpened\]/);
  assert.match(gallery, /isOpen \? \(/);
  assert.match(gallery, /実際の投稿を表示する/);
  assert.match(gallery, /loading="lazy"/);
  assert.match(gallery, /noopener noreferrer/);
});

test("service details are direct operator work and link to preselected contact forms", () => {
  const service = read("app/diary/services/page.tsx");
  const home = read("app/diary/page.tsx");
  const request = read("app/diary/request/page.tsx");
  const form = read("app/diary/components/inquiry-form.tsx");
  assert.match(service, /グルメ日誌への直接依頼/);
  assert.match(service, /食べログやGoogleマップ/);
  assert.match(service, /個別にご案内/);
  assert.match(service, /\/diary\/request\?service=/);
  assert.match(home, /<PostShowcase \/>/);
  assert.match(home, /href="\/diary\/services"/);
  assert.match(request, /const initialService = DIARY_SERVICES\.find/);
  assert.match(form, /defaultValue=\{initialService\}/);
});
