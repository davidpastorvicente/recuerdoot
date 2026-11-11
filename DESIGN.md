---
version: "genesis-1"
name: Recuerdoot
base: "Genesis (designmd.ai/chef/genesis)"
description: Editorial-precision interface for a Kahoot-style memories quiz. Bold display type, generous spacing, gallery-frame cards, a single indigo accent reserved for interaction, and a fixed multicolour answer palette for gameplay.
colors:
  primary: "#6366F1"
  primary-hover: "#4F46E5"
  primary-text: "light #4F46E5 / dark #A5B4FC"
  on-primary: "#FAFAFA"
  secondary: "#20970B"
  neutral: "#9C9C9C"
  background: "light #FAFAFA / dark #0B0B0D"
  surface: "light #FFFFFF / dark #141417"
  surface-alt: "light #F4F4F5 / dark #1D1D21"
  text-primary: "light #0A0A0A / dark #F4F4F5"
  text-secondary: "light #6B6B6B / dark #A1A1AA"
  border: "light #E8E8EC / dark #27272B"
  success: "#10B981"
  warning: "#F59E0B"
  error: "#EF4444"
  highlight: "rgba(245, 158, 11, 0.24)"
answer-palette:
  option-0: "#DC3E42"
  option-1: "#0D74CE"
  option-2: "#FFC53D"
  option-3: "#218358"
  option-4: "#067A6F"
  option-5: "#8145B5"
typography:
  display: { fontFamily: "General Sans", fontSize: 72px, fontWeight: 700, letterSpacing: -0.04em }
  headline: { fontFamily: "General Sans", fontSize: 60px, fontWeight: 700, letterSpacing: -0.04em }
  section: { fontFamily: "General Sans", fontSize: 32px, fontWeight: 700, letterSpacing: -0.03em }
  subhead: { fontFamily: "General Sans", fontSize: 24px, fontWeight: 700 }
  body: { fontFamily: "DM Sans", fontSize: 15px, fontWeight: 500 }
  small: { fontFamily: "DM Sans", fontSize: 13px, fontWeight: 500 }
  caption: { fontFamily: "DM Sans", fontSize: 12px, fontWeight: 500 }
  overline: { fontFamily: "DM Sans", fontSize: 11px, fontWeight: 700, letterSpacing: 0.08em, textTransform: uppercase }
  code: { fontFamily: "JetBrains Mono", fontWeight: 500 }
spacing: [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96]
rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  full: 9999px
elevation:
  hover: "0 8px 30px rgba(0,0,0,0.08) + translateY(-2px)"
  primary-hover: "0 4px 12px rgba(99,102,241,0.35)"
  popover: "shadow-lg"
  focus: "2px indigo outline + 0 0 0 3px rgba(99,102,241,0.12)"
components:
  button: { radius: 6px, sizes: { sm: 32px, md: 38px, lg: 44px }, weight: 500 }
  card: { background: surface, border: "1px border", radius: 12px }
  input: { radius: 6px, padding: "10px 14px", focus: "indigo border + ring" }
  chip: { radius: full, padding: "4px 12px", fontSize: 12px }
  nav: { height: 56px, background: "blurred background", border: "1px bottom" }
  answer-tile: { radius: 12px, background: answer-palette, font: subhead }
  play-button: { size: 56px, radius: full, background: primary }
---

## Overview

Recuerdoot is a memories quiz built on the **Genesis** design system: editorial, quietly confident, high information density balanced by breathing room. Two contexts share one system:

- **Host / big screen** (`index.html`): legible from across a room, every gameplay screen fits the viewport with no scrolling.
- **Player / phone** (`player.html`): phone-first, big tap targets, one decision per screen.

Product copy is always Spanish, short and direct.

Implementation notes:

- Tokens live as CSS custom properties at the top of `assets/css/main.css`. Light and dark values are declared once with `light-dark()`.
- The theme follows the OS. The host nav has a toggle that stores an explicit choice in `localStorage` (`recuerdoot-theme`); `assets/js/ui-shell.js` applies it before first paint.
- Use ids for singleton hooks and classes for shared styling.

## Colors

- **Primary indigo (`#6366F1`)**: interactive elements only: primary buttons, links, focus rings, play buttons. Never for static text, scores, timers or decoration.
- **Secondary green (`#20970B`)**: reserved for the one brand highlight in the start hero ("en juego").
- **Neutrals**: background `#FAFAFA`, surface `#FFFFFF`, text `#0A0A0A` / `#6B6B6B`, border `#E8E8EC`. Never pure black or pure white text.
- **Semantic**: success (correct, answers open), warning (listening, reconnecting), error (wrong, urgent countdown, destructive). Each has a `-text` variant with accessible contrast and a `-soft` background for chips.
- **Highlight**: a soft amber marker behind quoted phrases in questions (`<mark class="quote">`).
- **Medals**: gold, silver, bronze tinted chips for ranks 1 to 3.

### Answer palette

Answer colours are structural gameplay signals, not decoration, so they are exempt from the indigo-only rule. Keep them fixed per slot and always paired with their shape:

| Slot | Colour | Shape |
|------|--------|-------|
| 0 | red `#DC3E42` | triangle |
| 1 | blue `#0D74CE` | square |
| 2 | yellow `#FFC53D` (dark ink) | circle |
| 3 | green `#218358` | diamond |
| 4 | teal `#067A6F` | pentagon |
| 5 | purple `#8145B5` | inverted triangle |

## Typography

- **General Sans** (Fontshare): display, headlines, question text, answer tiles, leaderboard names. Bold with tight tracking (−0.02 to −0.04em).
- **DM Sans** (Google Fonts): body, buttons, labels, inputs.
- **JetBrains Mono**: PIN, scores, counts, dates, keyboard hints: anything that reads as data.
- Two weights per screen at most: 500 and 700.
- Scale: Display 72, Headline 60, Section 32, Subhead 24, Body 15, Small 13, Caption 12, Overline 11 (uppercase). Host question text clamps between 24 and 40px.

## Layout

- 4px spacing grid; container max width 1280px with 24px side padding.
- Sticky 56px nav with backdrop blur: brand left, question progress centre, context (PIN chip, theme toggle, Salir) right.
- Host gameplay screens (`.screen-stage`: question, reveal, scoreboard, multiplayer end) use `100dvh - nav` and `overflow: hidden`. When space is tight, shrink internals before overflowing.
- Question stage: header (overline counter + phase chip + question), body grid `[countdown | media | answer count]`, answer grid.
- Player screens are a centred single column (max 480px), except the answer grid, which fills the viewport.
- Respect safe areas (`viewport-fit=cover` + `env(safe-area-inset-*)`).

## Elevation

- Cards rest flat with a 1px border. Shadows only on hover (lift −2px) and on popovers or dialogs (`shadow-lg`).
- Primary buttons gain an indigo glow on hover. All buttons rise 1px on hover.
- Focus: 2px indigo outline plus the 3px indigo ring.

## Shapes

- 4px: chips' inner badges, `kbd`, inline highlights.
- 6px: buttons, inputs.
- 8px: media inside frames, QR panel, toasts.
- 12px: cards, answer tiles, leaderboard, dialogs.
- Full: chips, avatars, rank badges, status dots, play buttons.

## Components

### Buttons
Primary (indigo fill), secondary (1px border), ghost (text only), destructive (red border and text). Sizes 32/38/44px. Only one primary button per screen section. Buttons that advance the game carry `data-shortcut="next"` and a `→` key hint.

### Gallery frame (`.media-frame`)
Media is shown like a print in a gallery: white surface, 1px border, 12px radius, 12px padding, media at 8px radius. A revealed clip's date sits in a mono caption next to its play button. Audio-only frames shrink to their content; image or video frames take a larger viewport-relative box.

### Answer tiles
Large, colourful, shape plus label. Interactive tiles (solo) lift on hover and show a `1` to `6` key hint. After answering: the correct tile gets a success ring plus ✓, a wrong pick gets an error ring plus ✕, everything else dims. Never rely on colour alone.

### Countdown ring
Neutral ring in text colour; switches to error colour and pulses for the last 5 seconds.

### Chips and status
Pill chips for players, PIN, phase ("Atentos al audio", "Escuchando", "¡A responder!") and connection state. Status dots: success = live, warning = pending, neutral = offline.

### Reveal chart
Flat bars in answer colours; the correct column gets a "✓ Correcta" chip, the others dim. Order: question, revealed media, chart, next action.

### Leaderboard
One bordered card with divided rows: medal rank badge, name, movement chip (▲/▼ with places, "Nuevo"), mono score. The first scoreboard appears directly; later ones show the previous order, then rows travel to their new positions while scores count up. Top 5 only.

### Quiz card
Start-screen card (`#pack-card`) next to the hero: overline "Tu quiz", a status chip (success "Listo", error "Con errores"), the pack name as a subhead, secondary buttons for folder and zip plus a ghost "Quitar", a hint for drag and drop, and a collapsible "¿Cómo preparo el quiz?" with a mono folder tree. While a file is dragged over it, the border turns dashed indigo on `surface-alt`. Validation errors sit in an `error-soft` panel that scrolls after a few lines.

### Solo feedback sheet
Bottom-anchored card (a native `<dialog open>` outside `<main>`) over a scrim that leaves the question visible.

### Dialog and toast
Exit confirmation uses a native modal `<dialog>` with secondary "Seguir jugando" and destructive "Salir". Toasts are bottom-centred cards with a coloured left rule.

### Start countdown overlay
Full-screen blurred background with a giant General Sans digit and an overline label (Preparados, Listos, ¡Ya!).

## Decoration

The dot grid behind every page is the only decorative element. It fades towards the bottom and gets a soft spotlight that follows the mouse. No gradients, glows or illustrations elsewhere.

## Do's and Don'ts

Do:
- Keep indigo for interaction only.
- Keep the answer palette and shapes in sync between host and phones.
- Use mono for numbers and codes.
- Test light and dark themes and reduced motion.
- Keep every host gameplay screen inside the viewport.

Don't:
- Add shadows to resting elements.
- Mix radii (cards 12px, buttons/inputs 6px).
- Use more than two font weights on a screen.
- Put more than one filled indigo button in the same section.
- Use colour alone for correctness or state.
