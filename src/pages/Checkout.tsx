import { useState, useEffect } from "react";
import { useNavigate, Navigate, useLocation } from "react-router-dom";
import { useCart } from "../hooks/useCart";
import { User, Address, OrderItem, Coupon } from "../types";
import { formatCurrency } from "../lib/utils";
import { collection, addDoc, doc, updateDoc, getDoc, increment, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";
import { CreditCard, Truck, MapPin, CheckCircle2, ArrowLeft, Loader2, XCircle, Home, Tag, Calendar } from "lucide-react";
import { lookupPincode } from "../lib/pincode";
import ConfirmModal from "../components/ConfirmModal";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface CheckoutProps {
  user: User | null;
}

export default function Checkout({ user }: CheckoutProps) {
  const { items: cartItems, totalPrice: cartTotalPrice, clearCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'cod'>('razorpay');
  const [isCodEnabled, setIsCodEnabled] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [countdown, setCountdown] = useState(5);
  const [isCodModalOpen, setIsCodModalOpen] = useState(false);

  const calculateEstimatedDelivery = (minDays: number, maxDays: number) => {
    const addBusinessDays = (date: Date, days: number) => {
      const result = new Date(date);
      let added = 0;
      while (added < days) {
        result.setDate(result.getDate() + 1);
        if (result.getDay() !== 0 && result.getDay() !== 6) {
          added++;
        }
      }
      return result;
    };

    const now = new Date();
    const minDate = addBusinessDays(now, minDays);
    const maxDate = addBusinessDays(now, maxDays);

    return {
      min: minDate.toISOString(),
      max: maxDate.toISOString(),
      formatted: `${minDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${maxDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
    };
  };

  // Handle direct purchase (Buy Now)
  const directPurchase = location.state?.directPurchase as OrderItem | undefined;
  const items = directPurchase ? [directPurchase] : cartItems;
  const totalPrice = directPurchase ? directPurchase.price * directPurchase.quantity : cartTotalPrice;
  
  // Handle Coupon
  const coupon = location.state?.coupon as Coupon | undefined;
  const discountAmount = location.state?.discount as number || 0;
  const finalTotal = totalPrice - discountAmount;
  
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
      setShowSavedAddresses(true);
    } else if (user) {
      setAddress(prev => ({
        ...prev,
        name: user.displayName || "",
        phone: user.phoneNumber || ""
      }));
      setShowSavedAddresses(false);
    }
  }, [user]);

  if (!user) return <Navigate to="/login" />;
  if (items.length === 0) return <Navigate to="/shop" />;

  const handlePincodeChange = async (pincode: string) => {
    setAddress(prev => ({ ...prev, pincode, id: Date.now().toString() }));
    if (pincode.length === 6) {
      const data = await lookupPincode(pincode);
      if (data) {
        setAddress(prev => ({
          ...prev,
          city: data.city,
          state: data.state
        }));
      }
    }
  };

  const handlePlaceOrder = async () => {
    // Validation
    if (!address.name?.trim()) return toast.error("Name is required");
    if (!address.phone?.trim()) return toast.error("Phone number is required");
    if (!/^\d{10}$/.test(address.phone.trim())) return toast.error("Phone number must be 10 digits");
    if (!address.address?.trim()) return toast.error("Address is required");
    if (!address.city?.trim()) return toast.error("City is required");
    if (!address.state?.trim()) return toast.error("State is required");
    if (!address.pincode?.trim()) return toast.error("Pincode is required");
    if (!/^\d{6}$/.test(address.pincode.trim())) return toast.error("Pincode must be 6 digits");

    if (paymentMethod === 'cod') {
      setIsCodModalOpen(true);
      return;
    }

    await processOrder();
  };

  const processOrder = async () => {
    setLoading(true);
    try {
      if (paymentMethod === 'razorpay') {
        // 1. Create Razorpay Order on server
        const orderRes = await fetch("/api/payment/create-razorpay-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: finalTotal, receipt: `order_${Date.now()}` })
        });
        const orderData = await orderRes.json();

        if (!orderRes.ok) throw new Error(orderData.error || "Failed to create payment order");

        // 2. Open Razorpay Checkout
        const options = {
          key: "rzp_live_SZP0qjeVAeHesZ", // Provided by user
          amount: orderData.order.amount,
          currency: orderData.order.currency,
          name: "The Munnu",
          description: "Sneaker Purchase",
          order_id: orderData.order.id,
          handler: async (response: any) => {
            try {
              // 3. Verify payment on server
              const verifyRes = await fetch("/api/payment/verify-razorpay-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature
                })
              });
              const verifyData = await verifyRes.json();

              if (verifyRes.ok && verifyData.success) {
                // 4. Save order to Firestore
                const estDelivery = calculateEstimatedDelivery(5, 7);
                const finalOrderData = {
                  userId: user.uid,
                  items,
                  totalAmount: finalTotal,
                  discountAmount,
                  couponCode: coupon?.code || null,
                  paymentMethod: 'razorpay',
                  paymentStatus: 'paid',
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  orderStatus: 'pending',
                  address,
                  deliveryEstimate: estDelivery.formatted,
                  estimatedDelivery: estDelivery,
                  createdAt: new Date().toISOString(),
                };

                await addDoc(collection(db, "orders"), finalOrderData);
                
                // Update Coupon Stats
                if (coupon) {
                  await updateDoc(doc(db, "coupons", coupon.id), {
                    usageCount: increment(1),
                    totalDiscountGenerated: increment(discountAmount)
                  });

                  // Update User Specific Usage
                  const usageRef = doc(db, "coupon_usage", `${user.uid}_${coupon.code}`);
                  const usageSnap = await getDoc(usageRef);
                  if (usageSnap.exists()) {
                    await updateDoc(usageRef, { count: increment(1) });
                  } else {
                    await setDoc(usageRef, { 
                      userId: user.uid, 
                      couponCode: coupon.code, 
                      count: 1,
                      lastUsed: new Date().toISOString()
                    });
                  }
                }
                
                if (!directPurchase) clearCart();
                setPaymentStatus('success');
                
                // Start countdown for redirect
                let count = 5;
                const timer = setInterval(() => {
                  count -= 1;
                  setCountdown(count);
                  if (count === 0) {
                    clearInterval(timer);
                    navigate("/");
                  }
                }, 1000);
              } else {
                setPaymentStatus('failed');
              }
            } catch (error) {
              console.error("Verification error:", error);
              setPaymentStatus('failed');
            }
          },
          prefill: {
            name: address.name,
            contact: address.phone,
            email: user.email || ""
          },
          theme: {
            color: "#000000"
          },
          modal: {
            ondismiss: () => {
              setLoading(false);
              toast.error("Payment cancelled");
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response: any) {
          console.error("Payment failed:", response.error);
          setPaymentStatus('failed');
        });
        rzp.open();
      } else {
        // Cash on Delivery
        const estDelivery = calculateEstimatedDelivery(5, 7);
        const orderData = {
          userId: user.uid,
          items,
          totalAmount: finalTotal,
          discountAmount,
          couponCode: coupon?.code || null,
          paymentMethod: 'cod',
          paymentStatus: 'pending',
          orderStatus: 'pending',
          address,
          deliveryEstimate: estDelivery.formatted,
          estimatedDelivery: estDelivery,
          createdAt: new Date().toISOString(),
        };

        const orderRef = await addDoc(collection(db, "orders"), orderData);
        
        // Update Coupon Stats
        if (coupon) {
          await updateDoc(doc(db, "coupons", coupon.id), {
            usageCount: increment(1),
            totalDiscountGenerated: increment(discountAmount)
          });

          // Update User Specific Usage
          const usageRef = doc(db, "coupon_usage", `${user.uid}_${coupon.code}`);
          const usageSnap = await getDoc(usageRef);
          if (usageSnap.exists()) {
            await updateDoc(usageRef, { count: increment(1) });
          } else {
            await setDoc(usageRef, { 
              userId: user.uid, 
              couponCode: coupon.code, 
              count: 1,
              lastUsed: new Date().toISOString()
            });
          }
        }
        
        toast.success("Order placed successfully!");
        if (!directPurchase) clearCart();
        navigate(`/track/${orderRef.id}`);
      }
    } catch (error: any) {
      console.error("Order error:", error);
      toast.error(error.message || "Failed to place order. Please try again.");
    } finally {
      if (paymentMethod !== 'razorpay') setLoading(false);
      setIsCodModalOpen(false);
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
                  onClick={() => {
                    if (showSavedAddresses) {
                      // Switching to "Enter New"
                      setAddress({
                        id: Date.now().toString(),
                        name: user.displayName || "",
                        phone: user.phoneNumber || "",
                        pincode: "",
                        address: "",
                        city: "",
                        state: ""
                      });
                    }
                    setShowSavedAddresses(!showSavedAddresses);
                  }}
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
                    className={`p-6 text-left rounded-3xl border-2 transition-all relative group ${address.id === addr.id ? 'border-black dark:border-white bg-black/5 dark:bg-white/5 ring-2 ring-black/5 dark:ring-white/5' : 'border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 hover:border-gray-300 dark:hover:border-gray-700'}`}
                  >
                    {address.id === addr.id && (
                      <div className="absolute top-4 right-4 text-black dark:text-white">
                        <CheckCircle2 size={20} />
                      </div>
                    )}
                    <h4 className="font-bold uppercase tracking-tight mb-1 pr-8">{addr.name}</h4>
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
                    maxLength={6}
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                    value={address.pincode}
                    onChange={(e) => handlePincodeChange(e.target.value)}
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
              
              {coupon && (
                <div className="flex justify-between text-sm font-bold text-green-500 uppercase tracking-widest">
                  <div className="flex items-center">
                    <Tag size={12} className="mr-1" />
                    <span>Discount ({coupon.code})</span>
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

      {/* Payment Status Popups */}
      <AnimatePresence>
        {paymentStatus !== 'idle' && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-white dark:bg-gray-950 rounded-[3rem] p-12 text-center shadow-2xl"
            >
              {paymentStatus === 'success' ? (
                <>
                  <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8">
                    <CheckCircle2 size={48} />
                  </div>
                  <h2 className="text-3xl font-black tracking-tighter uppercase mb-4">Payment Confirmed</h2>
                  <p className="text-gray-500 font-bold mb-8">Your order has been placed successfully. Thank you for shopping with Munnu!</p>
                  <div className="space-y-4">
                    <div className="text-xs font-black uppercase tracking-widest text-gray-400">
                      Redirecting to home in {countdown}s...
                    </div>
                    <button 
                      onClick={() => navigate("/")}
                      className="w-full py-5 bg-black dark:bg-white text-white dark:text-black font-black text-sm uppercase tracking-widest rounded-full flex items-center justify-center"
                    >
                      <Home className="mr-2" size={18} />
                      Go Home Now
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-8">
                    <XCircle size={48} />
                  </div>
                  <h2 className="text-3xl font-black tracking-tighter uppercase mb-4">Payment Failed</h2>
                  <p className="text-gray-500 font-bold mb-8">Something went wrong with your transaction. Please try again or use a different method.</p>
                  <button 
                    onClick={() => {
                      setPaymentStatus('idle');
                      setLoading(false);
                    }}
                    className="w-full py-5 bg-black dark:bg-white text-white dark:text-black font-black text-sm uppercase tracking-widest rounded-full"
                  >
                    Try Again
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={isCodModalOpen}
        onClose={() => setIsCodModalOpen(false)}
        onConfirm={processOrder}
        title="Confirm COD Order"
        message="Are you sure you want to place this order using Cash on Delivery? You will pay when the order is delivered to your address."
        confirmText="Place Order"
        isDestructive={false}
        isLoading={loading}
      />
    </div>
  );
}
