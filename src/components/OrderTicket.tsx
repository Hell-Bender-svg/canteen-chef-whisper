import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Ticket, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface QueueItem {
  id: string;
  ticket_number: number;
  status: string;
  estimated_ready_at: string;
  actual_ready_at: string | null;
  item_name: string;
  quantity: number;
}

interface OrderTicketProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketNumber: number;
  estimatedMinutes: number;
}

export const OrderTicket = ({ open, onOpenChange, ticketNumber, estimatedMinutes }: OrderTicketProps) => {
  const [queueItem, setQueueItem] = useState<QueueItem | null>(null);

  useEffect(() => {
    if (open && ticketNumber) {
      fetchQueueItem();
      
      // Subscribe to realtime updates
      const channel = supabase
        .channel(`ticket-${ticketNumber}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'order_queue',
            filter: `ticket_number=eq.${ticketNumber}`
          },
          () => {
            fetchQueueItem();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [open, ticketNumber]);

  const fetchQueueItem = async () => {
    try {
      const { data, error } = await supabase
        .from('queue_display')
        .select('*')
        .eq('ticket_number', ticketNumber)
        .single();

      if (error) throw error;
      setQueueItem(data);
    } catch (error) {
      console.error('Error fetching queue item:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'preparing': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'ready': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'completed': return 'bg-muted text-muted-foreground border-muted';
      default: return 'bg-muted text-muted-foreground border-muted';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'In Queue';
      case 'preparing': return 'Being Prepared';
      case 'ready': return 'Ready for Pickup!';
      case 'completed': return 'Completed';
      default: return status;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Order Ticket
          </DialogTitle>
          <DialogDescription>
            Your order has been placed successfully
          </DialogDescription>
        </DialogHeader>

        <Card className="border-2 border-primary/20">
          <CardContent className="pt-6">
            <div className="text-center space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Ticket Number</p>
                <div className="text-6xl font-bold text-primary">
                  #{ticketNumber}
                </div>
              </div>

              {queueItem && (
                <>
                  <div className="flex items-center justify-center">
                    <Badge className={`${getStatusColor(queueItem.status)} px-4 py-2 text-sm`}>
                      {getStatusText(queueItem.status)}
                    </Badge>
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Item</span>
                      <span className="font-medium">{queueItem.item_name} x{queueItem.quantity}</span>
                    </div>

                    {queueItem.status !== 'completed' && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Estimated Time
                        </span>
                        <span className="font-medium">
                          {queueItem.estimated_ready_at 
                            ? format(new Date(queueItem.estimated_ready_at), 'HH:mm')
                            : `~${estimatedMinutes} min`
                          }
                        </span>
                      </div>
                    )}

                    {queueItem.status === 'ready' && (
                      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mt-4">
                        <div className="flex items-center gap-2 text-green-500 justify-center">
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="font-semibold">Ready for Pickup!</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2 text-center">
                          Please collect your order from the counter
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Keep this ticket number for reference
        </p>
      </DialogContent>
    </Dialog>
  );
};
