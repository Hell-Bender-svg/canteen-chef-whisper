import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { RecommendationCard } from "@/components/RecommendationCard";
import { TimeFilter } from "@/components/TimeFilter";
import { MenuGrid } from "@/components/MenuGrid";
import { Cart } from "@/components/Cart";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

interface Recommendation {
  rank: number;
  item: {
    id: string;
    name: string;
    category: string;
    price: number;
  };
  order_count: number;
  time_period: string;
}

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [timeFilter, setTimeFilter] = useState<'overall' | 'weekly' | 'monthly'>('overall');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [cartItems, setCartItems] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('recommendations', {
        body: { type: timeFilter, limit: 10 }
      });

      if (error) throw error;

      if (data.success) {
        setRecommendations(data.recommendations);
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMenuItems = async () => {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('category', { ascending: true });

      if (error) throw error;
      setMenuItems(data || []);
    } catch (error) {
      console.error('Error fetching menu items:', error);
      toast.error("Error loading menu");
    }
  };

  const seedMockData = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('seed-mock-data');
      if (error) throw error;
      if (data.success) {
        await fetchRecommendations();
      }
    } catch (error) {
      console.error('Error seeding data:', error);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      await fetchRecommendations();
      await fetchMenuItems();
      
      // Auto-seed if no recommendations
      if (recommendations.length === 0) {
        await seedMockData();
      }
    };
    initializeData();
  }, [timeFilter]);

  const handleAddToCart = (item: any) => {
    setCartItems(prev => ({
      ...prev,
      [item.id]: (prev[item.id] || 0) + 1
    }));
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCartItems(prev => {
      const newCart = { ...prev };
      if (newCart[itemId] > 1) {
        newCart[itemId]--;
      } else {
        delete newCart[itemId];
      }
      return newCart;
    });
  };

  const handleClearCart = () => {
    setCartItems({});
  };

  const handleCheckout = async () => {
    if (!user) {
      toast.error("Please sign in to place an order");
      navigate("/auth");
      return;
    }

    try {
      const orderPromises = Object.entries(cartItems).map(([itemId, quantity]) => {
        const item = menuItems.find(m => m.id === itemId);
        return supabase.functions.invoke('place-order', {
          body: {
            item_id: itemId,
            quantity,
            total_price: item.price * quantity
          }
        });
      });

      await Promise.all(orderPromises);
      toast.success("Order placed successfully!");
      setCartItems({});
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error("Failed to place order");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
  };

  const cartItemsArray = Object.entries(cartItems).map(([itemId, quantity]) => {
    const item = menuItems.find(m => m.id === itemId);
    return item ? { id: item.id, name: item.name, price: item.price, quantity } : null;
  }).filter(Boolean) as any[];

  const totalAmount = cartItemsArray.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <Navbar 
        user={user}
        onSignOut={handleSignOut}
        showRecommendations={showRecommendations}
        onToggleView={() => setShowRecommendations(!showRecommendations)}
        cartButton={
          !showRecommendations && (
            <Cart
              items={cartItemsArray}
              onRemoveItem={handleRemoveFromCart}
              onClearCart={handleClearCart}
              onCheckout={handleCheckout}
              totalAmount={totalAmount}
            />
          )
        }
      />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        {showRecommendations ? (
          <>
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                What's Popular Today?
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Discover the most-loved dishes at AKGEC Canteen
              </p>
            </div>

            <div className="max-w-2xl mx-auto mb-8">
              <TimeFilter value={timeFilter} onChange={setTimeFilter} />
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : recommendations.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
                {recommendations.map((rec) => (
                  <RecommendationCard
                    key={rec.item.id}
                    rank={rec.rank}
                    name={rec.item.name}
                    category={rec.item.category}
                    price={rec.item.price}
                    orderCount={rec.order_count}
                    timePeriod={rec.time_period}
                  />
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center max-w-2xl mx-auto">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading recommendations...</p>
              </Card>
            )}
          </>
        ) : (
          <>
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Order Your Favorite Food
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Browse our menu and place your order
              </p>
            </div>

            <MenuGrid
              items={menuItems}
              cartItems={cartItems}
              onAddToCart={handleAddToCart}
              onRemoveFromCart={handleRemoveFromCart}
            />
          </>
        )}
      </main>
    </div>
  );
};

export default Index;