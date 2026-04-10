import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { useCart } from "../hooks/useCart";
import { formatCurrency } from "../lib/utils";
import { Trash2, Plus, Minus, ArrowRight, ShoppingBag, Tag, X, Loader2, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import React, { useState, useEffect } from "react";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Coupon, Settings, User } from "../types";
import { toast } from "react-hot-toast";
import ConfirmModal from "../components/ConfirmModal";

export default function Cart() {
  const { items, removeFromCart, updateQuantity, totalPrice, totalItems } = useCart();
  const navigate = useNavigate();
  const { user } = useOutletContext<{ user: User | null }>();
  
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [itemToRemove, setItemToRemove] = useState<{productId: string, size: string} | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      const snap = await getDoc(doc(db, "settings", "global"));
      if (snap.exists()) setSettings(snap.data() as Settings);
    };
    fetchSettings();
  }, []);

  // Re-validate coupon when total price changes
  useEffect(() => {
    if (appliedCoupon) {
      if (totalPrice < appliedCoupon.minOrderAmount) {
        setAppliedCoupon(null);
        setCouponError(`Coupon removed: Minimum order amount is ${formatCurrency(appliedCoupon.minOrderAmount)}`);
        toast.error(`Minimum order amount for ${appliedCoupon.code} is ${formatCurrency(appliedCoupon.minOrderAmount)}`);
      }
    }
  }, [totalPrice, appliedCoupon]);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    if (code.length < 5) {
      toast.error("Coupon code must be at least 5 characters long");
      return;
    }
    
    setIsApplying(true);
    setCouponError(null);
    try {
      const docRef = doc(db, "coupons", code);
      const snap = await getDoc(docRef);
      
      if (!snap.exists()) {
        setCouponError("Invalid coupon code");
        toast.error("Invalid coupon code");
        return;
      }
      
      const coupon = { id: snap.id, ...snap.data() } as Coupon;
      
      if (!coupon.isActive) {
        setCouponError("This coupon is no longer active");
        toast.error("This coupon is no longer active");
        return;
      }
      
      if (totalPrice < coupon.minOrderAmount) {
        setCouponError(`Minimum order amount is ${formatCurrency(coupon.minOrderAmount)}`);
        toast.error(`Minimum order amount for this coupon is ${formatCurrency(coupon.minOrderAmount)}`);
        return;
      }
      
      if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
        setCouponError("This coupon has expired");
        toast.error("This coupon has expired");
        return;
      }

      // Check Max Usage Per User
      if (coupon.maxUsagePerUser && user) {
        const usageRef = doc(db, "coupon_usage", `${user.uid}_${coupon.code}`);
        const usageSnap = await getDoc(usageRef);
        if (usageSnap.exists()) {
          const usageData = usageSnap.data();
          if (usageData.count >= coupon.maxUsagePerUser) {
            setCouponError(`You have already used this coupon ${coupon.maxUsagePerUser} time(s)`);
            toast.error(`You have reached the maximum usage limit for this coupon`);
            return;
          }
        }
      }
      
      setAppliedCoupon(coupon);
      setCouponError(null);
      toast.success("Coupon applied successfully!");
    } catch (error) {
      toast.error("Failed to apply coupon");
    } finally {
      setIsApplying(false);
    }
  };

  const calculateDiscount = () => {
    if (!appliedCoupon) return 0;
    
    let discount = 0;
    if (appliedCoupon.discountType === 'percentage') {
      discount = (totalPrice * appliedCoupon.discountValue) / 100;
      if (appliedCoupon.maxDiscountAmount && discount > appliedCoupon.maxDiscountAmount) {
        discount = appliedCoupon.maxDiscountAmount;
      }
    } else {
      discount = appliedCoupon.discountValue;
    }
    
    return Math.min(discount, totalPrice);
  };

  const discountAmount = calculateDiscount();
  const finalTotal = totalPrice - discountAmount;

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
                      onClick={() => setItemToRemove({ productId: item.productId, size: item.size })}
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
              
              {appliedCoupon && (
                <div className="flex justify-between text-sm font-bold text-green-500 uppercase tracking-widest">
                  <div className="flex items-center">
                    <Tag size={12} className="mr-1" />
                    <span>Discount ({appliedCoupon.code})</span>
                  </div>
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm font-bold text-gray-500 uppercase tracking-widest">
                <span>Shipping</span>
                <span className="text-green-500">FREE</span>
              </div>
              <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center">
                <span className="text-lg font-black uppercase tracking-tighter">Total</span>
                <span className="text-3xl font-black">{formatCurrency(finalTotal)}</span>
              </div>
            </div>

            {/* Coupon Input */}
            {settings?.isCouponSystemEnabled && (
              <div className="mb-8">
                {!appliedCoupon ? (
                  <form onSubmit={handleApplyCoupon}>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="COUPON CODE"
                        value={couponCode}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                          setCouponCode(value);
                        }}
                        className={`w-full pl-10 pr-14 py-4 bg-white dark:bg-black rounded-2xl text-xs font-black uppercase tracking-widest focus:outline-none border ${couponError ? 'border-red-500' : 'border-gray-100 dark:border-gray-800'}`}
                      />
                      <Tag className={`absolute left-4 top-1/2 -translate-y-1/2 ${couponError ? 'text-red-500' : 'text-gray-400'}`} size={16} />
                      <button
                        type="submit"
                        disabled={isApplying || !couponCode.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                      >
                        {isApplying ? <Loader2 className="animate-spin" size={12} /> : "Apply"}
                      </button>
                    </div>
                    {couponError && (
                      <p className="text-[10px] font-bold text-red-500 mt-2 ml-4 uppercase tracking-widest">{couponError}</p>
                    )}
                  </form>
                ) : (
                  <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-[2rem] border border-green-100 dark:border-green-900/30">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-green-500 text-white rounded-lg">
                          <Tag size={14} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-green-600">Active Coupon</p>
                          <p className="text-sm font-black uppercase tracking-widest">{appliedCoupon.code}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => {
                            setAppliedCoupon(null);
                            setCouponCode("");
                            setCouponError(null);
                          }}
                          className="p-2 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-full transition-colors text-green-600"
                          title="Remove Coupon"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-2 pt-4 border-t border-green-100 dark:border-green-900/30">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-green-700">
                        <span>Discount Value</span>
                        <span>{appliedCoupon.discountType === 'percentage' ? `${appliedCoupon.discountValue}%` : formatCurrency(appliedCoupon.discountValue)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-black uppercase tracking-widest text-green-800">
                        <span>Total Savings</span>
                        <span>{formatCurrency(discountAmount)}</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        setAppliedCoupon(null);
                        setCouponCode("");
                        setCouponError(null);
                      }}
                      className="w-full mt-4 py-3 bg-green-500/10 hover:bg-green-500/20 text-green-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center"
                    >
                      <RefreshCw size={12} className="mr-2" /> Change Coupon
                    </button>
                  </div>
                )}
              </div>
            )}

            <button 
              onClick={() => navigate("/checkout", { state: { coupon: appliedCoupon, discount: discountAmount } })}
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

      <ConfirmModal
        isOpen={!!itemToRemove}
        onClose={() => setItemToRemove(null)}
        onConfirm={() => {
          if (itemToRemove) {
            removeFromCart(itemToRemove.productId, itemToRemove.size);
            setItemToRemove(null);
            toast.success("Item removed from cart");
          }
        }}
        title="Remove Item"
        message="Are you sure you want to remove this item from your cart?"
        confirmText="Remove"
      />
    </div>
  );
}
