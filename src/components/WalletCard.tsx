import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, Plus, History } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WalletCardProps {
  balance: number;
  onTopupSuccess: () => void;
  onViewHistory: () => void;
}

export const WalletCard = ({ balance, onTopupSuccess, onViewHistory }: WalletCardProps) => {
  const [topupAmount, setTopupAmount] = useState<string>('500');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleTopup = async () => {
    const amount = parseFloat(topupAmount);
    
    if (isNaN(amount) || amount < 100 || amount > 10000) {
      toast({
        title: "Invalid Amount",
        description: "Please enter an amount between ₹100 and ₹10,000",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('wallet-topup', {
        body: { amount }
      });

      if (error) throw error;

      if (data.checkout_url) {
        // Open Stripe checkout in new tab
        window.open(data.checkout_url, '_blank');
        
        toast({
          title: "Redirecting to Payment",
          description: "Complete your payment in the new tab"
        });
        
        // Poll for balance update
        const pollInterval = setInterval(() => {
          onTopupSuccess();
        }, 3000);

        // Stop polling after 2 minutes
        setTimeout(() => clearInterval(pollInterval), 120000);
      }
    } catch (error) {
      console.error('Top-up error:', error);
      toast({
        title: "Top-up Failed",
        description: error instanceof Error ? error.message : "Failed to initiate top-up",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Your Wallet
        </CardTitle>
        <CardDescription>
          Use your wallet balance for quick checkout
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg">
          <span className="text-sm font-medium">Current Balance</span>
          <span className="text-2xl font-bold">₹{balance.toFixed(2)}</span>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Add Money</label>
          <div className="flex gap-2">
            <Input
              type="number"
              value={topupAmount}
              onChange={(e) => setTopupAmount(e.target.value)}
              placeholder="Amount"
              min="100"
              max="10000"
              className="flex-1"
            />
            <Button 
              onClick={handleTopup}
              disabled={isProcessing}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Top-up
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Min: ₹100 | Max: ₹10,000
          </p>
        </div>

        <Button 
          variant="outline" 
          className="w-full gap-2"
          onClick={onViewHistory}
        >
          <History className="h-4 w-4" />
          View Transaction History
        </Button>
      </CardContent>
    </Card>
  );
};
