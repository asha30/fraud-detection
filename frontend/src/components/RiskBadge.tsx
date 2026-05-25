import Badge from './Badge';

export default function RiskBadge({ score }: { score: number }) {
  if (score > 70) return <Badge variant="high">High</Badge>;
  if (score >= 40) return <Badge variant="medium">Medium</Badge>;
  return <Badge variant="low">Low</Badge>;
}
