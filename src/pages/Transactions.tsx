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
              <DialogContent className="sm:max-w-[500px] h-[92vh] sm:h-auto max-h-[92vh] p-0 border-none bg-white dark:bg-neutral-900 overflow-hidden flex flex-col shadow-2xl rounded-t-2xl sm:rounded-2xl">
                <DialogHeader className="p-4 sm:p-6 pb-2 sm:pb-2 border-b shrink-0 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md sticky top-0 z-10">
                  <DialogTitle className="text-xl font-bold">{editingTransaction ? 'Editar Transação' : 'Nova Transação'}</DialogTitle>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 pb-24 sm:pb-6">
                    {/* Bloco 1: Tipo e Valor */}
                    <div className="space-y-4 bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-xl border border-neutral-100 dark:border-neutral-800">
                      <div className="flex justify-center">
                        <div className="grid grid-cols-2 w-full max-w-[240px] p-1 bg-neutral-200/50 dark:bg-neutral-800 rounded-lg">
                          <button
                            type="button"
                            onClick={() => setType('despesa')}
                            className={`py-1.5 px-4 rounded-md text-sm font-bold transition-all ${type === 'despesa' ? 'bg-white dark:bg-neutral-700 shadow-sm text-red-600' : 'text-muted-foreground hover:text-foreground'}`}
                          >
                            Despesa
                          </button>
                          <button
                            type="button"
                            onClick={() => setType('receita')}
                            className={`py-1.5 px-4 rounded-md text-sm font-bold transition-all ${type === 'receita' ? 'bg-white dark:bg-neutral-700 shadow-sm text-emerald-600' : 'text-muted-foreground hover:text-foreground'}`}
                          >
                            Receita
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">
                            {recurrenceType === 'parcelada' ? 'Valor da Parcela' : 'Valor'}
                          </Label>
                          <div className="relative group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground group-focus-within:text-primary transition-colors">R$</span>
                            <Input 
                              type="number" 
                              step="0.01" 
                              inputMode="decimal"
                              value={amount} 
                              onChange={e => handleAmountChange(e.target.value)} 
                              placeholder="0,00" 
                              className="pl-14 h-16 text-3xl font-black rounded-xl border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus-visible:ring-primary/20 shadow-sm"
                              autoFocus={!editingTransaction}
                            />
                          </div>
                        </div>

                        {recurrenceType === 'parcelada' && (
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Valor Total</Label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">R$</span>
                              <Input 
                                type="number" 
                                step="0.01" 
                                inputMode="decimal"
                                value={totalAmount} 
                                onChange={e => handleTotalAmountChange(e.target.value)} 
                                placeholder="0,00" 
                                className="pl-12 h-12 text-xl font-bold rounded-xl border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 shadow-inner"
                              />
                            </div>
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Descrição</Label>
                          <Input 
                            value={description} 
                            onChange={e => setDescription(e.target.value)} 
                            placeholder="Ex: Supermercado, Aluguel, Salário..." 
                            className="h-12 rounded-xl border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus-visible:ring-primary/20"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bloco 2: Método e Lançamento */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Método de Pagamento</Label>
                        <Select value={paymentMethod} onValueChange={(v: 'pix' | 'credito' | 'debito' | 'dinheiro') => setPaymentMethod(v)}>
                          <SelectTrigger className="h-12 rounded-xl border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:ring-primary/20">
                            <SelectValue placeholder="Selecione o método" />
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
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Tipo de Lançamento</Label>
                        <Select value={recurrenceType} onValueChange={handleRecurrenceTypeChange}>
                          <SelectTrigger className="h-12 rounded-xl border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:ring-primary/20">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unica">Única</SelectItem>
                            <SelectItem value="parcelada">Parcelada</SelectItem>
                            <SelectItem value="fixa">Fixa (Mensal)</SelectItem>
                            <SelectItem value="assinatura">Assinatura</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {paymentMethod === 'credito' && (
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Qual Cartão?</Label>
                        <Select value={creditCardId} onValueChange={setCreditCardId}>
                          <SelectTrigger className={`h-12 rounded-xl border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:ring-primary/20 ${!creditCardId ? 'border-red-500' : ''}`}>
                            <SelectValue placeholder="Selecione um cartão" />
                          </SelectTrigger>
                          <SelectContent>
                            {creditCards.length > 0 ? creditCards.map(cc => (
                              <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
                            )) : (
                              <SelectItem value="none" disabled>Nenhum cartão cadastrado</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        {!creditCards.length && (
                          <p className="text-[10px] text-red-500 ml-1 font-bold">Cadastre um cartão nas configurações antes de adicionar despesas de crédito.</p>
                        )}
                      </div>
                    )}

                    {/* Bloco 3: Data e Contexto */}
                    <div className="space-y-4 bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-xl border border-neutral-100 dark:border-neutral-800">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">
                          {recurrenceType === 'assinatura' || recurrenceType === 'fixa' ? 'Data de Início' : (paymentMethod === 'credito' ? 'Data da Compra' : 'Data da Transação')}
                        </Label>
                        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-12 rounded-xl border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900" />
                      </div>

                      {(recurrenceType === 'assinatura' || recurrenceType === 'fixa') && (
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Dia de Cobrança Mensal</Label>
                          <div className="flex items-center gap-4">
                            <Input 
                              type="number" 
                              min="1" 
                              max="31" 
                              value={billingDay} 
                              onChange={e => setBillingDay(e.target.value)} 
                              className="h-12 text-center font-bold text-xl w-24 rounded-xl border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                            />
                            <span className="text-sm font-medium text-muted-foreground">Todo dia {billingDay} de cada mês</span>
                          </div>
                        </div>
                      )}

                      {recurrenceType === 'parcelada' && (
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Número de Parcelas</Label>
                          <div className="flex items-center gap-4">
                            <Input 
                              type="number" 
                              min="2" 
                              max="120" 
                              value={totalInstallments} 
                              onChange={e => handleInstallmentsChange(e.target.value)} 
                              className="h-12 text-center font-bold text-xl w-24 rounded-xl border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                            />
                            <span className="text-sm font-medium text-muted-foreground">Vezes (ex: {totalInstallments}x de {formatCurrency(parseFloat(amount) || 0)})</span>
                          </div>
                        </div>
                      )}

                      {type === 'despesa' && (recurrenceType === 'unica' || recurrenceType === 'parcelada') && paymentMethod !== 'credito' && (
                        <div className="flex items-center justify-between py-1 px-1">
                          <Label className="text-sm font-bold">Já foi realizado o pagamento?</Label>
                          <Switch checked={status === 'pago'} onCheckedChange={(checked) => setStatus(checked ? 'pago' : 'pendente')} />
                        </div>
                      )}
                    </div>

                    {/* Bloco 4: Categoria */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center ml-1">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Categoria</Label>
                        <button 
                          type="button" 
                          onClick={() => setShowCategoriesModal(true)}
                          className="text-[10px] uppercase font-bold text-primary hover:underline transition-all"
                        >
                          + Nova Categoria
                        </button>
                      </div>
                      <Select value={categoryId} onValueChange={setCategoryId}>
                        <SelectTrigger className="h-12 rounded-xl border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
                          <SelectValue placeholder="Selecione uma categoria">
                            {categoryId ? (
                              <div className="flex items-center gap-3">
                                <div className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: categories.find(c => c.id === categoryId)?.color }} />
                                <span className="font-medium">{categories.find(c => c.id === categoryId)?.name}</span>
                              </div>
                            ) : "Selecione uma categoria"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {categories
                            .filter(c => c.type === 'ambos' || c.type === type)
                            .map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                                {c.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Resumo */}
                    {(amount && description && categoryId) && (
                      <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
                        <p className="text-primary font-bold mb-1">Resumo da transação:</p>
                        <p className="text-muted-foreground leading-relaxed">
                          Criando uma <span className="font-bold text-foreground">{type}</span> de 
                          <span className="font-bold text-foreground"> {formatCurrency(parseFloat(amount))}</span> 
                          {recurrenceType === 'parcelada' && ` em ${totalInstallments}x`}
                          {paymentMethod === 'credito' && ' no crédito'}
                          {recurrenceType === 'assinatura' && ' (assinatura mensal)'}
                          .
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="p-4 sm:p-6 border-t bg-white dark:bg-neutral-900 shrink-0 sticky bottom-0 z-20 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)]">
                    <Button type="submit" className="w-full h-14 text-lg font-black shadow-xl shadow-primary/20 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]">
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
