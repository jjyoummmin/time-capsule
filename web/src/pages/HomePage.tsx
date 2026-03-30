import { Buffer } from "buffer";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { mainnetClient, roundAt, timelockEncrypt } from "tlock-js";
import { createCapsule } from "../api";
import { sealMessage } from "../password";

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function HomePage() {
  const [message, setMessage] = useState("");
  const [openLocal, setOpenLocal] = useState(() => {
                            const t = new Date(Date.now() + 10 * 60 * 1000);
                            return toDatetimeLocalValue(t);
                          });
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; url: string } | null>(null);

  const previewOpenIso = useMemo(() => {
    const d = new Date(openLocal);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }, [openLocal]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setCreated(null);
    if (!message.trim()) {
      setErr("메시지를 입력해 주세요.");
      return;
    }
    const openAt = new Date(openLocal);
    if (Number.isNaN(openAt.getTime())) {
      setErr("오픈 시각이 올바르지 않습니다.");
      return;
    }
    const openMs = openAt.getTime();
    if (openMs <= Date.now()) {
      setErr("오픈 시각은 지금보다 미래여야 합니다.");
      return;
    }

    setBusy(true);
    try {
      const client = mainnetClient();
      const info = await client.chain().info();
      const targetRound = roundAt(openMs, info);
      const latest = await client.latest();
      if (targetRound <= latest.round) {
        setErr("선택한 시각이 너무 가깝습니다. 몇 초 뒤로 옮겨 보세요.");
        setBusy(false);
        return;
      }

      const inner = await sealMessage(message, password.trim() || null);
      const ciphertext = await timelockEncrypt(targetRound, Buffer.from(inner), client);

      const { id } = await createCapsule({
        ciphertext,
        openAtIso: openAt.toISOString(),
        targetRound,
        hasPassword: Boolean(password.trim()),
      });

      const url = `${window.location.origin}/c/${id}`;
      setCreated({ id, url });
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h1>새 타임캡슐</h1>
      <p className="lead">
        메시지는 <strong>브라우저에서</strong> drand 타임락으로 암호화된 뒤 서버에는 암호문만 저장됩니다.
        오픈 시각 이전에는 내용을 복호화할 수 없습니다.
      </p>

      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          <span>메시지</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            placeholder="미래의 나에게…"
            required
          />
        </label>

        <label className="field">
          <span>오픈 시각 (로컬)</span>
          <input
            type="datetime-local"
            value={openLocal}
            onChange={(e) => setOpenLocal(e.target.value)}
            required
          />
          {previewOpenIso && <small className="hint">UTC: {previewOpenIso}</small>}
        </label>

        <label className="field">
          <span>비밀번호 (선택)</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비워두면 시각만 맞으면 열림"
            autoComplete="new-password"
          />
        </label>

        {err && <div className="error">{err}</div>}

        <button type="submit" className="primary" disabled={busy}>
          {busy ? "암호화 및 저장 중…" : "캡슐 만들기"}
        </button>
      </form>

      {created && (
        <section className="result">
          <h2>공유 링크</h2>
          <p>
            이 주소를 저장해 두세요. 서버는 로그인을 제공하지 않습니다.
          </p>
          <div className="shareRow">
            <code className="url">{created.url}</code>
            <Link className="secondary" to={`/c/${created.id}`}>
              열기
            </Link>
          </div>
          <div className="qrBox">
            <QRCodeSVG value={created.url} size={160} level="M" />
          </div>
        </section>
      )}
    </div>
  );
}
