import React, { useState } from 'react';
import { useFinance, Transaction } from '../contexts/FinanceContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { format, parseISO, isSameMonth, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Search, Trash2, Edit2, CheckCircle2, Circle, Download, User, Users } from 'lucide-react';
import { toast } from 'sonner';

import Papa from 'papaparse';
import { MonthSelector } from '../components/MonthSelector';
import { Switch } from '../components/ui/switch';
import { v4 as uuidv4 } from 'uuid';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CategoriesModal from '../components/CategoriesModal';

export default function Transactions() {
  const location = useLocation();
  const { userProfile, householdMembers } = useAuth();
  const { transactions, categories, selectedMonth, addTransaction, updateTransaction, deleteTransaction, recurringTransactions, addCategory, creditCards } = useFinance();
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('todos');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'receita' | 'despesa'>('despesa');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'pendente' | 'pago'>('pago');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credito' | 'debito' | 'dinheiro'>('dinheiro');
  const [recurrenceType, setRecurrenceType] = useState<'unica' | 'parcelada' | 'fixa' | 'assinatura'>('unica');
  const [totalInstallments, setTotalInstallments] = useState('1');
  const [billingDay, setBillingDay] = useState(new Date().getDate().toString());
  const [creditCardId, setCreditCardId] = useState('');
  const [totalAmount, setTotalAmount] = useState('');

  const handleAmountChange = (val: string) => {
    setAmount(val);
    if (recurrenceType === 'parcelada') {
      const parsedAmount = parseFloat(val);
      const parsedInstallments = parseInt(totalInstallments);
      if (!isNaN(parsedAmount) && !isNaN(parsedInstallments)) {
        setTotalAmount((parsedAmount * parsedInstallments).toFixed(2));
      }
    }
  };

  const handleTotalAmountChange = (val: string) => {
    setTotalAmount(val);
    const parsedTotal = parseFloat(val);
    const parsedInstallments = parseInt(totalInstallments);
    if (!isNaN(parsedTotal) && !isNaN(parsedInstallments) && parsedInstallments > 0) {
      setAmount((parsedTotal / parsedInstallments).toFixed(2));
    }
  };

  const handleInstallmentsChange = (val: string) => {
    setTotalInstallments(val);
    if (recurrenceType === 'parcelada') {
      const parsedAmount = parseFloat(amount);
      const parsedInstallments = parseInt(val);
      if (!isNaN(parsedAmount) && !isNaN(parsedInstallments)) {
        setTotalAmount((parsedAmount * parsedInstallments).toFixed(2));
      }
    }
  };

  const handleRecurrenceTypeChange = (val: 'unica' | 'parcelada' | 'fixa' | 'assinatura') => {
    setRecurrenceType(val);
    if (val === 'parcelada') {
      const parsedAmount = parseFloat(amount);
      const parsedInstallments = parseInt(totalInstallments || '1');
      if (!isNaN(parsedAmount)) {
        setTotalAmount((parsedAmount * parsedInstallments).toFixed(2));
      }
    }
  };

  const filteredTransactions = transactions
    .filter(t => {
      const matchesMonth = isSameMonth(parseISO(t.billingDate || t.date), selectedMonth);
      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        categories.find(c => c.id === t.categoryId)?.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPayment = paymentMethodFilter === 'todos' || t.paymentMethod === paymentMethodFilter;
      
      // Hide recurring transactions (fixed/subscription) from the main list as requested
      const isRecurring = t.recurrenceType === 'fixa' || t.recurrenceType === 'assinatura';
      
      return matchesMonth && matchesSearch && matchesPayment && !isRecurring;
    })
    .sort((a, b) => {
      // Sort by status (pending first)
      if (a.status === 'pendente' && b.status === 'pago') return -1;
      if (a.status === 'pago' && b.status === 'pendente') return 1;
      // Then by date (descending)
      return new Date(b.billingDate || b.date).getTime() - new Date(a.billingDate || a.date).getTime();
    });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleOpenAdd = () => {
    setEditingTransaction(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setDescription(transaction.description);
    setAmount(transaction.amount.toString());
    setType(transaction.type);
    setCategoryId(transaction.categoryId);
    setDate(parseISO(transaction.date).toISOString().split('T')[0]);
    setStatus(transaction.status);
    setPaymentMethod(transaction.paymentMethod);
    setRecurrenceType(transaction.recurrenceType);
    setTotalInstallments(transaction.totalInstallments?.toString() || '1');
    setCreditCardId(transaction.creditCardId || '');
    if (transaction.recurrenceType === 'parcelada' && transaction.totalInstallments) {
      setTotalAmount((transaction.amount * transaction.totalInstallments).toFixed(2));
    } else {
      setTotalAmount('');
    }
    
    // Find the recurring template if it exists to get the billing day
    const recurringTemplate = transaction.recurringId 
      ? recurringTransactions.find(rt => rt.id === transaction.recurringId)
      : null;
    
    setBillingDay(recurringTemplate?.billingDay?.toString() || parseISO(transaction.date).getDate().toString());
    setIsDialogOpen(true);
  };

  const navigate = useNavigate();

  React.useEffect(() => {
    const state = location.state as { editId?: string };
    if (state?.editId) {
      const transaction = transactions.find(t => t.id === state.editId);
      if (transaction) {
        handleOpenEdit(transaction);
        
        // Remove old state to prevent infinite edit loops on re-renders
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location.state, transactions, navigate]);

  const handleAddCategory = async (e: React.FormEvent) => {
    // This is now handled by CategoriesModal, but we keep a simple version for quick add if needed
    // or just redirect to the modal
    setShowCategoriesModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !categoryId || !date) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) {
      toast.error('O valor deve ser um número válido.');
      return;
    }

    const parsedInstallments = recurrenceType === 'parcelada' ? parseInt(totalInstallments) : undefined;
    if (recurrenceType === 'parcelada' && (isNaN(parsedInstallments!) || parsedInstallments! < 2)) {
      toast.error('O número de parcelas deve ser pelo menos 2.');
      return;
    }

    const parsedBillingDay = (recurrenceType === 'assinatura' || recurrenceType === 'fixa') ? parseInt(billingDay) : undefined;
    if ((recurrenceType === 'assinatura' || recurrenceType === 'fixa') && (isNaN(parsedBillingDay!) || parsedBillingDay! < 1 || parsedBillingDay! > 31)) {
      toast.error('O dia de cobrança deve ser entre 1 e 31.');
      return;
    }

    if (paymentMethod === 'credito' && !creditCardId) {
      toast.error('Selecione o cartão de crédito da transação.');
      return;
    }

    try {
      if (editingTransaction) {
        let updateMode: 'unica' | 'futuras' | 'todos' = 'unica';
        // Simplified update mode for now to avoid blocking confirm() in iframe
        if (editingTransaction.recurringId) {
          updateMode = 'futuras'; // Default to updating future instances
        }

        await updateTransaction(editingTransaction.id, {
          description,
          amount: parsedAmount,
          type,
          categoryId,
          date: new Date(date + 'T12:00:00').toISOString(),
          status: type === 'receita' ? 'pago' : (paymentMethod === 'credito' ? 'pendente' : status),
          paymentMethod,
          recurrenceType,
          totalInstallments: parsedInstallments,
          creditCardId: paymentMethod === 'credito' ? creditCardId : undefined
        }, updateMode);
        toast.success('Transação atualizada!');
      } else {
        await addTransaction({
          description,
          amount: parsedAmount,
          type,
          categoryId,
          date: new Date(date + 'T12:00:00').toISOString(),
          status: type === 'receita' ? 'pago' : (paymentMethod === 'credito' ? 'pendente' : status),
          paymentMethod,
          recurrenceType,
          totalInstallments: parsedInstallments,
          billingDay: parsedBillingDay,
          creditCardId: paymentMethod === 'credito' ? creditCardId : undefined
        });
        toast.success('Transação adicionada!');
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error('Erro ao salvar transação.');
    }
  };

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setType('despesa');
    setCategoryId('');
    setDate(new Date().toISOString().split('T')[0]);
    setStatus('pago');
    setPaymentMethod('dinheiro');
    setRecurrenceType('unica');
    setTotalInstallments('1');
    setBillingDay(new Date().getDate().toString());
    setCreditCardId('');
    setTotalAmount('');
  };



  const toggleStatus = async (transaction: Transaction) => {
    if (transaction.type === 'receita') return;
    try {
      await updateTransaction(transaction.id, {
        status: transaction.status === 'pago' ? 'pendente' : 'pago'
      });
    } catch (error) {
      toast.error('Erro ao atualizar status.');
    }
  };

  const handleDelete = async (transaction: Transaction) => {
    let deleteMode: 'unica' | 'futuras' | 'todos' = 'unica';
    
    if (transaction.recurringId) {
      // Simplified delete mode for now to avoid blocking confirm() in iframe
      deleteMode = 'futuras';
    }

    try {
      await deleteTransaction(transaction.id, deleteMode);
      toast.success('Transação(ões) excluída(s)!');
    } catch (error) {
      toast.error('Erro ao excluir transação.');
    }
  };

  const handleExportCSV = () => {
    const data = filteredTransactions.map(t => {
      const category = categories.find(c => c.id === t.categoryId);
      return {
        Data: format(parseISO(t.date), "dd/MM/yyyy"),
        Descrição: t.description,
        Categoria: category?.name || 'Outros',
        Tipo: t.type === 'receita' ? 'Receita' : 'Despesa',
        Valor: t.amount,
        Status: t.status === 'pago' ? 'Pago' : 'Pendente'
      };
    });

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transacoes_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exportação concluída!');
  };

  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="w-full md:w-auto">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Despesas</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie suas receitas e despesas.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <MonthSelector />
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-2 flex-1 sm:flex-none">
              <Button 
                variant="outline" 
                size="icon" 
                title="Gerenciar Categorias" 
                className="h-10 w-10 sm:h-9 sm:w-9 shrink-0"
                onClick={() => setShowCategoriesModal(true)}
              >
                <Plus className="w-4 h-4" />
              </Button>
              
              <CategoriesModal open={showCategoriesModal} onOpenChange={setShowCategoriesModal} />

              <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                <SelectTrigger className="flex-1 sm:w-[140px] h-10 sm:h-9">
                  <SelectValue placeholder="Método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Métodos</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="debito">Débito</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={handleExportCSV} className="gap-2 h-10 sm:h-9 flex-1 sm:flex-none justify-center">
              <Download className="w-4 h-4" /> <span className="hidden sm:inline">Exportar</span>
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger>
                <Button className="gap-2 h-10 sm:h-9 flex-1 sm:flex-none justify-center" onClick={handleOpenAdd}>
                  <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nova Transação</span><span className="sm:hidden">Nova</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] w-full h-[95dvh] sm:h-auto sm:max-h-[90vh] rounded-t-[2.5rem] sm:rounded-2xl border-none">
                <DialogHeader className="p-6 pb-4 border-b shrink-0 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-xl">
                  <DialogTitle className="text-2xl font-black tracking-tight">{editingTransaction ? 'Editar Transação' : 'Nova Transação'}</DialogTitle>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                  <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 pb-32">
                    {/* Bloco 1: Tipo e Valor */}
                    <div className="space-y-6">
                      <div className="flex justify-center mb-2">
                        <div className="grid grid-cols-2 w-full max-w-[280px] p-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-2xl">
                          <button
                            type="button"
                            onClick={() => setType('despesa')}
                            className={`py-2 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${type === 'despesa' ? 'bg-white dark:bg-neutral-700 shadow-md text-red-600' : 'text-muted-foreground'}`}
                          >
                            Despesa
                          </button>
                          <button
                            type="button"
                            onClick={() => setType('receita')}
                            className={`py-2 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${type === 'receita' ? 'bg-white dark:bg-neutral-700 shadow-md text-emerald-600' : 'text-muted-foreground'}`}
                          >
                            Receita
                          </button>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/70 ml-1">
                            {recurrenceType === 'parcelada' ? 'Valor da Parcela' : 'Valor'}
                          </Label>
                          <div className="relative group">
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-black text-muted-foreground/40 group-focus-within:text-primary transition-colors">R$</span>
                            <Input 
                              type="number" 
                              step="0.01" 
                              inputMode="decimal"
                              value={amount} 
                              onChange={e => handleAmountChange(e.target.value)} 
                              placeholder="0,00" 
                              className="pl-16 h-20 text-4xl font-black rounded-3xl border-none bg-neutral-50 dark:bg-neutral-800/50 focus-visible:ring-primary shadow-inner"
                              autoFocus={!editingTransaction}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/70 ml-1">Descrição</Label>
                          <Input 
                            value={description} 
                            onChange={e => setDescription(e.target.value)} 
                            placeholder="O que você comprou?" 
                            className="h-14 px-6 rounded-2xl border-none bg-neutral-50 dark:bg-neutral-800/50 shadow-inner font-bold text-lg"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bloco 2: Detalhes Técnicos */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/70 ml-1">Método</Label>
                        <Select value={paymentMethod} onValueChange={(v: 'pix' | 'credito' | 'debito' | 'dinheiro') => setPaymentMethod(v)}>
                          <SelectTrigger className="h-14 px-6 rounded-2xl border-none bg-neutral-50 dark:bg-neutral-800/50 shadow-inner font-bold text-lg">
                            <SelectValue placeholder="Como pagou?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pix">PIX</SelectItem>
                            <SelectItem value="credito">Cartão de Crédito</SelectItem>
                            <SelectItem value="debito">Cartão de Débito</SelectItem>
                            <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/70 ml-1">Frequência</Label>
                        <Select value={recurrenceType} onValueChange={handleRecurrenceTypeChange}>
                          <SelectTrigger className="h-14 px-6 rounded-2xl border-none bg-neutral-50 dark:bg-neutral-800/50 shadow-inner font-bold text-lg">
                            <SelectValue placeholder="É recorrente?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unica">Única</SelectItem>
                            <SelectItem value="parcelada">Parcelada</SelectItem>
                            <SelectItem value="fixa">Mensal Fixa</SelectItem>
                            <SelectItem value="assinatura">Assinatura</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {paymentMethod === 'credito' && (
                      <div className="space-y-2 animate-in slide-in-from-top-4 duration-300">
                        <Label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/70 ml-1">Selecione o Cartão</Label>
                        <Select value={creditCardId} onValueChange={setCreditCardId}>
                          <SelectTrigger className={`h-14 px-6 rounded-2xl border-none bg-neutral-50 dark:bg-neutral-800/50 shadow-inner font-bold text-lg ${!creditCardId ? 'ring-2 ring-red-500/20 bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                            <SelectValue placeholder="Escolha um cartão" />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl">
                            {creditCards.length > 0 ? creditCards.map(cc => (
                              <SelectItem key={cc.id} value={cc.id} className="h-12 rounded-xl">{cc.name}</SelectItem>
                            )) : (
                              <SelectItem value="none" disabled>Nenhum cartão cadastrado</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Bloco 3: Configurações de Data */}
                    <div className="bg-neutral-100/50 dark:bg-neutral-800/30 p-6 rounded-[2rem] space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/70 ml-1">
                          {recurrenceType === 'assinatura' || recurrenceType === 'fixa' ? 'Inicia em' : 'Data do gasto'}
                        </Label>
                        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-14 px-6 rounded-2xl border-none bg-white dark:bg-neutral-800 font-bold text-lg" />
                      </div>

                      {recurrenceType === 'parcelada' && (
                        <div className="space-y-4 animate-in zoom-in-95 duration-300">
                          <div className="space-y-2">
                             <Label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/70 ml-1">Total de Parcelas</Label>
                             <div className="flex items-center gap-4">
                               <Input type="number" min="2" max="120" value={totalInstallments} onChange={e => handleInstallmentsChange(e.target.value)} className="h-14 text-center font-black text-2xl w-24 rounded-2xl border-none bg-white dark:bg-neutral-800" />
                               <span className="text-sm font-bold text-muted-foreground">{totalInstallments}x de {formatCurrency(parseFloat(amount) || 0)}</span>
                             </div>
                          </div>
                          <div className="space-y-2">
                             <Label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/70 ml-1">Valor Total da Compra</Label>
                             <div className="relative">
                               <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground/40 font-black">R$</span>
                               <Input type="number" step="0.01" inputMode="decimal" value={totalAmount} onChange={e => handleTotalAmountChange(e.target.value)} className="pl-14 h-14 rounded-2xl border-none bg-white/50 dark:bg-neutral-800/50 font-black text-xl" />
                             </div>
                          </div>
                        </div>
                      )}

                      {(recurrenceType === 'assinatura' || recurrenceType === 'fixa') && (
                        <div className="space-y-2 animate-in zoom-in-95 duration-300">
                          <Label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/70 ml-1">Dia da Cobrança</Label>
                          <div className="flex items-center gap-6">
                            <Input type="number" min="1" max="31" value={billingDay} onChange={e => setBillingDay(e.target.value)} className="h-14 text-center font-black text-2xl w-24 rounded-2xl border-none bg-white dark:bg-neutral-800" />
                            <span className="text-sm font-bold text-muted-foreground">Todo dia {billingDay} do mês</span>
                          </div>
                        </div>
                      )}

                      {type === 'despesa' && (recurrenceType === 'unica' || recurrenceType === 'parcelada') && paymentMethod !== 'credito' && (
                        <div className="flex items-center justify-between py-2">
                          <Label className="text-sm font-black text-muted-foreground flex items-center gap-2">
                            <CheckCircle2 className={`w-5 h-5 ${status === 'pago' ? 'text-emerald-500' : 'text-neutral-300'}`} />
                            Marcar como Pago
                          </Label>
                          <Switch checked={status === 'pago'} onCheckedChange={(checked) => setStatus(checked ? 'pago' : 'pendente')} className="scale-110" />
                        </div>
                      )}
                    </div>

                    {/* Bloco 4: Categorização */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center ml-1">
                        <Label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/70">Categoria</Label>
                        <button type="button" onClick={() => setShowCategoriesModal(true)} className="text-[10px] uppercase font-black text-primary hover:tracking-widest transition-all">+ Nova</button>
                      </div>
                      <Select value={categoryId} onValueChange={setCategoryId}>
                        <SelectTrigger className="h-16 px-6 rounded-[2rem] border-none bg-neutral-100 dark:bg-neutral-800 font-bold text-lg">
                          <SelectValue placeholder="Onde se encaixa?">
                            {categoryId ? (
                              <div className="flex items-center gap-4">
                                <div className="w-4 h-4 rounded-full shadow-lg" style={{ backgroundColor: categories.find(c => c.id === categoryId)?.color }} />
                                <span className="font-black text-foreground">{categories.find(c => c.id === categoryId)?.name}</span>
                              </div>
                            ) : "Onde se encaixa?"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          {categories
                            .filter(c => c.type === 'ambos' || c.type === type)
                            .map(c => (
                            <SelectItem key={c.id} value={c.id} className="h-12 rounded-xl">
                              <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                                <span className="font-bold">{c.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Footer Sticky na Thumb Zone */}
                  <div className="shrink-0 p-6 pb-[env(safe-area-inset-bottom,24px)] bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-t z-[60]">
                    <Button type="submit" className="w-full h-16 text-xl font-black rounded-2xl shadow-2xl shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98]">
                      {editingTransaction ? 'Salvar Alterações' : 'Confirmar Transação'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
        </div>
      </div>
    </div>



        <Card className="mt-6">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar transações..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="max-w-sm border-0 focus-visible:ring-0 px-0 h-8"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="rounded-md border-x sm:border">
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cobrança</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => {
                  const category = categories.find(c => c.id === transaction.categoryId);
                  const creator = householdMembers.find(m => m.uid === transaction.createdBy);
                  const showBillingDate = transaction.billingDate && 
                    !isSameMonth(parseISO(transaction.date), parseISO(transaction.billingDate));

                  return (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <button 
                          onClick={() => toggleStatus(transaction)}
                          className={`text-muted-foreground hover:text-primary transition-colors ${transaction.type === 'receita' ? 'cursor-default opacity-50' : ''}`}
                        >
                          {transaction.status === 'pago' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <Circle className="w-5 h-5" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span>{transaction.description}</span>
                            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700">
                              {creator?.photoURL ? (
                                <img src={creator.photoURL} alt="" className="w-3 h-3 rounded-full" referrerPolicy="no-referrer" />
                              ) : (
                                <User className="w-3 h-3 text-muted-foreground" />
                              )}
                              <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight">
                                {creator?.uid === userProfile?.uid ? 'Você' : creator?.displayName.split(' ')[0] || 'Usuário'}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-1">
                            {transaction.recurrenceType === 'parcelada' && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                Parcela {transaction.installmentNumber}/{transaction.totalInstallments}
                              </span>
                            )}
                            {transaction.recurrenceType === 'fixa' && (
                              <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                Despesa Fixa
                              </span>
                            )}
                            {transaction.recurrenceType === 'assinatura' && (
                              <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                Assinatura
                              </span>
                            )}
                            <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                              {transaction.paymentMethod?.toUpperCase() || 'DINHEIRO'}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category?.color || '#cbd5e1' }} />
                          <span className="text-sm text-muted-foreground">{category?.name || 'Categoria desconhecida'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(parseISO(transaction.date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex flex-col">
                          <span className={showBillingDate ? "text-primary font-medium" : ""}>
                            {format(parseISO(transaction.billingDate || transaction.date), "dd/MM/yyyy")}
                          </span>
                          {showBillingDate && (
                            <span className="text-[10px] text-primary uppercase font-bold tracking-tighter">Próxima Fatura</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${transaction.type === 'receita' ? 'text-emerald-500' : ''}`}>
                        {transaction.type === 'receita' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => handleOpenEdit(transaction)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(transaction)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredTransactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Nenhuma transação encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </CardContent>
      </Card>
    </div>
  );
}
