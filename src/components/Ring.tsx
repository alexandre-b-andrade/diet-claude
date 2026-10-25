/** Anel de progresso simples em SVG. */
export default function Ring({
  value,
  max,
  label,
  unit,
  size = 120,
  color = "var(--color-brand-600)",
  ofLabel = "de",
}: {
  value: number;
  max: number;
  label: string;
  unit: string;
  size?: number;
  color?: string;
  ofLabel?: string;
}) {
  const pct = max > 0 ? Math.min(value / max, 1.25) : 0;
  const over = max > 0 && value > max;
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const dash = Math.min(pct, 1) * c;
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${value} de ${max} ${unit}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-stone-200)" strokeWidth="10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? "var(--color-amber-500)" : color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="46%" textAnchor="middle" className="fill-stone-900" style={{ fontSize: size * 0.2, fontWeight: 600 }}>
          {Math.round(value)}
        </text>
        <text x="50%" y="64%" textAnchor="middle" className="fill-stone-500" style={{ fontSize: size * 0.1 }}>
          {ofLabel} {Math.round(max)} {unit}
        </text>
      </svg>
      <span className="mt-1 text-xs text-stone-600">{label}</span>
    </div>
  );
}
