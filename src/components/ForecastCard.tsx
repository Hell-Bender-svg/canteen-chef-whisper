import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ForecastCardProps {
  itemName: string;
  category: string;
  predictedQuantity: number;
  predictedRevenue: number;
  confidenceScore: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  forecastDate: string;
}

export const ForecastCard = ({
  itemName,
  category,
  predictedQuantity,
  predictedRevenue,
  confidenceScore,
  trend,
  forecastDate
}: ForecastCardProps) => {
  const getTrendIcon = () => {
    if (trend === 'increasing') return <TrendingUp className="w-4 h-4 text-success" />;
    if (trend === 'decreasing') return <TrendingDown className="w-4 h-4 text-destructive" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const getTrendBadge = () => {
    const variants = {
      increasing: "default",
      decreasing: "destructive", 
      stable: "secondary"
    } as const;
    
    return (
      <Badge variant={variants[trend]} className="flex items-center gap-1">
        {getTrendIcon()}
        {trend}
      </Badge>
    );
  };

  return (
    <Card className="p-4 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-card to-muted/20">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">{category}</Badge>
              {getTrendBadge()}
            </div>
            <h3 className="font-semibold text-foreground mb-1">{itemName}</h3>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground mb-1">Predicted Orders</p>
            <p className="font-semibold text-foreground">{predictedQuantity}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Expected Revenue</p>
            <p className="font-semibold text-primary">₹{predictedRevenue.toFixed(2)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
          <span className="text-muted-foreground">
            Confidence: {(confidenceScore * 100).toFixed(0)}%
          </span>
          <span className="text-muted-foreground">
            {new Date(forecastDate).toLocaleDateString()}
          </span>
        </div>
      </div>
    </Card>
  );
};
