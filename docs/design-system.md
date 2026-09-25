# Qurious design system (proposed, pending the content owner's approval)

The goal is the clarity of a good textbook with the feel of a well-made app: calm, warm, precise. It must not feel like a hackathon demo or a game. A live version of everything below is at **`/design`** in the web app.

## Principles
1. **One idea per screen.** Short paragraphs (≤ 3 sentences), generous whitespace, no walls of text.
2. **Show, then tell.** Each lesson step leads with a visual or interactive; text supports it.
3. **Color is meaning, used sparingly.** One accent for actions and progress. Two semantic colors for |0⟩ and |1⟩, used the same way everywhere (bars, Bloch sphere poles, kets, circuit outputs). Color never carries meaning alone: there's always a label, icon or pattern too.
4. **Math is welcome, never forced.** Collapsed by default, revealed in layers. Every equation has a plain-English line.
5. **Motion explains, never decorates.** 150–250 ms transitions that show cause and effect (a state moving after a gate). Reduced-motion users get instant updates.
6. **Progress, not points.** Distance to the goal ("3 steps from your answer") and a visible map. No streaks, badges or confetti for its own sake.

## Color tokens
Warm neutrals (stone), one indigo accent, and a cyan / amber pair for |0⟩ / |1⟩, chosen to stay distinguishable with the common forms of color blindness. Every text pairing meets **WCAG AA** (at least 4.5:1). The figures are contrast ratios against the page background, computed with the WCAG formula; the lowest is 4.77:1.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `bg` | `#FAF9F7` | `#1A1816` | Page background (warm, never pure white or pure black) |
| `surface` | `#FFFFFF` | `#23201D` | Cards, panels |
| `surface-muted` | `#F3F1EE` | `#2C2926` | Insets, code, the collapsed math drawer |
| `border` | `#E4E0DA` | `#3B3733` | Hairlines |
| `ink` | `#1C1917` (16.6:1) | `#F5F3F0` (16.0:1) | Body text |
| `ink-muted` | `#57534E` (7.3:1) | `#B8B2AA` (8.4:1) | Secondary text |
| `accent` | `#4338CA` (7.5:1) | `#A5B4FC` (8.9:1) | Links, focus rings, progress |
| `accent-solid` | `#4F46E5` + white text (6.3:1) | same | Primary buttons |
| `accent-soft` | `#EEF0FF` | `#2A2A4A` | Selected states, "you are here" |
| `zero` | `#0E7490` (5.1:1) | `#22D3EE` (9.8:1) | Everything about **\|0⟩** |
| `one` | `#B45309` (4.8:1) | `#FBBF24` (10.6:1) | Everything about **\|1⟩** |
| `success` | `#15803D` (4.8:1) | `#4ADE80` (10.2:1) | Correct answers (always with a ✓ icon and the word "Correct") |
| `danger` | `#BE123C` (6.0:1) | `#FB7185` (6.6:1) | Wrong answers (always with a ✗ icon and "Not quite") |
| `caution-soft` / `caution-ink` | `#FFF4E5` / `#8A3B0B` | `#3A2A17` / `#FCD9A8` | "Where this analogy breaks" callouts |

## Typography
- **Inter** for all text. **JetBrains Mono** for kets (|ψ⟩), gate names and code. Both are loaded with `next/font`, so there's no layout shift.
- The scale (rem, line height) is modest on purpose, because lessons are read on phones.

| Role | Size | Weight | Line height |
| --- | --- | --- | --- |
| Display (question) | 1.875rem (30px), 2.25rem on ≥ sm | 600 | 1.15 |
| H1 (lesson title) | 1.5rem (24px) | 600 | 1.25 |
| H2 (section) | 1.125rem (18px) | 600 | 1.35 |
| Body | 1.0625rem (17px) | 400 | 1.6 |
| Small / captions | 0.875rem (14px) | 400 | 1.5 |
| Eyebrow | 0.75rem (12px), uppercase, tracking 0.08em | 600 | 1.4 |

Body copy is capped at **~65 characters per line** (`max-w-prose`).

## Spacing, shape and elevation
- **4 px base grid.** Common steps: 8, 12, 16, 24, 32, 48. Screen gutter is 16 px on phones and 24 px from tablet up.
- **Radius:** 8 px (controls), 12 px (cards), 16 px (large panels), full (pills).
- **Elevation:** a single soft shadow for raised cards (`0 1px 2px rgb(0 0 0 / 0.05), 0 4px 16px rgb(0 0 0 / 0.04)`); in dark mode, borders replace shadows.
- **Focus:** 2 px accent ring with a 2 px offset on every interactive element.
- **Touch targets:** ≥ 44 × 44 px.

## Core components
| Component | Purpose / rules |
| --- | --- |
| **QuestionCard** | Home screen entry point: the question in display type, estimated minutes, "N ideas to your answer." Disabled cards say "Coming soon" in text, not just grey. |
| **Button** | `primary` (accent-solid), `secondary` (surface + border), `ghost`. One primary per screen. |
| **Ket** | Monospace ket with its semantic color: \|0⟩ in `zero`, \|1⟩ in `one`, others in ink. |
| **ProbabilityBars** | One bar per basis state; \|0⟩-type bars use `zero` with a solid fill, \|1⟩-type bars use `one` with a diagonal hatch, so they differ without color; the exact % is printed. |
| **Callout** | `analogy` (accent-soft, lightbulb icon) and `breaks` (caution-soft, "Where this analogy breaks" heading, warning icon). |
| **MathLayers** | "Show me the math" → level 1; "Show me more" → next level. KaTeX, each equation followed by its plain-English line. |
| **CheckQuestion** | Lettered options (A, B, C) as large radio cards. Feedback shows icon + word + explanation. After a wrong answer the alternate explanation appears, then a retry. |
| **StepProgress** | "3 steps from your answer" plus a slim segmented bar. Never "Lesson 4 of 30." |
| **PathMap** | Subway-style map (React Flow): done stops filled, current stop ringed in accent, future stops outlined, the goal as a flag. Labels always visible. |
| **DetourButton** | "Wait, why?" opens the current concept's prerequisites; a banner reads "Detour: … · Back to your path." |
| **ThemeToggle** | Light / Dark / System. Applied before first paint (no flash). |

## Accessibility checklist (applies to every screen)
- All interactives are keyboard operable (sliders with arrow keys, gates placeable with Enter as an alternative to drag-and-drop).
- 3D and canvas visuals have a text alternative describing the current state (e.g. "Arrow at 60° from |0⟩; P(0) = 75%").
- Live regions announce results of measurements and checks.
- `prefers-reduced-motion` disables non-essential animation.
- No information conveyed by color alone (icons, labels, patterns).
