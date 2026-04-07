import React, { useState } from 'react';
import { useFinance, Category } from '../contexts/FinanceContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, Edit2, Trash2, Tag, X } from 'lucide-react';
import { toast } from 'sonner';

interface CategoriesModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactElement;
}

export default function CategoriesModal({ open, onOpenChange, trigger }: CategoriesModalProps) {
  const { categories, addCategory, updateCategory, deleteCategory } = useFinance();
  const [isEditing, setIsEditing] = useState<Category | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [type, setType] = useState<'receita' | 'despesa' | 'ambos'>('despesa');

  const resetForm = () => {
    setName('');
    setColor('#3b82f6');
    setType('despesa');
    setIsEditing(null);
  };

  const handleEdit = (category: Category) => {
    setIsEditing(category);
    setName(category.name);
    setColor(category.color);
    setType(category.type);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      toast.error('O nome da categoria é obrigatório.');
      return;
    }

    try {
      if (isEditing) {
        await updateCategory(isEditing.id, { name, color, type });
        toast.success('Categoria atualizada!');
      } else {
        await addCategory({ name, color, type });
        toast.success('Categoria criada!');
      }
      resetForm();
    } catch (error) {
      toast.error('Erro ao salvar categoria.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta categoria?')) return;
    try {
      await deleteCategory(id);
      toast.success('Categoria excluída!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir categoria.');
    }
  };

  const colors = [
    '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', 
    '#ec4899', '#f43f5e', '#06b6d4', '#84cc16', '#71717a'
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col bg-neutral-950 border-neutral-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" />
            Gerenciar Categorias
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
          {/* Form Section */}
          <form onSubmit={handleSubmit} className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 space-y-4">
            <h3 className="text-sm font-semibold flex items-center justify-between">
              {isEditing ? 'Editar Categoria' : 'Nova Categoria'}
              {isEditing && (
                <Button type="button" variant="ghost" size="sm" onClick={resetForm} className="h-7 px-2">
                  <X className="w-3 h-3 mr-1" /> Cancelar
                </Button>
              )}
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="Ex: Alimentação" 
                  className="bg-neutral-950 border-neutral-800"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v: any) => setType(v)}>
                  <SelectTrigger className="bg-neutral-950 border-neutral-800">
                    <SelectValue>
                      {type === 'ambos' ? 'Ambos' : type === 'receita' ? 'Receita' : 'Despesa'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="despesa">Despesa</SelectItem>
                    <SelectItem value="receita">Receita</SelectItem>
                    <SelectItem value="ambos">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {colors.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-primary scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
                <div className="relative">
                  <Input 
                    type="color" 
                    value={color} 
                    onChange={e => setColor(e.target.value)} 
                    className="w-8 h-8 p-0 border-none rounded-full overflow-hidden cursor-pointer" 
                  />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full gap-2">
              {isEditing ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {isEditing ? 'Atualizar Categoria' : 'Criar Categoria'}
            </Button>
          </form>

          {/* List Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold px-1">Categorias Existentes</h3>
            <div className="grid gap-2">
              {categories.map(category => (
                <div 
                  key={category.id} 
                  className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg border border-neutral-800 group hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full shadow-sm" 
                      style={{ backgroundColor: category.color }} 
                    />
                    <div>
                      <p className="text-sm font-medium">{category.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {category.type === 'ambos' ? 'Receita e Despesa' : category.type === 'receita' ? 'Receita' : 'Despesa'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => handleEdit(category)}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    {!category.isDefault && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(category.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {categories.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                  <Tag className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Nenhuma categoria personalizada.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
