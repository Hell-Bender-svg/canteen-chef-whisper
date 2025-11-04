import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartProps {
  items: CartItem[];
  onRemoveItem: (itemId: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  onWalletCheckout: () => void;
  totalAmount: number;
  walletBalance: number;
  isLoggedIn: boolean;
}

export const Cart = ({ 
  items, 
  onRemoveItem, 
  onClearCart, 
  onCheckout, 
  onWalletCheckout, 
  totalAmount,
  walletBalance,
  isLoggedIn
}: CartProps) => {
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const canPayWithWallet = isLoggedIn && walletBalance >= totalAmount;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 relative">
          <ShoppingCart className="w-4 h-4" />
          <span className="hidden sm:inline">Cart</span>
          {totalItems > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0">
              {totalItems}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Your Cart ({totalItems} items)</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Your cart is empty</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                {items.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium">{item.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        ₹{item.price} × {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">₹{item.price * item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveItem(item.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-3">
                {isLoggedIn && (
                  <div className="flex justify-between text-sm p-2 bg-primary/10 rounded">
                    <span>Wallet Balance</span>
                    <span className="font-semibold">₹{walletBalance.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>₹{totalAmount}</span>
                </div>

                {isLoggedIn && canPayWithWallet && (
                  <Button 
                    onClick={onWalletCheckout} 
                    className="w-full gap-2" 
                    size="lg"
                    variant="default"
                  >
                    Pay with Wallet
                  </Button>
                )}

                <Button 
                  onClick={onCheckout} 
                  className="w-full" 
                  size="lg"
                  variant={canPayWithWallet ? "outline" : "default"}
                >
                  {isLoggedIn ? 'Pay Cash on Pickup' : 'Place Order'}
                </Button>

                <Button onClick={onClearCart} variant="outline" className="w-full">
                  Clear Cart
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
