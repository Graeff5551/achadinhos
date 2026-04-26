import React, { useState } from 'react';
import { signInWithPopup, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Heart, ShieldCheck, Loader2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, googleProvider);
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Login error:', error);
      alert('Erro ao fazer login. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Elementos decorativos de fundo */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-brand-cream rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl opacity-50"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-pink-100 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl opacity-30"></div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl relative"
      >
        <div className="text-center mb-12">
            <motion.div 
                animate={{ scale: [1, 1.05, 1], rotate: [0, -5, 5, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="w-24 h-24 bg-white rounded-[2rem] shadow-xl shadow-pink-100/50 flex items-center justify-center mx-auto mb-8 border border-pink-50"
            >
                <div className="text-brand-accent">
                    <Heart size={44} className="fill-brand-accent" />
                </div>
            </motion.div>
            <h1 className="text-5xl font-display font-bold text-slate-800 italic tracking-tight mb-4">Bem-vindo(a) ao Nosso Cantinho!</h1>
            <p className="text-slate-400 font-medium italic text-lg">Acesse os melhores achadinhos para seu bebê com muito amor ❤️</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl p-10 sm:p-16 rounded-[3.5rem] shadow-2xl shadow-pink-100/40 border border-white/50 relative text-center">
          
          <h2 className="text-2xl font-display font-bold text-slate-800 mb-10 italic">Para continuar, identifique-se:</h2>

          <button 
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-6 bg-white border-2 border-pink-50 rounded-[2rem] text-slate-700 font-bold hover:bg-brand-cream hover:border-pink-200 transition-all flex items-center justify-center gap-4 active:scale-95 shadow-sm text-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={24} className="animate-spin text-brand-accent" />
                Aguarde...
              </>
            ) : (
              <>
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-8 h-8" />
                Entrar com Google
              </>
            )}
          </button>

          <div className="mt-12 pt-10 border-t border-pink-50 grid grid-cols-2 gap-8">
             <div className="flex flex-col items-center gap-2 opacity-50">
                <ShieldCheck className="text-brand-accent" size={24} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Ambiente Seguro</span>
             </div>
             <div className="flex flex-col items-center gap-2 opacity-50">
                <Heart className="text-brand-accent fill-brand-accent" size={24} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Curadoria com Amor</span>
             </div>
          </div>
        </div>
        
        <p className="text-center mt-12 text-slate-300 text-xs font-bold italic">
            Garantimos a privacidade e segurança dos seus dados. 🔒
        </p>
      </motion.div>
    </div>
  );
}
