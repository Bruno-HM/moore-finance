import React, { useState } from 'react';
import { useFinance, RecurringTransaction } from '../contexts/FinanceContext';
import { isSameMonth, parseISO, format } from 'date-fns';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Trash2, Edit2, Calendar, CreditCard, Plus, RefreshCw, User, ArrowLeftRight, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import TransactionModal from '../components/TransactionModal';

export default function RecurringTransactions() {
  const { userProfile, householdMembers } = useAuth();
  const navigate = useNavigate();
  const { 
    recurringTransactions, transactions, selectedMonth, categories, bankAccounts,
    updateRecurringTransaction, deleteRecurringTransaction, 
    recalculateRecurring, updateTransaction, restoreRecurringInstance 
  } = useFinance();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      await recalculateRecurring();
      toast.success('Sincronizado!');
    } catch (error) {
      toast.error('Erro ao sincronizar.');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleOpenEdit = (rt: RecurringTransaction) => {
    // Find one instance to serve as the template for editing in TransactionModal
    const instance = transactions.find(t => t.recurringId === rt.id);
    if (instance) {
      setEditingTransaction(instance);
      setIsModalOpen(true);
    } else {
      toast.error('Não foi possível carregar a instância para edição.');
    }
  };

  // handleSubmit is now handled inside TransactionModal

  const handleDelete = async (id: string) => {
    if (confirm('Remover esta assinatura?')) {
      try {
        await deleteRecurringTransaction(id);
        toast.success('Removido.');
      } catch (error) {
        toast.error('Erro ao remover.');
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white mb-1">Assinaturas e Fixos</h2>
          <p className="text-white/40 text-sm font-medium">Gestão de gastos recorrentes automáticos.</p>
        </div>
        <Button 
          variant="ghost" 
          onClick={handleRecalculate} 
          disabled={isRecalculating}
          className="h-10 px-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
          <span className="text-[10px] font-black uppercase tracking-widest">Sincronizar</span>
        </Button>
      </div>

      {/* Grid of Recurring Items */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {recurringTransactions.map(rt => {
          const category = categories.find(c => c.id === rt.categoryId);
          const creator = householdMembers.find(m => m.uid === rt.createdBy);
          const monthInstances = transactions.filter(t => 
            t.recurringId === rt.id && 
            isSameMonth(parseISO(t.date), selectedMonth)
          );
          const instance = monthInstances.find(t => t.status === 'pago') || monthInstances[0];
          const isPaid = instance?.status === 'pago';

          return (
            <div key={rt.id} className="pluggy-card group flex flex-col p-6 min-h-[220px]">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-white/30 group-hover:border-primary/20 transition-colors">
                     {rt.recurrenceType === 'assinatura' ? <RefreshCw className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-primary transition-colors">{rt.title || rt.description}</h3>
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/20">{category?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => handleOpenEdit(rt)} className="p-1 text-white/20 hover:text-white transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                   </button>
                   <button onClick={() => handleDelete(rt.id)} className="p-1 text-white/20 hover:text-rose-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                   </button>
                </div>
              </div>

              <div className="flex-1">
                 <p className="text-3xl font-black text-white mb-2 tracking-tighter">{formatCurrency(rt.amount)}</p>
                 <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-widest text-white/30">
                    <div className="flex items-center gap-1">
                       <CreditCard className="w-3 h-3" />
                       {rt.paymentMethod}
                    </div>
                    {rt.billingDay && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Dia {rt.billingDay}
                      </div>
                    )}
                 </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                 <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 block mb-1">Mês Selecionado</span>
                    {instance ? (
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isPaid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-500'}`}>
                        {isPaid ? 'Pago' : 'Pendente'}
                      </span>
                    ) : (
                      <span className="text-[9px] font-black uppercase text-white/10 italic">Instância Removida</span>
                    )}
                 </div>
                 {instance && !isPaid && (
                   <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 text-[9px] font-black uppercase px-4 bg-white/5 text-white/60 hover:bg-primary hover:text-black rounded-lg transition-all"
                    onClick={async () => {
                      const accountId = instance.bankAccountId || rt.bankAccountId || bankAccounts[0]?.id;
                      await updateTransaction(instance.id, { 
                        status: 'pago',
                        bankAccountId: accountId
                      });
                      toast.success('Pagamento registrado! Saldo atualizado.');
                    }}
                   >
                     Pagar Agora
                   </Button>
                 )}
                 {instance && isPaid && (
                   <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 text-[9px] font-black uppercase px-4 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-all"
                    onClick={async () => {
                      const accountId = instance.bankAccountId || rt.bankAccountId || bankAccounts[0]?.id;
                      await updateTransaction(instance.id, { 
                        status: 'pendente',
                        bankAccountId: accountId
                      });
                      toast.info('Pagamento desfeito. Saldo restaurado.');
                    }}
                   >
                     Desfazer
                   </Button>
                 )}
                 {!instance && (
                   <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 text-[9px] font-black uppercase px-4 bg-white/5 text-white/30 hover:bg-white/10 rounded-lg transition-all"
                    onClick={() => restoreRecurringInstance(rt.id, format(selectedMonth, 'yyyy-MM'))}
                   >
                     Restaurar
                   </Button>
                 )}
              </div>
            </div>
          );
        })}
      </div>

      <TransactionModal 
        isOpen={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) setEditingTransaction(null);
        }}
        editingTransaction={editingTransaction}
        mode="recurring"
      />

      {/* FAB - Criar Novo */}
      <div className="fixed bottom-8 right-8 z-50">
        <Button 
          onClick={() => setIsModalOpen(true)}
          className="w-14 h-14 rounded-2xl bg-primary text-black shadow-2xl shadow-primary/30 hover:scale-110 active:scale-90 transition-all flex items-center justify-center p-0"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
