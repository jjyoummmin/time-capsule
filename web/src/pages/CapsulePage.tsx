import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { mainnetClient, roundTime, timelockDecrypt } from "tlock-js";
import { getCapsule, type CapsuleDTO } from "../api";
import { openMessage } from "../password";

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
          setErr("비밀번호가 올바르지 않거나, 비밀번호 없이 만들었을 수 있습니다.");
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
      <div className="panel">
        <p className="error">{loadErr}</p>
        <Link to="/">처음으로</Link>
      </div>
    );
  }

  if (!cap || latestRound === null) {
    return (
      <div className="panel">
        <p>불러오는 중…</p>
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
      <p className="meta muted">
        목표 라운드 <strong>{cap.targetRound}</strong>
        {approxKst && (
          <>
            {" "}
            · 비콘 기준 대략 <strong>{approxKst}</strong> (KST, 네트워크 지연에 따라 달라질 수 있음)
          </>
        )}
      </p>

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
          <Link to="/">새 캡슐 만들기</Link>
        </div>
      )}
    </div>
  );
}
