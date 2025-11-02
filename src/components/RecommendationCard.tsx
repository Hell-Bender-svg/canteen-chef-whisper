import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

interface RecommendationCardProps {
  rank: number;
  name: string;
  category: string;
  price: number;
  orderCount: number;
  timePeriod: string;
}

export const RecommendationCard = ({
  rank,
  name,
  category,
  price,
  orderCount,
  timePeriod
}: RecommendationCardProps) => {
  const getRankBadge = () => {
    if (rank === 1) return "🥇 #1";
    if (rank === 2) return "🥈 #2";
    if (rank === 3) return "🥉 #3";
    return `#${rank}`;
  };

  return (
    <Card className="p-4 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-card to-muted/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="font-bold">
              {getRankBadge()}
            </Badge>
            <Badge variant="outline">{category}</Badge>
          </div>
          
          <h3 className="font-semibold text-foreground mb-1">{name}</h3>
          
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="font-medium text-primary">₹{price}</span>
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {orderCount} orders
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};