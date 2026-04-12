import React, { useState, useEffect } from "react";
import { useNavigate, Navigate, useLocation } from "react-router-dom";
import { useCart } from "../hooks/useCart";
import { User, Address, OrderItem, Coupon } from "../types";
import { formatCurrency } from "../lib/utils";
import { collection, addDoc, doc, updateDoc, getDoc, increment, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";
import { CreditCard, Truck, MapPin, CheckCircle2, ArrowLeft, Loader2, XCircle, Home, Tag, Calendar, ChevronDown, ChevronRight, ShoppingCart, ShieldCheck, Lock, Smartphone } from "lucide-react";
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
  const [paymentMethod, setPaymentMethod] = useState<string>('razorpay');
  const [isCodEnabled, setIsCodEnabled] = useState(true);
  const [isCouponSystemEnabled, setIsCouponSystemEnabled] = useState(true);
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
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(location.state?.coupon as Coupon | undefined || null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

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
  const finalTotal = Math.max(0, totalPrice - discountAmount);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    if (code.length < 5) {
      toast.error("Coupon code must be at least 5 characters long");
      return;
    }
    
    setIsApplyingCoupon(true);
    setCouponError(null);
    try {
      const docRef = doc(db, "coupons", code);
      const snap = await getDoc(docRef);
      
      if (!snap.exists()) {
        setCouponError("Invalid coupon code");
        toast.error("Invalid coupon code");
        return;
      }
      
      const couponData = { id: snap.id, ...snap.data() } as Coupon;
      
      if (!couponData.isActive) {
        setCouponError("This coupon is no longer active");
        toast.error("This coupon is no longer active");
        return;
      }
      
      if (totalPrice < couponData.minOrderAmount) {
        setCouponError(`Minimum order amount is ${formatCurrency(couponData.minOrderAmount)}`);
        toast.error(`Minimum order amount for this coupon is ${formatCurrency(couponData.minOrderAmount)}`);
        return;
      }
      
      if (couponData.expiryDate && new Date(couponData.expiryDate) < new Date()) {
        setCouponError("This coupon has expired");
        toast.error("This coupon has expired");
        return;
      }

      // Check Max Usage Per User
      if (couponData.maxUsagePerUser && user) {
        const usageRef = doc(db, "coupon_usage", `${user.uid}_${couponData.code}`);
        const usageSnap = await getDoc(usageRef);
        if (usageSnap.exists()) {
          const usageData = usageSnap.data();
          if (usageData.count >= couponData.maxUsagePerUser) {
            setCouponError(`You have already used this coupon ${couponData.maxUsagePerUser} time(s)`);
            toast.error(`You have reached the maximum usage limit for this coupon`);
            return;
          }
        }
      }
      
      setAppliedCoupon(couponData);
      setCouponError(null);
      toast.success("Coupon applied successfully!");
    } catch (error) {
      toast.error("Failed to apply coupon");
    } finally {
      setIsApplyingCoupon(false);
    }
  };
  
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
  const [isAddingNewAddress, setIsAddingNewAddress] = useState(false);
  const [isOrderSummaryOpen, setIsOrderSummaryOpen] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const settingsSnap = await getDoc(doc(db, "settings", "global"));
      if (settingsSnap.exists()) {
        setIsCodEnabled(settingsSnap.data().isCodEnabled ?? true);
        setIsCouponSystemEnabled(settingsSnap.data().isCouponSystemEnabled !== false);
      }
    };
    fetchSettings();

    if (user?.addresses?.length) {
      const primaryAddress = user.addresses.find(addr => addr.isPrimary) || user.addresses[0];
      setAddress(primaryAddress);
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

  const handlePlaceOrder = async (method: string) => {
    // Validation
    if (!address.name?.trim()) return toast.error("Name is required");
    if (!address.phone?.trim()) return toast.error("Phone number is required");
    if (!/^\d{10}$/.test(address.phone.trim())) return toast.error("Phone number must be 10 digits");
    if (!address.address?.trim()) return toast.error("Address is required");
    if (!address.city?.trim()) return toast.error("City is required");
    if (!address.state?.trim()) return toast.error("State is required");
    if (!address.pincode?.trim()) return toast.error("Pincode is required");
    if (!/^\d{6}$/.test(address.pincode.trim())) return toast.error("Pincode must be 6 digits");

    setPaymentMethod(method);

    if (method === 'cod') {
      setIsCodModalOpen(true);
      return;
    }

    await processOrder(method);
  };

  const processOrder = async (method: string) => {
    setLoading(true);
    try {
      if (finalTotal === 0) {
        // Bypass payment gateway for free orders
        const estDelivery = calculateEstimatedDelivery(5, 7);
        const orderData = {
          userId: user.uid,
          items,
          totalAmount: finalTotal,
          discountAmount,
          couponCode: appliedCoupon?.code || null,
          paymentMethod: 'free',
          paymentStatus: 'paid',
          orderStatus: 'pending',
          address,
          deliveryEstimate: estDelivery.formatted,
          estimatedDelivery: estDelivery,
        };

        const orderRes = await fetch("/api/orders/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            orderData: {
              ...orderData,
              userEmail: user.email
            } 
          })
        });
        const orderResult = await orderRes.json();
        if (!orderRes.ok) throw new Error(orderResult.error || "Failed to place order");
        
        const orderId = orderResult.orderId;
        
        // Update Coupon Stats
        if (appliedCoupon) {
          await updateDoc(doc(db, "coupons", appliedCoupon.id), {
            usageCount: increment(1),
            totalDiscountGenerated: increment(discountAmount)
          });

          // Update User Specific Usage
          const usageRef = doc(db, "coupon_usage", `${user.uid}_${appliedCoupon.code}`);
          const usageSnap = await getDoc(usageRef);
          if (usageSnap.exists()) {
            await updateDoc(usageRef, { count: increment(1) });
          } else {
            await setDoc(usageRef, { 
              userId: user.uid, 
              couponCode: appliedCoupon.code, 
              count: 1,
              lastUsed: new Date().toISOString()
            });
          }
        }
        
        toast.success("Order placed successfully!");
        if (!directPurchase) clearCart();
        navigate(`/track/${orderId}`);
        return;
      }

      if (method !== 'cod') {
        // 1. Create Razorpay Order on server
        const orderRes = await fetch("/api/payment/create-razorpay-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: finalTotal, receipt: `order_${Date.now()}` })
        });
        const orderData = await orderRes.json();

        if (!orderRes.ok) throw new Error(orderData.details || orderData.error || "Failed to create payment order");

        // 2. Open Razorpay Checkout
        const options: any = {
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
                  userEmail: user.email,
                  items,
                  totalAmount: finalTotal,
                  discountAmount,
                  couponCode: appliedCoupon?.code || null,
                  paymentMethod: method,
                  paymentStatus: 'paid',
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  orderStatus: 'pending',
                  address,
                  deliveryEstimate: estDelivery.formatted,
                  estimatedDelivery: estDelivery,
                };

                const orderRes = await fetch("/api/orders/create", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ orderData: finalOrderData })
                });
                const orderResult = await orderRes.json();
                if (!orderRes.ok) throw new Error(orderResult.error || "Failed to place order");

                // Update Coupon Stats
                if (appliedCoupon) {
                  await updateDoc(doc(db, "coupons", appliedCoupon.id), {
                    usageCount: increment(1),
                    totalDiscountGenerated: increment(discountAmount)
                  });

                  // Update User Specific Usage
                  const usageRef = doc(db, "coupon_usage", `${user.uid}_${appliedCoupon.code}`);
                  const usageSnap = await getDoc(usageRef);
                  if (usageSnap.exists()) {
                    await updateDoc(usageRef, { count: increment(1) });
                  } else {
                    await setDoc(usageRef, { 
                      userId: user.uid, 
                      couponCode: appliedCoupon.code, 
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

        // Configure specific payment method if requested
        if (method === 'upi') {
          options.method = "upi";
          options.prefill.method = "upi";
          // For 'Others', we show all UPI options
          options.config = {
            display: {
              blocks: {
                upi: {
                  name: "Pay via any UPI App",
                  instruments: [
                    {
                      method: "upi"
                    }
                  ]
                }
              },
              sequence: ["block.upi"],
              preferences: {
                show_default_blocks: false
              }
            }
          };
        } else if (method === 'card') {
          options.method = "card";
          options.prefill.method = "card";
          options.config = {
            display: {
              blocks: {
                card: {
                  name: "Pay via Card",
                  instruments: [{ method: "card" }]
                }
              },
              sequence: ["block.card"],
              preferences: { show_default_blocks: false }
            }
          };
        } else if (method === 'netbanking') {
          options.method = "netbanking";
          options.prefill.method = "netbanking";
          options.config = {
            display: {
              blocks: {
                netbanking: {
                  name: "Pay via Netbanking",
                  instruments: [{ method: "netbanking" }]
                }
              },
              sequence: ["block.netbanking"],
              preferences: { show_default_blocks: false }
            }
          };
        } else if (method === 'wallet') {
          options.method = "wallet";
          options.prefill.method = "wallet";
          options.config = {
            display: {
              blocks: {
                wallet: {
                  name: "Pay via Wallet",
                  instruments: [{ method: "wallet" }]
                }
              },
              sequence: ["block.wallet"],
              preferences: { show_default_blocks: false }
            }
          };
        } else if (method.startsWith('upi_')) {
          const appId = method.split('_')[1];
          const appMap: Record<string, string> = {
            'phonepe': 'phonepe',
            'google_pay': 'google_pay',
            'paytm': 'paytm',
            'bhim': 'bhim'
          };
          const appName = appMap[appId] || appId;
          
          options.method = "upi";
          options.prefill.method = "upi";
          // Direct intent flow for mobile apps
          options.upi = {
            flow: 'intent',
            app: appName
          };
          
          // To ensure the app is "pre-selected" in the UI
          options.config = {
            display: {
              blocks: {
                upi: {
                  name: `Pay via ${appName.toUpperCase()}`,
                  instruments: [
                    { 
                      method: "upi", 
                      apps: [appName]
                    }
                  ]
                }
              },
              sequence: ["block.upi"],
              preferences: { 
                show_default_blocks: false
              }
            }
          };
        }

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response: any) {
          console.error("Payment failed:", response.error);
          if (response.error.code === 'BAD_REQUEST_ERROR' && response.error.description?.includes('app not found')) {
            toast.error("UPI app not found. Please install the selected app or choose another payment method.");
          } else {
            setPaymentStatus('failed');
          }
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
          couponCode: appliedCoupon?.code || null,
          paymentMethod: 'cod',
          paymentStatus: 'pending',
          orderStatus: 'pending',
          address,
          deliveryEstimate: estDelivery.formatted,
          estimatedDelivery: estDelivery,
        };

        const orderRes = await fetch("/api/orders/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            orderData: {
              ...orderData,
              userEmail: user.email
            } 
          })
        });
        const orderResult = await orderRes.json();
        if (!orderRes.ok) throw new Error(orderResult.error || "Failed to place order");
        
        const orderId = orderResult.orderId;
        
        // Update Coupon Stats
        if (appliedCoupon) {
          await updateDoc(doc(db, "coupons", appliedCoupon.id), {
            usageCount: increment(1),
            totalDiscountGenerated: increment(discountAmount)
          });

          // Update User Specific Usage
          const usageRef = doc(db, "coupon_usage", `${user.uid}_${appliedCoupon.code}`);
          const usageSnap = await getDoc(usageRef);
          if (usageSnap.exists()) {
            await updateDoc(usageRef, { count: increment(1) });
          } else {
            await setDoc(usageRef, { 
              userId: user.uid, 
              couponCode: appliedCoupon.code, 
              count: 1,
              lastUsed: new Date().toISOString()
            });
          }
        }
        
        toast.success("Order placed successfully!");
        if (!directPurchase) clearCart();
        navigate(`/track/${orderId}`);
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
    <div className="min-h-screen bg-[#f5f5f5] pb-24 font-sans text-gray-800">
      {/* Header */}
      <header className="bg-white sticky top-0 z-50 border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate("/");
                }
              }} 
              className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft size={24} className="text-gray-700" />
            </button>
            <h1 className="text-xl font-serif tracking-widest uppercase font-bold text-black">MUNNU</h1>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-black">{formatCurrency(finalTotal)}</div>
            {discountAmount > 0 && (
              <div className="text-xs text-gray-400 line-through">{formatCurrency(totalPrice)}</div>
            )}
          </div>
        </div>
        {/* Banner */}
        {appliedCoupon && (
          <div className="bg-pink-200/80 text-pink-900 text-center py-2 text-sm font-bold">
            Hooray!! You have unlocked {appliedCoupon.code}
          </div>
        )}
      </header>

      <div className="max-w-3xl mx-auto p-4 space-y-6 mt-2">
        {/* Order Summary Accordion */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
           <button 
             onClick={() => setIsOrderSummaryOpen(!isOrderSummaryOpen)}
             className="w-full p-4 flex justify-between items-center"
           >
             <div className="flex items-center space-x-3">
               <ShoppingCart size={20} className="text-gray-600" />
               <span className="font-medium text-gray-800">Order summary</span>
             </div>
             <div className="flex items-center space-x-2 text-gray-600">
               <span className="text-sm">{items.length} items</span>
               <ChevronDown size={20} className={`transition-transform ${isOrderSummaryOpen ? 'rotate-180' : ''}`} />
             </div>
           </button>
           <AnimatePresence>
             {isOrderSummaryOpen && (
               <motion.div 
                 initial={{ height: 0, opacity: 0 }}
                 animate={{ height: 'auto', opacity: 1 }}
                 exit={{ height: 0, opacity: 0 }}
                 className="border-t border-gray-100 px-4 py-2"
               >
                 {items.map(item => (
                   <div key={`${item.productId}-${item.size}`} className="flex items-center space-x-4 py-3 border-b border-gray-50 last:border-0">
                     <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                       <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                     </div>
                     <div className="flex-grow min-w-0">
                       <h4 className="text-sm font-medium truncate text-gray-800">{item.name}</h4>
                       <p className="text-xs text-gray-500">Qty: {item.quantity} • Size: {item.size}</p>
                     </div>
                     <span className="text-sm font-bold text-gray-800">{formatCurrency(item.price * item.quantity)}</span>
                   </div>
                 ))}
               </motion.div>
             )}
           </AnimatePresence>
        </div>

        {/* Deliver to */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-3">
              <MapPin size={20} className="text-gray-600" />
              <span className="font-medium text-gray-800">Deliver to</span>
            </div>
            <button 
              onClick={() => setShowSavedAddresses(!showSavedAddresses)}
              className="text-sm font-medium text-gray-900 flex items-center"
            >
              {address.id ? "Change address" : "Add address"} <ChevronRight size={16} />
            </button>
          </div>
          
          {address.id ? (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h4 className="font-bold text-gray-800 mb-1">{address.name}</h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                {address.address}, {address.city}, {address.state} - {address.pincode}
              </p>
              <p className="text-sm font-medium mt-2 text-gray-800">{address.phone}</p>
            </div>
          ) : (
            <button 
              onClick={() => setShowSavedAddresses(true)}
              className="w-full py-3 bg-gray-100 text-gray-500 rounded-xl font-medium"
            >
              No saved addresses
            </button>
          )}

          {/* Address Form / List (Hidden by default, shown when Add/Change is clicked) */}
          {showSavedAddresses && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              {user.addresses?.length > 0 && !isAddingNewAddress ? (
                <div className="space-y-3">
                  {user.addresses.map(addr => (
                    <button 
                      key={addr.id}
                      onClick={() => {
                        setAddress(addr);
                        setShowSavedAddresses(false);
                      }}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${address.id === addr.id ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}`}
                    >
                      <h4 className="font-bold text-gray-800 mb-1">{addr.name}</h4>
                      <p className="text-xs text-gray-600">{addr.address}, {addr.city}</p>
                    </button>
                  ))}
                  <button 
                    onClick={() => {
                      setAddress({ id: '', name: '', phone: '', pincode: '', address: '', city: '', state: '' });
                      setIsAddingNewAddress(true);
                    }}
                    className="w-full py-3 text-sm font-bold text-blue-600 border border-blue-200 rounded-xl bg-blue-50"
                  >
                    + Add New Address
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <input type="text" placeholder="Full Name" className="w-full p-3 border border-gray-200 rounded-xl text-sm" value={address.name} onChange={e => setAddress({...address, name: e.target.value})} />
                  <input type="tel" placeholder="Phone Number" className="w-full p-3 border border-gray-200 rounded-xl text-sm" value={address.phone} onChange={e => setAddress({...address, phone: e.target.value})} />
                  <textarea placeholder="Full Address" className="w-full p-3 border border-gray-200 rounded-xl text-sm" value={address.address} onChange={e => setAddress({...address, address: e.target.value})} />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" placeholder="Pincode" className="w-full p-3 border border-gray-200 rounded-xl text-sm" value={address.pincode} onChange={e => handlePincodeChange(e.target.value)} />
                    <input type="text" placeholder="City" className="w-full p-3 border border-gray-200 rounded-xl text-sm" value={address.city} onChange={e => setAddress({...address, city: e.target.value})} />
                  </div>
                  <input type="text" placeholder="State" className="w-full p-3 border border-gray-200 rounded-xl text-sm" value={address.state} onChange={e => setAddress({...address, state: e.target.value})} />
                  <button 
                    onClick={() => {
                      if(address.name && address.phone && address.address && address.pincode) {
                        setAddress({...address, id: Date.now().toString()});
                        setShowSavedAddresses(false);
                        setIsAddingNewAddress(false);
                      } else {
                        toast.error("Please fill all address fields");
                      }
                    }}
                    className="w-full py-3 bg-black text-white rounded-xl font-bold"
                  >
                    Save Address
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Offers & Rewards */}
        {isCouponSystemEnabled && (
          <div>
            <h3 className="text-sm text-gray-500 mb-2 px-1">Offers & Rewards</h3>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {!appliedCoupon ? (
                <div className="p-4">
                  <form onSubmit={handleApplyCoupon} className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Enter Coupon Code"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                      className="flex-grow px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold uppercase focus:outline-none focus:border-green-500"
                    />
                    <button
                      type="submit"
                      disabled={isApplyingCoupon || !couponCode.trim()}
                      className="px-6 py-3 bg-gray-900 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                    >
                      {isApplyingCoupon ? <Loader2 className="animate-spin" size={16} /> : "Apply"}
                    </button>
                  </form>
                  {couponError && <p className="text-xs text-red-500 mt-2 ml-1">{couponError}</p>}
                </div>
              ) : (
                <>
                  <div className="w-full p-4 flex justify-between items-center border-b border-gray-50">
                    <div className="flex items-center space-x-3">
                      <Tag size={20} className="text-green-600" />
                      <span className="font-medium text-green-600">{appliedCoupon.code} Applied</span>
                    </div>
                    <button onClick={() => setAppliedCoupon(null)} className="text-sm font-bold text-red-500">Remove</button>
                  </div>
                  {discountAmount > 0 && (
                    <div className="p-4 bg-yellow-50/50 flex items-center space-x-2 text-sm">
                      <span>🪙</span>
                      <span className="font-medium text-yellow-800">{formatCurrency(discountAmount)} Saved with discounts!</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Payment Methods */}
        <div>
          <h3 className="text-sm text-gray-500 mb-2 px-1">Payment methods</h3>
          <div className="space-y-3">
            
            {/* UPI */}
            <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 flex items-center justify-center">
                    <img 
                      src="https://img.icons8.com/color/96/bhim.png" 
                      alt="UPI" 
                      className="w-full h-full object-contain" 
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "https://static-assets-web.flixcart.com/fk-p-linchpin-web/batman-returns/logos/upi-logo.png";
                      }}
                    />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800">UPI</h4>
                  </div>
                </div>
                <span className="font-bold text-gray-800">{formatCurrency(finalTotal)}</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {[
                  { name: 'PhonePe', id: 'phonepe', icon: 'https://img.icons8.com/color/96/phone-pe.png' },
                  { name: 'GPay', id: 'google_pay', icon: 'https://img.icons8.com/color/96/google-pay.png' },
                  { name: 'Paytm', id: 'paytm', icon: 'https://img.icons8.com/color/96/paytm.png' },
                  { name: 'Others', id: 'upi', icon: 'https://img.icons8.com/color/96/bhim.png' }
                ].map((app, i) => (
                  <button 
                    key={i} 
                    onClick={() => handlePlaceOrder(app.id === 'upi' ? 'upi' : `upi_${app.id}`)}
                    aria-label={`Pay using ${app.name}`}
                    className="py-3 border border-gray-100 rounded-xl flex flex-col items-center justify-center bg-gray-50 hover:border-green-500 hover:bg-green-50 transition-all focus:outline-none focus:ring-2 focus:ring-green-500 active:scale-95 min-w-0"
                  >
                    <div className="w-10 h-10 mb-1 flex items-center justify-center overflow-hidden bg-white rounded-lg p-1 shadow-sm">
                      <img 
                        src={app.icon} 
                        alt={app.name} 
                        className="w-full h-full object-contain" 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          const fallback = "https://img.icons8.com/color/96/bhim.png";
                          if (target.src !== fallback) {
                            target.src = fallback;
                          }
                        }}
                      />
                    </div>
                    <span className="text-[9px] sm:text-[10px] text-gray-700 font-bold whitespace-nowrap truncate w-full px-1 text-center">{app.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Debit/Credit cards */}
            <button 
              onClick={() => handlePlaceOrder('card')}
              className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex justify-between items-center hover:border-green-500 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 flex items-center justify-center text-gray-600">
                  <CreditCard size={24} />
                </div>
                <div className="text-left">
                  <h4 className="font-bold text-gray-800">Debit/Credit cards</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Visa, Mastercard, RuPay & more</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-gray-800">{formatCurrency(finalTotal)}</span>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            </button>

            {/* Wallets */}
            <button 
              onClick={() => handlePlaceOrder('wallet')}
              className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex justify-between items-center hover:border-green-500 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 flex items-center justify-center text-gray-600">
                  <Smartphone size={24} />
                </div>
                <div className="text-left">
                  <h4 className="font-bold text-gray-800">Wallets</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Amazon Pay, PhonePe, Mobikwik & more</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-gray-800">{formatCurrency(finalTotal)}</span>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            </button>

            {/* Netbanking */}
            <button 
              onClick={() => handlePlaceOrder('netbanking')}
              className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex justify-between items-center hover:border-green-500 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 flex items-center justify-center text-gray-600">
                  <Home size={24} />
                </div>
                <div className="text-left">
                  <h4 className="font-bold text-gray-800">Netbanking</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Select from a list of banks</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-gray-800">{formatCurrency(finalTotal)}</span>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            </button>

            {/* Cash on Delivery */}
            {isCodEnabled && (
              <button 
                onClick={() => handlePlaceOrder('cod')}
                className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex justify-between items-center hover:border-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 flex items-center justify-center text-gray-600">
                    <Truck size={24} />
                  </div>
                  <div className="text-left">
                    <h4 className="font-bold text-gray-800">Cash on Delivery</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Pay when you receive</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-gray-800">{formatCurrency(finalTotal)}</span>
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Secure Checkout Indicators */}
        <div className="flex items-center justify-center space-x-6 py-6 text-gray-400">
          <div className="flex flex-col items-center space-y-1">
            <ShieldCheck size={20} />
            <span className="text-[10px] font-medium uppercase tracking-wider">100% Secure</span>
          </div>
          <div className="flex flex-col items-center space-y-1">
            <Lock size={20} />
            <span className="text-[10px] font-medium uppercase tracking-wider">SSL Encrypted</span>
          </div>
          <div className="flex flex-col items-center space-y-1">
            <CheckCircle2 size={20} />
            <span className="text-[10px] font-medium uppercase tracking-wider">Verified</span>
          </div>
        </div>

        {/* Footer */}
        <div className="pb-4 flex justify-between items-center text-sm text-gray-500">
          <span>Logged in with {user.phoneNumber || user.email}</span>
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
              className="w-full max-w-md bg-white rounded-[2rem] p-8 text-center shadow-2xl"
            >
              {paymentStatus === 'success' ? (
                <>
                  <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 size={40} />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Payment Confirmed</h2>
                  <p className="text-gray-500 text-sm mb-6">Your order has been placed successfully.</p>
                  <button 
                    onClick={() => navigate("/")}
                    className="w-full py-4 bg-black text-white font-bold rounded-xl"
                  >
                    Go Home Now
                  </button>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <XCircle size={40} />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Payment Failed</h2>
                  <p className="text-gray-500 text-sm mb-6">Something went wrong. Please try again.</p>
                  <button 
                    onClick={() => {
                      setPaymentStatus('idle');
                      setLoading(false);
                    }}
                    className="w-full py-4 bg-black text-white font-bold rounded-xl"
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
        onConfirm={() => processOrder('cod')}
        title="Confirm COD Order"
        message="Are you sure you want to place this order using Cash on Delivery? You will pay when the order is delivered."
        confirmText="Place Order"
        isDestructive={false}
        isLoading={loading}
        icon={Truck}
      />
    </div>
  );
}
