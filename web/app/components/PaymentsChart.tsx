"use client";

import { useEffect, useRef, useState } from "react";
import { allProposals, dailyPayments, OUTCOMES, type ChartOutcome, type Day } from "../lib/dailyPayments";
import { formatUnits, type WalletToken } from "../lib/near";
import { Loading, Skeleton } from "./Skeleton";

const DAYS = 14;
const HEIGHT = 220;
const PAD = { left: 52, right: 10, top: 22, bottom: 28 };
const RETRY_MS = 3000;

/** The app's own outcome colours: lime only for paid, coral only for refused. Checked for colourblind separation. */
const FILL: Record<ChartOutcome, string> = { paid: "var(--lime)", refused: "var(--coral)", failed: "#6b6b6b" };
const NAME: Record<ChartOutcome, string> = { paid: "Paid", refused: "Refused", failed: "Failed" };

const dayLabel = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * The wallet's payments per UTC day for the last two weeks, in one token, against the daily cap the contract enforces.
 * Each wallet's come from the verdicts its agent asked the API for.
 */
export function PaymentsChart({ walletId, tokenId, token }: { walletId: string; tokenId: string; token: WalletToken }) {
  const [days, setDays] = useState<Day[] | null | "error">(null);

  // Read once; while the API can't be reached, try again every few seconds, as Activity does.
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () =>
      allProposals(walletId).then(
        (ps) => live && setDays(dailyPayments(ps, tokenId, DAYS)),
        () => {
          if (!live) return;
          setDays("error");
          timer = setTimeout(load, RETRY_MS);
        },
      );
    void load();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [walletId, tokenId]);

  if (days === "error") return <p className="mt-4 text-sm text-mute">Can&apos;t reach the API for this wallet&apos;s payments. Retrying every 3 seconds.</p>;
  if (days === null)
    return (
      <Loading label="Loading payments">
        <div className="mt-4 flex gap-7">
          {OUTCOMES.map((o) => (
            <Skeleton key={o} className="h-12 w-24" />
          ))}
        </div>
        <Skeleton className="mt-6 h-[220px] w-full rounded-[14px]" />
      </Loading>
    );

  const fmt = (raw: bigint) => formatUnits(raw.toString(), token.decimals);
  const total = (o: ChartOutcome) => days.reduce((sum, d) => sum + d.raw[o], BigInt(0));
  const count = (o: ChartOutcome) => days.reduce((sum, d) => sum + d.count[o], 0);
  const empty = OUTCOMES.every((o) => count(o) === 0);

  return (
    <>
      {!empty && (
        <dl className="mt-4 flex flex-wrap gap-x-7 gap-y-2 text-[13px] text-mute">
          {OUTCOMES.map((o) => (
            <div key={o} className="flex flex-col-reverse">
              <dt>
                {o} · {count(o)} payment{count(o) === 1 ? "" : "s"}
              </dt>
              <dd className="text-[22px] font-black tracking-[-0.02em] text-text">{fmt(total(o))}</dd>
            </div>
          ))}
        </dl>
      )}
      <ul className="mt-4 flex flex-wrap gap-4 text-[12.5px] text-soft">
        {OUTCOMES.map((o) => (
          <li key={o} className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 rounded-full" style={{ background: FILL[o] }} aria-hidden="true" />
            {NAME[o]}
          </li>
        ))}
      </ul>
      <Plot days={days} token={token} empty={empty} />
      {!empty && (
        <details className="mt-3 text-[13px] text-mute">
          <summary className="cursor-pointer hover:text-text">Show as a table</summary>
          <table className="mt-2 w-full font-mono text-xs [&_td]:border-t [&_td]:border-line [&_td]:px-2 [&_td]:py-1.5 [&_td]:text-right [&_td:first-child]:text-left [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-right [&_th]:font-medium [&_th:first-child]:text-left">
            <thead>
              <tr>
                <th>Day (UTC)</th>
                {OUTCOMES.map((o) => (
                  <th key={o}>{NAME[o]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days
                .filter((d) => OUTCOMES.some((o) => d.count[o]))
                .map((d) => (
                  <tr key={d.day}>
                    <td>{d.day}</td>
                    {OUTCOMES.map((o) => (
                      <td key={o}>
                        {fmt(d.raw[o])} ({d.count[o]})
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </details>
      )}
    </>
  );
}

/** A smooth line through the points that never overshoots them, so a day with nothing never dips below zero (monotone cubic). */
function monotonePath(pts: [number, number][]): string {
  const n = pts.length;
  if (n < 2) return n ? `M${pts[0][0]},${pts[0][1]}` : "";
  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0]);
  const slope = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / dx[i]);
  const tangent = pts.map((_, i) => {
    if (i === 0) return slope[0];
    if (i === n - 1) return slope[n - 2];
    const a = slope[i - 1];
    const b = slope[i];
    return a * b <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / a + (dx[i] + 2 * dx[i - 1]) / b);
  });
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i][0] + h},${pts[i][1] + h * tangent[i]} ${pts[i + 1][0] - h},${pts[i + 1][1] - h * tangent[i + 1]} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

/** The smallest of 1, 2, 2.5, 5 × 10^k at or above v, so the axis reads in round numbers. */
function niceCeil(v: number): number {
  const k = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 2.5, 5, 10].find((m) => m * k >= v * (1 - 1e-9)) ?? 10) * k;
}

/**
 * The top of the axis: the daily cap when the payments come near it, so the reader sees the headroom; otherwise the
 * payments' own scale, so small ones aren't flattened against zero, with the cap stated in text instead of drawn.
 */
function axisTop(dataMax: number, cap: number): { top: number; showCap: boolean } {
  if (cap > 0 && dataMax * 2.5 >= cap) return { top: niceCeil(Math.max(cap, dataMax)), showCap: true };
  return { top: dataMax > 0 ? niceCeil(dataMax * 1.15) : cap || 1, showCap: dataMax === 0 && cap > 0 };
}

/** Drawn back to front, so paid, the line the cap is about, sits on top. */
const DRAW_ORDER: ChartOutcome[] = ["failed", "refused", "paid"];

function Plot({ days, token, empty }: { days: Day[]; token: WalletToken; empty: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  // Drawn at the card's real width, so the axis text stays at its real size on every screen.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // Measure once now, then on every resize: the observer only reports on a painted frame, which a background tab never gets.
    setWidth(Math.floor(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const units = (raw: bigint) => Number(formatUnits(raw.toString(), token.decimals));
  const cap = units(BigInt(token.caps.daily));
  const { top, showCap } = axisTop(Math.max(0, ...days.flatMap((d) => OUTCOMES.map((o) => units(d.raw[o])))), cap);
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const x = (i: number) => PAD.left + (days.length > 1 ? (plotW * i) / (days.length - 1) : plotW / 2);
  // The last label ends at the plot's edge, so on a phone they need six days between them to stay apart.
  const every = width < 560 ? 6 : 2;
  const ticks = [0, top / 2, top];
  const points = (o: ChartOutcome) => days.map((d, i): [number, number] => [x(i), y(units(d.raw[o]))]);

  // The crosshair finds the nearest day, so the pointer never has to land on a 2px line.
  const nearest = (clientX: number) => {
    const left = box.current?.getBoundingClientRect().left ?? 0;
    const i = Math.round(((clientX - left - PAD.left) / (plotW || 1)) * (days.length - 1));
    return Math.min(days.length - 1, Math.max(0, i));
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setHover((h) => Math.min(days.length - 1, Math.max(0, (h ?? days.length - 1) + (e.key === "ArrowLeft" ? -1 : 1))));
  };

  return (
    <div
      ref={box}
      className="relative mt-2 rounded-[10px] outline-none focus-visible:ring-1 focus-visible:ring-soft"
      tabIndex={empty ? undefined : 0}
      aria-label={empty ? undefined : "Payments per day; use the arrow keys to read each day"}
      onKeyDown={empty ? undefined : onKey}
      onFocus={() => !empty && setHover((h) => h ?? days.length - 1)}
      onBlur={() => setHover(null)}
      onPointerLeave={() => setHover(null)}
    >
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          className="block"
          role="img"
          aria-label={`${token.symbol} paid, refused and failed per day for the last ${days.length} days, against a daily cap of ${formatUnits(token.caps.daily, token.decimals)}`}
        >
          <defs>
            {OUTCOMES.map((o) => (
              <linearGradient key={o} id={`wash-${o}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={FILL[o]} stopOpacity={0.16} />
                <stop offset="100%" stopColor={FILL[o]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="#2b2b2b" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-mute font-mono text-[11px] tabular-nums">
                {Number(t.toPrecision(3))}
              </text>
            </g>
          ))}
          {showCap ? (
            <>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(cap)} y2={y(cap)} stroke="var(--soft)" strokeWidth={1} />
              <text x={width - PAD.right} y={y(cap) - 7} textAnchor="end" className="fill-soft font-mono text-[11px]">
                daily cap {formatUnits(token.caps.daily, token.decimals)} {token.symbol}
              </text>
            </>
          ) : (
            <text x={width - PAD.right} y={PAD.top - 8} textAnchor="end" className="fill-mute font-mono text-[11px]">
              daily cap {formatUnits(token.caps.daily, token.decimals)} {token.symbol}, above this scale
            </text>
          )}
          {days.map(
            (d, i) =>
              (days.length - 1 - i) % every === 0 && (
                // The first and last labels sit inside the plot's edges, so they aren't cut off on a phone.
                <text
                  key={d.day}
                  x={x(i)}
                  y={HEIGHT - 8}
                  textAnchor={i === days.length - 1 ? "end" : i === 0 ? "start" : "middle"}
                  className="fill-mute font-mono text-[11px]"
                >
                  {dayLabel(d.day)}
                </text>
              ),
          )}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--soft)" strokeOpacity={0.35} strokeWidth={1} />}
          {!empty &&
            DRAW_ORDER.map((o) => {
              const pts = points(o);
              const line = monotonePath(pts);
              return (
                <g key={o}>
                  <path d={`${line} L${pts[pts.length - 1][0]},${y(0)} L${pts[0][0]},${y(0)} Z`} fill={`url(#wash-${o})`} />
                  <path d={line} fill="none" stroke={FILL[o]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                </g>
              );
            })}
          {!empty &&
            DRAW_ORDER.flatMap((o) =>
              days.map((d, i) =>
                // A dot marks each day with a payment; at the crosshair every series gets one. Ringed in the card's surface.
                d.raw[o] > BigInt(0) || hover === i ? (
                  <circle key={`${o}-${i}`} cx={x(i)} cy={y(units(d.raw[o]))} r={hover === i ? 5 : 4} fill={FILL[o]} stroke="var(--ink-2)" strokeWidth={2} />
                ) : null,
              ),
            )}
          {!empty && (
            <rect
              x={PAD.left - 12}
              y={PAD.top}
              width={plotW + 24}
              height={plotH}
              fill="transparent"
              onPointerMove={(e) => setHover(nearest(e.clientX))}
              onPointerDown={(e) => setHover(nearest(e.clientX))}
            />
          )}
        </svg>
      )}
      {empty && width > 0 && (
        <p className="pointer-events-none absolute inset-x-0 top-[38%] text-center text-[13.5px] text-mute" style={{ paddingLeft: PAD.left }}>
          <b className="text-text">No payments yet.</b>
          <br />
          They appear here as the agent proposes them.
        </p>
      )}
      {hover !== null && <Tip day={days[hover]} token={token} left={x(hover) + 14 > width - 200 ? x(hover) - 202 : x(hover) + 14} />}
    </div>
  );
}

function Tip({ day, token, left }: { day: Day; token: WalletToken; left: number }) {
  return (
    <div className="pointer-events-none absolute top-8 z-10 w-[188px] rounded-[12px] border border-line bg-[#0d0d0d] px-3 py-2.5 text-[12.5px] shadow-[0_8px_24px_#0008]" style={{ left: Math.max(0, left) }}>
      <p className="mb-1 font-bold">{dayLabel(day.day)}</p>
      {OUTCOMES.map((o) => (
        <p key={o} className="flex justify-between gap-3 text-mute">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full" style={{ background: FILL[o] }} aria-hidden="true" />
            {NAME[o]} · {day.count[o]}
          </span>
          <span className="font-mono text-xs font-bold text-text tabular-nums">{formatUnits(day.raw[o].toString(), token.decimals)}</span>
        </p>
      ))}
      <p className="mt-1 text-right font-mono text-[11px] text-mute">{token.symbol}</p>
    </div>
  );
}
