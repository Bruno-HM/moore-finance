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

export default function RecurringTransactions() {
  const { userProfile, householdMembers } = useAuth();
  const navigate = useNavigate();
  const { 
    recurringTransactions, transactions, selectedMonth, categories, bankAccounts,
    updateRecurringTransaction, deleteRecurringTransaction, 
    recalculateRecurring, updateTransaction, restoreRecurringInstance 
  } = useFinance();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRT, setEditingRT] = useState<RecurringTransaction | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credito' | 'debito' | 'dinheiro'>('dinheiro');
  const [billingDay, setBillingDay] = useState('');
  const [updateMode, setUpdateMode] = useState<'este_mes' | 'futuras'>('futuras');

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
    setEditingRT(rt);
    setTitle(rt.title || rt.description);
    setDescription(rt.description || '');
    setAmount(rt.amount.toString());
    setCategoryId(rt.categoryId);
    setPaymentMethod(rt.paymentMethod);
    setBillingDay(rt.billingDay?.toString() || '');
    setUpdateMode('futuras');
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRT) return;
    try {
      await updateRecurringTransaction(editingRT.id, {
        title, description, amount: parseFloat(amount),
        categoryId, paymentMethod,
        billingDay: billingDay ? parseInt(billingDay) : undefined
      }, updateMode);
      toast.success('Atualizado!');
      setIsDialogOpen(false);
    } catch (error) {
      toast.error('Erro ao atualizar.');
    }
  };

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
          const instance = transactions.find(t => 
            t.recurringId === rt.id && 
            isSameMonth(parseISO(t.billingDate || t.date), selectedMonth)
          );
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

      {/* Simplified Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[450px] bg-black/90 backdrop-blur-3xl border-white/5 p-0 overflow-hidden rounded-[2.5rem] shadow-2xl">
          <DialogHeader className="p-8 pb-4 border-b border-white/5">
            <DialogTitle className="text-2xl font-black text-white tracking-tighter">Ajustar Assinatura</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            <div className="space-y-4">
               <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1">Título</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} className="h-14 px-6 rounded-2xl bg-white/5 border-none font-bold text-lg" />
               </div>
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                     <Label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1">Valor</Label>
                     <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="h-14 px-6 rounded-2xl bg-white/5 border-none font-black text-xl" />
                  </div>
                  <div className="space-y-3">
                     <Label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1">Vencimento</Label>
                     <Input type="number" min="1" max="31" value={billingDay} onChange={e => setBillingDay(e.target.value)} className="h-14 px-6 rounded-2xl bg-white/5 border-none font-black text-xl text-center" />
                  </div>
               </div>
               <div className="space-y-3 pt-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1">Abrangência da Mudança</Label>
                  <Select value={updateMode} onValueChange={(v: any) => setUpdateMode(v)}>
                    <SelectTrigger className="h-14 px-6 rounded-2xl bg-white/5 border-none font-bold text-xs uppercase tracking-widest text-white/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-white/10">
                      <SelectItem value="este_mes">Somente este mês</SelectItem>
                      <SelectItem value="futuras">Este mês e futuros</SelectItem>
                    </SelectContent>
                  </Select>
               </div>
            </div>
            <Button type="submit" className="w-full h-16 bg-white text-black font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-2xl hover:scale-[1.02] active:scale-95 transition-all">
              Confirmar Ajustes
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* FAB - Criar Novo */}
      <div className="fixed bottom-8 right-8 z-50">
        <Button 
          onClick={() => navigate('/transactions', { state: { openNewRecurring: true } })}
          className="w-14 h-14 rounded-2xl bg-primary text-black shadow-2xl shadow-primary/30 hover:scale-110 active:scale-90 transition-all flex items-center justify-center p-0"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
