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
import { motion, AnimatePresence } from 'motion/react';
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
    { name: 'Home', path: '/', icon: LayoutDashboard },
    { name: 'Gastos', path: '/transactions', icon: Receipt },
    { name: 'Fixos & Assin.', path: '/recurring', icon: CalendarRange },
    { name: 'Tags', path: '#categories', icon: Tag, onClick: () => setShowCategories(true) },
  ];

  return (
    <div className="flex h-screen h-[100dvh] bg-background text-foreground overflow-hidden font-sans">
      {/* Sidebar - Desktop */}
      <aside className="w-72 hidden md:flex flex-col p-4 z-20">
        <div className="flex-1 flex flex-col bg-card rounded-[2rem] border border-border/50 shadow-xl shadow-primary/5 overflow-hidden">
          <div className="p-8 flex items-center justify-between">
            <h1 className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                <Wallet className="w-6 h-6 text-primary-foreground" />
              </div>
              <span>Moore<span className="text-primary">Finance</span></span>
            </h1>
          </div>
          
          <nav className="flex-1 px-6 space-y-2 mt-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              const Component = item.onClick ? 'button' : Link;
              const props = item.onClick ? { onClick: item.onClick } : { to: item.path! };

              return (
                <Component
                  key={item.name}
                  {...(props as any)}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 relative group ${
                    isActive 
                      ? 'text-primary' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 bg-primary/10 rounded-2xl border border-primary/20"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <Icon className={`w-5 h-5 relative z-10 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="font-semibold text-sm relative z-10">{item.name}</span>
                </Component>
              );
            })}

            <div className="pt-8 px-2 space-y-4">
              <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground bg-muted/30 p-4 rounded-2xl border border-border/50">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="capitalize tracking-tight">
                  {format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </span>
              </div>

              <div className={`flex items-center gap-3 text-[11px] p-4 rounded-2xl border border-dashed shadow-inner ${
                isSharedGroup 
                  ? 'bg-primary/5 border-primary/20 text-primary' 
                  : 'bg-muted/30 border-border text-muted-foreground'
              }`}>
                {isSharedGroup ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
                <span className="font-bold uppercase tracking-widest">
                  {isSharedGroup ? 'Familiar' : 'Privado'}
                </span>
              </div>
            </div>
          </nav>

          <div className="p-6 border-t border-border/50 bg-muted/20">
            <div className="flex items-center justify-between mb-4">
               <ModeToggle />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" className="w-full justify-start gap-4 px-3 py-8 rounded-2xl hover:bg-primary/5 group" />}>
                <div className="relative">
                  <Avatar className="w-11 h-11 border-2 border-primary/20 group-hover:border-primary/50 transition-colors">
                    <AvatarImage src={userProfile?.photoURL || ''} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">{userProfile?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex flex-col items-start text-sm">
                  <span className="font-bold text-foreground truncate w-28 group-hover:text-primary transition-colors">{userProfile?.displayName}</span>
                  <span className="text-[11px] text-muted-foreground truncate w-28 font-medium">{userProfile?.email}</span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl shadow-2xl border-border/50">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">Ações</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-primary/5"
                  onClick={() => setShowSettings(true)}
                >
                  <Settings className="w-4 h-4 text-primary" /> 
                  <span className="font-semibold">Ajustes</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer text-destructive hover:bg-destructive/10">
                  <LogOut className="w-4 h-4" /> 
                  <span className="font-semibold">Desconectar</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
      <CategoriesModal open={showCategories} onOpenChange={setShowCategories} />

      {/* Content Container */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Mobile Navbar */}
        <header className="md:hidden border-b border-border/50 bg-card p-5 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
             <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                <Wallet className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-lg font-extrabold tracking-tight">Moore<span className="text-primary">Finance</span></h1>
          </div>
          <div className="flex items-center gap-3">
            <ModeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full overflow-hidden w-10 h-10 border-2 border-primary/20" />}>
                <Avatar className="w-full h-full">
                  <AvatarImage src={userProfile?.photoURL || ''} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">{userProfile?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl shadow-2xl border-border/50 mt-2">
                <DropdownMenuLabel className="font-bold px-3 py-2">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-bold text-foreground leadng-none">{userProfile?.displayName}</p>
                    <p className="text-[11px] leading-none text-muted-foreground font-medium">{userProfile?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowSettings(true)} className="p-3 rounded-xl gap-3">
                  <Settings className="h-4 w-4 text-primary" />
                  <span className="font-semibold">Configurações</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive p-3 rounded-xl gap-3 hover:bg-destructive/10">
                  <LogOut className="h-4 w-4" />
                  <span className="font-semibold">Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Dynamic Page Background Elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none -mr-48 -mt-48" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/3 rounded-full blur-[100px] pointer-events-none -ml-32 -mb-32" />

        <div className="flex-1 overflow-auto p-5 md:p-12 relative z-10 scrollbar-hide">
          <div className="max-w-7xl mx-auto w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom Nav - Mobile Dock Aesthetic */}
        <div className="md:hidden p-4 fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
          <nav className="bg-card/85 backdrop-blur-xl border border-border/50 flex justify-around p-2 rounded-[2rem] shadow-2xl pointer-events-auto ring-1 ring-black/5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              const Component = item.onClick ? 'button' : Link;
              const props = item.onClick ? { onClick: item.onClick } : { to: item.path! };

              return (
                <Component
                  key={item.name}
                  {...(props as any)}
                  className={`relative flex-1 flex flex-col items-center gap-1.5 py-4 px-2 rounded-2xl transition-all ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="bottom-nav-active"
                      className="absolute inset-x-2 inset-y-2 bg-primary/10 rounded-2xl border border-primary/20"
                      transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                    />
                  )}
                  <Icon className={`w-6 h-6 relative z-10 transition-transform ${isActive ? 'scale-110 active:scale-95' : 'scale-100 hover:scale-105'}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider relative z-10">{item.name.split(' ')[0]}</span>
                </Component>
              );
            })}
          </nav>
        </div>
      </main>
    </div>
  );
}
