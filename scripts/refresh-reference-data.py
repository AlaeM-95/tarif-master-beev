#!/usr/bin/env python3
"""Régénère les jeux de référence véhicules embarqués dans l'app.

  public/data/ademe-car-labelling.json  <- API ADEME « Car Labelling » (data.ademe.fr)
  public/data/open-ev-data.json         <- Open EV Data (dernière release GitHub, fichier JSON)

Usage (depuis le dossier repo/) :  python3 scripts/refresh-reference-data.py

Pas de dépendance : bibliothèque standard uniquement. À relancer chaque trimestre
(ADEME actualise janvier / avril / juillet / octobre) puis à committer les deux
fichiers JSON.

Sources et licences
  - ADEME Car Labelling : Licence Ouverte / Open Licence (Etalab).
    https://www.data.gouv.fr/dataservices/ademe-car-labelling
  - Open EV Data : CDLA-Permissive-2.0.
    https://github.com/open-ev-data/open-ev-data-dataset
"""
import json
import os
import urllib.parse
import urllib.request
from datetime import date

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data")

ADEME_API = "https://data.ademe.fr/data-fair/api/v1/datasets/ademe-car-labelling/lines"
ADEME_COLS = [
    "Marque", "Modèle", "Description_Commerciale", "Energie", "Carrosserie",
    "Puissance_fiscale", "Puissance_maximale", "Puissance_nominale_électrique",
    "CO2_vitesse_mixte_Max", "Conso_vitesse_mixte_Max", "Conso_elec_Max",
    "Autonomie_elec_Max", "Poids_à_vide", "Prix_véhicule",
]

OEV_RELEASE = "https://api.github.com/repos/open-ev-data/open-ev-data-dataset/releases/latest"
OEV_COLS = [
    "make_name", "model_name", "year", "trim_name", "variant_name", "vehicle_type",
    "system_power_kw", "battery_capacity_net_kwh", "range_wltp_km",
    "dc_max_power_kw", "ac_max_power_kw",
    "curb_weight_kg", "cargo_l", "length_mm", "width_mm", "height_mm", "fr_market",
]


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "tarif-master-refresh"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read()


def num(x):
    if x in (None, ""):
        return None
    try:
        f = float(x)
    except (TypeError, ValueError):
        return None
    return int(f) if f == int(f) else round(f, 2)


def ademe():
    qs = urllib.parse.urlencode({"size": 10000, "select": ",".join(ADEME_COLS)})
    data = json.loads(get(f"{ADEME_API}?{qs}"))
    seen, rows = set(), []
    for r in data["results"]:
        row = [r.get(c) for c in ADEME_COLS]
        key = tuple(row)
        if key in seen:
            continue
        seen.add(key)
        rows.append(row)
    rows.sort(key=lambda r: (str(r[0]), str(r[1]), str(r[2])))
    out = {
        "meta": {
            "source": "ADEME Car Labelling (data.ademe.fr)",
            "license": "Licence Ouverte / Open Licence (Etalab)",
            "url": "https://www.data.gouv.fr/dataservices/ademe-car-labelling",
            "generated": date.today().isoformat(),
            "units": "Puissance_* en kW, Conso_elec_Max en Wh/km, Poids en kg, CO2 WLTP en g/km",
        },
        "cols": ADEME_COLS,
        "rows": rows,
    }
    with open(os.path.join(OUT, "ademe-car-labelling.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"ADEME : {len(rows)} configurations uniques ({data['total']} lignes brutes)")


def open_ev_data():
    rel = json.loads(get(OEV_RELEASE))
    asset = next(a for a in rel["assets"] if a["name"].endswith(".json"))
    data = json.loads(get(asset["browser_download_url"]))

    def dig(o, *path):
        for k in path:
            if not isinstance(o, dict):
                return None
            o = o.get(k)
        return o

    rows = []
    for v in data["vehicles"]:
        wltp = next((c.get("range_km") for c in (dig(v, "range", "rated") or []) if c.get("cycle") == "wltp"), None)
        kwh = dig(v, "battery", "pack_capacity_kwh_net")
        if not (wltp or kwh):
            continue
        rows.append([
            dig(v, "make", "name"), dig(v, "model", "name"), num(v.get("year")),
            dig(v, "trim", "name") or "", dig(v, "variant", "name") or "", v.get("vehicle_type") or "",
            num(dig(v, "powertrain", "system_power_kw")), num(kwh), num(wltp),
            num(dig(v, "charging", "dc", "max_power_kw")), num(dig(v, "charging", "ac", "max_power_kw")),
            num(dig(v, "weights", "curb_weight_kg")), num(dig(v, "capacity", "cargo_l")),
            num(dig(v, "dimensions", "length_mm")), num(dig(v, "dimensions", "width_mm")), num(dig(v, "dimensions", "height_mm")),
            1 if "FR" in (v.get("markets") or []) else 0,
        ])
    rows.sort(key=lambda r: (r[0], r[1], r[2] or 0, r[3], r[4]))
    out = {
        "meta": {
            "source": "Open EV Data " + rel["tag_name"],
            "license": "CDLA-Permissive-2.0",
            "url": "https://github.com/open-ev-data/open-ev-data-dataset",
            "generated": date.today().isoformat(),
            "units": "puissance et recharge en kW, batterie nette en kWh, autonomie WLTP en km, poids en kg, coffre en L, dimensions en mm",
            "caveat": "Jeu communautaire : des valeurs peuvent être erronées (ex. Model Y Long Range AWD à 719 km WLTP). Toujours croiser.",
        },
        "cols": OEV_COLS,
        "rows": rows,
    }
    with open(os.path.join(OUT, "open-ev-data.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Open EV Data {rel['tag_name']} : {len(rows)} variantes")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    ademe()
    open_ev_data()
