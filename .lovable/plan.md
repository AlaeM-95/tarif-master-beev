# Refonte du générateur de propositions Beev

## 1. Trois types de projet, trois PDF, trois validations

Au-dessus du dashboard, ajout d'un **sélecteur de type de projet** (un seul à la fois) :

- **Projet Véhicules** — uniquement le catalogue véhicules visible.
- **Projet Bornes Domicile (B2B2E)** — uniquement le catalogue bornes domicile.
- **Projet Bornes Site Entreprise** — uniquement le catalogue bornes site.

Chaque type pilote :

- **L'UI** : seuls les onglets pertinents apparaissent (les autres sont masqués pour éviter les sélections croisées).
- **Le PDF** : trois templates dédiés
  - `pdf/vehicles.ts` — couverture LLD, fiches véhicules, TCO optionnel, conditions LLD, signature.
  - `pdf/home-chargers.ts` — couverture B2B2E, kit Beev x Seris, process collaborateur (commande → installation domicile → supervision → remboursement), engagement employeur, signature.
  - `pdf/site-chargers.ts` — couverture site entreprise, devis détaillé par site (matériel + IRVE + génie civil), planning chantier, conditions de garantie, signature.
- **Le bloc "Bon pour accord"** : libellés, mentions légales et cases à cocher différents par type (ex. mandat collaborateur pour domicile, PV de réception de chantier pour site, BPA LLD pour véhicules).

## 2. Corrections du PDF actuel

- Recalcul des marges et des sauts de page : `addPage()` systématique quand `cursorY + blockHeight > pageHeight - footerMargin`, suppression des espaces résiduels en bas de page.
- Espacement uniforme entre titres / tableaux / blocs (constantes `SPACING.section/block/line`).
- **Image borne en format auto** : helper `drawImageContain(doc, dataUrl, x, y, maxW, maxH)` qui calcule le ratio natif de l'image (via `Image.naturalWidth/Height` chargé dans `loadImage`) et centre l'image dans la zone — plus de déformation, plus d'espace vide aléatoire.

## 3. Ajout manuel d'éléments

Sur chacun des trois onglets, bouton **"+ Ajouter"** ouvrant un dialog :

- Véhicule : marque, modèle, version, énergie, prix TTC, loyer LLD TTC, autonomie, conso, image (URL).
- Borne domicile : marque, modèle, puissance, prix HT (forfait pose 0–10 m inclus), image, lignes de devis.
- Borne site : marque, modèle, puissance, image, lignes de devis (matériel + IRVE + câblage…).

Persistance dans `localStorage` (mêmes clés que les catalogues actuels). Bouton "Supprimer" sur les éléments custom.

## 4. Import depuis le calculateur TCO

Méthode recommandée : **export/import par code unique partagé**.

```text
Calculateur TCO ──► bouton "Exporter vers catalogue Beev"
                   │
                   ▼
         Génère un payload JSON signé
                   │
                   ▼
         Code court à 6 caractères (ex. K7B2-9F)
                   │
                   ▼
Catalogue Beev ──► champ "Importer depuis TCO" → saisie du code
                   │
                   ▼
         Récupère le payload → ajoute les véhicules sélectionnés
```

Deux variantes possibles côté infrastructure :

- **A. Via Lovable Cloud (recommandé)** : table `tco_exports(code text primary key, payload jsonb, created_at, expires_at)`. Le calculateur fait `INSERT`, le catalogue fait `SELECT … WHERE code = ?`. Code unique à durée de vie limitée (24 h). Aucun compte requis.
- **B. Sans backend** : le calculateur encode le payload dans un lien `?import=<base64>` que le commercial colle dans le catalogue. Pas de code court, mais zéro infra.

Pour cette itération je propose d'**implémenter le côté catalogue** (UI "Importer un projet TCO" qui accepte soit un code, soit un lien collé), prêt à brancher l'API quand le calculateur exposera l'export. En attendant, le champ accepte un JSON collé manuellement (utile pour les tests).

## Fichiers touchés

- `src/lib/catalog.ts` — type `ProjectType`, helpers création custom items.
- `src/lib/store.ts` — hook `useProjectType`, helpers add/remove custom.
- `src/lib/pdf/` — éclatement en `vehicles.ts`, `home-chargers.ts`, `site-chargers.ts`, `shared.ts` (header/footer/image helpers/spacing).
- `src/routes/index.tsx` — sélecteur de projet, masquage conditionnel des onglets, dialog d'ajout, dialog d'import TCO, mode présentation adapté.

## Hors scope

- L'API réelle côté calculateur TCO (à faire dans le projet TCO ensuite).
- Refonte visuelle complète du Mode Présentation (suit la même structure que le PDF).
