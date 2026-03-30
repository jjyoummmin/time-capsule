import { Buffer } from "buffer";
import { ko } from "date-fns/locale";
import { useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { mainnetClient, roundAt, timelockEncrypt } from "tlock-js";
import { TimePickerField } from "../components/TimePickerField";
import { createCapsule } from "../api";
import { sealMessage } from "../password";

import "react-datepicker/dist/react-datepicker.css";

function HeroTimeCapsuleIcon() {
  return (
    <svg
      className="home-hero-svg"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="homeHeroGrad" x1="8" y1="6" x2="32" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--accent)" />
          <stop offset={1} stopColor="var(--violet)" />
        </linearGradient>
      </defs>
      <path
        d="M12.8 9.5H27.2L20 20L27.2 30.5H12.8L20 20L12.8 9.5Z"
        fill="none"
        stroke="url(#homeHeroGrad)"
        strokeWidth={1.28}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function startOfLocalDay(d: Date): Date {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return t;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 날짜만 바꾼 뒤 그날 허용 범위 안으로 맞춤 */
function clampOpenAtToDayBounds(merged: Date): Date {
  const n = new Date();
  let lo: Date;
  const hi = new Date(merged.getFullYear(), merged.getMonth(), merged.getDate(), 23, 59, 0, 0);
  if (isSameLocalDay(merged, n)) {
    lo = n;
  } else {
    lo = startOfLocalDay(merged);
  }
  let t = merged.getTime();
  if (t < lo.getTime()) {
    const step = 15 * 60 * 1000;
    t = Math.ceil(lo.getTime() / step) * step;
    if (t > hi.getTime()) {
      return hi;
    }
    return new Date(t);
  }
  if (t > hi.getTime()) {
    return hi;
  }
  return new Date(merged.getFullYear(), merged.getMonth(), merged.getDate(), merged.getHours(), merged.getMinutes(), 0, 0);
}

export function HomePage() {
  const [message, setMessage] = useState("");
  const [openAt, setOpenAt] = useState(() => new Date(Date.now() + 10 * 60 * 1000));
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; url: string } | null>(null);

  const startOfToday = useMemo(() => startOfLocalDay(new Date()), []);

  const { minTime, maxTime } = useMemo(() => {
    const n = new Date();
    const sel = openAt;
    if (isSameLocalDay(sel, n)) {
      return {
        minTime: n,
        maxTime: new Date(sel.getFullYear(), sel.getMonth(), sel.getDate(), 23, 59, 0, 0),
      };
    }
    return {
      minTime: startOfLocalDay(sel),
      maxTime: new Date(sel.getFullYear(), sel.getMonth(), sel.getDate(), 23, 59, 0, 0),
    };
  }, [openAt]);

  const previewOpenIso = useMemo(() => {
    const t = openAt.getTime();
    return Number.isNaN(t) ? null : openAt.toISOString();
  }, [openAt]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setCreated(null);
    if (!message.trim()) {
      setErr("메시지를 입력해 주세요.");
      return;
    }
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
    <div className="panel home-panel">
      <header className="home-hero">
        <div className="home-hero-title-row">
          <span className="home-hero-icon-wrap" aria-hidden>
            <HeroTimeCapsuleIcon />
          </span>
          <div className="home-hero-headlines">
            <h1>온라인 타임캡슐</h1>
            <p className="home-hero-tagline">지정한 시각이 될 때까지 잠긴 메시지를 만듭니다.</p>
          </div>
        </div>
      </header>

      <section className="home-intro" role="note">
        <div className="home-intro-card">
          <div className="home-intro-highlights">
            <div className="home-intro-point">
              <span className="home-intro-point-badge" aria-hidden>
                1
              </span>
              <p>
                정해 둔 시각이 되기 전에는, 서버를 포함해{" "}
                <strong>정상적인 방법으로는 내용을 열 수 없습니다.</strong>
              </p>
            </div>
            <div className="home-intro-point">
              <span className="home-intro-point-badge" aria-hidden>
                2
              </span>
              <p>
                비밀번호를 넣었다면, 시각이 지나도{" "}
                <strong>비밀번호가 맞지 않으면 내용을 볼 수 없습니다.</strong>
              </p>
            </div>
          </div>
          <div className="home-intro-foot">
            <p>
              메시지와 비밀번호는 이 브라우저 안에서만 다루며, 평문·비밀번호는 서버로 보내지 않습니다.
            </p>
            <p>
              drand 타임락으로 암호화한 뒤 서버에는 암호문과 열림에 필요한 시각(라운드) 정보만 저장됩니다.
            </p>
          </div>
        </div>
      </section>

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

        <div className="field">
          <span>오픈 날짜·시각 (기기 로컬)</span>
          <div className="datetime-row">
            <div className="datetime-picker-shell">
              <DatePicker
                selected={openAt}
                onChange={(d: Date | null) => {
                  if (!d) {
                    return;
                  }
                  setOpenAt((prev) => {
                    const merged = new Date(
                      d.getFullYear(),
                      d.getMonth(),
                      d.getDate(),
                      prev.getHours(),
                      prev.getMinutes(),
                      0,
                      0,
                    );
                    return clampOpenAtToDayBounds(merged);
                  });
                }}
                locale={ko}
                showTimeSelect={false}
                dateFormat="yyyy.MM.dd"
                minDate={startOfToday}
                placeholderText="날짜 선택"
                wrapperClassName="datetime-picker-wrap"
                calendarClassName="capsule-datepicker-calendar"
                popperClassName="capsule-datepicker-popper"
                popperPlacement="bottom-start"
                showPopperArrow={false}
              />
            </div>
            <TimePickerField value={openAt} onChange={setOpenAt} minTime={minTime} maxTime={maxTime} />
          </div>
          {previewOpenIso && (
            <small className="hint">
              UTC: {previewOpenIso} · 위 시각은 이 기기의 타임존 기준입니다.
            </small>
          )}
        </div>

        <label className="field">
          <span>비밀번호 (선택)</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="입력하지 않는 경우 비밀번호 없이 만들어집니다."
            autoComplete="new-password"
          />
          <small className="hint">
            비밀번호를 설정한 경우 <strong>분실 시 복호화 불가</strong> (서버에도 저장되지 않음).
          </small>
        </label>

        {err && <div className="error">{err}</div>}

        <button type="submit" className="primary" disabled={busy}>
          {busy ? "암호화 및 저장 중…" : "캡슐 만들기"}
        </button>
      </form>

      {created && (
        <section className="result">
          <h2>공유 링크</h2>
          <p className="result-hint">
            이 주소를 꼭 저장해 두세요. 로그인 없이 링크만으로 열 수 있습니다.
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
