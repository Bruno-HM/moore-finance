import React, { useState } from 'react';
import { useFinance, Transaction } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Sparkles, Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { addMonths, parseISO } from 'date-fns';

interface AITransactionInputProps {
  onResult?: (data: Partial<Transaction> & { categoryName?: string; billingDay?: number }) => void;
}

export default function AITransactionInput({ onResult }: AITransactionInputProps) {
  const { categories, addTransaction } = useFinance();
  const { userProfile } = useAuth();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [suggestion, setSuggestion] = useState<Partial<Transaction> & { categoryName?: string; billingDay?: number }>({});

  const handleAISubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Prioritize API_KEY (manual secret) over GEMINI_API_KEY (reserved secret)
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || "AIzaSyD4RIZOsu1JzQM-jjKF-bkmQ4RRtyBGvw8"
    
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'undefined' || apiKey === '') {
      toast.error('Configuração de IA incompleta. Verifique a API_KEY nos Secrets do AI Studio.');
      return;
    }

    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey });
      const categoryNames = categories.map(c => c.name).join(', ');
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: `Analise a seguinte frase e extraia os dados de uma transação financeira.
        Frase: "${input}"
        
        Categorias disponíveis: ${categoryNames}.
        Se a categoria não se encaixar perfeitamente, escolha a mais próxima ou retorne "Outros".
        
        A data atual é ${new Date().toISOString()}. Interprete palavras como "ontem", "hoje", "semana passada" com base nesta data.
        
        Identifique a intenção:
        - Compra única: recurrenceType = 'unica'
        - Compra parcelada: recurrenceType = 'parcelada', extraia totalInstallments
        - Assinatura: recurrenceType = 'assinatura'
        - Despesa fixa: recurrenceType = 'fixa'
        
        Identifique o método de pagamento: 'pix', 'credito', 'debito', 'dinheiro'.
        
        Para a descrição, gere algo claro e útil. Ex:
        - "Recebi um pix da Taina do serviço de 10 reais" -> "Pagamento da Taina referente a serviço"
        - "Comprei um lanche no iFood por 30 reais" -> "Compra de lanche no iFood"
        - "Paguei o aluguel" -> "Pagamento de aluguel"`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING, description: 'Descrição curta da transação' },
              amount: { type: Type.NUMBER, description: 'Valor numérico positivo' },
              type: { type: Type.STRING, enum: ['receita', 'despesa'], description: 'Se é uma receita (receita) ou despesa (despesa)' },
              categoryName: { type: Type.STRING, description: 'Nome da categoria correspondente' },
              date: { type: Type.STRING, description: 'Data da transação no formato ISO 8601' },
              paymentMethod: { type: Type.STRING, enum: ['pix', 'credito', 'debito', 'dinheiro'], description: 'Método de pagamento' },
              recurrenceType: { type: Type.STRING, enum: ['unica', 'parcelada', 'fixa', 'assinatura'], description: 'Tipo de recorrência' },
              totalInstallments: { type: Type.NUMBER, description: 'Número total de parcelas, se for parcelado' },
              billingDay: { type: Type.NUMBER, description: 'Dia do mês para cobrança (1-31), se for recorrente ou assinatura' }
            },
            required: ['description', 'amount', 'type', 'categoryName', 'date', 'paymentMethod', 'recurrenceType']
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      
      if (result.description && result.amount) {
        const lowerInput = input.toLowerCase();
        const hasExplicitMethod = lowerInput.includes('pix') || 
                                 lowerInput.includes('crédito') || 
                                 lowerInput.includes('credito') || 
                                 lowerInput.includes('débito') || 
                                 lowerInput.includes('debito');
        
        let finalDate = result.date;
        if (result.paymentMethod === 'credito' && userProfile?.creditCardClosingDay) {
          const transactionDate = parseISO(result.date);
          const closingDay = userProfile.creditCardClosingDay;
          
          if (transactionDate.getDate() > closingDay) {
            finalDate = addMonths(transactionDate, 1).toISOString();
          }
        }

        const finalSuggestion = { ...result, date: finalDate };

        if (onResult) {
          onResult(finalSuggestion);
          setInput('');
        } else if (hasExplicitMethod) {
          await saveTransaction(finalSuggestion);
        } else {
          setSuggestion(finalSuggestion);
          setShowConfirm(true);
        }
      } else {
        toast.error('Não foi possível entender a transação.');
      }
    } catch (error) {
      console.error('AI Error:', error);
      toast.error('Erro ao processar com IA.');
    } finally {
      setLoading(false);
    }
  };

  const saveTransaction = async (data: Partial<Transaction> & { categoryName?: string; categoryId?: string }) => {
    try {
      let categoryId = data.categoryId;
      
      if (!categoryId && data.categoryName) {
        categoryId = categories.find(c => c.name.toLowerCase() === data.categoryName?.toLowerCase())?.id;
      }
      
      if (!categoryId) {
        categoryId = categories.find(c => c.type === (data.type === 'receita' ? 'receita' : 'despesa'))?.id || categories[0]?.id;
      }

      await addTransaction({
        description: data.description || '',
        amount: data.amount || 0,
        type: (data.type as 'receita' | 'despesa') || 'despesa',
        categoryId: categoryId || '',
        date: data.date || new Date().toISOString(),
        status: 'pago',
        paymentMethod: (data.paymentMethod as any) || 'dinheiro',
        recurrenceType: (data.recurrenceType as any) || 'unica',
        totalInstallments: data.totalInstallments,
      });

      toast.success('Transação adicionada com sucesso!');
      setInput('');
      setShowConfirm(false);
    } catch (error: any) {
      console.error('Error saving transaction:', error);
      toast.error('Erro ao salvar transação.');
    }
  };

  const confirmTransaction = async () => {
    setLoading(true);
    await saveTransaction(suggestion);
    setLoading(false);
  };

  return (
    <>
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <form onSubmit={handleAISubmit} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" />
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ex: Comprei uma geladeira de 2000 em 5x no cartão..."
                className="pl-10 bg-white dark:bg-neutral-900 border-primary/20 focus-visible:ring-primary/30 h-11 sm:h-10"
                disabled={loading}
              />
            </div>
            <Button type="submit" disabled={loading || !input.trim()} className="gap-2 h-11 sm:h-10 shrink-0">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{loading ? 'Analisando...' : 'Analisar'}</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Confirmar Transação
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input 
                value={suggestion.description || ''} 
                onChange={e => setSuggestion({...suggestion, description: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input 
                  type="number" 
                  value={suggestion.amount || ''} 
                  onChange={e => setSuggestion({...suggestion, amount: parseFloat(e.target.value)})}
                />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input 
                  type="date" 
                  value={suggestion.date?.split('T')[0] || ''} 
                  onChange={e => setSuggestion({...suggestion, date: new Date(e.target.value).toISOString()})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Método</Label>
                <Select 
                  value={suggestion.paymentMethod} 
                  onValueChange={v => setSuggestion({...suggestion, paymentMethod: v as any})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="credito">Cartão de Crédito</SelectItem>
                    <SelectItem value="debito">Cartão de Débito</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select 
                  value={suggestion.recurrenceType} 
                  onValueChange={v => setSuggestion({...suggestion, recurrenceType: v as any})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unica">Única</SelectItem>
                    <SelectItem value="parcelada">Parcelada</SelectItem>
                    <SelectItem value="fixa">Fixa</SelectItem>
                    <SelectItem value="assinatura">Assinatura</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {suggestion.recurrenceType === 'parcelada' && (
              <div className="space-y-2">
                <Label>Parcelas</Label>
                <Input 
                  type="number" 
                  value={suggestion.totalInstallments || ''} 
                  onChange={e => setSuggestion({...suggestion, totalInstallments: parseInt(e.target.value)})}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select 
                value={suggestion.categoryId || categories.find(c => c.name.toLowerCase() === suggestion.categoryName?.toLowerCase())?.id || ''} 
                onValueChange={v => setSuggestion({...suggestion, categoryId: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter(c => c.type === 'ambos' || c.type === suggestion.type)
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
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={loading}>
              <X className="w-4 h-4 mr-2" /> Cancelar
            </Button>
            <Button onClick={confirmTransaction} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Confirmar e Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
