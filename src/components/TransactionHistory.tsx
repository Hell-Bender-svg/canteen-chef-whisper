import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowUpCircle, ArrowDownCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
}

interface TransactionHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TransactionHistory = ({ open, onOpenChange }: TransactionHistoryProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTransactions();
    }
  }, [open]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Transaction History</DialogTitle>
          <DialogDescription>
            View your recent wallet transactions
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No transactions yet
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center gap-4 p-3 rounded-lg border bg-card"
                >
                  <div className={`p-2 rounded-full ${
                    transaction.transaction_type === 'credit' 
                      ? 'bg-green-500/10 text-green-500' 
                      : 'bg-red-500/10 text-red-500'
                  }`}>
                    {transaction.transaction_type === 'credit' ? (
                      <ArrowUpCircle className="h-5 w-5" />
                    ) : (
                      <ArrowDownCircle className="h-5 w-5" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {transaction.description}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(transaction.created_at), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className={`font-bold ${
                      transaction.transaction_type === 'credit' 
                        ? 'text-green-500' 
                        : 'text-red-500'
                    }`}>
                      {transaction.transaction_type === 'credit' ? '+' : '-'}₹{transaction.amount.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Balance: ₹{transaction.balance_after.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
