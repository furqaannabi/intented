"use client";

import { useEffect, useRef, useState } from "react";
import { allProposals, dailyPayments, OUTCOMES, type ChartOutcome, type Day } from "../lib/dailyPayments";
import { formatUnits, WALLET_ID, type WalletToken } from "../lib/near";
import { Loading, Skeleton } from "./Skeleton";

const DAYS = 14;
const HEIGHT = 220;
const PAD = { left: 52, right: 8, top: 22, bottom: 28 };
const BAR_MAX = 24;

/** The app's own outcome colours: lime only for paid, coral only for refused. Checked for colourblind separation. */
const FILL: Record<ChartOutcome, string> = { paid: "var(--lime)", refused: "var(--coral)", failed: "#6b6b6b" };
const NAME: Record<ChartOutcome, string> = { paid: "Paid", refused: "Refused", failed: "Failed" };

const dayLabel = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * The wallet's payments per UTC day for the last two weeks, in one token, against the daily cap the contract enforces.
 * Only the demo wallet has proposals in the API today; every other wallet gets the empty chart.
 */
export function PaymentsChart({ walletId, tokenId, token }: { walletId: string; tokenId: string; token: WalletToken }) {
  const served = walletId === WALLET_ID;
  const [days, setDays] = useState<Day[] | null | "error">(served ? null : dailyPayments([], tokenId, DAYS));

  useEffect(() => {
    if (!served) return;
    let live = true;
    allProposals().then(
      (ps) => live && setDays(dailyPayments(ps, tokenId, DAYS)),
      () => live && setDays("error"),
    );
    return () => {
      live = false;
    };
  }, [served, tokenId]);

  if (days === "error") return <p className="mt-4 text-sm text-mute">Couldn&apos;t reach the API for this wallet&apos;s payments. Reload to try again.</p>;
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
            <span className="size-2.5 rounded-[3px]" style={{ background: FILL[o] }} aria-hidden="true" />
            {NAME[o]}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span className="h-0 w-3.5 border-t border-soft" aria-hidden="true" />
          Daily cap
        </li>
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
  const top = Math.max(cap, ...days.map((d) => OUTCOMES.reduce((s, o) => s + units(d.raw[o]), 0))) || 1;
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const band = plotW / days.length;
  const bar = Math.min(BAR_MAX, band * 0.55);
  const every = width < 560 ? 4 : 2;
  const ticks = [0, cap / 2, cap];

  return (
    <div ref={box} className="relative mt-2" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          className="block"
          role="img"
          aria-label={`${token.symbol} paid, refused and failed per day for the last ${days.length} days, against a daily cap of ${formatUnits(token.caps.daily, token.decimals)}`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === cap ? "var(--soft)" : "#2b2b2b"} strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-mute font-mono text-[11px] tabular-nums">
                {Number(t.toPrecision(3))}
              </text>
            </g>
          ))}
          <text x={width - PAD.right} y={y(cap) - 7} textAnchor="end" className="fill-soft font-mono text-[11px]">
            daily cap {formatUnits(token.caps.daily, token.decimals)} {token.symbol}
          </text>
          {days.map((d, i) => {
            const cx = PAD.left + band * i + band / 2;
            const shown = OUTCOMES.filter((o) => d.raw[o] > BigInt(0));
            let base = y(0);
            return (
              <g key={d.day}>
                {hover === i && <rect x={PAD.left + band * i} y={PAD.top} width={band} height={plotH} fill="rgb(255 255 255 / 0.04)" />}
                {shown.map((o, j) => {
                  // Stacked from the baseline: a 2px surface gap between segments, 4px rounding on the top one only.
                  const h = Math.max(3, (units(d.raw[o]) / top) * plotH);
                  const gap = j ? 2 : 0;
                  const r = j === shown.length - 1 ? Math.min(4, h / 2) : 0;
                  const y0 = base - gap;
                  const y1 = base - h;
                  base = y1;
                  const x0 = cx - bar / 2;
                  const x1 = cx + bar / 2;
                  const path = r
                    ? `M${x0},${y0} V${y1 + r} Q${x0},${y1} ${x0 + r},${y1} H${x1 - r} Q${x1},${y1} ${x1},${y1 + r} V${y0} Z`
                    : `M${x0},${y0} V${y1} H${x1} V${y0} Z`;
                  return <path key={o} d={path} fill={FILL[o]} />;
                })}
                {(days.length - 1 - i) % every === 0 && (
                  // The last day's label ends at the plot's edge, so it isn't cut off on a phone.
                  <text
                    x={i === days.length - 1 ? width - PAD.right : cx}
                    y={HEIGHT - 8}
                    textAnchor={i === days.length - 1 ? "end" : "middle"}
                    className="fill-mute font-mono text-[11px]"
                  >
                    {dayLabel(d.day)}
                  </text>
                )}
                {!empty && (
                  <rect
                    x={PAD.left + band * i}
                    y={PAD.top}
                    width={band}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onClick={() => setHover(i)}
                  />
                )}
              </g>
            );
          })}
        </svg>
      )}
      {empty && width > 0 && (
        <p className="pointer-events-none absolute inset-x-0 top-[38%] text-center text-[13.5px] text-mute" style={{ paddingLeft: PAD.left }}>
          <b className="text-text">No payments yet.</b>
          <br />
          They appear here as the agent proposes them.
        </p>
      )}
      {hover !== null && <Tip day={days[hover]} token={token} left={Math.min(PAD.left + band * hover + band / 2 + 12, width - 196)} />}
    </div>
  );
}

function Tip({ day, token, left }: { day: Day; token: WalletToken; left: number }) {
  return (
    <div className="pointer-events-none absolute top-8 z-10 w-[188px] rounded-[12px] border border-line bg-[#0d0d0d] px-3 py-2.5 text-[12.5px] shadow-[0_8px_24px_#0008]" style={{ left: Math.max(0, left) }}>
      <p className="mb-1 font-bold">{dayLabel(day.day)}</p>
      {OUTCOMES.map((o) => (
        <p key={o} className="flex justify-between gap-3 text-soft">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-[2px]" style={{ background: FILL[o] }} aria-hidden="true" />
            {NAME[o]} · {day.count[o]}
          </span>
          <span className="font-mono text-xs tabular-nums">{formatUnits(day.raw[o].toString(), token.decimals)}</span>
        </p>
      ))}
      <p className="mt-1 text-right font-mono text-[11px] text-mute">{token.symbol}</p>
    </div>
  );
}
