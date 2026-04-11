import React, { useState } from 'react';
import { useFinance } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { parseOFX, OFXTransaction } from '../lib/ofx-parser';
import { toast } from 'sonner';
import { FileUp, Landmark, AlertCircle, CheckCircle2, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

interface ImportModalProps {
  trigger?: React.ReactNode;
}

export default function ImportModal({ trigger }: ImportModalProps) {
  const { bankAccounts, importTransactions, loading } = useFinance();
  const { householdMembers } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.toLowerCase().split('.').pop();
    if (ext !== 'ofx' && ext !== 'pdf') {
      toast.error('Por favor, selecione um arquivo .OFX ou .PDF');
      return;
    }

    setSelectedFile(file);
    toast.success(`Arquivo ${file.name} selecionado!`);
  };

  const handleImport = async () => {
    if (!selectedBankAccountId) {
      toast.error('Selecione a conta bancária de destino.');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await importTransactions(selectedBankAccountId, selectedFile!);
      toast.success(`Importação concluída!`, {
        description: `${result.added} transações adicionadas, ${result.skipped} ignoradas por duplicidade.`
      });
      setOpen(false);
      resetState();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao importar transações.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetState = () => {
    setSelectedFile(null);
    setSelectedBankAccountId('');
    setIsProcessing(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if(!v) resetState(); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2 border-primary/20 hover:bg-primary/5 text-primary font-bold transition-all hover:scale-[1.02]">
            <FileUp className="w-4 h-4" />
            <span className="hidden sm:inline">Importar Extrato</span>
            <span className="sm:hidden">Importar</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col p-0 border-none rounded-3xl shadow-2xl bg-neutral-950 border-neutral-800">
        <DialogHeader className="p-8 pb-4 bg-primary/5 border-b border-primary/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <Landmark className="w-6 h-6 text-primary-foreground" />
            </div>
            <DialogTitle className="text-2xl font-black tracking-tight">Importar Extrato ou Fatura</DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground font-medium">Suporte a arquivos .OFX e Faturas Sicoob .PDF</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
          {/* Passo 1: Seleção de Conta */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">1</div>
              <Label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground">Conta de Destino</Label>
            </div>
            <Select value={selectedBankAccountId} onValueChange={setSelectedBankAccountId}>
              <SelectTrigger className="h-14 px-6 rounded-2xl border-none bg-neutral-900 font-bold text-lg focus:ring-primary shadow-inner transition-all text-white">
                <SelectValue placeholder="Selecione para qual conta importar...">
                  {bankAccounts.find(acc => acc.id === selectedBankAccountId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-neutral-800 shadow-2xl bg-neutral-900 border text-white">
                {bankAccounts.filter(acc => acc.isActive !== false).map(acc => (
                  <SelectItem key={acc.id} value={acc.id} className="h-12 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{acc.name}</span>
                      <span className="text-[10px] opacity-50">({householdMembers.find(m => m.uid === acc.memberId)?.displayName || 'Geral'})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Passo 2: Upload de Arquivo */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">2</div>
              <Label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground">Arquivo (OFX ou PDF Sicoob)</Label>
            </div>
            
            {!selectedFile ? (
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-primary/20 rounded-[2rem] bg-primary/5 hover:bg-primary/10 transition-all cursor-pointer group">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <div className="p-4 rounded-full bg-neutral-800 shadow-xl mb-4 group-hover:scale-110 transition-transform">
                    <FileUp className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-sm font-black text-primary uppercase tracking-widest">Clique para selecionar</p>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">Arquivos .ofx ou .pdf</p>
                </div>
                <input type="file" className="hidden" accept=".ofx,.pdf" onChange={handleFileUpload} />
              </label>
            ) : (
              <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-500/20 p-6 rounded-[2rem] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h4 className="font-black text-emerald-600 dark:text-emerald-400">Arquivo Selecionado</h4>
                    <p className="text-xs font-medium text-emerald-600/70 truncate max-w-[200px]">{selectedFile.name}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)} className="text-emerald-600 hover:bg-emerald-500/10 font-bold uppercase text-[10px]">Trocar</Button>
              </div>
            )}
          </div>

          {/* Preview removido - Processamento agora é exclusivo do backend por performance e segurança */}
          {selectedFile && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-500/20 rounded-2xl flex gap-3">
              <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Ao clicar em confirmar, o sistema analisará o arquivo e importará apenas as transações novas.
                {selectedFile.name.toLowerCase().endsWith('.pdf') && " Faturas de cartão serão importadas como lançamentos pendentes no crédito."}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="p-8 bg-neutral-900 border-t border-neutral-800 flex flex-col sm:flex-row gap-3">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isProcessing} className="flex-1 font-bold rounded-2xl h-14">Cancelar</Button>
          <Button 
            onClick={handleImport} 
            disabled={!selectedFile || !selectedBankAccountId || isProcessing}
            className="flex-1 h-14 rounded-2xl font-black text-lg bg-primary shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:grayscale disabled:opacity-50"
          >
            {isProcessing ? 'Enviando...' : 'Confirmar Importação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

