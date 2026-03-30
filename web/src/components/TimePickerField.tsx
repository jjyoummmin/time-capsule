import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const timeFmt = new Intl.DateTimeFormat("ko-KR", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatTimeKo(d: Date): string {
  return timeFmt.format(d);
}

function truncateToMinute(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), 0, 0);
}

function formatHHmmLocal(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function mergeLocalTime(day: Date, hour: number, minute: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0, 0);
}

function clampToBounds(t: Date, lo: Date, hi: Date): Date {
  const x = truncateToMinute(t).getTime();
  const a = truncateToMinute(lo).getTime();
  const b = truncateToMinute(hi).getTime();
  if (x < a) {
    return new Date(a);
  }
  if (x > b) {
    return new Date(b);
  }
  return truncateToMinute(t);
}

/** 15분 간격 슬롯 + 현재 선택 시각이 격자에 없으면 한 칸 끼워 넣기 */
export function buildTimeOptions(day: Date, minBound: Date, maxBound: Date, selected: Date): Date[] {
  const y = day.getFullYear();
  const mo = day.getMonth();
  const da = day.getDate();
  const minM = truncateToMinute(minBound);
  const maxM = truncateToMinute(maxBound);
  const opts: Date[] = [];

  for (let h = 0; h < 24; h++) {
    for (const mm of [0, 15, 30, 45]) {
      const t = new Date(y, mo, da, h, mm, 0, 0);
      if (t.getTime() >= minM.getTime() && t.getTime() <= maxM.getTime()) {
        opts.push(t);
      }
    }
  }

  const sel = truncateToMinute(selected);
  if (
    sel.getFullYear() === y &&
    sel.getMonth() === mo &&
    sel.getDate() === da &&
    sel.getTime() >= minM.getTime() &&
    sel.getTime() <= maxM.getTime() &&
    !opts.some((o) => o.getTime() === sel.getTime())
  ) {
    opts.push(sel);
    opts.sort((a, b) => a.getTime() - b.getTime());
  }

  return opts;
}

type TimePickerFieldProps = {
  value: Date;
  onChange: (next: Date) => void;
  minTime: Date;
  maxTime: Date;
};

export function TimePickerField({ value, onChange, minTime, maxTime }: TimePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const options = useMemo(
    () => buildTimeOptions(value, minTime, maxTime, value),
    [value, minTime, maxTime],
  );

  useLayoutEffect(() => {
    if (open && activeRef.current) {
      activeRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selectedMin = truncateToMinute(value).getTime();

  function applyHHmmFromInput(raw: string) {
    if (!raw || !/^\d{1,2}:\d{2}$/.test(raw)) {
      return;
    }
    const [hs, ms] = raw.split(":");
    const hour = parseInt(hs, 10);
    const minute = parseInt(ms, 10);
    if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return;
    }
    const next = mergeLocalTime(value, hour, minute);
    onChange(clampToBounds(next, minTime, maxTime));
  }

  return (
    <div className="time-picker" ref={rootRef}>
      <div className="time-picker-row">
        <input
          type="time"
          className="time-picker-input"
          step={60}
          value={formatHHmmLocal(value)}
          onChange={(e) => applyHHmmFromInput(e.target.value)}
          aria-label="시각 직접 입력 (24시간)"
        />
        <button
          type="button"
          className="time-picker-list-btn"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label="시간 목록에서 선택"
        >
          <span className="time-picker-chevron" aria-hidden />
        </button>
      </div>
      {open && (
        <div className="time-picker-menu" role="listbox">
          {options.map((t) => {
            const active = t.getTime() === selectedMin;
            return (
              <button
                key={t.getTime()}
                ref={active ? activeRef : undefined}
                type="button"
                role="option"
                aria-selected={active}
                className={"time-picker-option" + (active ? " time-picker-option--active" : "")}
                onClick={() => {
                  onChange(t);
                  setOpen(false);
                }}
              >
                {formatTimeKo(t)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
