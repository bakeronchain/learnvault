# LearnVault Brand Guide

> Built for African learners. Powered by community. Governed by effort.

---

## Colours

### Primary Palette

| Name          | Hex       | Usage                                    |
| ------------- | --------- | ---------------------------------------- |
| Brand Cyan    | `#00d2ff` | Primary accent, links, highlights        |
| Brand Blue    | `#3a7bd5` | Secondary accent, gradients              |
| Brand Emerald | `#00ff80` | Success states, DeFi track, earn actions |
| Brand Purple  | `#8e2de2` | Soroban track, governance, DAO features  |

### Neutrals

| Name           | Hex                      | Usage                     |
| -------------- | ------------------------ | ------------------------- |
| Background     | `#05070a`                | Page background           |
| Surface        | `#0d1117`                | Cards, panels             |
| Surface Alt    | `#11141a`                | Elevated surfaces, modals |
| Border         | `rgba(255,255,255,0.08)` | Subtle borders            |
| Text Primary   | `#ffffff`                | Headings, body            |
| Text Secondary | `rgba(255,255,255,0.55)` | Descriptions, labels      |
| Text Muted     | `rgba(255,255,255,0.25)` | Placeholders, metadata    |

### Light Mode Equivalents

| Name          | Hex       |
| ------------- | --------- |
| Brand Cyan    | `#0099cc` |
| Brand Blue    | `#2a5fa8` |
| Brand Emerald | `#00b85c` |
| Brand Purple  | `#6a1fa8` |
| Background    | `#f8fafc` |
| Text Primary  | `#1a1a2e` |

### Gradients

```css
/* Iridescent brand gradient */
linear-gradient(to right, #00d2ff, #3a7bd5, #00ff80)

/* Full spectrum (borders, special elements) */
linear-gradient(to right, #00d2ff, #3a7bd5, #00ff80, #8e2de2)

/* Background mesh */
radial-gradient(at 0% 0%, rgba(0,210,255,0.15) 0px, transparent 50%),
radial-gradient(at 50% 0%, rgba(58,123,213,0.15) 0px, transparent 50%),
radial-gradient(at 100% 0%, rgba(0,255,128,0.15) 0px, transparent 50%),
radial-gradient(at 0% 100%, rgba(142,45,226,0.15) 0px, transparent 50%),
radial-gradient(at 100% 100%, rgba(0,210,255,0.15) 0px, transparent 50%)
```

---

## Typography

### Typefaces

| Role      | Font                       | Fallback                 |
| --------- | -------------------------- | ------------------------ |
| Primary   | Inter                      | system-ui, -apple-system |
| Monospace | JetBrains Mono / Fira Code | monospace                |

Inter is available via Google Fonts: `https://fonts.google.com/specimen/Inter`

### Scale

| Token      | Size | Weight | Usage                    |
| ---------- | ---- | ------ | ------------------------ |
| Display    | 72px | 800    | Hero headings, OG images |
| H1         | 52px | 800    | Page titles              |
| H2         | 36px | 700    | Section headings         |
| H3         | 24px | 600    | Card titles              |
| Body Large | 20px | 400    | Lead paragraphs          |
| Body       | 16px | 400    | Default body text        |
| Small      | 14px | 400    | Labels, metadata         |
| Micro      | 12px | 400    | Captions, legal          |

### Letter Spacing

- Display / H1: `-1px` to `-2px`
- Badges / labels: `+2px` to `+3px` (uppercase)
- Body: `0` (default)

---

## Logo

### Variants

| File                              | Use case                      |
| --------------------------------- | ----------------------------- |
| `logos/learnvault-logo-dark.svg`  | Default — dark backgrounds    |
| `logos/learnvault-logo-light.svg` | Light backgrounds             |
| `logos/learnvault-icon-dark.svg`  | Icon only — dark backgrounds  |
| `logos/learnvault-icon-light.svg` | Icon only — light backgrounds |
| `logos/favicon-32.svg`            | Browser tab (32×32)           |
| `logos/favicon-16.svg`            | Browser tab (16×16)           |

### Clear Space

Maintain a minimum clear space equal to the height of the "L" in the wordmark on
all sides of the logo.

### Don'ts

- Do not recolour the logo outside the approved palette
- Do not stretch or distort proportions
- Do not place on busy backgrounds without a backdrop
- Do not use the light logo on dark backgrounds or vice versa

---

## Iconography

The LearnVault icon is a shield containing a graduation cap with an LRN token
badge. It represents:

- Shield — security, trust, on-chain proof
- Graduation cap — learning, achievement
- LRN badge — earn-to-learn model

---

## Track Accent Colours

Each course track has a dedicated accent colour used in NFT credentials, cover
images, and UI theming.

| Track                   | Accent Colour | Hex       |
| ----------------------- | ------------- | --------- |
| Introduction to Stellar | Cyan          | `#00d2ff` |
| Soroban Smart Contracts | Purple        | `#8e2de2` |
| DeFi Fundamentals       | Emerald       | `#00ff80` |

---

## ScholarNFT Credentials

Base template: `nft/scholar-nft-base.svg` (1000×1000px)

Track variants swap the accent gradient and include a track-specific background
motif:

| File                          | Track                   | Accent            |
| ----------------------------- | ----------------------- | ----------------- |
| `nft/scholar-nft-base.svg`    | Generic / base          | Cyan→Blue→Emerald |
| `nft/scholar-nft-stellar.svg` | Introduction to Stellar | Cyan→Blue         |
| `nft/scholar-nft-soroban.svg` | Soroban Smart Contracts | Purple→Cyan       |
| `nft/scholar-nft-defi.svg`    | DeFi Fundamentals       | Emerald→Blue      |

NFT credentials are soulbound and non-transferable. The artwork must remain
recognisable at social card sizes (minimum 400×400px).

---

## Open Graph Images

| File                 | Dimensions | Usage                          |
| -------------------- | ---------- | ------------------------------ |
| `og/og-homepage.svg` | 1200×630px | Homepage meta tag              |
| `og/og-fallback.svg` | 1200×630px | Generic fallback for all pages |

For production, export SVGs to PNG at 2× density (2400×1260px) using a tool like
`sharp`, `Inkscape`, or `resvg`.

```bash
# Example using resvg
resvg og-homepage.svg og-homepage@2x.png --width 2400
```

---

## Course Track Covers

| File                             | Track                   |
| -------------------------------- | ----------------------- |
| `covers/cover-intro-stellar.svg` | Introduction to Stellar |
| `covers/cover-soroban.svg`       | Soroban Smart Contracts |
| `covers/cover-defi.svg`          | DeFi Fundamentals       |

Covers are designed at 1200×630px and double as social share cards.

---

## Voice & Tone (Visual)

- Dark-first: all primary assets are designed for dark backgrounds
- Iridescent gradients signal trust and innovation
- Subtle grid lines reference blockchain/data aesthetics
- Track-specific accent colours create a clear visual language per learning path
- The shield motif is the core brand symbol — use it consistently

---

## Asset Directory

```
public/assets/brand/
├── logos/
│   ├── learnvault-logo-dark.svg
│   ├── learnvault-logo-light.svg
│   ├── learnvault-icon-dark.svg
│   ├── learnvault-icon-light.svg
│   ├── favicon-32.svg
│   └── favicon-16.svg
├── og/
│   ├── og-homepage.svg
│   └── og-fallback.svg
├── nft/
│   ├── scholar-nft-base.svg
│   ├── scholar-nft-stellar.svg
│   ├── scholar-nft-soroban.svg
│   └── scholar-nft-defi.svg
└── covers/
    ├── cover-intro-stellar.svg
    ├── cover-soroban.svg
    └── cover-defi.svg
```

---

## Contributing Design Assets

Open a draft PR with your proposals. Include:

1. The asset file(s) in the correct directory
2. A brief description of design decisions
3. Screenshots or previews in the PR description

All assets must follow the colour palette and typography defined in this guide.
Community feedback is welcome before merging.
