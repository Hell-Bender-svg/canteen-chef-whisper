import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Clock, CheckCircle2, Play, XCircle } from "lucide-react";
import { format } from "date-fns";

interface QueueItem {
  id: string;
  ticket_number: number;
  status: string;
  estimated_ready_at: string;
  actual_ready_at: string | null;
  item_name: string;
  quantity: number;
  created_at: string;
}

export const OwnerQueueManager = () => {
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQueue();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('owner-queue-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_queue'
        },
        () => {
          fetchQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchQueue = async () => {
    try {
      const { data, error } = await supabase
        .from('queue_display')
        .select('*')
        .in('status', ['pending', 'preparing', 'ready'])
        .order('ticket_number', { ascending: true });

      if (error) throw error;
      setQueueItems(data || []);
    } catch (error) {
      console.error('Error fetching queue:', error);
      toast.error("Error loading queue");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };
      
      if (newStatus === 'ready') {
        updateData.actual_ready_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('order_queue')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      
      toast.success(`Order marked as ${newStatus}`);
      fetchQueue();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error("Failed to update status");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-500';
      case 'preparing': return 'bg-blue-500/10 text-blue-500';
      case 'ready': return 'bg-green-500/10 text-green-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const pendingCount = queueItems.filter(i => i.status === 'pending').length;
  const preparingCount = queueItems.filter(i => i.status === 'preparing').length;
  const readyCount = queueItems.filter(i => i.status === 'ready').length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Preparing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{preparingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Ready</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{readyCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order Queue</CardTitle>
          <CardDescription>Manage current orders and their status</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>ETA</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queueItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono font-bold">
                    #{item.ticket_number}
                  </TableCell>
                  <TableCell className="font-medium">{item.item_name}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(item.status)}>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.estimated_ready_at 
                      ? format(new Date(item.estimated_ready_at), 'HH:mm')
                      : '-'
                    }
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(item.created_at), 'HH:mm')}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {item.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(item.id, 'preparing')}
                        className="gap-1"
                      >
                        <Play className="h-3 w-3" />
                        Start
                      </Button>
                    )}
                    {item.status === 'preparing' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(item.id, 'ready')}
                        className="gap-1"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Ready
                      </Button>
                    )}
                    {item.status === 'ready' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(item.id, 'completed')}
                        className="gap-1"
                      >
                        <XCircle className="h-3 w-3" />
                        Complete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
