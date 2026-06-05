-- Migration 031 : ajoute les clés pdf_texts pour la fiche produit borne
-- (Connectivité, Communication, Smart Charging, Garantie) éditables depuis
-- /admin/pdf > onglet Site > catégorie fiche produit.

INSERT INTO pdf_texts (scope, slug, category, label, kind, content_text, content_list, position) VALUES
  ('site', 'site_product_connectivity', 'site · fiche produit', 'Spec Connectivité', 'text',
    'Prise Type 2 intégrée · Lecteur RFID · Connectivité WiFi/4G', NULL, 10),
  ('site', 'site_product_communication', 'site · fiche produit', 'Spec Communication', 'text',
    'OCPP 1.6 et 2.0 · Supervision compatible', NULL, 11),
  ('site', 'site_product_smart_charging', 'site · fiche produit', 'Spec Smart Charging', 'text',
    'Délestage dynamique · Équilibrage actif', NULL, 12),
  ('site', 'site_product_warranty', 'site · fiche produit', 'Spec Qualité et Garantie (personnalisable par modèle)', 'text',
    'IP54 · IK10 · Garantie constructeur 3 ans (extensible 6 ans)', NULL, 13)
ON CONFLICT (scope, slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';
