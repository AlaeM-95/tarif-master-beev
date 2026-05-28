// Liste déroulante de marges avec barème fixe imposé.
// Utilisée pour les lignes de chiffrage bornes uniquement.

// Barème officiel : 0 % à 150 % par paliers de 10 %.
// Le 0 % permet de "remettre à zéro" la marge si nécessaire.
export const MARGIN_PRESETS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150];

type Props = {
  value: number;
  onChange: (v: number) => void;
  className?: string;
};

export function MarginSelect({ value, onChange, className }: Props) {
  // Si la valeur courante ne fait pas partie du barème (anciennes saisies libres),
  // on la conserve dans la liste pour ne pas la perdre silencieusement.
  const options = MARGIN_PRESETS.includes(value)
    ? MARGIN_PRESETS
    : [...MARGIN_PRESETS, value].sort((a, b) => a - b);

  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={
        className ??
        "h-7 w-full rounded-md border border-[#3809EA]/40 bg-background px-2 text-xs text-right font-semibold text-[#3809EA] cursor-pointer"
      }
      title="Barème de marge appliqué pour le PDF client"
    >
      {options.map((m) => (
        <option key={m} value={m}>
          {m} %
        </option>
      ))}
    </select>
  );
}
