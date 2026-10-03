---
name: run-ops
description: Work through GOURMET DIARY's daily operations queues as one of the Operator roles (実績読み取り, 投稿レポート読み取り, Creatorサポート, 店舗サポート, マッチング, 品質管理, 経理). Use when asked to "今日の運営をやって", run the ops queues, or act as an operations staff member.
---

# Run the operations queues

The roles, their rules and what they may not do are in `docs/OPERATIONS.md`.
Read it first; it overrides anything here.

1. `npm run ops` — counts per queue, oldest first.
2. For the queue of your role: `npm run ops -- <queue>`. Each queue prints
   its owner role and the next action.
3. Screenshot queues have their own skills:
   - `insights` → `.claude/skills/read-insights/SKILL.md`
   - `post-reports` → `.claude/skills/read-post-report/SKILL.md`
4. Queues that need a message to a person (Creatorサポート, 店舗サポート,
   マッチング, 品質管理): draft the message with the template in
   `docs/OPERATIONS.md` and hand it to a human for sending unless you have
   been given a sending channel. Never promise money, change prices or
   accuse anyone.
5. Finish with a short report: per queue, what you did, what is left, and
   anything that needs a human decision.
