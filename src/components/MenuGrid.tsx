import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
}

interface MenuGridProps {
  items: MenuItem[];
  cartItems: Record<string, number>;
  onAddToCart: (item: MenuItem) => void;
  onRemoveFromCart: (itemId: string) => void;
}

export const MenuGrid = ({ items, cartItems, onAddToCart, onRemoveFromCart }: MenuGridProps) => {
  const categories = [...new Set(items.map(item => item.category))];

  return (
    <div className="space-y-8">
      {categories.map(category => (
        <div key={category}>
          <h2 className="text-2xl font-bold mb-4">{category}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items
              .filter(item => item.category === category)
              .map(item => {
                const quantity = cartItems[item.id] || 0;
                return (
                  <Card key={item.id} className="p-4 hover:shadow-lg transition-all">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{item.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {item.description}
                          </p>
                        </div>
                        <Badge variant="secondary" className="ml-2">
                          ₹{item.price}
                        </Badge>
                      </div>

                      {quantity === 0 ? (
                        <Button 
                          onClick={() => onAddToCart(item)}
                          className="w-full"
                          size="sm"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add to Cart
                        </Button>
                      ) : (
                        <div className="flex items-center justify-between bg-primary/10 rounded-lg p-2">
                          <Button
                            onClick={() => onRemoveFromCart(item.id)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="font-semibold text-primary">{quantity}</span>
                          <Button
                            onClick={() => onAddToCart(item)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
};
