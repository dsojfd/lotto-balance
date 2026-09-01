interface LottoBallProps {
  number: number;
}

function rangeLabel(number: number): string {
  if (number <= 10) return '1에서 10 구간';
  if (number <= 20) return '11에서 20 구간';
  if (number <= 30) return '21에서 30 구간';
  if (number <= 40) return '31에서 40 구간';
  return '41에서 45 구간';
}

export function LottoBall({ number }: LottoBallProps) {
  const range = Math.min(5, Math.ceil(number / 10));
  return <span className={`lotto-ball lotto-ball--${range}`} aria-label={`번호 ${number}, ${rangeLabel(number)}`}>{number}</span>;
}
