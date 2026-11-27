"use client";

import { useState, type RefObject } from "react";
import {
  DIARY_MESSAGE_TEMPLATES,
  firstBlankRange,
  hasOwnText,
  type DiaryMessageTemplate,
} from "@/lib/diary/message-templates";

/** Writes a template into the field; false when the store keeps its own text. */
function fillMessageField(field: HTMLTextAreaElement, template: DiaryMessageTemplate) {
  if (hasOwnText(field.value) && !window.confirm("入力中の内容を、テンプレートに置き換えますか？")) {
    return false;
  }
  field.value = template.body;
  field.focus();
  const blank = firstBlankRange(template.body);
  if (blank) field.setSelectionRange(blank[0], blank[1]);
  return true;
}

/**
 * One-tap starters for the consultation message. The textarea stays
 * uncontrolled: a tap writes the template into it, selects the first （　）
 * blank, and never overwrites the store's own text without asking.
 */
export function MessageTemplatePicker({
  target,
  onApply,
}: {
  target: RefObject<HTMLTextAreaElement | null>;
  onApply?: () => void;
}) {
  const [selected, setSelected] = useState("");

  function apply(key: string) {
    const template = DIARY_MESSAGE_TEMPLATES.find((item) => item.key === key);
    if (!target.current || !template) return;
    if (!fillMessageField(target.current, template)) return;
    setSelected(key);
    onApply?.();
  }

  return (
    <div className="diary-template-picker" role="group" aria-label="ご相談内容のテンプレート">
      <p>テンプレートから選ぶ <span>押すと下の欄に入ります。（　）の中を書き換えてください。</span></p>
      <div className="diary-template-buttons">
        {DIARY_MESSAGE_TEMPLATES.map((template) => (
          <button
            key={template.key}
            type="button"
            aria-pressed={selected === template.key}
            onClick={() => apply(template.key)}
          >
            {template.label}
          </button>
        ))}
      </div>
    </div>
  );
}
