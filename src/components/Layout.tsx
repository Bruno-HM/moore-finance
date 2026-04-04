import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFinance } from '../contexts/FinanceContext';
import { LayoutDashboard, Receipt, LogOut, Settings, Wallet, CalendarRange, Calendar, Users, User, Tag } from 'lucide-react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ModeToggle } from './ModeToggle';
import SettingsModal from './SettingsModal';
import CategoriesModal from './CategoriesModal';
import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export default function Layout() {
  const { userProfile, logout, householdMembers } = useAuth();
  const { currentDate } = useFinance();
  const location = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  const isSharedGroup = userProfile?.householdId !== userProfile?.personalHouseholdId;

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Despesas', path: '/transactions', icon: Receipt },
    { name: 'Assinaturas', path: '/recurring', icon: CalendarRange },
    { name: 'Categorias', path: '#categories', icon: Tag, onClick: () => setShowCategories(true) },
  ];

  return (
    <div className="flex h-screen h-[100dvh] bg-neutral-50 dark:bg-neutral-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-white dark:bg-neutral-900 hidden md:flex flex-col">
        <div className="p-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Wallet className="w-6 h-6" />
            MooreFinance
          </h1>
          <ModeToggle />
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            if (item.onClick) {
              return (
                <button
                  key={item.name}
                  onClick={item.onClick}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </button>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-primary/10 text-primary font-medium' 
                    : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}

          <div className="pt-4 px-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-neutral-50 dark:bg-neutral-800/50 p-2 rounded-md border border-neutral-100 dark:border-neutral-800">
              <Calendar className="w-3 h-3" />
              <span className="capitalize">
                {format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </span>
            </div>

            <div className={`flex items-center gap-2 text-[10px] p-2 rounded-md border border-dashed ${
              isSharedGroup 
                ? 'bg-blue-50/50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400' 
                : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-800 text-muted-foreground'
            }`}>
              {isSharedGroup ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
              <span className="font-bold uppercase tracking-wider">
                {isSharedGroup ? 'Grupo Compartilhado' : 'Grupo Pessoal'}
              </span>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" className="w-full justify-start gap-3 px-2" />}>
              <Avatar className="w-8 h-8">
                <AvatarImage src={userProfile?.photoURL || ''} />
                <AvatarFallback>{userProfile?.displayName?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start text-sm">
                <span className="font-medium truncate w-32">{userProfile?.displayName}</span>
                <span className="text-xs text-muted-foreground truncate w-32">{userProfile?.email}</span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="flex items-center gap-2"
                onClick={() => setShowSettings(true)}
              >
                <Settings className="w-4 h-4" /> Configurações
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout} className="flex items-center gap-2 text-destructive">
                <LogOut className="w-4 h-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
      <CategoriesModal open={showCategories} onOpenChange={setShowCategories} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden border-b bg-white dark:bg-neutral-900 p-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            MooreFinance
          </h1>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full overflow-hidden" />}>
                <Avatar className="w-8 h-8">
                  <AvatarImage src={userProfile?.photoURL || ''} />
                  <AvatarFallback>{userProfile?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{userProfile?.displayName}</p>
                    <p className="text-xs leading-none text-muted-foreground">{userProfile?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowSettings(true)}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Configurações</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </div>

        {/* Mobile Nav */}
        <nav className="md:hidden border-t bg-white dark:bg-neutral-900 flex justify-around p-2 pb-safe-offset-2 sticky bottom-0 z-50">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            if (item.onClick) {
              return (
                <button
                  key={item.name}
                  onClick={item.onClick}
                  className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg ${
                    isActive ? 'text-primary' : 'text-neutral-500'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.name}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg ${
                  isActive ? 'text-primary' : 'text-neutral-500'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
