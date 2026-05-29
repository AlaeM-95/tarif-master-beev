-- Ajoute le prix d'achat HT sur chaque borne (distinct du prix de vente catalogue
-- déjà stocké dans price_ht). Sans cette colonne, le PU achat affiché dans le
-- chiffrage commercial était identique au PU client, ce qui empêchait tout
-- calcul de marge.

ALTER TABLE chargers ADD COLUMN IF NOT EXISTS price_buy_ht NUMERIC NOT NULL DEFAULT 0;

-- Seed des prix d'achat issus de l'onglet 'Materiel - Borne' du fichier
-- TARIF INSTALLATEURS. Matching case-insensitive sur brand + model.
-- Ne touche que les bornes dont price_buy_ht est encore 0, pour ne pas écraser
-- des saisies admin manuelles.

UPDATE chargers SET price_buy_ht = 379.0 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Ohme')) AND LOWER(TRIM(model)) = LOWER(TRIM('Epod S Monophasé'));
UPDATE chargers SET price_buy_ht = 434.0 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Ohme')) AND LOWER(TRIM(model)) = LOWER(TRIM('Epod S Triphasé'));
UPDATE chargers SET price_buy_ht = 523.71 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Alfen')) AND LOWER(TRIM(model)) = LOWER(TRIM('Eve Single S-line Monophasé'));
UPDATE chargers SET price_buy_ht = 537.51 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Alfen')) AND LOWER(TRIM(model)) = LOWER(TRIM('Eve Single S-line Triphasé'));
UPDATE chargers SET price_buy_ht = 690.0 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Alfen')) AND LOWER(TRIM(model)) = LOWER(TRIM('Eve Single Pro-line Monophasé'));
UPDATE chargers SET price_buy_ht = 790.27 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Alfen')) AND LOWER(TRIM(model)) = LOWER(TRIM('Eve Single Pro-line Triphasé'));
UPDATE chargers SET price_buy_ht = 2014.0 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Alfen')) AND LOWER(TRIM(model)) = LOWER(TRIM('Eve Double Pro-line Monophasé'));
UPDATE chargers SET price_buy_ht = 2293.38 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Alfen')) AND LOWER(TRIM(model)) = LOWER(TRIM('Eve Double Pro-line Triphasé'));
UPDATE chargers SET price_buy_ht = 429.0 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('V2C')) AND LOWER(TRIM(model)) = LOWER(TRIM('Trydan Pro Monophasé'));
UPDATE chargers SET price_buy_ht = 497.0 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('V2C')) AND LOWER(TRIM(model)) = LOWER(TRIM('Trydan Pro Triphasé'));
UPDATE chargers SET price_buy_ht = 500.0 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Hager')) AND LOWER(TRIM(model)) = LOWER(TRIM('Witty Plus Monophasé'));
UPDATE chargers SET price_buy_ht = 500.0 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Hager')) AND LOWER(TRIM(model)) = LOWER(TRIM('Witty Plus Triphasé'));
UPDATE chargers SET price_buy_ht = 680.0 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Hager')) AND LOWER(TRIM(model)) = LOWER(TRIM('Witty Pro Monophasé'));
UPDATE chargers SET price_buy_ht = 680.0 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Hager')) AND LOWER(TRIM(model)) = LOWER(TRIM('Witty Pro Triphasé'));
UPDATE chargers SET price_buy_ht = 2100.0 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Hager')) AND LOWER(TRIM(model)) = LOWER(TRIM('Witty Park Double Triphasé'));
UPDATE chargers SET price_buy_ht = 1153.12 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Porsche')) AND LOWER(TRIM(model)) = LOWER(TRIM('Wallbox Monophasé'));
UPDATE chargers SET price_buy_ht = 1153.12 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Porsche')) AND LOWER(TRIM(model)) = LOWER(TRIM('Wallbox Triphasé'));
UPDATE chargers SET price_buy_ht = 626.5 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Smappee')) AND LOWER(TRIM(model)) = LOWER(TRIM('EV Wall Monophasé'));
UPDATE chargers SET price_buy_ht = 626.5 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Smappee')) AND LOWER(TRIM(model)) = LOWER(TRIM('EV Wall Triphasé'));
UPDATE chargers SET price_buy_ht = 649.0 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Smappee')) AND LOWER(TRIM(model)) = LOWER(TRIM('EV Wall Monophasé + 4G + Linky'));
UPDATE chargers SET price_buy_ht = 649.0 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Smappee')) AND LOWER(TRIM(model)) = LOWER(TRIM('EV Wall Triphasé + 4G + Linky'));
UPDATE chargers SET price_buy_ht = 689.0 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Smappee')) AND LOWER(TRIM(model)) = LOWER(TRIM('EV Wall Monophasé + 4G + Smart Kit'));
UPDATE chargers SET price_buy_ht = 689.0 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Smappee')) AND LOWER(TRIM(model)) = LOWER(TRIM('EV Wall Triphasé + 4G + Smart Kit'));
UPDATE chargers SET price_buy_ht = 796.0 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Smappee')) AND LOWER(TRIM(model)) = LOWER(TRIM('EV One Monophasé'));
UPDATE chargers SET price_buy_ht = 796.0 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Smappee')) AND LOWER(TRIM(model)) = LOWER(TRIM('EV One Triphasé'));
UPDATE chargers SET price_buy_ht = 869.0 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Smappee')) AND LOWER(TRIM(model)) = LOWER(TRIM('EV One Monophasé + Smart Kit / Linky'));
UPDATE chargers SET price_buy_ht = 869.0 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Smappee')) AND LOWER(TRIM(model)) = LOWER(TRIM('EV One Monophasé + Smart Kit / Linky'));
UPDATE chargers SET price_buy_ht = 1699.0 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Smappee')) AND LOWER(TRIM(model)) = LOWER(TRIM('EV Dual Wall Triphasé'));
UPDATE chargers SET price_buy_ht = 1849.0 WHERE price_buy_ht = 0 AND LOWER(TRIM(brand)) = LOWER(TRIM('Smappee')) AND LOWER(TRIM(model)) = LOWER(TRIM('EV Dual Base Triphasé'));

-- Vérification : combien de bornes ont maintenant un prix d'achat ?
SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE price_buy_ht > 0) AS with_buy_price FROM chargers;
