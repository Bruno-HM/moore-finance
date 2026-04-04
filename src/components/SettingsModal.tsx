import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { Settings, Loader2, Copy, Check, Users, User, LogOut, ArrowRight, CreditCard as CreditCardIcon, Plus, Trash2 } from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { userProfile, updateProfile, joinHousehold, leaveHousehold } = useAuth();
  const [closingDay, setClosingDay] = useState<string>('');
  const [salary, setSalary] = useState<string>('');
  const [inviteCodeInput, setInviteCodeInput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { creditCards, addCreditCard, deleteCreditCard } = useFinance();
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardClosing, setNewCardClosing] = useState('');
  const [newCardDue, setNewCardDue] = useState('');

  useEffect(() => {
    if (userProfile?.creditCardClosingDay) {
      setClosingDay(userProfile.creditCardClosingDay.toString());
    }
    if (userProfile?.salary) {
      setSalary(userProfile.salary.toString());
    }
  }, [userProfile]);

  const isSharedGroup = userProfile?.householdId !== userProfile?.personalHouseholdId;

  const copyInviteCode = () => {
    if (userProfile?.inviteCode) {
      navigator.clipboard.writeText(userProfile.inviteCode);
      setCopied(true);
      toast.success('Código copiado!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleJoinGroup = async () => {
    if (!inviteCodeInput.trim()) {
      toast.error('Por favor, insira um código de convite.');
      return;
    }

    setActionLoading(true);
    try {
      await joinHousehold(inviteCodeInput.trim());
      toast.success('Você entrou no grupo compartilhado!');
      setInviteCodeInput('');
    } catch (error) {
      console.error('Error joining group:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao entrar no grupo.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!confirm('Tem certeza que deseja sair deste grupo? Você voltará para o seu grupo pessoal.')) {
      return;
    }

    setActionLoading(true);
    try {
      await leaveHousehold();
      toast.success('Você voltou para o seu grupo pessoal.');
    } catch (error) {
      console.error('Error leaving group:', error);
      toast.error('Erro ao sair do grupo.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddCard = async () => {
    if (!newCardName.trim()) {
      toast.error('Informe o nome do cartão.');
      return;
    }
    const closing = parseInt(newCardClosing);
    const due = parseInt(newCardDue);
    
    if (isNaN(closing) || closing < 1 || closing > 31) {
      toast.error('Dia de fechamento inválido.');
      return;
    }
    if (isNaN(due) || due < 1 || due > 31) {
      toast.error('Dia de vencimento inválido.');
      return;
    }

    setActionLoading(true);
    try {
      await addCreditCard({
        name: newCardName.trim(),
        closingDay: closing,
        dueDay: due
      });
      toast.success('Cartão adicionado!');
      setNewCardName('');
      setNewCardClosing('');
      setNewCardDue('');
      setShowAddCard(false);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao adicionar cartão.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCard = async (id: string) => {
    if (!confirm('Excluir este cartão?')) return;
    setActionLoading(true);
    try {
      await deleteCreditCard(id);
      toast.success('Cartão removido.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao remover cartão.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSave = async () => {
    const day = parseInt(closingDay);
    if (closingDay && (isNaN(day) || day < 1 || day > 31)) {
      toast.error('O dia de fechamento deve ser entre 1 e 31.');
      return;
    }

    const salaryVal = parseFloat(salary);
    if (salary && isNaN(salaryVal)) {
      toast.error('O salário deve ser um número válido.');
      return;
    }

    setLoading(true);
    try {
      await updateProfile({ 
        creditCardClosingDay: closingDay ? day : undefined,
        salary: salary ? salaryVal : undefined
      });
      toast.success('Configurações salvas com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Configurações do Perfil
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Status do Grupo */}
          <div className="bg-neutral-50 dark:bg-neutral-900 p-4 rounded-lg border border-neutral-100 dark:border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isSharedGroup ? (
                  <Users className="w-4 h-4 text-blue-500" />
                ) : (
                  <User className="w-4 h-4 text-green-500" />
                )}
                <span className="text-sm font-medium">
                  {isSharedGroup ? 'Grupo Compartilhado' : 'Grupo Pessoal (Solo)'}
                </span>
              </div>
              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                isSharedGroup ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              }`}>
                Ativo
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {isSharedGroup 
                ? 'Você está visualizando e editando dados de um grupo compartilhado.' 
                : 'Você está visualizando seus dados financeiros individuais.'}
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold border-b pb-2">Dados Financeiros</h3>
            <div className="space-y-2">
              <Label htmlFor="salary">Seu Salário Mensal (R$)</Label>
              <Input
                id="salary"
                type="number"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="Ex: 5000"
              />
              <p className="text-xs text-muted-foreground">
                Este valor é pessoal e não é compartilhado com outros membros.
              </p>
            </div>

            <div className="space-y-4 border rounded-lg p-4 bg-white dark:bg-neutral-900 shadow-sm mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2"><CreditCardIcon className="w-4 h-4"/> Cartões de Crédito</h4>
                  <p className="text-xs text-muted-foreground">Gerencie seus cartões para controle de faturas.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowAddCard(!showAddCard)}>
                  {showAddCard ? 'Cancelar' : <><Plus className="w-4 h-4 mr-1"/> Novo</>}
                </Button>
              </div>

              {showAddCard && (
                <div className="space-y-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-md border">
                  <Input placeholder="Nome (Ex: Nubank, Itaú...)" value={newCardName} onChange={e => setNewCardName(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Dia Fechamento</Label>
                      <Input type="number" min="1" max="31" value={newCardClosing} onChange={e => setNewCardClosing(e.target.value)} placeholder="Ex: 5" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Dia Vencimento</Label>
                      <Input type="number" min="1" max="31" value={newCardDue} onChange={e => setNewCardDue(e.target.value)} placeholder="Ex: 12" />
                    </div>
                  </div>
                  <Button className="w-full" size="sm" onClick={handleAddCard} disabled={actionLoading}>Adicionar Cartão</Button>
                </div>
              )}

              {creditCards.length > 0 ? (
                <div className="space-y-2 mt-2">
                  {creditCards.map(cc => (
                    <div key={cc.id} className="flex items-center justify-between p-2 rounded-md border bg-neutral-50 dark:bg-neutral-800">
                      <div>
                        <p className="text-sm font-medium">{cc.name}</p>
                        <p className="text-[10px] text-muted-foreground">Fechamento: {cc.closingDay} | Vencimento: {cc.dueDay}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteCard(cc.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">Nenhum cartão cadastrado.</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold border-b pb-2">Gestão de Grupo</h3>
            
            {/* Invite Code Display (Always show their personal one or current one?) */}
            {/* User said: "Envie este código para seu parceiro(a) entrar na mesma conta." */}
            <div className="space-y-2">
              <Label>Seu Código de Convite (Pessoal)</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded border truncate">
                  {userProfile?.inviteCode || '...'}
                </code>
                <Button variant="outline" size="icon" onClick={copyInviteCode} disabled={!userProfile?.inviteCode}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Compartilhe este código para que alguém entre no seu grupo.
              </p>
            </div>

            {/* Join/Leave Actions */}
            <div className="pt-2 space-y-3">
              {!isSharedGroup ? (
                <div className="space-y-2">
                  <Label htmlFor="joinCode">Entrar em outro grupo</Label>
                  <div className="flex gap-2">
                    <Input
                      id="joinCode"
                      placeholder="Código do parceiro"
                      value={inviteCodeInput}
                      onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                      className="uppercase"
                    />
                    <Button 
                      variant="secondary" 
                      onClick={handleJoinGroup}
                      disabled={actionLoading || !inviteCodeInput}
                    >
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button 
                  variant="destructive" 
                  className="w-full" 
                  onClick={handleLeaveGroup}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogOut className="w-4 h-4 mr-2" />}
                  Sair do Grupo Compartilhado
                </Button>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
