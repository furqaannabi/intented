# Design: Carbon

The look William chose on 1 November 2026 for the landing page. The feed, receipt and mandate pages use the same system.

## Colour

Four colours, and each one has one job. Tokens live in `app/globals.css` and are exposed to Tailwind as `ink`, `ink-2`, `line`, `text`, `mute`, `card`, `soft`, `lime`, `lime-ink` and `coral`.

| Token | Value | Job |
| --- | --- | --- |
| `ink` / `ink-2` / `line` | #111111 / #1a1a1a / #2b2b2b | Every surface: page, panels, receipts, borders |
| `text` / `mute` | #f2f2f2 / #a3a3a3 | Body text and secondary text |
| `card` (+ `soft` highlight #d4d4d4) | #262626 | The agent and its wallet card; "in progress" (waves, judging dots) |
| `lime` (on `lime-ink`) | #c8ff3d | ALLOW, a paid payment, the primary button. Nothing else |
| `coral` | #ff5b4a | DENY, a refused payment, the agent being tricked. Nothing else |

Don't add colours. Panels stay neutral grey: no white or tinted paper. A verdict colours only its own line, never a whole panel.

## Type

- **Schibsted Grotesk** (400, 500, 700, 900) for everything readable. Headlines are 900, with tracking around -0.035em to -0.04em and line height 0.93–1. Cap display sizes at 96px.
- **Martian Mono** (400, 500) only for data: account ids, amounts, transaction hashes, verdict JSON, and what the agent and the paywall say.

Both load through `next/font/google` in `app/layout.tsx`.

## Shape and depth

- Radii: 999px for buttons, 16–18px for panels, 24–30px for the card and the terminal.
- Shadows have a vertical offset and a soft blur (`0 30px 70px rgb(0 0 0 / .55)`). Glows are allowed only on a verdict screen, and stay faint.

## Motion

- **One main animation:** the tap-to-pay hero (`app/components/TapToPay.tsx`).
  - The agent reads a paywall and pays the vendor (ALLOW).
  - A poisoned paywall then tricks the agent into paying the attacker (DENY).
  - Each verdict prints a receipt up out of the terminal. The next verdict pulls the last receipt back in.
- **One supporting animation:** the "how it works" line draws as the section scrolls into view. It's pure CSS (`animation-timeline: view()`), and browsers without it show the line fully drawn.
- No entrance animation on every section.
- Ease out (`cubic-bezier(0.16, 1, 0.3, 1)` or similar). No bounce.
- With `prefers-reduced-motion`, the hero shows its end state (the attack refused) and nothing moves.

## Icons

Drawn SVG in `app/components/icons.tsx` (check, cross, arrow), with one stroke weight. No Unicode glyphs or emoji as icons.

## Copy rules

These come from the trust rules in `CLAUDE.md`.
- Every number and hash on the page comes from a real testnet run or `make redteam`. Name the date and the model next to red-team numbers.
- Never say the contract verifies the TDX quote. The attestation is verified off-chain and the signer is allowlisted.
- Show the model's reason verbatim when a page shows one.
- Plain statements. No marketing words.

## CSS files

`next.config.ts` runs every `.css` file through the Tailwind loader as global CSS, so CSS modules don't work here. Component CSS is plain CSS with a prefix per component: `ttp-` in `components/tap-to-pay.css` and `home-` in `app/home.css`.
