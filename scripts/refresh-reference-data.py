#!/usr/bin/env python3
"""Régénère les jeux de référence véhicules embarqués dans l'app.

  public/data/ademe-car-labelling.json  <- API ADEME « Car Labelling » (data.ademe.fr)
  public/data/open-ev-data.json         <- Open EV Data (dernière release GitHub)

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
import csv
import io
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
    asset = next(a for a in rel["assets"] if a["name"].endswith(".csv"))
    text = get(asset["browser_download_url"]).decode("utf-8")
    rows = []
    for r in csv.DictReader(io.StringIO(text)):
        if not (r["range_wltp_km"] or r["battery_capacity_net_kwh"]):
            continue
        rows.append([
            r["make_name"], r["model_name"], num(r["year"]), r["trim_name"], r["variant_name"],
            r["vehicle_type"], num(r["system_power_kw"]), num(r["battery_capacity_net_kwh"]),
            num(r["range_wltp_km"]), num(r["dc_max_power_kw"]), num(r["ac_max_power_kw"]),
        ])
    rows.sort(key=lambda r: (r[0], r[1], r[2] or 0, r[3], r[4]))
    out = {
        "meta": {
            "source": "Open EV Data " + rel["tag_name"],
            "license": "CDLA-Permissive-2.0",
            "url": "https://github.com/open-ev-data/open-ev-data-dataset",
            "generated": date.today().isoformat(),
            "units": "puissance et recharge en kW, batterie nette en kWh, autonomie WLTP en km",
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
