import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getDirectDriveUrl } from '../lib/utils';
import { motion } from 'motion/react';
import { useCart } from '../lib/cartStore';
import { ShoppingBag, ChevronLeft, ShieldCheck, Truck, RotateCcw, Heart, Plus, Minus } from 'lucide-react';

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();

  useEffect(() => {
    async function fetchProduct() {
      if (!id) return;
      const docRef = doc(db, 'products', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProduct({ id: docSnap.id, ...docSnap.data() });
      }
      setLoading(false);
    }
    fetchProduct();
  }, [id]);

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) {
        addItem(product);
    }
  };

  if (loading) return (
    <div className="py-40 text-center flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-pink-100 border-t-pink-500 rounded-full animate-spin"></div>
      <p className="font-display text-xl text-slate-400 italic">Olhando esse achadinho...</p>
    </div>
  );
  
  if (!product) return (
    <div className="py-40 text-center">
        <h2 className="text-4xl font-display font-bold text-slate-800 italic">Achadinho perdido... 🍼</h2>
        <button onClick={() => navigate('/')} className="mt-8 btn-primary px-10 py-4">Voltar ao Início</button>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto py-16 px-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
        <motion.div
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           className="relative group"
        >
          <div className="absolute inset-0 bg-brand-cream/30 rounded-[3rem] -rotate-3 group-hover:rotate-0 transition-transform duration-500"></div>
          <div className="relative aspect-[4/5] rounded-[3rem] overflow-hidden border-2 border-white shadow-xl shadow-pink-100/50">
            <img 
              src={getDirectDriveUrl(product.imageUrl)} 
              alt={product.name} 
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out" 
            />
          </div>
        </motion.div>

        <div className="flex flex-col h-full">
           <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-10"
           >
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-pink-300 mb-6 italic">
                <ShieldCheck size={14} /> Achadinho Especial
              </div>
              <h1 className="text-5xl sm:text-7xl font-display font-bold text-slate-800 mb-6 italic tracking-tight leading-[0.9]">{product.name}</h1>
              <div className="flex items-baseline gap-4 mb-4">
                <span className="text-4xl font-bold text-brand-accent tracking-tighter italic">R$ {product.price.toFixed(2)}</span>
                <span className="text-sm text-slate-300 line-through font-bold">R$ {(product.price * 1.3).toFixed(2)}</span>
              </div>
              <div className="bg-brand-blue/10 border border-brand-blue/20 w-fit px-6 py-3 rounded-[1.5rem] flex items-center gap-3">
                 <div className="w-1.5 h-1.5 bg-brand-blue rounded-full animate-pulse"></div>
                 <span className="text-brand-blue font-bold text-[10px] uppercase tracking-widest italic leading-none">
                    Entrega em todo o Brasil por apenas R$ 39,80
                 </span>
              </div>
           </motion.div>

           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.1 }}
             className="bg-white p-10 rounded-[3rem] shadow-sm border border-pink-50 mb-10 flex-grow"
           >
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 mb-4 italic">Descrição do Produto</h4>
              <p className="text-slate-500 text-lg leading-relaxed font-medium italic opacity-80 whitespace-pre-line">{product.description}</p>
           </motion.div>

           <motion.div
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.2 }}
             className="mt-auto space-y-6"
           >
              <div className="flex items-center flex-wrap gap-6">
                <div className="flex items-center bg-brand-cream/50 p-2 rounded-2xl border border-pink-50 shadow-sm">
                   <button 
                     onClick={() => setQuantity(q => Math.max(1, q - 1))}
                     className="w-12 h-12 flex items-center justify-center bg-white rounded-xl text-brand-accent hover:bg-brand-accent hover:text-white transition-all shadow-sm active:scale-90"
                   >
                     <Minus size={18} />
                   </button>
                   <span className="w-12 text-center font-bold text-slate-800 text-xl">{quantity}</span>
                   <button 
                     onClick={() => setQuantity(q => q + 1)}
                     className="w-12 h-12 flex items-center justify-center bg-white rounded-xl text-brand-accent hover:bg-brand-accent hover:text-white transition-all shadow-sm active:scale-90"
                   >
                     <Plus size={18} />
                   </button>
                </div>
                <button 
                  onClick={handleAddToCart}
                  className="flex-grow btn-primary py-6 text-xl flex items-center justify-center gap-4 group min-w-[200px]"
                >
                  <ShoppingBag size={24} className="group-hover:animate-bounce" /> 
                  Colocar na Sacola
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-4 border-t border-pink-50 pt-8 mt-10">
                <div className="flex flex-col items-center text-center gap-2 opacity-60">
                    <Truck className="text-pink-200" size={24} />
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">Envio Rápido</span>
                </div>
                <div className="flex flex-col items-center text-center gap-2 border-x border-pink-50 px-2 opacity-60">
                    <ShieldCheck className="text-pink-200" size={24} />
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">100% Seguro</span>
                </div>
                <div className="flex flex-col items-center text-center gap-2 opacity-60">
                    <RotateCcw className="text-pink-200" size={24} />
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">Troca Grátis</span>
                </div>
              </div>

              <p className="text-center text-[10px] font-black text-slate-300 uppercase tracking-widest italic flex items-center justify-center gap-2 opacity-50">
                <Heart size={10} className="fill-brand-accent text-brand-accent" /> Escolhido com Amor para Você
              </p>
           </motion.div>
        </div>
      </div>
    </div>
  );
}
