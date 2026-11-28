"use client";

import { useState } from "react";
import Link from "next/link";

// These are real Instagram post IDs explicitly provided by the operator.
// Do not infer the restaurants, dishes, performance, or whether they were paid PR.
export const EXAMPLE_POSTS = [
  { id: "DeBsEOaD1C6", number: "01" },
  { id: "Deglh2WD0XG", number: "02" },
  { id: "Dd8icENj2aw", number: "03" },
] as const;

export function PostShowcase() {
  const [opened, setOpened] = useState<string[]>([]);

  return (
    <div className="diary-post-list">
      {EXAMPLE_POSTS.map((post) => {
        const isOpen = opened.includes(post.id);
        const postUrl = `https://www.instagram.com/p/${post.id}/`;
        return (
          <article className="diary-post-card" key={post.id}>
            <div className="diary-post-heading">
              <span>RECENT POST / {post.number}</span>
              <span>Instagram</span>
            </div>
            {isOpen ? (
              <div className="diary-post-embed-container">
                <iframe
                  title={`グルメ日誌のInstagram投稿例 ${post.number}`}
                  src={`https://www.instagram.com/p/${post.id}/embed/captioned/`}
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="diary-post-placeholder">
                <div className="diary-post-placeholder-top">
                  <span>GOURMET DIARY</span>
                  <span>OSAKA ↗</span>
                </div>
                <div className="diary-post-placeholder-art" aria-hidden="true">
                  <span>「おいしい」の<br />出会いを。</span>
                  <small>POST {post.number}</small>
                </div>
                <button
                  className="diary-post-open"
                  type="button"
                  aria-label={`投稿例${post.number}をサイト内で表示`}
                  onClick={() => setOpened((previous) => [...previous, post.id])}
                >
                  実際の投稿を表示する ↗
                </button>
              </div>
            )}
            <div className="diary-post-bottom">
              <p>投稿例 {post.number} <span>／ 実際のInstagram投稿</span></p>
              <a href={postUrl} target="_blank" rel="noopener noreferrer">
                Instagramで見る <span aria-hidden="true">↗</span>
              </a>
            </div>
          </article>
        );
      })}
      <div className="diary-post-footnote">
        <p>掲載しているのは最近の実際の投稿例です。すべてがPR案件であること、また特定の数値的成果を示すものではありません。</p>
        <p>埋め込みは「実際の投稿を表示する」を押したときだけ読み込みます。閲覧できない場合はInstagramのリンクをご利用ください。</p>
        <Link href="/diary/services">依頼できるPR内容を詳しく見る ↗</Link>
      </div>
    </div>
  );
}
