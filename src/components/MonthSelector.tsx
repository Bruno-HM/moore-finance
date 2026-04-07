import { useFinance } from '../contexts/FinanceContext';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function MonthSelector() {
  const { selectedMonth, setSelectedMonth } = useFinance();

  const handlePrevMonth = () => setSelectedMonth(subMonths(selectedMonth, 1));
  const handleNextMonth = () => setSelectedMonth(addMonths(selectedMonth, 1));

  return (
    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
      <Button variant="outline" size="icon" onClick={handlePrevMonth}>
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <div className="w-32 text-center font-medium capitalize">
        {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
      </div>
      <Button variant="outline" size="icon" onClick={handleNextMonth}>
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
