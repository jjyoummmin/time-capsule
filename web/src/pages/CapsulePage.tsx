import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { mainnetClient, roundTime, timelockDecrypt } from "tlock-js";
import { getCapsule, type CapsuleDTO } from "../api";
import { openMessage } from "../password";

function formatRemainingKo(targetMs: number, nowMs: number): string {
  let ms = targetMs - nowMs;
  if (ms < 0) {
    ms = 0;
  }
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const d = String(days).padStart(2, "0");
  const h = String(hours).padStart(2, "0");
  const m = String(minutes).padStart(2, "0");
  const s = String(seconds).padStart(2, "0");
  return `${d}일 ${h}시간 ${m}분 ${s}초 남음`;
}

export function CapsulePage() {
  const { id } = useParams<{ id: string }>();
  const [cap, setCap] = useState<CapsuleDTO | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [latestRound, setLatestRound] = useState<number | null>(null);
  const [approxOpenMs, setApproxOpenMs] = useState<number | null>(null);

  const [phase, setPhase] = useState<"locked" | "open" | "revealed">("locked");
  const [pw, setPw] = useState("");
  const [plain, setPlain] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const refreshChain = useCallback(async (dto: CapsuleDTO) => {
    const client = mainnetClient();
    const latest = await client.latest();
    setLatestRound(latest.round);
    const info = await client.chain().info();
    setApproxOpenMs(roundTime(info, dto.targetRound));
  }, []);

  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const dto = await getCapsule(id);
        if (cancelled) {
          return;
        }
        setCap(dto);
        await refreshChain(dto);
      } catch (e) {
        if (!cancelled) {
          setLoadErr(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, refreshChain]);

  useEffect(() => {
    if (!cap || latestRound === null) {
      return;
    }
    if (latestRound < cap.targetRound) {
      setPhase("locked");
    } else {
      setPhase((p) => (p === "revealed" ? "revealed" : "open"));
    }
  }, [cap, latestRound]);

  useEffect(() => {
    if (!cap || phase !== "locked") {
      return;
    }
    const t = window.setInterval(() => {
      void refreshChain(cap);
    }, 10_000);
    return () => window.clearInterval(t);
  }, [cap, phase, refreshChain]);

  useEffect(() => {
    if (!cap || latestRound === null || latestRound >= cap.targetRound || approxOpenMs == null) {
      return;
    }
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [cap, latestRound, approxOpenMs]);

  async function tryUnlock() {
    if (!cap) {
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const client = mainnetClient();
      const outer = await timelockDecrypt(cap.ciphertext, client);
      if (!cap.hasPassword) {
        const text = await openMessage(new Uint8Array(outer), null);
        setPlain(text);
        setPhase("revealed");
        return;
      }
      const text = await openMessage(new Uint8Array(outer), pw);
      setPlain(text);
      setPhase("revealed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (cap.hasPassword) {
        if (msg.includes("비밀번호") || (e instanceof DOMException && e.name === "OperationError")) {
          setErr("비밀번호가 올바르지 않습니다.");
        } else {
          setErr(msg);
        }
      } else {
        setErr(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  if (loadErr) {
    return (
      <div className="panel panel-error">
        <p className="error">{loadErr}</p>
        <Link className="secondary" to="/">
          처음으로
        </Link>
      </div>
    );
  }

  if (!cap || latestRound === null) {
    return (
      <div className="panel panel-loading">
        <span className="spinner" aria-hidden />
        <span>캡슐을 불러오는 중…</span>
      </div>
    );
  }

  const locked = latestRound < cap.targetRound;
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/c/${cap.id}` : "";

  const approxKst =
    approxOpenMs != null
      ? new Date(approxOpenMs).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
      : null;

  return (
    <div className="panel">
      <h1>타임캡슐</h1>
      <div className="capsule-meta">
        {locked ? (
          <>
            {approxKst ? (
              <p className="meta">
                이 캡슐은 <strong>{approxKst}</strong> 이후부터 열 수 있어요. (KST)
              </p>
            ) : (
              <p className="meta muted">열리는 시각을 불러오는 중…</p>
            )}
            {approxOpenMs != null && (
              <p className="capsule-countdown" aria-live="polite">
                {formatRemainingKo(approxOpenMs, nowTick)}
              </p>
            )}
            <p className="meta-foot muted small">
              목표 라운드 {cap.targetRound}. drand 네트워크 지연 등으로 실제 시각은 앞뒤로 조금 달라질 수
              있습니다.
            </p>
          </>
        ) : approxKst ? (
          <p className="meta">
            이 캡슐은 <strong>{approxKst}</strong> 에 열렸습니다.
          </p>
        ) : (
          <p className="meta">이 캡슐은 열렸습니다.</p>
        )}
      </div>

      {shareUrl && (
        <div className="inlineQr">
          <QRCodeSVG value={shareUrl} size={96} level="L" />
          <div>
            <small>공유</small>
            <div className="url small">{shareUrl}</div>
          </div>
        </div>
      )}

      {locked && (
        <div className="notice">
          <h2>아직 열리지 않았습니다</h2>
          <p>
            drand 네트워크에서 이 캡슐의 목표 라운드가 나오기 전입니다.
            현재 최신 라운드는 <strong>{latestRound}</strong> 입니다.
          </p>
          <p className="muted small">
            새로고침을 해 두면 목표 시각에 가깝게 자동으로 상태가 바뀝니다.
          </p>
        </div>
      )}

      {!locked && phase !== "revealed" && (
        <div className="unlock">
          <h2>열 수 있습니다</h2>
          {cap.hasPassword && (
            <label className="field">
              <span>비밀번호</span>
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="off"
              />
            </label>
          )}
          {err && <div className="error">{err}</div>}
          <button type="button" className="primary" onClick={() => void tryUnlock()} disabled={busy}>
            {busy ? "복호화 중…" : "내용 보기"}
          </button>
        </div>
      )}

      {phase === "revealed" && plain != null && (
        <div className="revealed">
          <h2>메시지</h2>
          <pre className="message">{plain}</pre>
          <Link className="secondary" to="/">
            새 캡슐 만들기
          </Link>
        </div>
      )}
    </div>
  );
}
