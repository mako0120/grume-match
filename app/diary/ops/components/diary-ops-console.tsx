"use client";

import { hasCompleteOpsSnapshot } from "@/lib/diary/ops-sync-integrity";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  DIARY_OPS_STAGES,
  DIARY_OPS_STATUSES,
  LIMIT_FILE_BYTES,
  casesFromDiaryCsv,
  diaryOpsExportCsv,
  type DiaryOpsCase,
  type DiaryOpsStatus,
} from "@/lib/diary/ops";

type Screen = "overview" | "pipeline" | "cases" | "calendar" | "finance";
const formatYen = (n: number) => new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(n);
const readableDate = (value: string) => {
  if (!value) return "未設定";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 20) : date.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
};

const serviceLabels: Record<string, string> = {
  instagram_feed: "Instagram フィード",
  instagram_feed_video: "フィード＋動画",
  instagram_reel: "Instagram リール",
  instagram_stories: "ストーリーズ",
  photo_video: "写真・動画撮影",
  consultation: "事前相談",
};

const closed = (value: DiaryOpsStatus) => value === "完了" || value === "終了";
const overdue = (item: DiaryOpsCase) => !closed(item.status) && Boolean(item.dueDate) &&
  !Number.isNaN(Date.parse(item.dueDate)) && new Date(item.dueDate).getTime() < new Date(new Date().toDateString()).getTime();

export function DiaryOpsConsole() {
  const [items, setItems] = useState<DiaryOpsCase[]>([]);
  const [importedFile, setImportedFile] = useState("");
  const [alert, setAlert] = useState("");
  const [loading, setLoading] = useState(false);
  const [screen, setScreen] = useState<Screen>("overview");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const date = new Date();
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
  });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("すべて");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginPending, setLoginPending] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [showLiveLogin, setShowLiveLogin] = useState(false);
  const [stateConnected, setStateConnected] = useState(false);
  const [savingState, setSavingState] = useState(false);
  const stateVersions = useRef<Map<string, string>>(new Map());
  const picker = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const editingBaseline = useRef<DiaryOpsCase | null>(null);
  const latestItems = useRef(items);
  useEffect(() => { latestItems.current = items; }, [items]);

  // Owner-only live data is never kept visible after logout or role revocation.
  function clearLiveData() {
    setAccessToken("");
    setItems([]);
    setSelectedId(null);
    setImportedFile("");
    setLastSyncedAt("");
    setStateConnected(false);
    stateVersions.current.clear();
    setEmail("");
    setPassword("");
  }

  useEffect(() => {
    if (!selectedId) return;
    // Preserve a pristine snapshot while the detail drawer is being edited.
    // The background poller remains stopped until this drawer closes.
    const pristine = items.find(caseItem => caseItem.id === selectedId);
    editingBaseline.current = pristine ? { ...pristine } : null;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDetail();
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'
      ));
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previousFocus?.focus(); };
    // selectedId is the only trigger; preserve the edit baseline across keystrokes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (!accessToken || selectedId) return;
    let cancelled = false;
    async function sync() {
      if (document.visibilityState === "hidden") return;
      setSyncing(true);
      try {
        const response = await fetch("/.netlify/functions/diary-ops-feed", {
          method: "GET",
          headers: { Authorization: "Bearer " + accessToken, Accept: "application/json" },
          credentials: "omit",
          cache: "no-store",
        });
        const body: unknown = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          const err = typeof body === "object" && body !== null && "error" in body ? String(body.error) : "unknown";
          if (response.status === 401 || response.status === 403) {
            setAccessToken("");
            setItems([]);
            setSelectedId(null);
            setImportedFile("");
            setLastSyncedAt("");
            setEmail("");
            setPassword("");
            setLiveError("本人認証の有効期限が切れたか、管理者権限がありません。再ログインしてください。");
          } else {
            setStateConnected(false);
            stateVersions.current.clear();
            setLiveError("自動同期に失敗しました（" + err + "）。Netlifyの設定と接続を確認してください。");
          }
          return;
        }
        if (typeof body !== "object" || body === null || !("leads" in body) || !Array.isArray(body.leads)) {
          setStateConnected(false);
          stateVersions.current.clear();
          setLiveError("想定外の同期レスポンスです。");
          return;
        }
        const incoming = body.leads as Array<{
          id: string; receivedAt: string; restaurant: string; contact: string;
          email: string; service: string; kind: string; message: string;
          featuredMenu: string; visitPreference: string;
        }>;
        type SavedState = Partial<DiaryOpsCase> & { id: string; version: string };
        const persisted = new Map<string, SavedState>();
        let canSave = false;
        let stateWarning = "";
        try {
          const stateResult = await fetch("/.netlify/functions/diary-ops-state", {
            method: "GET",
            headers: { Authorization: "Bearer " + accessToken, Accept: "application/json" },
            credentials: "omit", cache: "no-store",
          });
          if (cancelled) return;
          if (stateResult.status === 401 || stateResult.status === 403) {
            setAccessToken("");
            setItems([]);
            setSelectedId(null);
            setImportedFile("");
            setStateConnected(false);
            stateVersions.current.clear();
            setLiveError("案件管理の権限がありません。再ログインしてください。");
            return;
          }
          if (stateResult.ok) {
            const value: unknown = await stateResult.json();
            if (value && typeof value === "object" && "items" in value && Array.isArray(value.items)) {
              const records = value.items as SavedState[];
              const valid = records.every(record => record && typeof record.id === "string" &&
                /^[a-z0-9-]{8,128}$/i.test(record.id) &&
                typeof record.version === "string" && /^[a-f0-9]{64}$/.test(record.version));
              if (valid) for (const record of records) persisted.set(record.id, record);
              if (!valid || persisted.size !== records.length) {
                stateWarning = "Google Sheetsの案件一覧に重複・不正データがあります。保存を停止しました。";
              } else {
                stateVersions.current = new Map(Array.from(persisted, ([id, record]) => [id, record.version]));
                canSave = true;
              }
            } else stateWarning = "案件保存APIから予期しない応答です。保存できません。";
          } else if (stateResult.status !== 503) {
            stateWarning = "案件のGoogle Sheets保存機能に接続できません。";
          }
        } catch {
          if (cancelled) return;
          stateWarning = "Sheets同期に失敗しました。進捗はまだ保存されていません。";
        }
        if (cancelled) return;
        // Never present unregistered new leads as zero-revenue operational
        // records. Sheets may lag the Forms intake by up to five minutes.
        const complete = canSave && hasCompleteOpsSnapshot(
          incoming.map(lead => lead.id), [...persisted.keys()],
          "partial" in body && body.partial === true);
        if (canSave && !complete && !stateWarning) {
          stateWarning = "NetlifyとSheetsの受付IDが不一致、または一部未取得です。金額集計と保存を停止しました。";
        }
        stateVersions.current = complete ? stateVersions.current : new Map();
        setStateConnected(complete);
        setItems(() => {
          const updated = incoming.map(lead => {
            const ops = complete ? persisted.get(lead.id) : undefined;
            return {
              ...lead,
              status: ops?.status ?? "未対応",
              nextAction: ops?.nextAction ?? "",
              dueDate: ops?.dueDate ?? "",
              visitDate: ops?.visitDate ?? "",
              postDate: ops?.postDate ?? "",
              agreedFee: ops?.agreedFee ?? 0,
              paidAmount: ops?.paidAmount ?? 0,
              note: ops?.note ?? "",
              postUrl: ops?.postUrl ?? "",
            } as DiaryOpsCase;
          });
          return updated;
        });
        setImportedFile("NETLIFY LIVE / " + new Date().toLocaleTimeString("ja-JP"));
        setLastSyncedAt(new Date().toLocaleTimeString("ja-JP"));
        setLiveError(("partial" in body && body.partial === true) ? "申込みが500件を超えています。過去分はNetlify本体で確認してください。" : stateWarning);
      } catch {
        if (!cancelled) {
          setStateConnected(false);
          stateVersions.current.clear();
          setLiveError("ネットワークエラーのため再接続を待っています。");
        }
      } finally {
        if (!cancelled) setSyncing(false);
      }
    }
    void sync();
    const timer = window.setInterval(() => { void sync(); }, 60000);
    const onVisible = () => { void sync(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [accessToken, selectedId]);

  async function loginToLive(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loginPending) return;
    setLoginPending(true);
    setLiveError("");
    try {
      const response = await fetch("/.netlify/identity/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        credentials: "omit",
        cache: "no-store",
        body: new URLSearchParams({ grant_type: "password", username: email.trim(), password }),
      });
      const data: unknown = await response.json();
      if (!response.ok || !data || typeof data !== "object" || !("access_token" in data) ||
          typeof data.access_token !== "string" || data.access_token.length < 50) {
        throw new Error("login_failed");
      }
      setPassword("");
      setItems([]);
      setSelectedId(null);
      setImportedFile("");
      setStateConnected(false);
      stateVersions.current.clear();
      setAccessToken(data.access_token);
      setShowLiveLogin(false);
    } catch {
      setLiveError("ログインできませんでした。Netlify Identityの招待・本人のパスワード・管理者権限を確認してください。");
    } finally {
      setLoginPending(false);
    }
  }

  const visible = useMemo(() => items.filter(item => {
    const query = search.trim().toLocaleLowerCase("ja-JP");
    const matches = !query || [item.restaurant, item.contact, item.service, item.message, item.id]
      .some(value => value.toLocaleLowerCase("ja-JP").includes(query));
    return matches && (status === "すべて" || item.status === status);
  }), [items, search, status]);

  const selected = items.find(item => item.id === selectedId);
  function closeDetail() {
    if (!selectedId) return;
    const baseline = editingBaseline.current;
    const current = latestItems.current.find(item => item.id === selectedId);
    const opsFields: Array<keyof DiaryOpsCase> = [
      "status", "nextAction", "dueDate", "visitDate", "postDate",
      "agreedFee", "paidAmount", "note", "postUrl",
    ];
    if (baseline && current &&
      opsFields.some(field => baseline[field] !== current[field])) {
      if (!window.confirm("変更内容がGoogle Sheetsに保存されていません。破棄して閉じますか？")) return;
      setItems(previous => previous.map(item => item.id === selectedId ? baseline : item));
    }
    editingBaseline.current = null;
    setSelectedId(null);
  }
  const calendarDays = useMemo(() => {
    const [year, month] = calendarMonth.split("-").map(Number);
    const offset = new Date(year, month - 1, 1).getDay();
    const days = new Date(year, month, 0).getDate();
    return [...Array<null>(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  }, [calendarMonth]);
  const calendarEvents = useMemo(() => items.flatMap(item => [
    ...(item.visitDate ? [{ item, day: item.visitDate.slice(0, 10), label: "来店" }] : []),
    ...(item.postDate ? [{ item, day: item.postDate.slice(0, 10), label: "投稿" }] : []),
  ]).filter(event => event.day.startsWith(calendarMonth))
    .sort((a, b) => a.day.localeCompare(b.day)), [items, calendarMonth]);
  function moveCalendarMonth(offset: number) {
    const [year, month] = calendarMonth.split("-").map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    setCalendarMonth(date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0"));
  }
  const open = items.filter(item => !closed(item.status));
  const pending = open.filter(item => item.status === "未対応").length;
  const late = open.filter(overdue).length;
  const opsReady = !accessToken || stateConnected;
  const contracted = items.reduce((sum, item) => sum + item.agreedFee, 0);
  const unpaid = items.reduce((sum, item) => sum + Math.max(0, item.agreedFee - item.paidAmount), 0);
  const next = open.slice().sort((a, b) => {
    const first = a.dueDate && !Number.isNaN(Date.parse(a.dueDate)) ? Date.parse(a.dueDate) : Infinity;
    const second = b.dueDate && !Number.isNaN(Date.parse(b.dueDate)) ? Date.parse(b.dueDate) : Infinity;
    return first - second;
  }).slice(0, 7);

  async function importCsv(file: File | undefined) {
    if (!file) return;
    if (file.size > LIMIT_FILE_BYTES || !/\.csv$/i.test(file.name)) {
      setAlert("CSVファイル（2MB以下）を選んでください。");
      return;
    }
    if (items.some(item => item.note || item.status !== "未対応" || item.agreedFee || item.nextAction)) {
      if (!window.confirm("今の画面で編集した未書き出しの情報が消えます。CSVを読み直しますか？")) return;
    }
    setLoading(true);
    try {
      const source = await file.text();
      const parsed = casesFromDiaryCsv(source);
      if (!parsed.length) throw new Error("CSVに受付案件が見つかりませんでした。");
      setItems(parsed);
      setImportedFile(file.name);
      setSelectedId(null);
      setStatus("すべて");
      setSearch("");
      setScreen("overview");
      setAlert(String(parsed.length) + "件をこのブラウザ内で読み込みました。サーバーへは送信していません。");
    } catch (e) {
      setAlert(e instanceof Error ? e.message : "読み込みに失敗しました。");
    } finally {
      setLoading(false);
      if (picker.current) picker.current.value = "";
    }
  }

  function updateCase(id: string, patch: Partial<DiaryOpsCase>) {
    setItems(previous => previous.map(item => item.id === id ? { ...item, ...patch } : item));
  }

  async function persistSelectedCase() {
    if (!selected || !stateConnected || savingState) return;
    const expectedVersion = stateVersions.current.get(selected.id);
    if (!expectedVersion) {
      setLiveError("受付IDがまだ案件ボードへ反映されていません。5分同期後に再試行してください。");
      return;
    }
    setSavingState(true);
    try {
      const patch = {
        status: selected.status, nextAction: selected.nextAction,
        dueDate: selected.dueDate, visitDate: selected.visitDate,
        postDate: selected.postDate, agreedFee: selected.agreedFee,
        paidAmount: selected.paidAmount, note: selected.note, postUrl: selected.postUrl,
      };
      const response = await fetch("/.netlify/functions/diary-ops-state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + accessToken, Accept: "application/json",
        },
        credentials: "omit", cache: "no-store",
        body: JSON.stringify({ id: selected.id, expectedVersion, patch }),
      });
      if (!response.ok) {
        if (response.status === 409) {
          setLiveError("Google Sheetsに別の更新があります。案件を閉じて最新情報を確認してください。");
        } else if (response.status === 401 || response.status === 403) {
          clearLiveData();
          setLiveError("保存の管理者権限がなくなりました。再ログインしてください。");
        } else setLiveError("Google Sheetsへの保存に失敗しました。接続とApps Script設定を確認してください。");
        return;
      }
      const result: unknown = await response.json();
      if (!result || typeof result !== "object" || !("item" in result) ||
        !result.item || typeof result.item !== "object" ||
        !("version" in result.item) || typeof result.item.version !== "string") {
        setLiveError("保存結果を確認できませんでした。最新状態を確認してください。");
        return;
      }
      stateVersions.current.set(selected.id, result.item.version);
      editingBaseline.current = null;
      setSelectedId(null);
      setLiveError("");
      setAlert("案件の進捗・金額・メモをGoogle Sheetsに保存しました。");
    } catch {
      setLiveError("保存結果を確認できませんでした。再保存する前にSheetsの最新状態を確認してください。");
    } finally {
      setSavingState(false);
    }
  }

  function exportCsv() {
    if (!items.length) return;
    const blob = new Blob([diaryOpsExportCsv(items)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "gurume-diary-ops-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setAlert("更新済みCSVを保存しました。顧客情報を含むため、公開フォルダーに置かないでください。");
  }

  function setScreenTo(nextScreen: Screen) {
    setScreen(nextScreen);
    setSelectedId(null);
  }

  return (
    <div className="diary-ops" id="diary-main">
      <div className="ops-workspace">
        <aside className="ops-sidebar" aria-label="案件管理ナビゲーション">
          <Link href="/diary" className="ops-logo"><span>食</span><strong>GOURMET DIARY</strong><small>OPERATIONS DESK</small></Link>
          <span className="ops-sidebar-caption">WORKSPACE</span>
          <nav className="ops-navigation" aria-label="管理メニュー">
            {([
              ["overview", "◫", "概要・ダッシュボード"],
              ["pipeline", "▥", "進捗パイプライン"],
              ["cases", "≡", "案件一覧"],
              ["calendar", "▦", "来店・投稿予定"],
              ["finance", "¥", "売上・入金"],
            ] as const).map(([key, glyph, label]) => (
              <button key={key} type="button" className={screen === key ? "is-active" : ""}
                onClick={() => setScreenTo(key)} aria-current={screen === key ? "page" : undefined}>
                <span aria-hidden="true">{glyph}</span>{label}
              </button>
            ))}
          </nav>
          <div className="ops-sidebar-bottom">
            <span className="ops-security-dot" aria-hidden="true" /> ローカル処理モード
            <p>選択したCSVは端末のメモリで処理されます。送信・自動保存は行いません。</p>
            <Link href="/diary">← 公開サイトに戻る</Link>
          </div>
        </aside>

        <div className="ops-main-column">
          <header className="ops-topbar">
            <span className="ops-breadcrumb">グルメ日誌 <span>/</span> 案件管理</span>
            <div className="ops-top-actions">
              <span className="ops-private-pill">{accessToken ? (stateConnected ? "● LIVE / SHEETS接続" : "● LIVE / 受付のみ") : "● PRIVATE MODE"}</span>
              <button type="button" className="ops-button ops-secondary"
                onClick={() => { if (accessToken) { clearLiveData(); setLiveError(""); }
                  else setShowLiveLogin(!showLiveLogin); }}>
                {accessToken ? "自動同期を終了" : "自動同期ログイン"}
              </button>
              <input ref={picker} type="file" accept=".csv,text/csv" className="ops-visually-hidden" aria-label="CSVを読み込む"
                onChange={event => { void importCsv(event.target.files?.[0]); }} />
              <button type="button" className="ops-button ops-secondary" disabled={loading || Boolean(accessToken)} onClick={() => picker.current?.click()}>
                {loading ? "読込中…" : "CSVを読み込む"}
              </button>
              <button type="button" className="ops-button ops-primary" disabled={!items.length || !opsReady} onClick={exportCsv}>
                CSVを書き出す ↗
              </button>
            </div>
          </header>

          <main className="ops-content">
            <div className="ops-page-intro">
              <span className="ops-eyebrow">PR MANAGEMENT / OSAKA</span>
              <h1>{screen === "overview" ? "案件の全体像" : screen === "pipeline" ? "進捗パイプライン" : screen === "cases" ? "案件を検索・整理" : screen === "calendar" ? "来店・投稿スケジュール" : "売上・入金管理"}</h1>
              <p>問い合わせから投稿、入金まで。今日、何をすべきかを一目で把握。</p>
            </div>
            <div className="ops-safety-note" role="status">
              <strong>プライバシー優先</strong>
              {accessToken
                ? (stateConnected ? "管理者認証済み。申込み・運用状況をGoogle Sheetsと照合しています。" : "管理者認証済み。申込み情報は取得中ですが、進捗の保存はまだ有効ではありません。")
                : "自動同期はNetlify Identityの管理者認証が必要です。CSVを選択した場合はブラウザ内のみで処理します。"}
              {accessToken ? "　最新確認：" + (lastSyncedAt || "接続中…") + (syncing ? "（更新中）" : "") : ""}
            </div>
            {showLiveLogin && !accessToken && (
              <form className="ops-live-login" onSubmit={event => { void loginToLive(event); }}>
                <div><span className="ops-eyebrow">SECURE LIVE CONNECTION</span>
                  <h2>Netlify Identityでログイン</h2>
                  <p>事前にNetlifyでIdentityを有効化し、専用Gmailを招待してadminロールを設定してください。管理者パスワードは保存しません。</p>
                </div>
                <label>管理者メールアドレス
                  <input type="email" autoComplete="username" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} />
                </label>
                <label>Netlify Identityパスワード
                  <input type="password" autoComplete="current-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
                </label>
                <button type="submit" className="ops-button ops-primary" disabled={loginPending}>{loginPending ? "確認中…" : "本人確認して自動同期"}</button>
              </form>
            )}
            {liveError && <p className="ops-feedback ops-error" role="alert">{liveError}</p>}
            {alert && <p className="ops-feedback" role="status">{alert}</p>}

            {!items.length ? (
              <section className="ops-start">
                <div className="ops-start-icon" aria-hidden="true">◈</div>
                <span className="ops-eyebrow">AUTOMATIC SYNC / BACKUP CSV</span>
                <h2>{accessToken ? "案件を安全に取得中…" : "まず、申込みCSVを読み込みましょう。"}</h2>
                <p>自動同期は右上の「自動同期ログイン」。設定前はNetlify管理画面の <strong>Forms → diary-pr-inquiry</strong> からCSVを読み込めます。CSVはサーバーにアップロードされません。</p>
                <button type="button" className="ops-button ops-primary" onClick={() => picker.current?.click()}>
                  CSVを選択する <span aria-hidden="true">↗</span>
                </button>
                <div className="ops-start-footer">
                  <span>✓ 専用データベース不要</span>
                  <span>✓ CSV用トークン不要</span>
                  <span>✓ 認証後は自動同期可能</span>
                </div>
              </section>
            ) : (
              <>
                <div className="ops-loaded-status">
                  <span>{items.length}件を読込済み　/　{importedFile}</span>
                  <span>{stateConnected ? "進捗・金額は「Google Sheetsに保存」で永続化できます。" : "進捗・金額はまだ端末内のみ。CSV保存が必要です。"}</span>
                </div>
                {screen === "overview" && (
                  <>
                    <div className="ops-metrics">
                      <div><span>表示中の受付件数</span><strong>{items.length}<small> 件</small></strong><p>取得した案件のみ。全件数とは限りません</p></div>
                      {opsReady ? <>
                        <div><span>未対応</span><strong>{pending}<small> 件</small></strong><p>最優先で確認</p></div>
                        <div className={late ? "ops-metric-warning" : ""}><span>期限超過</span><strong>{late}<small> 件</small></strong><p>対応期限を再確認</p></div>
                        <div><span>合意金額</span><strong>{formatYen(contracted)}</strong><p>全案件の合計</p></div>
                        <div><span>未入金</span><strong>{formatYen(unpaid)}</strong><p>未収の合計</p></div>
                      </> : <div className="ops-metric-warning">
                        <span>進捗・売上</span><strong>未取得</strong>
                        <p>Google Sheetsの同期が完了するまで集計しません</p>
                      </div>}
                    </div>
                    {opsReady && <div className="ops-overview-grid">
                      <section className="ops-panel">
                        <div className="ops-panel-heading"><div><span className="ops-eyebrow">ACTION PRIORITY</span><h2>次にやること</h2></div>
                          <button onClick={() => setScreenTo("cases")} className="ops-text-action">すべて見る ↗</button>
                        </div>
                        <div className="ops-simple-list">
                          {next.length ? next.map(item => (
                            <button key={item.id} className="ops-simple-item" onClick={() => setSelectedId(item.id)}>
                              <span className="ops-avatar">{item.restaurant.charAt(0)}</span>
                              <span className="ops-item-description"><strong>{item.restaurant}</strong><small>{item.nextAction || "次にやることを設定"}</small></span>
                              <span className={overdue(item) ? "ops-date-late" : "ops-date"}>{readableDate(item.dueDate)}</span>
                            </button>
                          )) : <p className="ops-empty">対応待ちの案件はありません。</p>}
                        </div>
                      </section>
                      <section className="ops-panel">
                        <div className="ops-panel-heading"><div><span className="ops-eyebrow">PIPELINE STATUS</span><h2>進行状況</h2></div></div>
                        <div className="ops-progress-list">
                          {DIARY_OPS_STAGES.map(stage => {
                            const count = items.filter(item => (stage.statuses as readonly string[]).includes(item.status)).length;
                            return <div key={stage.title} className="ops-progress-row">
                              <div><span>{stage.title}</span><strong>{count}件</strong></div>
                              <div className="ops-progress-track"><div style={{ width: String(items.length ? Math.round(count / items.length * 100) : 0) + "%" }} /></div>
                            </div>;
                          })}
                        </div>
                        <button onClick={() => setScreenTo("pipeline")} className="ops-text-action">カンバンで確認 ↗</button>
                      </section>
                    </div>}
                  </>
                )}
                {(screen === "cases" || screen === "pipeline") && (
                  <div className="ops-filters">
                    <label className="ops-search">
                      <span aria-hidden="true">⌕</span>
                      <input value={search} onChange={event => setSearch(event.target.value)} placeholder="店舗名、担当者、相談内容を検索" />
                    </label>
                    <select aria-label="進捗で絞り込む" value={status} onChange={event => setStatus(event.target.value)}>
                      <option>すべて</option>
                      {DIARY_OPS_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                    <span>{visible.length}件を表示</span>
                  </div>
                )}
                {screen === "pipeline" && !opsReady && <p className="ops-feedback ops-error" role="status">
                  運用データはまだ取得できません。新着受付がSheetsへ反映されるまでお待ちください。
                </p>}
                {screen === "pipeline" && opsReady && (
                  <div className="ops-kanban">
                    {DIARY_OPS_STAGES.map(stage => {
                      const stageItems = visible.filter(item => (stage.statuses as readonly string[]).includes(item.status));
                      return <section key={stage.title} className="ops-kanban-column">
                        <h2>{stage.title}<span>{stageItems.length}</span></h2>
                        {stageItems.map(item => <button type="button" key={item.id} className="ops-kanban-card" onClick={() => setSelectedId(item.id)}>
                          <strong>{item.restaurant}</strong><small>{serviceLabels[item.service] || item.service || "相談内容確認"}</small>
                          <p>{item.nextAction || "次の対応を設定"}</p>
                          <span className={overdue(item) ? "ops-date-late" : "ops-date"}>{readableDate(item.dueDate)}</span>
                        </button>)}
                        {!stageItems.length && <p className="ops-kanban-empty">まだ案件がありません</p>}
                      </section>;
                    })}
                  </div>
                )}
                {screen === "cases" && (
                  <section className="ops-table-shell">
                    <table className="ops-table"><thead><tr><th>店舗・企業</th><th>進捗</th><th>次の対応</th><th>期限</th><th>合意金額</th><th>詳細</th></tr></thead>
                      <tbody>{visible.map(item => <tr key={item.id}>
                        <td><strong>{item.restaurant}</strong><small>{item.contact}</small></td>
                        <td><span className="ops-status-tag">{opsReady ? item.status : "未取得"}</span></td>
                        <td>{opsReady ? (item.nextAction || "未設定") : "同期中"}</td>
                        <td className={opsReady && overdue(item) ? "ops-date-late" : ""}>{opsReady ? readableDate(item.dueDate) : "—"}</td>
                        <td>{opsReady ? formatYen(item.agreedFee) : "—"}</td>
                        <td><button className="ops-text-action" onClick={() => setSelectedId(item.id)}>開く ↗</button></td>
                      </tr>)}</tbody>
                    </table>
                    {!visible.length && <p className="ops-empty">検索条件に一致する案件はありません。</p>}
                  </section>
                )}
                {screen === "calendar" && !opsReady && <p className="ops-feedback ops-error" role="status">
                  来店・投稿予定は運用データの同期完了後に表示されます。
                </p>}
                {screen === "calendar" && opsReady && (
                  <section className="ops-panel ops-calendar">
                    <div className="ops-calendar-toolbar">
                      <div><span className="ops-eyebrow">VISIT & PUBLISH / SCHEDULE</span>
                        <h2>{calendarMonth.replace("-", "年")}月の予定</h2>
                        <p>来店日と投稿日を確認。予定を選ぶと案件詳細が開きます。</p>
                      </div>
                      <div className="ops-calendar-controls">
                        <button type="button" className="ops-button ops-secondary"
                          onClick={() => moveCalendarMonth(-1)} aria-label="前の月">←</button>
                        <label><span className="ops-visually-hidden">表示する月</span>
                          <input type="month" value={calendarMonth}
                            onChange={event => { if (/^\d{4}-\d{2}$/.test(event.target.value)) setCalendarMonth(event.target.value); }}/></label>
                        <button type="button" className="ops-button ops-secondary"
                          onClick={() => moveCalendarMonth(1)} aria-label="次の月">→</button>
                      </div>
                    </div>
                    <div className="ops-calendar-grid" aria-label={calendarMonth + "の来店・投稿予定"}>
                      {["日", "月", "火", "水", "木", "金", "土"].map(weekday =>
                        <span key={weekday} className="ops-calendar-weekday">{weekday}</span>)}
                      {calendarDays.map((day, idx) => {
                        const key = calendarMonth + "-" + String(day ?? "").padStart(2, "0");
                        const daily = day ? calendarEvents.filter(event => event.day === key) : [];
                        return <div key={idx} className={"ops-calendar-day" + (day ? "" : " is-blank")}>
                          {day && <><strong>{day}</strong>
                            {daily.map((event, eventIndex) =>
                              <button key={event.item.id + event.label + eventIndex} type="button"
                                className={event.label === "来店" ? "ops-calendar-visit" : "ops-calendar-post"}
                                onClick={() => setSelectedId(event.item.id)}
                                title={event.label + "・" + event.item.restaurant}>
                                <span>{event.label}</span> {event.item.restaurant}
                              </button>)}
                          </>}
                        </div>;
                      })}
                    </div>
                    <div className="ops-calendar-agenda">
                      {calendarEvents.map((event, index) =>
                        <button key={event.item.id + event.label + index} type="button"
                          onClick={() => setSelectedId(event.item.id)}>
                          <time dateTime={event.day}>{readableDate(event.day)}</time>
                          <span>{event.label}</span><strong>{event.item.restaurant}</strong>
                          <span aria-hidden="true">↗</span>
                        </button>)}
                    </div>
                    {!calendarEvents.length && <p className="ops-empty">この月の来店・投稿予定はまだありません。</p>}
                  </section>
                )}
                {screen === "finance" && !opsReady && <p className="ops-feedback ops-error" role="status">
                  売上・入金データは未取得です。0円とは判断しないでください。
                </p>}
                {screen === "finance" && opsReady && (
                  <section className="ops-panel ops-finance">
                    <div className="ops-panel-heading"><div><span className="ops-eyebrow">BILLING & REVENUE</span><h2>入金状況の確認</h2></div></div>
                    <div className="ops-metrics ops-finance-metrics"><div><span>合意金額</span><strong>{formatYen(contracted)}</strong></div><div><span>着金額</span><strong>{formatYen(items.reduce((sum, item) => sum + item.paidAmount, 0))}</strong></div><div><span>未回収</span><strong>{formatYen(unpaid)}</strong></div></div>
                    <div className="ops-table-shell"><table className="ops-table"><thead><tr><th>店舗・企業</th><th>ステータス</th><th>合意金額</th><th>入金済み</th><th>未収</th><th>詳細</th></tr></thead><tbody>
                    {items.filter(item => item.agreedFee > 0).map(item => <tr key={item.id}>
                      <td><strong>{item.restaurant}</strong></td><td>{item.status}</td><td>{formatYen(item.agreedFee)}</td><td>{formatYen(item.paidAmount)}</td><td>{formatYen(Math.max(0, item.agreedFee - item.paidAmount))}</td>
                      <td><button className="ops-text-action" onClick={() => setSelectedId(item.id)}>更新 ↗</button></td>
                    </tr>)}</tbody></table>
                    {!items.some(item => item.agreedFee) && <p className="ops-empty">成約金額が登録された案件はありません。</p>}</div>
                    <p className="ops-finance-disclaimer">※ 決済・請求書の発行は行いません。入金額は銀行などで着金を確認してから入力してください。</p>
                  </section>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {selected && <div className="ops-modal-shade" onMouseDown={event => { if (event.target === event.currentTarget) closeDetail(); }}>
        <section ref={dialogRef} className="ops-detail" role="dialog" aria-modal="true" aria-label={selected.restaurant + "の案件詳細"}>
          <header><div><span className="ops-eyebrow">CASE DETAIL</span><h2>{selected.restaurant}</h2><p>{selected.id}</p></div>
            <button ref={closeButtonRef} aria-label="閉じる" className="ops-close" onClick={closeDetail}>✕</button></header>
          <div className="ops-detail-body">
            <fieldset className="ops-detail-fields" disabled={Boolean(accessToken && !stateConnected)}>
              <label>進捗ステータス<select value={selected.status} onChange={event => updateCase(selected.id, { status: event.target.value as DiaryOpsStatus })}>
                {DIARY_OPS_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select></label>
              <label>次にやること<input maxLength={500} value={selected.nextAction} onChange={event => updateCase(selected.id, { nextAction: event.target.value })} placeholder="例：見積を返信する" /></label>
              <label>対応期限<input type="date" value={selected.dueDate.slice(0, 10)} onChange={event => updateCase(selected.id, { dueDate: event.target.value })} /></label>
              <label>来店予定日<input type="date" value={selected.visitDate.slice(0, 10)} onChange={event => updateCase(selected.id, { visitDate: event.target.value })} /></label>
              <label>投稿予定日<input type="date" value={selected.postDate.slice(0, 10)} onChange={event => updateCase(selected.id, { postDate: event.target.value })} /></label>
              <label>合意金額（税込）<input type="number" min={0} max={1000000000} value={selected.agreedFee} onChange={event => updateCase(selected.id, { agreedFee: Math.max(0, Number(event.target.value) || 0) })} /></label>
              <label>確認済み入金額<input type="number" min={0} max={1000000000} value={selected.paidAmount} onChange={event => updateCase(selected.id, { paidAmount: Math.max(0, Number(event.target.value) || 0) })} /></label>
              <label>投稿URL<input type="url" maxLength={300} value={selected.postUrl} onChange={event => updateCase(selected.id, { postUrl: event.target.value })} placeholder="https://www.instagram.com/p/..." /></label>
              <label className="ops-span-all">運用メモ<textarea value={selected.note} maxLength={2000} rows={4} onChange={event => updateCase(selected.id, { note: event.target.value })} placeholder="相手との合意条件や次回連絡の内容" /></label>
            </fieldset>
            <div className="ops-detail-original">
              <h3>受付内容（読み込み元）</h3>
              <dl><dt>受付日時</dt><dd>{selected.receivedAt || "不明"}</dd>
                <dt>担当者</dt><dd>{selected.contact || "未入力"}</dd>
                <dt>メール</dt><dd>{selected.email || "未入力"}</dd>
                <dt>PRプラン</dt><dd>{serviceLabels[selected.service] || selected.service || "未指定"}</dd>
                <dt>相談内容</dt><dd className="ops-original-message">{selected.message || "未入力"}</dd>
                <dt>紹介メニュー</dt><dd>{selected.featuredMenu || "未入力"}</dd>
                <dt>来店希望</dt><dd>{selected.visitPreference || "未入力"}</dd>
              </dl>
            </div>
          </div>
          <footer><p>{stateConnected
            ? "保存するとGoogle Sheetsの案件管理正本へ反映します。成約・入金は確認した内容のみ入力してください。"
            : "編集は端末内のみ。変更後はCSVを保存してください。"}
          </p>
            {stateConnected
              ? <button className="ops-button ops-primary" disabled={savingState}
                  onClick={() => { void persistSelectedCase(); }}>
                  {savingState ? "保存中…" : "Google Sheetsに保存 ↗"}
                </button>
              : <button className="ops-button ops-primary" onClick={() => { exportCsv(); editingBaseline.current = null; setSelectedId(null); }}>
                  変更内容をCSV保存 ↗
                </button>}
          </footer>
        </section>
      </div>}
    </div>
  );
}
