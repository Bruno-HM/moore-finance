import React, { useState } from 'react';
import { Transaction } from '../contexts/FinanceContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tag, Edit2, ChevronRight } from 'lucide-react';
import TransactionModal from './TransactionModal';

interface CategoryDetailModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  categoryName: string;
  categoryColor: string;
  transactions: Transaction[];
}

export default function CategoryDetailModal({
  isOpen,
  onOpenChange,
  categoryName,
  categoryColor,
  transactions
}: CategoryDetailModalProps) {
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleEdit = (t: Transaction) => {
    setEditingTransaction(t);
    setIsTransactionModalOpen(true);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] bg-black/90 backdrop-blur-2xl border-white/5 p-0 overflow-hidden rounded-[2.5rem] shadow-2xl">
          <DialogHeader className="p-8 pb-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div 
                className="w-3 h-3 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.2)]" 
                style={{ backgroundColor: categoryColor }} 
              />
              <DialogTitle className="text-2xl font-black text-white tracking-tighter">
                {categoryName}
              </DialogTitle>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mt-1">
              {transactions.length} Lançamentos no período
            </p>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto no-scrollbar p-6 space-y-3">
            {transactions.map(t => (
              <div 
                key={t.id}
                onClick={() => handleEdit(t)}
                className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/[0.08] transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    <Tag className="w-3.5 h-3.5 text-white/40 group-hover:text-white transition-colors" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white/80 group-hover:text-white transition-colors truncate">
                      {t.title || t.description}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/20">
                      {format(parseISO(t.date), 'dd/MM')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                   <p className="text-sm font-black text-white">
                     {formatCurrency(t.amount)}
                   </p>
                   <ChevronRight className="w-3.5 h-3.5 text-white/10 group-hover:text-white/40 transition-all" />
                </div>
              </div>
            ))}

            {transactions.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/10 italic">Nenhum lançamento nesta categoria.</p>
              </div>
            )}
          </div>
          
          <div className="p-6 border-t border-white/5 bg-white/[0.01]">
             <p className="text-[10px] text-center text-white/20 font-medium">Toque em um item para editar ou excluir.</p>
          </div>
        </DialogContent>
      </Dialog>

      <TransactionModal 
        isOpen={isTransactionModalOpen}
        onOpenChange={setIsTransactionModalOpen}
        editingTransaction={editingTransaction}
      />
    </>
  );
}

