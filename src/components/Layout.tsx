/* Versão 1.1.2 - Correção de Estabilidade */
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation, Link, Outlet } from 'react-router-dom';
import { 
  LogOut, 
  LayoutDashboard, 
  Receipt, 
  CalendarRange, 
  Menu, 
  X,
  User,
  Settings,
  ChevronRight
} from 'lucide-react';
import { Button } from './ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuGroup,
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from './ui/dropdown-menu';
import { motion, AnimatePresence } from 'motion/react';
import SettingsModal from './SettingsModal';

export default function Layout() {
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const navItems = [
    { name: 'Overview', path: '/', icon: LayoutDashboard },
    { name: 'Fluxo', path: '/transactions', icon: Receipt },
    { name: 'Fixos', path: '/recurring', icon: CalendarRange },
  ];

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-primary/30">
      {/* Universal Top Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                <LayoutGridIcon className="w-5 h-5 text-black" />
              </div>
              <span className="text-sm font-black tracking-tighter uppercase">MooreFinance</span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                      isActive 
                        ? 'bg-white text-black shadow-lg' 
                        : 'text-white/40 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger id="btn-settings" className="relative h-9 w-9 rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition-all bg-white/5 flex items-center justify-center hover:bg-white/10 outline-none">
                  {userProfile?.photoURL ? (
                    <img
                      src={userProfile.photoURL}
                      alt={userProfile.displayName || ''}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User className="h-4 w-4 text-white/40" />
                  )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-black/90 backdrop-blur-2xl border-white/10 rounded-2xl p-2 shadow-2xl">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-3 py-2">
                    <p className="text-xs font-black uppercase tracking-widest text-white/30 mb-0.5">Conta</p>
                    <p className="text-sm font-bold text-white truncate">{userProfile?.displayName}</p>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-white/5 mx-1" />
                <DropdownMenuItem className="rounded-xl focus:bg-white/10 cursor-pointer py-3" onClick={() => setIsSettingsOpen(true)}>
                  <Settings className="mr-3 h-4 w-4 text-white/40" />
                  <span className="text-xs font-bold">Configurações</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-xl focus:bg-rose-500/10 cursor-pointer py-3 text-rose-500" onClick={logout}>
                  <LogOut className="mr-3 h-4 w-4" />
                  <span className="text-xs font-bold">Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Toggle */}
            <button 
              id="btn-mobile-menu"
              className="md:hidden p-2 text-white/50 hover:text-white transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-black pt-20 px-6 md:hidden"
          >
            <nav className="space-y-4">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group active:bg-white/10 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <item.icon className="w-5 h-5 text-white/30 group-active:text-primary transition-colors" />
                    <span className="text-sm font-bold tracking-tight">{item.name}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/10" />
                </Link>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="pt-24 pb-32 px-4 sm:px-6 max-w-7xl mx-auto">
        <Outlet />
      </main>

      {/* Subtle Background Glows */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
      <SettingsModal open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </div>
  );
}

function LayoutGridIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  );
}

