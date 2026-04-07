import React, { useState, useEffect, useMemo } from 'react';
import { useFinance, Transaction } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Loader2, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { parseISO } from 'date-fns';

interface TransactionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingTransaction?: Transaction | null;
  initialType?: 'receita' | 'despesa';
  mode?: 'normal' | 'recurring';
}

export default function TransactionModal({
  isOpen,
  onOpenChange,
  editingTransaction,
  initialType = 'despesa',
  mode = 'normal'
}: TransactionModalProps) {
  const { userProfile, householdMembers } = useAuth();
  const {
    categories, addTransaction, updateTransaction,
    deleteTransaction, creditCards, bankAccounts
  } = useFinance();

  const [loading, setLoading] = useState(false);

  // Form States
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'receita' | 'despesa'>(initialType);
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credito' | 'debito' | 'dinheiro'>('dinheiro');
  const [recurrenceType, setRecurrenceType] = useState<'unica' | 'parcelada' | 'fixa' | 'assinatura'>('unica');
  const [totalInstallments, setTotalInstallments] = useState('1');
  const [billingDay, setBillingDay] = useState(new Date().getDate().toString());
  const [creditCardId, setCreditCardId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');

  // Sync state with editingTransaction
  useEffect(() => {
    if (editingTransaction) {
      setTitle(editingTransaction.title || editingTransaction.description || '');
      setDescription(editingTransaction.description || '');
      setAmount(editingTransaction.amount.toString());
      setType(editingTransaction.type);
      setCategoryId(editingTransaction.categoryId);
      setDate(parseISO(editingTransaction.date).toISOString().split('T')[0]);
      setPaymentMethod(editingTransaction.paymentMethod || 'dinheiro');
      setRecurrenceType(editingTransaction.recurrenceType || 'unica');
      setTotalInstallments(editingTransaction.totalInstallments?.toString() || '1');
      setCreditCardId(editingTransaction.creditCardId || '');
      setBankAccountId(editingTransaction.bankAccountId || '');
    } else {
      resetForm();
      setType(initialType);
      if (mode === 'recurring') {
        setRecurrenceType('fixa');
      }
    }
  }, [editingTransaction, initialType, isOpen, mode]);

  // Reset category if it doesn't match the current type
  useEffect(() => {
    if (categoryId && !editingTransaction) {
      const currentCategory = categories.find(c => c.id === categoryId);
      if (currentCategory && currentCategory.type !== 'ambos' && currentCategory.type !== type) {
        setCategoryId('');
      }
    }
  }, [type, categoryId, categories, editingTransaction]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAmount('');
    setType(initialType);
    setCategoryId('');
    setDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('dinheiro');
    setRecurrenceType('unica');
    setTotalInstallments('1');
    setBillingDay(new Date().getDate().toString());
    setCreditCardId('');
    setBankAccountId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount || !categoryId || !date) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }

    if (paymentMethod === 'credito' && !creditCardId) {
      toast.error('Selecione um cartão de crédito.');
      return;
    }

    if (paymentMethod !== 'credito' && !bankAccountId && type === 'despesa') {
      toast.error('Selecione uma conta bancária.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title,
        description,
        amount: parseFloat(amount),
        type,
        categoryId,
        date: new Date(date + 'T12:00:00').toISOString(),
        status: ((type === 'receita') ? 'pago' : (paymentMethod === 'credito' ? 'pendente' : 'pago')) as 'pago' | 'pendente',
        paymentMethod,
        recurrenceType: (paymentMethod === 'pix' || paymentMethod === 'debito' || paymentMethod === 'dinheiro') ? 'unica' : recurrenceType,
        totalInstallments: parseInt(totalInstallments),
        billingDay: parseInt(billingDay),
        creditCardId: paymentMethod === 'credito' ? creditCardId : undefined,
        bankAccountId: paymentMethod !== 'credito' ? bankAccountId : undefined,
      };

      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, payload as any);
        toast.success(mode === 'recurring' ? 'Automação atualizada!' : 'Registro atualizado!');
      } else {
        await addTransaction(payload as any);
        toast.success(mode === 'recurring' ? 'Nova assinatura/fixo configurado!' : 'Novo registro salvo!');
      }
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editingTransaction) return;
    if (window.confirm('Excluir esta transação?')) {
      setLoading(true);
      try {
        await deleteTransaction(editingTransaction.id);
        toast.success('Registro excluído.');
        onOpenChange(false);
      } catch (error) {
        toast.error('Erro ao excluir.');
      } finally {
        setLoading(false);
      }
    }
  };

  const selectedCategoryName = useMemo(() => {
    return categories.find(c => c.id === categoryId)?.name;
  }, [categories, categoryId]);

  const selectedCreditCardName = useMemo(() => {
    return creditCards.find(cc => cc.id === creditCardId)?.name;
  }, [creditCards, creditCardId]);

  const selectedBankAccountName = useMemo(() => {
    return bankAccounts.find(acc => acc.id === bankAccountId)?.name;
  }, [bankAccounts, bankAccountId]);

  const paymentMethodLabels: Record<string, string> = {
    pix: 'P-I-X',
    credito: 'C. de Crédito',
    debito: 'C. de Débito',
    dinheiro: 'Dinheiro'
  };

  const renderRecurrenceSection = () => (
    !editingTransaction && (paymentMethod === 'credito' || mode === 'recurring') && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-white/[0.02] p-6 rounded-3xl border border-white/5">
        <div className="space-y-3">
          <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 ml-1">Repetição</Label>
          <Select value={recurrenceType} onValueChange={(v: any) => setRecurrenceType(v)}>
            <SelectTrigger className="h-14 px-6 rounded-2xl bg-white/5 border-none font-bold text-base text-white">
              <SelectValue placeholder="Recorrência">
                {recurrenceType === 'unica' ? 'Único' : 
                 recurrenceType === 'parcelada' ? 'Parcelado' :
                 recurrenceType === 'fixa' ? 'Fixo (Mensal)' :
                 recurrenceType === 'assinatura' ? 'Assinatura' : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-black/90 backdrop-blur-2xl border-white/10 rounded-xl">
              {mode === 'normal' ? (
                <>
                  <SelectItem value="unica">Único</SelectItem>
                  {paymentMethod === 'credito' && (
                    <SelectItem value="parcelada">Parcelado</SelectItem>
                  )}
                </>
              ) : (
                <>
                  <SelectItem value="fixa">Fixo (Mensal)</SelectItem>
                  <SelectItem value="assinatura">Assinatura</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {recurrenceType === 'parcelada' && paymentMethod === 'credito' && (
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 ml-1">Nº de Parcelas</Label>
            <div className="relative">
              <Input
                type="number" min="1" max="99"
                value={totalInstallments} onChange={e => setTotalInstallments(e.target.value)}
                className="h-14 px-6 rounded-2xl bg-white/5 border-none font-black text-xl text-white"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-right">
                <p className="text-[8px] font-black uppercase tracking-widest text-primary">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((parseFloat(amount) || 0) / (parseInt(totalInstallments) || 1))}
                </p>
                <p className="text-[7px] font-bold text-white/20 uppercase tracking-tighter">por parcela</p>
              </div>
            </div>
          </div>
        )}

        {(recurrenceType === 'fixa' || recurrenceType === 'assinatura') && (
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 ml-1">Dia de Cobrança</Label>
            <Input
              type="number" min="1" max="31"
              value={billingDay} onChange={e => setBillingDay(e.target.value)}
              className="h-14 px-6 rounded-2xl bg-white/5 border-none font-black text-xl text-white"
            />
          </div>
        )}
      </div>
    )
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-black/90 backdrop-blur-2xl border-white/5 p-0 overflow-hidden rounded-[2.5rem] shadow-2xl">
        <DialogHeader className="p-8 pb-4 border-b border-white/5">
          <DialogTitle className="text-2xl font-black text-white tracking-tighter flex items-center gap-3">
            {mode === 'recurring' && <RefreshCw className="w-6 h-6 text-primary" />}
            {editingTransaction 
              ? (mode === 'recurring' ? 'Editar Assinatura/Fixo' : 'Editar Registro') 
              : (mode === 'recurring' ? 'Nova Assinatura ou Fixo' : 'Novo Lançamento')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh] no-scrollbar">
            {/* Type Switcher */}
            <div className="flex justify-center">
              <div className="grid grid-cols-2 w-full p-1 bg-white/5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setType('despesa')}
                  className={`py-2 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${type === 'despesa' ? 'bg-white text-black shadow-xl' : 'text-white/40'}`}
                >
                  Despesa
                </button>
                <button
                  type="button"
                  onClick={() => setType('receita')}
                  className={`py-2 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${type === 'receita' ? 'bg-white text-black shadow-xl' : 'text-white/40'}`}
                >
                  Receita
                </button>
              </div>
            </div>

            {/* Value Input */}
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 ml-1">Valor do Registro</Label>
              <div className="relative group">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-white/20 group-focus-within:text-primary transition-colors">R$</span>
                <input
                  type="number" step="0.01"
                  value={amount} onChange={e => setAmount(e.target.value)}
                  className="h-20 w-full pl-16 text-4xl font-black rounded-3xl bg-white/5 border-none focus-visible:ring-primary/20 text-white placeholder:text-white/10 outline-none transition-all"
                  placeholder="0,00"
                  autoFocus={!editingTransaction}
                />
              </div>
            </div>

            {/* Recurrence Selection - PLACEMENT VARIES BY MODE */}
            {mode === 'recurring' && renderRecurrenceSection()}

            {/* Main Info */}
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 ml-1">Título</Label>
                <Input
                  value={title} onChange={e => setTitle(e.target.value)}
                  placeholder={mode === 'recurring' ? "Ex: Aluguel, Netflix, Seguro..." : "Ex: Supermercado, Almoço..."}
                  className="h-14 px-6 rounded-2xl bg-white/5 border-none font-bold text-lg focus-visible:ring-primary/20 text-white"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 ml-1">Observações / Descrição</Label>
                <textarea
                  value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Adicione detalhes sobre este registro..."
                  className="w-full min-h-[100px] p-6 rounded-2xl bg-white/5 border-none font-medium text-base focus:ring-1 focus:ring-primary/20 text-white placeholder:text-white/10 outline-none transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 ml-1">Categoria</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className="h-14 px-6 rounded-2xl bg-white/5 border-none font-bold text-base text-white">
                      <SelectValue placeholder="Categoria">
                        {categories.find(c => c.id === categoryId)?.name}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-black/90 backdrop-blur-2xl border-white/10 rounded-xl">
                      {categories.filter(c => c.type === 'ambos' || c.type === type).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 ml-1">Data {mode === 'recurring' && '(Início)'}</Label>
                  <input
                    type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="h-14 w-full px-6 rounded-2xl bg-white/5 border-none font-bold text-base text-white outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Payment Details */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 ml-1">Forma de Pagamento</Label>
                  <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                    <SelectTrigger className="h-14 px-6 rounded-2xl bg-white/5 border-none font-bold text-base text-white">
                      <SelectValue placeholder="Selecione a forma">
                        {paymentMethod === 'pix' ? 'PIX' : 
                         paymentMethod === 'credito' ? 'Cartão de Crédito' :
                         paymentMethod === 'debito' ? 'Cartão de Débito' :
                         paymentMethod === 'dinheiro' ? 'Dinheiro' : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-black/90 backdrop-blur-2xl border-white/10 rounded-xl">
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="credito">Cartão de Crédito</SelectItem>
                      <SelectItem value="debito">Cartão de Débito</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {paymentMethod === 'credito' ? (
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 ml-1">Qual Cartão?</Label>
                    <Select value={creditCardId} onValueChange={setCreditCardId}>
                      <SelectTrigger className="h-14 px-6 rounded-2xl bg-white/5 border-none font-bold text-base text-white">
                        <SelectValue placeholder="Selecione o cartão">
                          {selectedCreditCardName}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-black/90 backdrop-blur-2xl border-white/10 rounded-xl">
                        {creditCards.filter(cc => cc.isActive !== false).map(cc => (
                          <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 ml-1">Qual Conta?</Label>
                    <Select value={bankAccountId} onValueChange={setBankAccountId}>
                      <SelectTrigger className="h-14 px-6 rounded-2xl bg-white/5 border-none font-bold text-base text-white">
                        <SelectValue placeholder="Selecione a conta">
                          {selectedBankAccountName}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-black/90 backdrop-blur-2xl border-white/10 rounded-xl">
                        {bankAccounts.filter(acc => acc.isActive !== false).map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Normal Recurrence Selection */}
            {mode === 'normal' && renderRecurrenceSection()}

          </div>

          <DialogFooter className="p-8 pt-6 border-t border-white/5 bg-white/[0.02] flex flex-row items-center gap-3">
            {editingTransaction && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
                className="h-14 px-6 rounded-2xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/20"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
              </Button>
            )}
            <Button
              type="submit"
              disabled={loading}
              className={`flex-1 h-14 rounded-2xl font-black text-lg shadow-xl transition-all ${
                mode === 'recurring' 
                  ? 'bg-white text-black hover:bg-white/90 shadow-white/10' 
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Salvando...
                </>
               ) : (
                editingTransaction 
                  ? (mode === 'recurring' ? 'Salvar Alterações' : 'Salvar Alterações') 
                  : (mode === 'recurring' ? 'Ativar Automação' : 'Confirmar Lançamento')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
