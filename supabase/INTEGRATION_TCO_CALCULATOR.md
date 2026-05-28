# Intégration calculateur TCO ↔ tarif-master

Document à transmettre au développeur de **beev-tco-2026.lovable.app/app**
pour qu'il synchronise les résultats TCO avec **tarif-master-beev**.

---

## Architecture

Les deux apps partagent **le même projet Supabase** (URL et clé anon
identiques). Quand un commercial calcule un TCO dans `beev-tco-2026`, le
résultat doit être inséré dans la table `tco_results`. L'app
`tarif-master` lit cette table pour afficher le TCO complet dans le PDF
client.

```
┌──────────────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│ beev-tco-2026        │────▶│ Supabase         │◀────│ tarif-master-beev    │
│ (calcul TCO)         │     │ tco_results      │     │ (PDF + sélection)    │
└──────────────────────┘     └──────────────────┘     └──────────────────────┘
                     INSERT                     SELECT
```

---

## 1. Connexion Supabase identique

Dans `beev-tco-2026`, utiliser :

```typescript
const SUPABASE_URL = "https://cufovklqzypdosgmkhrp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

(les mêmes clés que dans `src/lib/supabase.ts` de tarif-master)

---

## 2. Schéma de la table `tco_results`

| Colonne                | Type        | Description |
|------------------------|-------------|-------------|
| `id`                   | UUID        | Auto-généré |
| `vehicle_id`           | TEXT        | ID du véhicule du catalog (ex: "tesla-model-y") |
| `vehicle_brand`        | TEXT        | "TESLA" |
| `vehicle_model`        | TEXT        | "MODEL Y" |
| `duration_months`      | INT         | 48 (durée LLD) |
| `km_per_year`          | INT         | 30000 |
| `energy_params`        | JSONB       | `{ mixHomePct, kWhHome, kWhPublic, fuelPriceL }` |
| `monthly_lld`          | NUMERIC     | Loyer mensuel TTC |
| `lease_per_100km`      | NUMERIC     | Coût loyer / 100 km |
| `energy_per_100km`     | NUMERIC     | Coût énergie / 100 km |
| `insurance_per_year`   | NUMERIC     | Assurance annuelle |
| `maintenance_per_year` | NUMERIC     | Maintenance annuelle |
| `tires_per_year`       | NUMERIC     | Pneus annuels |
| `tco_per_100km`        | NUMERIC     | TCO total / 100 km |
| `tco_per_year`         | NUMERIC     | TCO total / an |
| `tco_total_contract`   | NUMERIC     | TCO total sur durée |
| `ref_brand`            | TEXT        | "Peugeot 308 essence" (référence) |
| `ref_tco_per_100km`    | NUMERIC     | TCO référence essence / 100 km |
| `economy_per_100km`    | NUMERIC     | Économie / 100 km vs réf. |
| `economy_per_year`     | NUMERIC     | Économie annuelle |
| `economy_total_contract` | NUMERIC   | Économie sur durée contrat |
| `bonus_ecologique`     | NUMERIC     | Bonus écologique appliqué |
| `malus_co2`            | NUMERIC     | Malus CO₂ |
| `aide_locale`          | NUMERIC     | Aide régionale |
| `malus_poids`          | NUMERIC     | Malus au poids |
| `client_company`       | TEXT        | Nom de l'entreprise cliente (optionnel) |
| `computed_at`          | TIMESTAMP   | Auto |
| `source`               | TEXT        | "tco-calculator" |
| `notes`                | TEXT        | Notes libres |

---

## 3. Code à intégrer dans beev-tco-2026

Quand l'utilisateur termine un calcul TCO et clique sur "Sauvegarder" :

```typescript
import { supabase } from "./lib/supabase";

async function saveTcoResultToBeev({
  vehicleId,
  vehicleBrand,
  vehicleModel,
  durationMonths,
  kmPerYear,
  energyParams,
  monthlyLld,
  leasePer100km,
  energyPer100km,
  insurancePerYear,
  maintenancePerYear,
  tiresPerYear,
  tcoPer100km,
  tcoPerYear,
  tcoTotalContract,
  refBrand,
  refTcoPer100km,
  refTcoPerYear,
  economyPer100km,
  economyPerYear,
  economyTotalContract,
  bonusEcologique = 0,
  malusCo2 = 0,
  aideLocale = 0,
  malusPoids = 0,
  clientCompany,
  notes,
}) {
  const { data, error } = await supabase
    .from("tco_results")
    .insert({
      vehicle_id: vehicleId,
      vehicle_brand: vehicleBrand,
      vehicle_model: vehicleModel,
      duration_months: durationMonths,
      km_per_year: kmPerYear,
      energy_params: energyParams,
      monthly_lld: monthlyLld,
      lease_per_100km: leasePer100km,
      energy_per_100km: energyPer100km,
      insurance_per_year: insurancePerYear,
      maintenance_per_year: maintenancePerYear,
      tires_per_year: tiresPerYear,
      tco_per_100km: tcoPer100km,
      tco_per_year: tcoPerYear,
      tco_total_contract: tcoTotalContract,
      ref_brand: refBrand,
      ref_tco_per_100km: refTcoPer100km,
      ref_tco_per_year: refTcoPerYear,
      economy_per_100km: economyPer100km,
      economy_per_year: economyPerYear,
      economy_total_contract: economyTotalContract,
      bonus_ecologique: bonusEcologique,
      malus_co2: malusCo2,
      aide_locale: aideLocale,
      malus_poids: malusPoids,
      client_company: clientCompany,
      notes: notes,
      source: "tco-calculator",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Erreur sauvegarde TCO:", error);
    return null;
  }
  return data?.id;
}
```

---

## 4. Comportement côté tarif-master

Une fois le résultat dans Supabase, `tarif-master` :
1. Affiche un badge "TCO calculé le {date}" sur la fiche véhicule
2. Utilise les valeurs détaillées (assurance, maintenance, etc.) dans la
   page comparaison TCO et dans le bloc TCO du PDF
3. Si plusieurs résultats existent pour un véhicule, prend le plus
   récent (tri par `computed_at DESC`)

---

## 5. Prérequis

L'utilisateur qui sauvegarde doit être **connecté** à Supabase (auth).
Les RLS sont configurées pour autoriser l'écriture aux utilisateurs
authentifiés uniquement.

---

## 6. Test rapide

Après avoir installé le code dans `beev-tco-2026` :

```sql
-- Vérifier qu'un résultat est bien arrivé
SELECT vehicle_brand, vehicle_model, tco_per_100km, economy_per_100km, computed_at
FROM tco_results
ORDER BY computed_at DESC
LIMIT 5;
```
