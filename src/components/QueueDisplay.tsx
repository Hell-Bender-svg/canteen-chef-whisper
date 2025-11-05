import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp } from "lucide-react";

interface QueueItem {
  id: string;
  ticket_number: number;
  status: string;
  item_name: string;
  quantity: number;
}

export const QueueDisplay = () => {
  const [nowServing, setNowServing] = useState<number | null>(null);
  const [recentlyReady, setRecentlyReady] = useState<QueueItem[]>([]);

  useEffect(() => {
    fetchQueueStatus();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('queue-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_queue'
        },
        () => {
          fetchQueueStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchQueueStatus = async () => {
    try {
      // Get the latest ready order
      const { data: readyOrders, error: readyError } = await supabase
        .from('queue_display')
        .select('*')
        .eq('status', 'ready')
        .order('ticket_number', { ascending: false })
        .limit(5);

      if (readyError) throw readyError;

      if (readyOrders && readyOrders.length > 0) {
        setNowServing(readyOrders[0].ticket_number);
        setRecentlyReady(readyOrders);
      } else {
        // If no ready orders, show the latest preparing order
        const { data: preparingOrders, error: prepError } = await supabase
          .from('queue_display')
          .select('*')
          .eq('status', 'preparing')
          .order('ticket_number', { ascending: false })
          .limit(1);

        if (!prepError && preparingOrders && preparingOrders.length > 0) {
          setNowServing(preparingOrders[0].ticket_number);
        }
      }
    } catch (error) {
      console.error('Error fetching queue status:', error);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">Now Serving</CardTitle>
          <CardDescription>Current ticket being prepared</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="text-8xl font-bold text-primary mb-4">
              {nowServing ? `#${nowServing}` : '--'}
            </div>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Real-time updates</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {recentlyReady.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5" />
              Recently Ready
            </CardTitle>
            <CardDescription>Orders ready for pickup</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentlyReady.slice(1, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono">
                      #{item.ticket_number}
                    </Badge>
                    <span className="text-sm font-medium">{item.item_name}</span>
                  </div>
                  <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                    Ready
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
