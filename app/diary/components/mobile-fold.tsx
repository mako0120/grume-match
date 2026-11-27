"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * On phones a section collapses to one tappable title, so visitors open only
 * what they want to read. On wider screens the toggle is hidden and the body
 * uses `display: contents`, so the section's own layout is untouched.
 * A link to the section (e.g. header "#results") opens it.
 */
export function MobileFold({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const bodyId = `${id}-fold`;

  useEffect(() => {
    const openIfTargeted = () => {
      if (window.location.hash === `#${id}`) setOpen(true);
    };
    // Next.js <Link href="/diary#id"> uses pushState, which fires no
    // hashchange, so also open on clicks of links that point here.
    const openOnLinkClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (link instanceof HTMLAnchorElement && link.hash === `#${id}` && link.pathname === window.location.pathname) {
        setOpen(true);
      }
    };
    const frame = window.requestAnimationFrame(openIfTargeted);
    window.addEventListener("hashchange", openIfTargeted);
    document.addEventListener("click", openOnLinkClick);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", openIfTargeted);
      document.removeEventListener("click", openOnLinkClick);
    };
  }, [id]);

  return (
    <>
      <button
        type="button"
        className="diary-fold-toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{title}</span>
        <span className="diary-fold-icon" aria-hidden="true">{open ? "−" : "＋"}</span>
      </button>
      <div id={bodyId} className="diary-fold-body" data-open={open}>
        {children}
      </div>
    </>
  );
}
