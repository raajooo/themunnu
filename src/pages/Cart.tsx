import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../hooks/useCart";
import { formatCurrency } from "../lib/utils";
import { Trash2, Plus, Minus, ArrowRight, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function Cart() {
  const { items, removeFromCart, updateQuantity, totalPrice, totalItems } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-32 text-center">
        <div className="flex justify-center mb-8 text-gray-200">
          <ShoppingBag size={120} strokeWidth={1} />
        </div>
        <h2 className="text-4xl font-black tracking-tighter uppercase mb-4">Your cart is empty</h2>
        <p className="text-gray-500 mb-10 max-w-md mx-auto">Looks like you haven't added any sneakers to your cart yet. Explore our latest drops and find your perfect pair.</p>
        <Link to="/shop" className="px-10 py-4 bg-black dark:bg-white text-white dark:text-black font-black text-sm uppercase tracking-widest rounded-full hover:opacity-90 transition-opacity">
          Explore Shop
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-5xl font-black tracking-tighter uppercase mb-12">Your Bag ({totalItems})</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-8">
          <AnimatePresence>
            {items.map((item) => (
              <motion.div 
                key={`${item.productId}-${item.size}`}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-8 p-6 bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-900 rounded-3xl"
              >
                <div className="w-full sm:w-32 aspect-square rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-900">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                
                <div className="flex-grow">
                  <h3 className="text-xl font-black uppercase tracking-tight mb-1">{item.name}</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Size: {item.size}</p>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center bg-gray-50 dark:bg-gray-900 rounded-full px-4 py-2">
                      <button 
                        onClick={() => updateQuantity(item.productId, item.size, item.quantity - 1)}
                        className="p-1 hover:text-black dark:hover:text-white transition-colors"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="mx-4 font-black text-sm">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.productId, item.size, item.quantity + 1)}
                        className="p-1 hover:text-black dark:hover:text-white transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <button 
                      onClick={() => removeFromCart(item.productId, item.size)}
                      className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                <div className="text-right w-full sm:w-auto">
                  <p className="text-2xl font-black">{formatCurrency(item.price * item.quantity)}</p>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{formatCurrency(item.price)} each</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 dark:bg-gray-950 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-900 sticky top-24">
            <h2 className="text-2xl font-black tracking-tighter uppercase mb-8">Summary</h2>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between text-sm font-bold text-gray-500 uppercase tracking-widest">
                <span>Subtotal</span>
                <span>{formatCurrency(totalPrice)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-gray-500 uppercase tracking-widest">
                <span>Shipping</span>
                <span className="text-green-500">FREE</span>
              </div>
              <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center">
                <span className="text-lg font-black uppercase tracking-tighter">Total</span>
                <span className="text-3xl font-black">{formatCurrency(totalPrice)}</span>
              </div>
            </div>

            <button 
              onClick={() => navigate("/checkout")}
              className="w-full py-5 bg-black dark:bg-white text-white dark:text-black font-black text-sm uppercase tracking-[0.2em] rounded-full hover:opacity-90 transition-opacity flex items-center justify-center"
            >
              Checkout <ArrowRight className="ml-2" size={18} />
            </button>
            
            <div className="mt-8 space-y-4">
              <div className="flex items-center space-x-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span>Secure Checkout</span>
              </div>
              <div className="flex items-center space-x-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span>Free Shipping & Returns</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
