interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
}

const Sparkline = ({ data, width = 80, height = 24 }: SparklineProps) => {
  if (!data.length || data.every((v) => v === 0)) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const max = Math.max(...data, 1);
  const stepX = width / Math.max(data.length - 1, 1);
  const points = data
    .map((v, i) => `${(i * stepX).toFixed(2)},${(height - (v / max) * height).toFixed(2)}`)
    .join(" ");
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  const total = data.reduce((a, b) => a + b, 0);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      role="img"
      aria-label={`${total} generations in the last 30 days`}
    >
      <polygon points={areaPoints} fill="hsl(var(--primary) / 0.15)" />
      <polyline
        points={points}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default Sparkline;
