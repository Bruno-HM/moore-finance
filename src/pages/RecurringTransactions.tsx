import React, { useState } from 'react';
import { useFinance, RecurringTransaction } from '../contexts/FinanceContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Trash2, Edit2, Calendar, CreditCard, Wallet, Plus, RefreshCw, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

export default function RecurringTransactions() {
  const { userProfile, householdMembers } = useAuth();
  const { recurringTransactions, categories, updateRecurringTransaction, deleteRecurringTransaction, recalculateRecurring } = useFinance();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRT, setEditingRT] = useState<RecurringTransaction | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Form state
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
      toast.success('Valores recalculados e sincronizados!');
    } catch (error) {
      toast.error('Erro ao recalcular valores.');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleOpenEdit = (rt: RecurringTransaction) => {
    setEditingRT(rt);
    setDescription(rt.description);
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

    if (!description || !amount || !categoryId) {
      toast.error('Preencha todos os campos.');
      return;
    }

    try {
      await updateRecurringTransaction(editingRT.id, {
        description,
        amount: parseFloat(amount),
        categoryId,
        paymentMethod,
        billingDay: billingDay ? parseInt(billingDay) : undefined
      }, updateMode);
      toast.success('Assinatura atualizada!');
      setIsDialogOpen(false);
    } catch (error) {
      toast.error('Erro ao atualizar assinatura.');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta assinatura? As transações futuras e a pendente deste mês serão removidas. O histórico pago será preservado.')) {
      try {
        await deleteRecurringTransaction(id);
        toast.success('Assinatura removida!');
      } catch (error) {
        toast.error('Erro ao remover assinatura.');
      }
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="w-full md:w-auto">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Assinaturas e Despesas Fixas</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie seus gastos recorrentes que não aparecem na lista principal.
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleRecalculate} 
          disabled={isRecalculating}
          className="h-10 sm:h-9 gap-2 w-full md:w-auto justify-center"
        >
          <RefreshCw className={`w-4 h-4 ${isRecalculating ? 'animate-spin' : ''}`} />
          {isRecalculating ? 'Recalculando...' : 'Recalcular Valores'}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {recurringTransactions.map(rt => {
          const category = categories.find(c => c.id === rt.categoryId);
          const creator = householdMembers.find(m => m.uid === rt.createdBy);
          return (
            <Card key={rt.id} className="relative overflow-hidden">
              <div 
                className="absolute top-0 left-0 w-1 h-full" 
                style={{ backgroundColor: category?.color || '#cbd5e1' }}
              />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{rt.description}</CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(rt)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(rt.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(rt.amount)}</div>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>{rt.recurrenceType === 'assinatura' ? 'Assinatura' : 'Despesa Fixa'}</span>
                  <span>•</span>
                  <CreditCard className="h-3 w-3" />
                  <span className="uppercase">{rt.paymentMethod}</span>
                  {rt.billingDay && (
                    <>
                      <span>•</span>
                      <Calendar className="h-3 w-3" />
                      <span>Dia {rt.billingDay}</span>
                    </>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 dark:bg-neutral-800">
                    {category?.name || 'Sem Categoria'}
                  </span>
                  <div className="flex items-center gap-1">
                    {creator?.photoURL ? (
                      <img src={creator.photoURL} alt="" className="w-3 h-3 rounded-full" referrerPolicy="no-referrer" />
                    ) : (
                      <User className="w-3 h-3 text-muted-foreground" />
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {creator?.uid === userProfile?.uid ? 'Você' : creator?.displayName.split(' ')[0] || 'Usuário'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {recurringTransactions.length === 0 && (
          <Card className="col-span-full border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Wallet className="h-10 w-10 mb-4 opacity-20" />
              <p>Nenhuma assinatura ou despesa fixa encontrada.</p>
              <p className="text-sm">Adicione uma nova transação e selecione "Assinatura" ou "Fixa".</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Assinatura</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Método</Label>
                <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="credito">Crédito</SelectItem>
                    <SelectItem value="debito">Débito</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dia de Vencimento (1-31)</Label>
              <Input 
                type="number" 
                min="1" 
                max="31" 
                value={billingDay} 
                onChange={e => setBillingDay(e.target.value)} 
                placeholder="Ex: 10"
              />
              <p className="text-[10px] text-muted-foreground">
                * Deixe vazio para usar o dia da criação original.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
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

            <div className="space-y-2">
              <Label>Aplicar alteração em:</Label>
              <Select value={updateMode} onValueChange={(v: any) => setUpdateMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="este_mes">Somente este mês</SelectItem>
                  <SelectItem value="futuras">Este mês e futuros</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                * No mês atual, o valor só muda se ainda estiver pendente.
              </p>
            </div>

            <Button type="submit" className="w-full">Salvar Alterações</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
