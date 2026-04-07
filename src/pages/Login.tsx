import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { AlgorithmicBackground } from '../components/AlgorithmicBackground';

export default function Login() {
  const { user, loading, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  // Mouse Interaction Setup
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  const handleMouseMove = (event: React.MouseEvent) => {
    const { clientX, clientY } = event;
    mouseX.set(clientX);
    mouseY.set(clientY);
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    mouseX.set(touch.clientX);
    mouseY.set(touch.clientY);
  };

  useEffect(() => {
    if (!loading && user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden p-6 font-sans"
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
    >
      {loading ? (
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin relative z-50"
        />
      ) : (
        <>
          {/* Algorithmic Art Background */}
          <AlgorithmicBackground mouseX={springX} mouseY={springY} />

          {/* Central Shine */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(244,114,182,0.05),transparent_70%)] pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md z-10"
          >
            <div className="pluggy-card p-12 bg-white/[0.02] backdrop-blur-3xl border-white/[0.08] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] relative overflow-hidden group rounded-[2.5rem]">
              {/* Internal Glow Effect */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

              <div className="flex flex-col items-center text-center space-y-10">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ delay: 0.3, duration: 0.8, type: "spring", bounce: 0.4 }}
                  className="relative"
                >
                  <div className="absolute inset-0 bg-primary/30 blur-[40px] opacity-20 -z-10 scale-150 rounded-full" />
                  <img
                    src="/icon-512.png"
                    alt="MooreFinance Logo"
                    className="w-32 h-32 object-contain drop-shadow-[0_10px_30px_rgba(244,114,182,0.4)]"
                  />
                </motion.div>

                <div className="space-y-4">
                  <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.6 }}
                    className="text-5xl font-black text-white tracking-[-0.05em]"
                  >
                    Moore<span className="text-primary italic">Finance</span>
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.8 }}
                    className="text-white/30 text-[13px] font-semibold tracking-wide uppercase leading-relaxed max-w-[280px] mx-auto"
                  >
                    Construindo o amanhã <br /><span className="text-primary text-[16px]">juntos.</span>
                  </motion.p>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.6 }}
                  className="w-full pt-4 px-2"
                >
                  <Button
                    onClick={signInWithGoogle}
                    className="w-full h-16 bg-white hover:bg-neutral-100 text-black font-black text-[13px] uppercase tracking-[0.25em] rounded-2xl shadow-2xl shadow-white/5 group relative overflow-hidden transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center"
                  >
                    {/* Button Shine Animation */}
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />

                    <div className="flex items-center justify-center gap-4 relative z-10 w-full">
                      <svg className="w-6 h-6" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      <span className="font-bold">Entrar com Google</span>
                    </div>
                  </Button>
                </motion.div>
              </div>

              {/* Subtle Ambient light */}
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 blur-[60px] opacity-20 rounded-full" />
            </div>
          </motion.div>

          {/* Version Tag */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 1 }}
            className="absolute bottom-8 flex flex-col items-center space-y-2"
          >
            <span className="text-[9px] uppercase font-black tracking-[0.5em] text-white/20">
              Algorithmic Design v2 &copy; {new Date().getFullYear()}
            </span>
            <div className="w-12 h-[1px] bg-white/10" />
          </motion.div>
        </>
      )}
    </div>
  );
}
