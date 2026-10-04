"use client";

import { useState } from "react";

export function CopyButton({ value, label = "コピー" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button className="secondary-button copy-button" onClick={copy} type="button">
      {copied ? "コピーしました" : label}
    </button>
  );
}
