import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, CalendarDays, TrendingUp } from "lucide-react";

interface TimeFilterProps {
  value: 'overall' | 'weekly' | 'monthly';
  onChange: (value: 'overall' | 'weekly' | 'monthly') => void;
}

export const TimeFilter = ({ value, onChange }: TimeFilterProps) => {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as any)} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="overall" className="gap-2">
          <TrendingUp className="w-4 h-4" />
          <span className="hidden sm:inline">All Time</span>
        </TabsTrigger>
        <TabsTrigger value="weekly" className="gap-2">
          <CalendarDays className="w-4 h-4" />
          <span className="hidden sm:inline">This Week</span>
        </TabsTrigger>
        <TabsTrigger value="monthly" className="gap-2">
          <Calendar className="w-4 h-4" />
          <span className="hidden sm:inline">This Month</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
};