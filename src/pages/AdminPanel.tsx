import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getDirectDriveUrl } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Edit, Trash2, X, Package, DollarSign, Image as ImageIcon, FileText } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
}

export default function AdminPanel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    imageUrl: '',
    price: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        name: formData.name,
        description: formData.description,
        imageUrl: formData.imageUrl,
        price: parseFloat(formData.price),
        updatedAt: serverTimestamp()
      };

      if (isEditing && currentProduct) {
        await updateDoc(doc(db, 'products', currentProduct.id), data);
      } else {
        await addDoc(collection(db, 'products'), { ...data, createdAt: serverTimestamp() });
      }

      setFormData({ name: '', description: '', imageUrl: '', price: '' });
      setIsEditing(false);
      setCurrentProduct(null);
    } catch (error) {
      console.error("Error saving product:", error);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (product: Product) => {
    setIsEditing(true);
    setCurrentProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      imageUrl: product.imageUrl,
      price: product.price.toString()
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja apagar este produto?')) {
      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (error) {
        console.error("Error deleting product:", error);
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <div className="flex items-center justify-between mb-12">
        <h1 className="text-4xl font-display font-bold text-slate-800 flex items-center gap-4 italic uppercase tracking-tight">
          <Package className="text-brand-accent/50" size={32} /> Central de Mimos
        </h1>
        {isEditing && (
          <button 
            onClick={() => {
              setIsEditing(false);
              setFormData({ name: '', description: '', imageUrl: '', price: '' });
            }}
            className="flex items-center gap-2 text-slate-400 hover:text-red-500 font-bold transition-colors text-sm italic"
          >
            <X size={20} /> Cancelar Mimo
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-1">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-sm shadow-pink-50 border border-pink-50 sticky top-36">
            <h2 className="text-2xl font-display font-bold text-slate-800 mb-8 italic">
              {isEditing ? 'Editar Achadinho' : 'Novo Achadinho'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <Package size={12} /> Nome do Produto
                </label>
                <input 
                  required
                  className="input-warm" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <FileText size={12} /> Descrição
                </label>
                <textarea 
                  required
                  rows={4}
                  className="input-warm resize-none" 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <ImageIcon size={12} /> Link compartilhado do Drive
                </label>
                <input 
                  required
                  placeholder="Cole o link aqui..."
                  className="input-warm" 
                  value={formData.imageUrl}
                  onChange={e => setFormData({...formData, imageUrl: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <DollarSign size={12} /> Valor (R$)
                </label>
                <input 
                  required
                  type="number"
                  step="0.01"
                  className="input-warm font-bold text-xl text-brand-accent italic" 
                  value={formData.price}
                  onChange={e => setFormData({...formData, price: e.target.value})}
                />
              </div>
              <button 
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-5 text-lg shadow-pink-100"
              >
                {loading ? 'Preparando...' : isEditing ? 'Salvar Edição' : 'Publicar Achadinho'}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between px-4">
             <h2 className="text-[10px] font-black text-pink-300 uppercase tracking-[0.3em] italic">Estoque Atual ({products.length} itens)</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatePresence>
              {products.map(product => (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white p-2 rounded-[2rem] shadow-sm border border-pink-50 flex flex-col group hover:shadow-md transition-all overflow-hidden"
                >
                  <div className="relative aspect-video rounded-[1.5rem] overflow-hidden mb-4 bg-slate-50 border border-slate-100">
                    <img src={getDirectDriveUrl(product.imageUrl)} alt={product.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  </div>
                  
                  <div className="px-4 pb-4">
                    <h3 className="font-display font-bold text-xl text-slate-800 line-clamp-1 mb-1 italic">{product.name}</h3>
                    <p className="text-brand-accent font-bold text-base mb-6">R$ {product.price.toFixed(2)}</p>
                    
                    <div className="flex gap-3">
                        <button 
                        onClick={() => startEdit(product)}
                        className="flex-grow py-3 bg-pink-50 text-brand-accent hover:bg-brand-accent hover:text-white rounded-xl transition-all font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                        <Edit size={14} /> Editar
                        </button>
                        <button 
                        onClick={() => handleDelete(product.id)}
                        className="p-3 bg-slate-50 text-slate-300 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all"
                        >
                        <Trash2 size={16} />
                        </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
