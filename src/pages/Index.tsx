import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { RecommendationCard } from "@/components/RecommendationCard";
import { TimeFilter } from "@/components/TimeFilter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles, ChefHat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [timeFilter, setTimeFilter] = useState<'overall' | 'weekly' | 'monthly'>('overall');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('recommendations', {
        body: { type: timeFilter, limit: 10 }
      });

      if (error) throw error;

      if (data.success) {
        setRecommendations(data.recommendations);
      } else {
        toast.error("Failed to load recommendations");
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      toast.error("Error loading recommendations");
    } finally {
      setLoading(false);
    }
  };

  const seedMockData = async () => {
    setSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed-mock-data');

      if (error) throw error;

      if (data.success) {
        toast.success(`Generated ${data.inserted} mock orders!`);
        fetchRecommendations();
      } else {
        toast.error("Failed to generate mock data");
      }
    } catch (error) {
      console.error('Error seeding data:', error);
      toast.error("Error generating mock data");
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    // Auto-seed data on first load if no recommendations exist
    const initializeData = async () => {
      await fetchRecommendations();
      if (recommendations.length === 0) {
        await seedMockData();
      }
    };
    initializeData();
  }, [timeFilter]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            What's Popular Today?
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover the most-loved dishes at AKGEC Canteen
          </p>
        </div>

        {/* Filter */}
        <div className="max-w-2xl mx-auto mb-8">
          <TimeFilter value={timeFilter} onChange={setTimeFilter} />
        </div>

        {/* Recommendations Grid */}
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
      </main>
    </div>
  );
};

export default Index;