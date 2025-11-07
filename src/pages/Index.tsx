import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { RecommendationCard } from "@/components/RecommendationCard";
import { ForecastCard } from "@/components/ForecastCard";
import { TimeFilter } from "@/components/TimeFilter";
import { MenuGrid } from "@/components/MenuGrid";
import { Cart } from "@/components/Cart";
import { WalletCard } from "@/components/WalletCard";
import { TransactionHistory } from "@/components/TransactionHistory";
import { QueueDisplay } from "@/components/QueueDisplay";
import { OrderTicket } from "@/components/OrderTicket";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, TrendingUp } from "lucide-react";
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
  const [timeFilter, setTimeFilter] = useState<'overall' | 'weekly' | 'monthly'>('overall');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [personalizedRecs, setPersonalizedRecs] = useState<any[]>([]);
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [cartItems, setCartItems] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [showOrderTicket, setShowOrderTicket] = useState(false);
  const [currentTicket, setCurrentTicket] = useState<{ number: number; minutes: number } | null>(null);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchWalletBalance();
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchWalletBalance();
      } else {
        setWalletBalance(0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchWalletBalance = async () => {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('balance')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // Ignore "no rows" error
        throw error;
      }

      setWalletBalance(data ? parseFloat(String(data.balance)) : 0);
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
    }
  };

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

  const fetchPersonalizedRecommendations = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('personalized-recommendations', {
        body: { user_id: user.id, limit: 10 }
      });

      if (error) throw error;

      if (data.success) {
        setPersonalizedRecs(data.recommendations);
      }
    } catch (error) {
      console.error('Error fetching personalized recommendations:', error);
    }
  };

  const fetchForecasts = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('demand-forecast', {
        body: { forecast_type: 'daily', days_ahead: 7 }
      });

      if (error) throw error;

      if (data.success) {
        setForecasts(data.forecasts.slice(0, 6));
      }
    } catch (error) {
      console.error('Error fetching forecasts:', error);
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
      await fetchForecasts();
      
      if (user) {
        await fetchPersonalizedRecommendations();
      }
      
      // Auto-seed if no recommendations
      if (recommendations.length === 0) {
        await seedMockData();
      }
    };
    initializeData();
  }, [timeFilter, user]);

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
        return supabase.functions.invoke('place-order', {
          body: {
            item_id: itemId,
            quantity,
            use_wallet: false
          }
        });
      });

      const results = await Promise.all(orderPromises);
      
      // Get the first ticket number (if multiple orders, show first one)
      const firstResult = results[0]?.data;
      if (firstResult?.ticket_number) {
        setCurrentTicket({
          number: firstResult.ticket_number,
          minutes: firstResult.estimated_minutes || 5
        });
        setShowOrderTicket(true);
      }

      toast.success("Order placed successfully! Pay cash on pickup.");
      setCartItems({});
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error("Failed to place order");
    }
  };

  const handleWalletCheckout = async () => {
    if (!user) {
      toast.error("Please sign in to place an order");
      navigate("/auth");
      return;
    }

    // Calculate total amount
    const totalAmount = Object.entries(cartItems).reduce((sum, [itemId, quantity]) => {
      const item = menuItems.find(m => m.id === itemId);
      return sum + (item ? item.price * quantity : 0);
    }, 0);
    
    if (walletBalance < totalAmount) {
      toast.error(`Insufficient balance. You need ₹${totalAmount.toFixed(2)} but have ₹${walletBalance.toFixed(2)}`);
      return;
    }

    try {
      const orderPromises = Object.entries(cartItems).map(([itemId, quantity]) => {
        return supabase.functions.invoke('place-order', {
          body: {
            item_id: itemId,
            quantity,
            use_wallet: true
          }
        });
      });

      const results = await Promise.all(orderPromises);
      
      // Get the first ticket number
      const firstResult = results[0]?.data;
      if (firstResult?.ticket_number) {
        setCurrentTicket({
          number: firstResult.ticket_number,
          minutes: firstResult.estimated_minutes || 5
        });
        setShowOrderTicket(true);
      }

      toast.success("Order placed and paid from wallet!");
      setCartItems({});
      fetchWalletBalance(); // Refresh wallet balance
    } catch (error) {
      console.error('Wallet checkout error:', error);
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
        cartButton={
          <Cart
            items={cartItemsArray}
            onRemoveItem={handleRemoveFromCart}
            onClearCart={handleClearCart}
            onCheckout={handleCheckout}
            onWalletCheckout={handleWalletCheckout}
            totalAmount={totalAmount}
            walletBalance={walletBalance}
            isLoggedIn={!!user}
          />
        }
      />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="text-center mb-12">
          <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">AKGEC CANTEEN</p>
          <h1 className="text-5xl md:text-7xl font-bold mb-4" style={{ color: 'hsl(25, 75%, 47%)' }}>
            Cafe @ AKGEC
          </h1>
        </div>

        <Tabs defaultValue="popular" className="max-w-6xl mx-auto mb-12">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="popular" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Popular
            </TabsTrigger>
            {user && (
              <TabsTrigger value="personalized" className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                For You
              </TabsTrigger>
            )}
            <TabsTrigger value="forecast">Forecasts</TabsTrigger>
          </TabsList>

          <TabsContent value="popular">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : recommendations.length > 0 ? (
              <>
                <div className="max-w-7xl mx-auto mb-8">
                  <div className="flex items-center justify-center gap-4 mb-8 overflow-x-auto pb-4">
                    {recommendations.slice(0, 6).map((rec) => (
                      <button
                        key={rec.item.id}
                        onClick={() => {
                          const element = document.getElementById(`menu-item-${rec.item.id}`);
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }}
                        className="flex-shrink-0 group cursor-pointer"
                      >
                        <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-secondary/20 shadow-lg transition-transform duration-300 group-hover:scale-105 group-hover:shadow-xl">
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                            <span className="text-xs font-bold text-primary mb-1">#{rec.rank}</span>
                            <span className="text-sm font-semibold line-clamp-2">{rec.item.name}</span>
                            <span className="text-xs text-muted-foreground mt-1">₹{rec.item.price}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="max-w-2xl mx-auto">
                  <TimeFilter value={timeFilter} onChange={setTimeFilter} />
                </div>
              </>
            ) : (
              <Card className="p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading recommendations...</p>
              </Card>
            )}
          </TabsContent>

          {user && (
            <TabsContent value="personalized">
              {personalizedRecs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {personalizedRecs.map((rec) => (
                    <RecommendationCard
                      key={rec.item.id}
                      rank={rec.rank}
                      name={rec.item.name}
                      category={rec.item.category}
                      price={rec.item.price}
                      orderCount={Math.round(rec.ml_score)}
                      timePeriod="ML-Powered"
                    />
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <Sparkles className="w-12 h-12 text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Order more items to get personalized recommendations!
                  </p>
                </Card>
              )}
            </TabsContent>
          )}

          <TabsContent value="forecast">
            {forecasts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {forecasts.map((forecast) => (
                  <ForecastCard
                    key={forecast.item_id}
                    itemName={forecast.item?.name || 'Unknown'}
                    category={forecast.item?.category || 'Unknown'}
                    predictedQuantity={forecast.predicted_quantity}
                    predictedRevenue={forecast.predicted_revenue}
                    confidenceScore={forecast.confidence_score}
                    trend={forecast.trend}
                    forecastDate={forecast.forecast_date}
                  />
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <TrendingUp className="w-12 h-12 text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Generating demand forecasts...
                </p>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <div className="mb-12 max-w-4xl mx-auto">
          <QueueDisplay />
        </div>

        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Order Your Favorites</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Browse our full menu and place your order
          </p>
        </div>

        {user && (
          <div className="mb-12 max-w-md mx-auto">
            <WalletCard 
              balance={walletBalance} 
              onTopupSuccess={fetchWalletBalance}
              onViewHistory={() => setShowTransactionHistory(true)}
            />
          </div>
        )}

        <MenuGrid
          items={menuItems}
          cartItems={cartItems}
          onAddToCart={handleAddToCart}
          onRemoveFromCart={handleRemoveFromCart}
        />
      </main>

      <TransactionHistory 
        open={showTransactionHistory}
        onOpenChange={setShowTransactionHistory}
      />

      {currentTicket && (
        <OrderTicket
          open={showOrderTicket}
          onOpenChange={setShowOrderTicket}
          ticketNumber={currentTicket.number}
          estimatedMinutes={currentTicket.minutes}
        />
      )}
    </div>
  );
};

export default Index;