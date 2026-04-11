import React, { useState, useMemo } from 'react';
import { useFinance, Transaction } from '../contexts/FinanceContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { format, parseISO, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Plus, Search, Trash2, Edit2, CheckCircle2, LayoutGrid, Tag, User, Users, Landmark, Filter, CreditCard, Settings, ChevronRight, FileUp } from 'lucide-react';
import { MonthSelector } from '../components/MonthSelector';
import { Switch } from '../components/ui/switch';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Label } from '../components/ui/label';
import CategoriesModal from '../components/CategoriesModal';
import ImportModal from '../components/ImportModal';
import TransactionModal from '../components/TransactionModal';
import { motion, AnimatePresence } from 'motion/react';

export default function Transactions() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile, householdMembers } = useAuth();
  const { 
    transactions, categories, selectedMonth, addTransaction, 
    updateTransaction, deleteTransaction, 
    creditCards, bankAccounts 
  } = useFinance();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [categoryFilter, setCategoryFilter] = useState('todos');
  const [groupBy, setGroupBy] = useState<'none' | 'category' | 'member'>('none');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Handle navigation from Fixos page
  React.useEffect(() => {
    if (location.state?.openNewRecurring) {
      setEditingTransaction(null);
      setIsDialogOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  // 1. Filtering & Grouping Logic
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        const matchesMonth = isSameMonth(parseISO(t.billingDate || t.date), selectedMonth);
        const matchesSearch = (t.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                               t.description?.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'todos' || t.status === statusFilter;
        const matchesCategory = categoryFilter === 'todos' || t.categoryId === categoryFilter;
        
        // Hide recurring instances from the main flow list to keep it for avulsas/parcelas
        const isRecurrent = !!t.recurringId || t.recurrenceType === 'fixa' || t.recurrenceType === 'assinatura';
        
        return matchesMonth && matchesSearch && matchesStatus && matchesCategory && !isRecurrent;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, selectedMonth, searchTerm, statusFilter, categoryFilter]);

  const groupedTransactions = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      let key = 'Geral';
      if (groupBy === 'category') key = categories.find(c => c.id === t.categoryId)?.name || 'Outros';
      else if (groupBy === 'member') key = householdMembers.find(m => m.uid === (t.paidBy || t.createdBy))?.displayName || 'Outros';
      else key = format(parseISO(t.date), "dd 'de' MMMM", { locale: ptBR }).toUpperCase();

      if (!acc[key]) acc[key] = { items: [], total: 0 };
      acc[key].items.push(t);
      acc[key].total += t.type === 'receita' ? t.amount : -t.amount;
      return acc;
    }, {} as Record<string, { items: Transaction[]; total: number }>);
  }, [filteredTransactions, groupBy, categories, householdMembers]);

  // 2. Handlers
  const handleOpenAdd = () => {
    setEditingTransaction(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsDialogOpen(true);
  };

  const handleDelete = async (t: Transaction) => {
    if (confirm('Excluir transação?')) {
      await deleteTransaction(t.id);
      toast.success('Excluída.');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white mb-1">Movimentações</h2>
          <p className="text-white/40 text-sm font-medium">Controle detalhado do seu fluxo de caixa.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <MonthSelector />
        </div>
      </div>

      {/* Modern Filter & Grouping Bar */}
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 group w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-primary transition-colors" />
          <Input 
             placeholder="Buscar transação..." 
             value={searchTerm}
             onChange={e => setSearchTerm(e.target.value)}
             className="h-11 pl-11 bg-white/5 border-white/5 rounded-xl text-sm font-medium focus-visible:ring-primary/20 hover:bg-white/[0.08] transition-all"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto pb-1 md:pb-0">
          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 min-w-[120px] bg-white/5 border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/50 hover:bg-white/[0.08] transition-all">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-black/90 backdrop-blur-2xl border-white/10 rounded-xl">
              <SelectItem value="todos">Todos Status</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
            </SelectContent>
          </Select>

          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-11 min-w-[140px] bg-white/5 border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/50 hover:bg-white/[0.08] transition-all">
               <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent className="bg-black/90 backdrop-blur-2xl border-white/10 rounded-xl">
              <SelectItem value="todos">Categorias</SelectItem>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Grouping Selection (Essential per User) */}
          <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
            <SelectTrigger className="h-11 min-w-[130px] bg-primary/10 border-primary/20 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-3.5 h-3.5" />
                <SelectValue placeholder="Agrupar" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-black/90 backdrop-blur-2xl border-white/10 rounded-xl">
              <SelectItem value="none">Por Data</SelectItem>
              <SelectItem value="category">Por Categoria</SelectItem>
              <SelectItem value="member">Por Membro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* High-Density Transaction List */}
      <div className="space-y-12">
        {Object.entries(groupedTransactions).map(([groupName, { items, total }]) => (
          <div key={groupName} className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">{groupName}</span>
              <span className={`text-[10px] font-black uppercase tracking-widest ${total >= 0 ? 'text-emerald-500/50' : 'text-rose-500/50'}`}>
                {formatCurrency(Math.abs(total))}
              </span>
            </div>
            
            <div className="pluggy-card divide-y divide-white/5 overflow-hidden">
              {items.map((t) => {
                const cat = categories.find(c => c.id === t.categoryId);
                const creator = householdMembers.find(m => m.uid === (t.paidBy || t.createdBy));
                return (
                  <div 
                    key={t.id}
                    className="flex items-center justify-between p-4 hover:bg-white/[0.03] active:bg-white/[0.05] transition-all cursor-pointer group"
                    onClick={() => handleOpenEdit(t)}
                  >
                    <div className="flex items-center gap-5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0 group-hover:border-primary/20 transition-colors">
                        {t.type === 'receita' ? <Plus className="w-4 h-4 text-emerald-400" /> : <Tag className="w-4 h-4 text-white/30" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                           <p className="text-sm font-bold text-white group-hover:text-primary transition-colors truncate">{t.title || t.description}</p>
                           {t.bankTransactionId && <Landmark className="w-3 h-3 text-white/20" />}
                        </div>
                        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-white/20">
                          <span>{cat?.name}</span>
                          <span>•</span>
                          <span>{creator?.displayName?.split(' ')[0] || 'Desconhecido'}</span>
                          {t.status === 'pendente' && (
                            <span className="text-amber-500/80 ml-1">Pendente</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0 ml-4">
                      <p className={`text-sm font-black tracking-tight ${t.type === 'receita' ? 'text-emerald-400' : 'text-white'}`}>
                        {t.type === 'receita' ? '+' : '-'}{formatCurrency(t.amount)}
                      </p>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                           onClick={(e) => { e.stopPropagation(); handleOpenEdit(t); }} 
                           className="text-white/20 hover:text-white transition-colors"
                         >
                           <Edit2 className="w-3.5 h-3.5" />
                         </button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); handleDelete(t); }} 
                           className="text-white/20 hover:text-rose-500 transition-colors"
                         >
                           <Trash2 className="w-3.5 h-3.5" />
                         </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {filteredTransactions.length === 0 && (
          <div className="py-24 text-center flex flex-col items-center gap-4">
             <Search className="w-10 h-10 text-white/5" />
             <p className="text-xs font-bold text-white/20 uppercase tracking-[0.2em]">Nenhum lançamento encontrado</p>
          </div>
        )}
      </div>

      {/* Transaction Modal & Utilities */}
      <TransactionModal 
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingTransaction={editingTransaction}
      />
      
      <CategoriesModal open={showCategoriesModal} onOpenChange={setShowCategoriesModal} />

      {/* Floating Action Buttons (Fixed to Screen) */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-4 items-end z-50">
        {/* New Import FAB */}
        <ImportModal trigger={
          <Button 
            className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-xl border border-white/10 shadow-2xl transition-all flex items-center gap-2 group"
          >
            <FileUp className="w-4 h-4 text-primary active:scale-95 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Importar Extrato</span>
          </Button>
        } />

        {/* New Transaction FAB */}
        <Button 
          onClick={handleOpenAdd}
          className="w-14 h-14 rounded-2xl bg-primary text-black shadow-2xl shadow-primary/30 hover:scale-110 active:scale-90 transition-all flex items-center justify-center p-0"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}

