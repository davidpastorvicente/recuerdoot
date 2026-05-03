---
version: "alpha"
name: Recuerdoot
description: Dark, nostalgic quiz interface for a Kahoot-style memories game with a blue accent system, bold display typography, and phone-first multiplayer interactions.
colors:
  primary: "#0A0E1A"
  secondary: "#141928"
  tertiary: "#4F8CFF"
  tertiary-soft: "#3D6FD1"
  neutral: "#EAE6DF"
  neutral-muted: "#7A8599"
  surface: "#141928"
  surface-hover: "#1C2237"
  border: "#1E2640"
  border-strong: "#2A3A5E"
  success: "#5EE6A0"
  success-surface: "rgba(94, 230, 160, 0.12)"
  error: "#F07070"
  error-surface: "rgba(240, 112, 112, 0.12)"
  option-red: "#D94545"
  option-blue: "#3B7DD8"
  option-yellow: "#E6B830"
  option-green: "#30B870"
  scrim: "rgba(10, 14, 26, 0.45)"
  on-primary: "#EAE6DF"
  on-tertiary: "#0A0E1A"
typography:
  display-xl:
    fontFamily: "Archivo Black"
    fontSize: 3.4rem
    fontWeight: 800
    lineHeight: 1
    letterSpacing: -0.03em
  display-lg:
    fontFamily: "Archivo Black"
    fontSize: 2.8rem
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: -0.02em
  heading-md:
    fontFamily: "Outfit"
    fontSize: 1.6rem
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: 0
  body-md:
    fontFamily: "Outfit"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
  body-lg:
    fontFamily: "Outfit"
    fontSize: 1.15rem
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: 0
  label-caps:
    fontFamily: "Archivo Black"
    fontSize: 0.85rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.08em
rounded:
  sm: 10px
  md: 14px
  lg: 20px
  xl: 24px
  pill: 999px
spacing:
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 32px
  section: 40px
components:
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.md}"
    padding: 18px
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.tertiary}"
    rounded: "{rounded.md}"
    padding: 18px
  card-question:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.lg}"
    padding: 28px
  modal-result:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.xl}"
    padding: 32px
  option-tile:
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: 24px
  play-button:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    rounded: "{rounded.pill}"
    size: 60px
  player-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: 16px
---

## Overview

Recuerdoot is a memories quiz, not a neutral enterprise dashboard. The interface should feel like a playful late-night game session built from dark surfaces, bold typography, and bright quiz colors, while still reading clearly from a distance on the host screen and quickly on a phone.

The visual identity balances three ideas:

- Big-screen legibility for the host and reveal moments.
- Fast, tap-friendly interaction for player phones.
- Warm nostalgia through atmospheric texture and celebratory motion, without becoming messy or cartoonish.

All visible product copy is in Spanish. The UI should stay confident and concise rather than verbose.

Implementation note:

- Prefer ids for singleton UI hooks that exist once per screen.
- Prefer classes for shared or repeated styling patterns.

## Colors

The palette is built around a dark foundation with a single blue accent system for primary actions and progress states.

- **Primary (`#0A0E1A`)**: main page background and deepest canvas.
- **Secondary / Surface (`#141928`)**: cards, sheets, and elevated containers.
- **Tertiary / Accent (`#4F8CFF`)**: primary buttons, progress, active highlights, and branded emphasis.
- **Neutral (`#EAE6DF`)**: main text on dark surfaces.
- **Neutral Muted (`#7A8599`)**: metadata, helper copy, labels, and secondary information.
- **Success (`#5EE6A0`)** and **Error (`#F07070`)**: correctness and failure states only.

The answer palette is intentionally multicolor and should remain fixed to the familiar quiz pattern:

- Option 1: red
- Option 2: blue
- Option 3: yellow
- Option 4: green

Use the accent blue for the product identity, but do not replace the answer colors with the accent system. Those option colors communicate gameplay structure.

The solo result modal uses a scrim behind the modal content. It should dim the background enough to protect readability, but not fully black out the question underneath.

## Typography

Typography is split into two roles:

- **Archivo Black** for brand moments, counters, scores, labels that need punch, and large display text.
- **Outfit** for everything else: question copy, buttons, metadata, labels, and form input.

Usage rules:

- Brand wordmark and major results should feel oversized and graphic.
- Question text should be bold and highly legible, not decorative.
- Metadata uses compact uppercase styling with increased letter spacing.
- Body copy should keep comfortable line height and avoid dense paragraphs.

Do not introduce additional font families unless there is a strong, explicit reason.

## Layout

The application has two layout modes that must feel related but optimized for different devices.

Host / solo layout:

- Center the main content group within the viewport unless solo mode intentionally shifts the question stack upward.
- Keep the question header visually detached and pinned near the top.
- Use wide cards with generous padding and strong whitespace.
- Prevent horizontal overflow.

Player layout:

- Design mobile-first with full-width controls and strong vertical rhythm.
- Prioritize touch targets and readability over density.
- Respect safe areas at the top and bottom.

Shared layout rules:

- Use `dvh`-aware sizing where full-screen sections are needed.
- Host gameplay screens should fit inside the viewport without page scrolling.
- Maintain an 8px-based spacing rhythm.
- Keep primary controls comfortably separated.
- When vertical space is tight, shrink internal components before allowing the host layout to overflow.

## Elevation & Depth

Depth in Recuerdoot comes from surface contrast, borders, glow, and shadow rather than heavy skeuomorphism.

- Cards use dark surfaces with subtle borders.
- The brand and accent states can use glow sparingly.
- Buttons and tiles can scale slightly on interaction, but should not jump or reflow layout.
- Overlays and result states should use a restrained scrim instead of blur-heavy effects.

The grain layer and radial glow are part of the visual atmosphere. Keep them subtle enough that they never compete with text.

## Shapes

Rounded corners are soft but not bubbly.

- Inputs and standard buttons: medium radius.
- Large cards: large radius.
- Result modal: extra-large radius.
- Circular audio controls: full pill / circle.

Quiz answer shapes inside the tiles are structural identity elements. Preserve the triangle, square, circle, diamond, pentagon, and inverted triangle language across host and player UIs. For five-option layouts, keep the last answer centered on its own row with the same width as the other answers; for six-option layouts, use three rows of two.

## Components

### Brand

The `Recuerdoot` wordmark is a display treatment, not ordinary heading text. It uses a blue gradient fill and light glow. Keep it centered and prominent on major entry and ending screens.

### Buttons

- Primary buttons use the accent blue with dark text.
- Secondary buttons sit on the surface color with an accent border and accent text.
- Hover and press states should scale subtly from the center.
- Disabled buttons reduce emphasis without looking broken.
- Shared button styling belongs on classes; one-off button hooks can use ids.

### Question Card

The question card is the core container for the host and solo experience. It should always feel stable, readable, and visually heavier than the surrounding UI.

- Use a dark elevated surface.
- Keep generous padding.
- Support optional image and optional audio.
- Question text must remain the focal point.

### Question Header

The question header is pinned above the content group and contains progress metadata.

- Counter on the left.
- Progress track in the center.
- Contextual status on the right.

It should read as HUD-like information, lighter than the main card but always visible.

### Answer Tiles

Answer tiles are large, colorful, and immediate.

- Two-column grid on host and solo.
- Strong color identity per tile.
- Large icon shape plus answer text.
- Hover or press states can scale slightly but must stay centered.
- After selection, dimming and correctness states should be visually obvious.

### Audio Controls

Audio buttons are circular accent controls with a clear play/pause swap. They should feel tactile and distinct from generic buttons.

- Minimum size stays large enough for touch.
- Playing state may pulse.
- Icon-only controls must always have accessible labels.

### Solo Result Modal

Solo feedback appears in a bottom-anchored modal rather than shifting the question layout.

- Use a centered modal with a bottom inset.
- Support status text, revealed image, revealed audio, and the next action.
- The background should remain partially visible behind the scrim.

### Reveal and Leaderboard

Reveal moments are performance screens.

- Keep the reveal sequence ordered as: question card, reveal media, chart, then next action.
- If reveal media contains only audio controls and metadata, the container should shrink to content instead of occupying the full media frame.
- If reveal media contains an image, use a larger framed treatment sized with viewport-relative limits.
- The bar chart should feel simple and bold, not analytical.
- Correct answers should be reinforced with both text/icon treatment and color.
- The multiplayer scoreboard should briefly show the previous standings before transitioning to the updated order.
- When ranks change, leaderboard rows should visibly travel to their new positions instead of only fading between states.
- Rank changes can be reinforced with compact up/down indicators and the score should count up from the previous total to the new one.
- Leaderboard views should show only the top 5 players.
- Rank numerals should use medal colors for places 1-3: gold, silver, and bronze.

### Player Join Form

The join screen should feel fast and frictionless.

- Clear labels above inputs.
- Large centered values.
- Full-width join CTA.
- Errors appear inline and remain easy to spot.

## Do's and Don'ts

Do:

- Keep the dark, immersive quiz-night mood.
- Use blue as the product accent consistently.
- Preserve the red / blue / yellow / green answer tile language.
- Favor bold hierarchy and large touch targets.
- Respect safe areas, reduced motion, and keyboard/screen-reader basics.
- Use SVG icons or simple geometric shapes instead of emoji for structural UI.

Don't:

- Reintroduce the old purple or yellow accent system as the default identity.
- Add extra fonts, glassy blur, or decorative gradients everywhere.
- Make answer tiles animate by shifting away from their center.
- Hide critical content behind fixed headers, bottom controls, or viewport clipping.
- Use color alone to communicate correctness or state.
- Treat the player UI like a miniature desktop page; it must stay phone-first.
