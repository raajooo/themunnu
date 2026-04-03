import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useCart } from "../hooks/useCart";
import { User, Address } from "../types";
import { formatCurrency } from "../lib/utils";
import { collection, addDoc, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "react-hot-toast";
import { motion } from "motion/react";
import { CreditCard, Truck, MapPin, CheckCircle2, ArrowLeft, Loader2 } from "lucide-react";

interface CheckoutProps {
  user: User | null;
}

export default function Checkout({ user }: CheckoutProps) {
  const { items, totalPrice, clearCart } = useCart();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'cod'>('razorpay');
  const [isCodEnabled, setIsCodEnabled] = useState(true);
  
  const [address, setAddress] = useState<Address>({
    id: Date.now().toString(),
    name: "",
    phone: "",
    pincode: "",
    address: "",
    city: "",
    state: ""
  });

  const [showSavedAddresses, setShowSavedAddresses] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const settingsSnap = await getDoc(doc(db, "settings", "global"));
      if (settingsSnap.exists()) {
        setIsCodEnabled(settingsSnap.data().isCodEnabled ?? true);
      }
    };
    fetchSettings();

    if (user?.addresses?.length) {
      setAddress(user.addresses[0]);
    }
  }, [user]);

  if (!user) return <Navigate to="/login" />;
  if (items.length === 0) return <Navigate to="/shop" />;

  const handlePlaceOrder = async () => {
    if (!address.name || !address.phone || !address.address || !address.pincode) {
      toast.error("Please fill in all address fields");
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        userId: user.uid,
        items,
        totalAmount: totalPrice,
        paymentMethod,
        paymentStatus: paymentMethod === 'cod' ? 'pending' : 'paid', // Simplified for now
        orderStatus: 'pending',
        address,
        createdAt: new Date().toISOString(),
      };

      const orderRef = await addDoc(collection(db, "orders"), orderData);
      
      toast.success("Order placed successfully!");
      clearCart();
      navigate(`/track/${orderRef.id}`);
    } catch (error) {
      console.error("Order error:", error);
      toast.error("Failed to place order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <button onClick={() => navigate("/cart")} className="flex items-center text-xs font-bold uppercase tracking-widest mb-8 hover:opacity-70 transition-opacity">
        <ArrowLeft size={16} className="mr-2" /> Back to Bag
      </button>

      <h1 className="text-5xl font-black tracking-tighter uppercase mb-12">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
        <div className="lg:col-span-2 space-y-12">
          {/* Shipping Address */}
          <section>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center font-black">1</div>
                <h2 className="text-2xl font-black tracking-tighter uppercase">Shipping Address</h2>
              </div>
              {user.addresses?.length > 0 && (
                <button 
                  onClick={() => setShowSavedAddresses(!showSavedAddresses)}
                  className="text-xs font-black uppercase tracking-widest underline underline-offset-4"
                >
                  {showSavedAddresses ? "Enter New" : "Use Saved"}
                </button>
              )}
            </div>
            
            {showSavedAddresses && user.addresses?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {user.addresses?.map(addr => (
                  <button 
                    key={addr.id}
                    onClick={() => {
                      setAddress(addr);
                      setShowSavedAddresses(false);
                    }}
                    className={`p-6 text-left rounded-3xl border-2 transition-all ${address.id === addr.id ? 'border-black dark:border-white bg-black/5 dark:bg-white/5' : 'border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950'}`}
                  >
                    <h4 className="font-bold uppercase tracking-tight mb-1">{addr.name}</h4>
                    <p className="text-xs text-gray-500 leading-relaxed truncate">
                      {addr.address}, {addr.city}
                    </p>
                    <p className="text-[10px] font-bold mt-2 text-gray-400">{addr.phone}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-900 rounded-[2.5rem]">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Full Name</label>
                  <input 
                    type="text" 
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                    value={address.name}
                    onChange={(e) => setAddress({...address, name: e.target.value, id: Date.now().toString()})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Phone Number</label>
                  <input 
                    type="tel" 
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                    value={address.phone}
                    onChange={(e) => setAddress({...address, phone: e.target.value, id: Date.now().toString()})}
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Full Address</label>
                  <textarea 
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold min-h-[100px]"
                    value={address.address}
                    onChange={(e) => setAddress({...address, address: e.target.value, id: Date.now().toString()})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">City</label>
                  <input 
                    type="text" 
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                    value={address.city}
                    onChange={(e) => setAddress({...address, city: e.target.value, id: Date.now().toString()})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pincode</label>
                  <input 
                    type="text" 
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                    value={address.pincode}
                    onChange={(e) => setAddress({...address, pincode: e.target.value, id: Date.now().toString()})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">State</label>
                  <input 
                    type="text" 
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                    value={address.state}
                    onChange={(e) => setAddress({...address, state: e.target.value, id: Date.now().toString()})}
                  />
                </div>
              </div>
            )}
          </section>

          {/* Payment Method */}
          <section>
            <div className="flex items-center space-x-4 mb-8">
              <div className="w-10 h-10 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center font-black">2</div>
              <h2 className="text-2xl font-black tracking-tighter uppercase">Payment Method</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button 
                onClick={() => setPaymentMethod('razorpay')}
                className={`p-8 rounded-[2.5rem] border-2 text-left transition-all flex flex-col justify-between h-48 ${paymentMethod === 'razorpay' ? 'border-black dark:border-white bg-black dark:bg-white text-white dark:text-black' : 'border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950'}`}
              >
                <CreditCard size={32} />
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Online Payment</h3>
                  <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${paymentMethod === 'razorpay' ? 'opacity-70' : 'text-gray-400'}`}>Razorpay / UPI / Cards</p>
                </div>
              </button>

              {isCodEnabled && (
                <button 
                  onClick={() => setPaymentMethod('cod')}
                  className={`p-8 rounded-[2.5rem] border-2 text-left transition-all flex flex-col justify-between h-48 ${paymentMethod === 'cod' ? 'border-black dark:border-white bg-black dark:bg-white text-white dark:text-black' : 'border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950'}`}
                >
                  <Truck size={32} />
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Cash on Delivery</h3>
                    <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${paymentMethod === 'cod' ? 'opacity-70' : 'text-gray-400'}`}>Pay when you receive</p>
                  </div>
                </button>
              )}
            </div>
          </section>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 dark:bg-gray-950 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-900 sticky top-24">
            <h2 className="text-2xl font-black tracking-tighter uppercase mb-8">Order Summary</h2>
            
            <div className="space-y-6 mb-8 max-h-60 overflow-y-auto pr-2">
              {items.map(item => (
                <div key={`${item.productId}-${item.size}`} className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-900 flex-shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <h4 className="text-sm font-bold truncate uppercase">{item.name}</h4>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Qty: {item.quantity} • Size: {item.size}</p>
                  </div>
                  <span className="text-sm font-black">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-4 mb-8 pt-6 border-t border-gray-200 dark:border-gray-800">
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
              onClick={handlePlaceOrder}
              disabled={loading}
              className="w-full py-5 bg-black dark:bg-white text-white dark:text-black font-black text-sm uppercase tracking-[0.2em] rounded-full hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Place Order"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
