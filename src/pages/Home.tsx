import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getDirectDriveUrl } from '../lib/utils';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useCart } from '../lib/cartStore';
import { ShoppingBag, Heart, Search } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    setLoading(true);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsArr = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      console.log("Produtos carregados:", docsArr.length);
      setProducts(docsArr);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar produtos:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));

  if (loading) return (
    <div className="py-40 text-center flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-pink-100 border-t-pink-500 rounded-full animate-spin"></div>
      <p className="font-display text-xl text-slate-400 italic">Preparando mimos...</p>
    </div>
  );

  return (
    <div className="pb-20">
      <header className="py-20 sm:py-32 text-center px-4">
        <motion.div
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           className="bg-white/40 border border-pink-100/50 backdrop-blur-sm w-fit mx-auto px-6 py-2 rounded-full mb-10 text-[10px] font-black uppercase tracking-[0.3em] text-brand-accent flex items-center gap-2"
        >
           <span className="w-1.5 h-1.5 bg-brand-accent rounded-full animate-pulse"></span>
           Achadinhos da Semana
        </motion.div>
        <motion.h1 
          className="text-6xl sm:text-8xl font-display font-bold text-slate-800 mb-10 italic tracking-tight leading-[0.9]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Tudo para <br />
          <span className="text-brand-accent">o seu bebê.</span>
        </motion.h1>
        <motion.p 
          className="text-slate-400 max-w-xl mx-auto text-lg font-medium leading-relaxed italic"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Curadoria exclusiva de fraldas, roupinhas e acessórios <br className="hidden sm:block" /> selecionados com muito amor.
        </motion.p>
      </header>

      <div className="max-w-xl mx-auto mb-20 px-4">
        <div className="bg-white/70 backdrop-blur-md rounded-[2.5rem] p-2 border border-pink-50 shadow-sm shadow-pink-100/20 flex items-center gap-2 group transition-all focus-within:ring-2 focus-within:ring-pink-200">
            <div className="p-3 text-pink-300">
                <Search size={22} />
            </div>
            <input 
                type="text" 
                placeholder="Busque por produtos... 🔍"
                className="flex-grow bg-transparent border-none p-2 outline-none text-slate-700 italic font-medium placeholder:text-slate-300"
                value={filter}
                onChange={e => setFilter(e.target.value)}
            />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-12 px-4">
        {filteredProducts.map((product, index) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex flex-col group"
          >
            <Link to={`/product/${product.id}`} className="block relative aspect-[4/5] overflow-hidden bg-slate-50 mb-6 rounded-[2.5rem] border border-pink-50 transition-all group-hover:shadow-xl group-hover:shadow-pink-100/50">
              <img 
                src={getDirectDriveUrl(product.imageUrl)} 
                alt={product.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
              />
              <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-white/90 backdrop-blur-sm p-3 rounded-2xl shadow-lg text-brand-accent">
                    <Heart size={20} className="fill-brand-accent" />
                </div>
              </div>
            </Link>
            
            <div className="px-2">
              <Link to={`/product/${product.id}`} className="mb-2 block">
                 <h3 className="text-2xl font-display font-bold text-slate-800 italic group-hover:text-brand-accent transition-colors truncate">{product.name}</h3>
              </Link>
              <p className="text-slate-400 text-sm line-clamp-2 mb-6 font-medium leading-relaxed italic h-10">{product.description}</p>
              
              <div className="flex items-center justify-between pt-6 border-t border-pink-50">
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-300 line-through font-bold">R$ {(product.price * 1.3).toFixed(2)}</span>
                    <span className="text-2xl font-bold text-slate-800 tracking-tight">R$ {product.price.toFixed(2)}</span>
                </div>
                <button 
                  onClick={() => addItem(product)}
                  className="p-4 bg-brand-cream text-brand-accent rounded-2xl hover:bg-brand-accent hover:text-white transition-all shadow-sm active:scale-90"
                >
                    <ShoppingBag size={22} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      
      {filteredProducts.length === 0 && (
         <div className="py-20 text-center font-display text-2xl text-slate-300 italic">
            Nenhum achadinho encontrado para "{filter}"... 🍼
         </div>
      )}
    </div>
  );
}
