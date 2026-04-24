import React from 'react';
import { useCart } from '../lib/cartStore';
import { getDirectDriveUrl } from '../lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ArrowRight, ShoppingBag } from 'lucide-react';
import { motion } from 'motion/react';

export default function CartPage() {
  const { items, removeItem, updateQuantity, subtotal, shipping, total } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
        <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-12 bg-white/40 backdrop-blur-sm rounded-full border border-pink-100/50 mb-10 shadow-inner"
        >
          <ShoppingBag size={80} className="text-pink-100" />
        </motion.div>
        <h2 className="text-4xl font-display font-bold text-slate-800 mb-6 italic tracking-tight">Sua sacolinha está vazia... 🍼</h2>
        <p className="text-slate-400 mb-10 max-w-sm text-lg font-medium italic">Que tal aproveitar nossos achadinhos e economizar muito no enxoval?</p>
        <Link to="/" className="btn-primary px-12 py-5 text-xl">
          Explorar Achadinhos
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-16 px-4">
      <header className="mb-16 text-center">
        <h1 className="text-5xl font-display font-bold text-slate-800 mb-4 italic tracking-tight uppercase tracking-[0.1em]">Sua Sacola de Mimos</h1>
        <p className="text-slate-400 font-medium italic text-lg opacity-70">Falta pouco para seus achadinhos chegarem na sua casa!</p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
        <div className="lg:col-span-2 space-y-6">
          {items.map((item) => (
            <motion.div 
              key={item.id}
              layout
              className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-pink-50 flex flex-col sm:flex-row items-center gap-8 group hover:shadow-md transition-all sm:pr-10"
            >
              <div className="w-32 h-32 rounded-[2rem] overflow-hidden border border-pink-50 flex-shrink-0 bg-slate-50 shadow-inner group-hover:scale-105 transition-transform">
                <img 
                  src={getDirectDriveUrl(item.imageUrl)} 
                  alt={item.name} 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover" 
                />
              </div>
              <div className="flex-grow text-center sm:text-left">
                <h3 className="text-2xl font-display font-bold text-slate-800 mb-2 italic line-clamp-1">{item.name}</h3>
                <p className="text-brand-accent font-bold text-xl mb-6">R$ {item.price.toFixed(2)}</p>
                
                <div className="flex items-center justify-center sm:justify-start gap-8">
                  <div className="flex items-center bg-brand-cream/40 p-1.5 rounded-2xl border border-pink-100/50 shadow-sm">
                    <button 
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-10 h-10 flex items-center justify-center bg-white rounded-xl text-brand-accent hover:bg-brand-accent hover:text-white transition-all shadow-sm active:scale-90"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-10 text-center font-bold text-slate-700 text-lg">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-10 h-10 flex items-center justify-center bg-white rounded-xl text-brand-accent hover:bg-brand-accent hover:text-white transition-all shadow-sm active:scale-90"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <button 
                    onClick={() => removeItem(item.id)}
                    className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                  >
                    <Trash2 size={22} />
                  </button>
                </div>
              </div>
              <div className="hidden sm:block text-right">
                <p className="text-[10px] text-slate-300 uppercase font-black tracking-[0.2em] mb-2 italic">Subtotal</p>
                <p className="font-bold text-slate-800 text-3xl tracking-tighter italic">R$ {(item.price * item.quantity).toFixed(2)}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white p-10 rounded-[3rem] shadow-xl shadow-pink-100/30 border border-pink-50 sticky top-36">
            <h2 className="text-2xl font-display font-bold text-slate-800 mb-10 italic border-b border-pink-50 pb-6">Resumo</h2>
            
            <div className="space-y-6 mb-10">
              <div className="flex justify-between font-medium text-slate-400">
                <span className="italic">Mercadorias</span>
                <span className="font-bold text-slate-600">R$ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium text-slate-400 italic">Frete Fixo</span>
                <span className="text-slate-800 font-bold">R$ {shipping.toFixed(2)}</span>
              </div>
              
              <div className="pt-8 border-t border-pink-50 flex flex-col gap-2">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] italic">Total Final</span>
                <div className="flex justify-between items-baseline">
                    <span className="text-5xl font-display font-bold text-slate-800 tracking-tighter">R$ {total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => navigate('/checkout')}
              className="w-full btn-primary py-6 text-xl shadow-pink-100 flex items-center justify-center gap-4"
            >
              Fechar Pedido <ArrowRight size={22} />
            </button>
            
            <p className="text-center mt-6 text-[10px] font-black text-slate-300 uppercase tracking-widest italic opacity-50">Pagamento 100% Seguro via Pix</p>
          </div>
        </div>
      </div>
    </div>
  );
}
