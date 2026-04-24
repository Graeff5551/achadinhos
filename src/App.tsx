import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut, signInWithPopup, signInWithEmailLink } from 'firebase/auth';
import { auth, googleProvider } from './lib/firebase';
import { CartProvider, useCart } from './lib/cartStore';
import { ShoppingCart, User, Package, LogOut, Trash2, Edit, Plus, Info, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Components
import Home from './pages/Home';
import ProductDetails from './pages/ProductDetails';
import CartPage from './pages/CartPage';
import Checkout from './pages/Checkout';
import AdminPanel from './pages/AdminPanel';
import Login from './pages/Login';

const AdminEmail = 'pauloverifica@gmail.com';

function FreeShippingBar() {
  return (
    <div className="bg-brand-accent text-white text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] py-2.5 text-center sticky top-0 z-[60] shadow-md italic">
      🍯 Entrega em todo o Brasil por apenas R$ 39,80! 🧸
    </div>
  );
}

function Navbar() {
  const { items } = useCart();
  const [user, setUser] = useState(auth.currentUser);
  const navigate = useNavigate();

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  const cartCount = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <>
      <FreeShippingBar />
      <nav className="h-20 bg-white/80 backdrop-blur-md border-b border-pink-100/50 px-6 sm:px-8 flex items-center justify-between sticky top-[28px] sm:top-[32px] z-50 shrink-0">
      <div className="flex items-center gap-4">
        {window.location.pathname !== '/' && (
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-pink-50 rounded-full transition-all text-pink-400 active:scale-95"
            title="Voltar"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        <Link to="/" className="flex items-center gap-3">
          <div className="w-11 h-11 bg-pink-100 rounded-2xl flex items-center justify-center text-pink-600 font-bold text-2xl shadow-sm italic font-display">A</div>
          <span className="text-2xl font-bold tracking-tight text-slate-800 font-display italic hidden sm:block">Achadinhos Baby</span>
        </Link>
      </div>
      
      <div className="flex items-center gap-4 sm:gap-6">
        {user && (
          <div className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-pink-50 rounded-full border border-pink-100/50">
            <div className="w-2 h-2 bg-pink-400 rounded-full animate-pulse"></div>
            <span className="text-xs font-semibold text-pink-600/70">{user.email}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-slate-500">
          {user?.email === AdminEmail && (
            <Link to="/admin" className="p-2.5 hover:text-pink-500 hover:bg-pink-50 rounded-xl transition-all">
              <Package size={22} />
            </Link>
          )}
          
          <Link to="/cart" className="relative p-2.5 hover:text-pink-500 hover:bg-pink-50 rounded-xl transition-all">
            <ShoppingCart size={22} />
            {cartCount > 0 && (
              <span className="absolute top-1 right-1 bg-brand-accent text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full shadow-lg shadow-pink-200 font-bold">
                {cartCount}
              </span>
            )}
          </Link>
          
          {user && (
            <button 
              onClick={() => signOut(auth)}
              className="p-2.5 hover:text-red-400 hover:bg-red-50 rounded-xl transition-all"
            >
              <LogOut size={22} />
            </button>
          )}
        </div>
      </div>
    </nav>
    </>
  );
}

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const [user, setUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(!auth.currentUser);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && user.email !== AdminEmail) return <Navigate to="/" />;

  return <>{children}</>;
}

export default function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50 font-sans">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="*" element={
                <ProtectedRoute>
                  <Navbar />
                  <main className="max-w-7xl mx-auto p-4">
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/product/:id" element={<ProductDetails />} />
                      <Route path="/cart" element={<CartPage />} />
                      <Route path="/checkout" element={<Checkout />} />
                      <Route 
                        path="/admin" 
                        element={
                          <ProtectedRoute adminOnly>
                            <AdminPanel />
                          </ProtectedRoute>
                        } 
                      />
                    </Routes>
                  </main>
                </ProtectedRoute>
              } />
            </Routes>
          </AnimatePresence>
        </div>
      </BrowserRouter>
    </CartProvider>
  );
}
