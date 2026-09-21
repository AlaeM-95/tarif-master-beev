# Beev Design System

> L'expert de la mobilité électrique pour les entreprises : leasing, installation de bornes, gestion de flottes.

Beev (acronym for **BE Electric Vehicle**, also a wink at electric *bees*) is a French greentech company founded in 2019–2020 by Solal Botbol and Chanez Djoudi, based in Paris. Beev is a **one-stop shop for electric mobility**: it advises companies and individuals on choosing and leasing electric vehicles, installs home and workplace charging stations, runs a fleet-management product (Beev Fleet Manager), and guides clients through aids, tax and car policy. B-Corp certified. Labelled GreenTech Innovation.

**Positioning:** your copilot to finance vehicles, install charge points, optimise fiscality and car policy, and simplify fleet management.

**Core audiences:**
- Entreprises & dirigeants (fleet, HR/finance/RSE)
- Salariés (home charging installation)
- Particuliers (leasing + home installation)

## Sources used to build this design system

- `uploads/Beev_Charte_Graphique_2026_Paysage.pdf` · **primary source**, the official 2026 brand charter (13 pages). Colours, logotype, typography, iconography, buttons, usage examples and essential rules all come from this document. Also copied to `assets/Beev_Charte_Graphique_2026_Paysage.pdf`.
- Logo + monogram PNG/SVG assets provided directly by the team (black / white / B‑Corp combinations).
- 4 animated logo MP4s provided by the team (white-on-black, black-on-white, monogram only) · kept in `assets/`.
- Roobert font files (Regular / Medium / SemiBold) provided directly.
- Public site **https://www.beev.co** used for copy tone and content fundamentals cross-check.

### ⚠️ Known gaps / asks for the user
- **Roobert Light and Roobert Bold** are referenced in the charter's type scale but not present in the uploads. The CSS currently falls back to Regular / SemiBold for those weights. **Please send Light and Bold `.ttf`/`.otf` if available.**
- The charter references "photographies aux teintes naturelles" (photos with natural tones) but no photography assets were supplied. Placeholders are used in UI kits.
- No codebase or Figma link was shared, so UI kits are built from the brand charter + public site cues. They are cosmetic recreations, not reproductions of the production apps.

---

## Index · what's in this folder

```
README.md                    ← you are here
SKILL.md                     ← instructions for downstream agents / Claude Code
colors_and_type.css          ← tokens + semantic classes (import this)

fonts/                       ← Roobert-Regular/Medium/SemiBold .ttf
assets/                      ← logos, monograms, B-Corp, animated MP4s
preview/                     ← Design-System-tab cards (colors, type, buttons, icons…)
ui_kits/
  └── marketing-site/        ← Public site components (hero, nav, cards, CTAs)
```

---

## CONTENT FUNDAMENTALS · voice, tone, copy

Beev's communication is **clear, confident, conversational and reassuring** · the voice of an expert copilot who removes friction from a complex transition.

**Language & register**
- **Primary language is French.** English is used on the `/en/` side of the marketing site for international audiences. Never mix the two on the same surface.
- Address the reader with **vous** in French, **you** in English. Never **tu**. Collective "nous" is used for Beev itself: *"Notre réseau donne accès aux meilleures offres."*
- Casing: **sentence case** everywhere · headlines, buttons, labels. Never TITLE CASE or ALL CAPS. The only shouty treatment the brand allows is big display type in Roobert SemiBold, set lowercase or sentence case.
- Punctuation: French typography rules apply · non-breaking spaces before `?`, `!`, `:`, `;` and around `« »` guillemets. Apostrophes typographiques `'` preferred over straight `'`.

**Tone dial**
- **Concrete over abstract.** "Installez votre borne en sérénité" beats "enjoy a seamless charging experience". Verbs-first, action-oriented.
- **Calmly confident.** Short declarative sentences. "Indépendant et 100% gratuit" "Time for electric" Avoid hype adjectives (amazing, revolutionary) and startup filler (leverage, disrupt, unlock).
- **Practical & educational.** Headlines often pose the user's real question and answer it plainly: *"Pourquoi Beev est moins cher ? Notre réseau donne accès aux meilleures offres."* / *"Combien coûte une borne chez soi ? Le coût varie selon la solution choisie."*
- **Warm, not cute.** Beev does not joke about itself or use emoji. No exclamation-point chains. Warmth comes from the beige backgrounds, the soft pastel accents and the reassurance of the copy, not from tone-of-voice gimmicks.

**Signature moves**
- Two- or three-line display headlines, heavily enjambed, set flush-left on an accent background:
  > Indépendant<br>et 100%<br>gratuit.
- **Question → answer** pairings in FAQ / education blocks (see charter p. 11).
- **CTA pairs** rather than solo CTAs: a primary "Obtenir un devis" next to a secondary "C'est parti !". Buttons use full sentence fragments with an imperative verb ("Obtenir un devis", "Prendre rendez-vous", "Découvrez les bornes").
- The word *"accompagnement"* and the phrase *"à vos côtés"* recur across Beev copy · lean on them.

**Emoji / unicode**
- **No emoji** in product, marketing or brand surfaces.
- No decorative unicode characters as icons. Iconography is a dedicated pictogram system · see ICONOGRAPHY below.

**Examples pulled from the charter + site**
- Display: *"Time for electric"*, *"Installez votre borne en sérénité"*, *"Obtenez toutes les aides"*. Note that titles never end with a period.
- Sub-head: *"Beev vous conseille pour trouver la voiture et la solution adaptée."*
- CTA: *Obtenir un devis* • *C'est parti !* • *Prendre rendez-vous*
- Card eyebrow: *Incontournable*
- Value prop: *"Service rapide, conseillers réactifs."*, *"Meilleurs prix du marché, au top."*

---

## VISUAL FOUNDATIONS

**Overall vibe.** Warm-minimalist, print-influenced editorial. The brand behaves like a *tasteful newspaper* more than a tech product: generous beige paper, deep near-black ink, big typographic moments, and three carefully rationed pastel accents (rose, bleu, violet) that alternate between sections to give rhythm.

### Colour

- **Primaries:** `#1D1D1D` Black + `#FCF9F2` Beige. These are the default page/ink pairing · never true `#000/#FFF` for body. The beige is warm and paper-like; it carries most long-form surfaces.
- **Secondary accents:** Rose `#F4B8AA`, Bleu `#A5D2FF`, Violet `#D3CCD8`. Each has 50% / 30% / 20% tints for subtle fills and backgrounds. **Rule: alternate accents between sections · never mix all three on the same composition.**
- **Status:** Good `#6CBE5E`, Warning `#F27B39`, Error `#ED3E3E`. Reserved for forms, onboarding and connection states.
- **Flat fills only. Dégradés are forbidden by the charter.** This rule is non-negotiable · no colour-to-colour gradients, no radial glows, no duotone photo treatments. Tints replace gradients where softness is needed.
- **Logo colour rules:** logotype is either pure black (on light/rose/bleu/violet/beige) or pure white (on dark). Never recoloured.

### Typography

- **Roobert** (Displaay Type Foundry, Martin Vácha) is the single brand typeface · a mono-linear geometric sans with subtle "bent pipe" character. Used for display, UI and body alike. The brand is a one-font system.
- Scale (desktop → mobile) as defined by the charter:

  | Role | Size / Leading | Weight |
  |---|---|---|
  | Title 1 | 60 / 60 | SemiBold |
  | Title 2 | 38 / 46 | SemiBold |
  | Title 3 Bold | 22 / 26 | SemiBold |
  | Title 3 Light | 22 / 28 | Regular/Light |
  | Title mobile | 30 / 35 | SemiBold |
  | Title mobile petit | 20 / 23 | SemiBold |
  | Body | 15 / 22 | Regular |
  | Body mobile | 18 / 24 | Regular |

- **Alignment:** always flush-left for running text. Centred body copy is explicitly forbidden by the charter.
- **Letter-spacing:** negative on display (≈ -0.015 to -0.02em), normal on body.
- Display headlines often enjamb across 3 lines with hard line-breaks for rhythm.

### Layout & composition

- **Alternation is the system.** Dark cover → light body → accent section → dark closing. The charter explicitly calls out: "fond sombre pour couverture et closing", avoid "mises en page tout-clair ou tout-sombre sans rythme".
- Generous white (beige) space. Big margins. The logo has mandatory "marges de respiration" · never compressed edge-to-edge.
- Text blocks are narrow (≈ 50–65 ch) and flush-left, with lots of vertical breathing room.
- Cards are rectangular with large radii (see Radii), no colored left borders.

### Backgrounds

- **Flat colour only.** Beige, black, or one of the three accents.
- No gradients, no patterns, no textures, no meshes.
- Full-bleed photography is allowed ("Photographies aux teintes naturelles") · natural tones, low saturation, no aggressive contrast. Placeholders used in kits where images weren't supplied.

### Animation

- **Restrained.** The logo animation MP4s (`assets/animated-logo-*.mp4`, `assets/animated-monogram-*.mp4`) are the brand's signature motion moments: the monogram draws itself in, then the wordmark reveals.
- Easing: smooth, natural (`cubic-bezier(0.16, 1, 0.3, 1)` / `0.4, 0, 0.2, 1`). No bouncy spring, no overshoot.
- Durations: 140ms (fast UI), 220ms (standard transition), 360ms (slow reveal).
- **Avoid:** parallax, elaborate scroll-jacking, confetti, cartoony bounces.

### Hover & press states

- **Buttons (filled):** hover shifts to a slightly lighter/darker shade of the same hue (never a new colour). Rose → Rose-50 on hover. Black → pure `#000`. White → Beige.
- **Buttons (contour):** hover inverts · the outline fills in with its border colour and the label flips.
- **Links/cards:** hover uses a subtle translate-y (-1 to -2px) + shadow bump, or the arrow glyph slides 3px right.
- **Press (`:active`):** 1px downward translate; no colour change. Never shrink scale below 0.98.

### Borders, shadows, radii

- **Border width:** 1px default, 1.5px on stronger emphasis. No dashed/dotted borders.
- **Border colour:** `rgba(29,29,29,0.10)` subtle, or straight `#1D1D1D` for strong.
- **Shadows:** extremely restrained. Mostly flat design. A 2–8px soft shadow for hovering cards, a 20–48px diffuse shadow only for modals/menus. No inner shadows, no colored glows.
- **Radii:** 10px on buttons (charter rule). Cards 16–24px. Big surfaces / hero bubbles 32px. Fully pill-shaped badges allowed for tags.

### Transparency & blur

- Very sparingly. The brand is a flat-colour brand. Transparency is used only for sticky headers (beige/95 with a subtle backdrop-blur on scroll) and for the 20/30/50% accent tints · which are resolved to solid hex values, not rgba, to keep reproductions consistent across print and screen.

### Imagery treatment

- Photographs in **natural, warm tones**. No heavy filter. No extreme contrast. No black-and-white unless explicitly editorial.
- Product photography (vehicles, charge points) is typically shot on white/beige sets or in daylight real-world contexts.
- Illustrations are **line pictograms** with rounded corners and flat fills (see ICONOGRAPHY).

### Fixed elements

- Sticky top nav on marketing site; collapses on scroll.
- Floating monogram-badge circle (dark or light version in `assets/monogram-badge-*.png`) used as a persistent brand mark in app shells.

---

## ICONOGRAPHY

From the charter (p. 9, *Iconographie*): **"Pictogrammes au trait · coins arrondis · aplats plats uniquement."** · line pictograms, rounded corners, flat fills only.

**The Beev icon style:**
- Line icons with rounded strokes (`stroke-linecap: round`, `stroke-linejoin: round`).
- Stroke width ≈ 1.75–2px at 24px sizing.
- Square canvas, generous inner padding (~10–15%).
- **Two canvas variants per icon:**
  - *Variante Beige* · icon on `#FCF9F2` beige tile with black stroke. Standard usage.
  - *Variantes couleur* · same icon on rose / bleu / violet tiles as section accents, or white strokes on dark tiles.
- Each pictogram sits inside a rounded-square tile (radius ~24–32px) used as the visual container · this tile is part of the icon, not decoration.

**What we shipped**
- Beev does **not** publish a public icon-font or SVG library with the charter. Since no codebase was shared, we substitute **[Lucide](https://lucide.dev)** (CDN, MIT-licensed) as the working icon set · its `stroke-linecap: round` style and weight match the Beev aesthetic very closely. Lucide is wrapped in Beev rounded tiles via the `.beev-icon-tile` component (see `preview/iconography.html`).
- **⚠️ Flagged substitution.** If Beev has proprietary pictograms, please share the SVG set and we'll drop Lucide for the real thing.
- Specific categories the charter illustrates by name: *Accompagnement* (calendar / user), *Recharge* (charge-point / cable), *Installation* (tools / certified installer). We map these to Lucide `calendar-check`, `plug-zap`, `wrench` respectively in the preview.

**Emoji & unicode**
- **No emoji** anywhere in brand or product surfaces.
- **No unicode characters** used decoratively as icons (no ★, ✓, →).
- **No em dash `—` anywhere.** Replace with middle-dot ` · `, colon `:`, or comma. Hyphen `-` is tolerated only in compound words.
- **No arrow glyph inside a `<button>` CTA.** Pas de "→", pas de chevron, pas de SVG arrow. Le label seul porte le sens. Text links outside buttons may keep an arrow.

---

## Production rules

### From the charter (p. 12)

**À faire**
- Flat colour fills only
- Alternate Rose / Bleu / Violet between sections
- Left-align text
- Dark background for covers & closings
- Use the monogram in small formats
- Respect brand colour palette
- Natural-tone photography
- Respect logo margins

**À éviter**
- Gradients (total ban)
- Mixing three accents in one composition
- Centering long body text
- All-light or all-dark layouts without rhythm
- Stretching or distorting the logo
- Modifying logo colours
- Over-saturated / high-contrast photography
- Compressing the logo against the edges

### Hard-coded brand rules — see `BRAND_RULES.md`

The canonical, structured rule set lives in **`BRAND_RULES.md`** at the project root. It covers : mise en page, typographie, orthographe et typographie française (espaces insécables), boutons & CTA, signature "Time for Electric", visuels, couleurs, logo. Toutes les règles ci-dessus y sont consolidées et étendues. Lint your output against it before shipping.
