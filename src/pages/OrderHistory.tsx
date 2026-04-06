import { useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { User, Order } from "../types";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { formatCurrency } from "../lib/utils";
import { format } from "date-fns";
import { Package, ChevronRight, Search, MessageCircle } from "lucide-react";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";

const CACHE_KEY = "user_orders_cache";
const CACHE_EXPIRY = 10 * 60 * 1000; // 10 minutes

interface OrderHistoryProps {
  user: User | null;
}

export default function OrderHistory({ user }: OrderHistoryProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    throw error;
  }

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;
      
      // Try cache first
      const cached = localStorage.getItem(`${CACHE_KEY}_${user.uid}`);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_EXPIRY) {
          setOrders(data);
          setLoading(false);
          return;
        }
      }

      try {
        const q = query(
          collection(db, "orders"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        const fetchedOrders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
        setOrders(fetchedOrders);
        
        // Update cache
        localStorage.setItem(`${CACHE_KEY}_${user.uid}`, JSON.stringify({
          data: fetchedOrders,
          timestamp: Date.now()
        }));
      } catch (err: any) {
        if (err.message?.includes('resource-exhausted') || err.message?.includes('Quota limit exceeded')) {
          try {
            handleFirestoreError(err, OperationType.GET, "orders_history");
          } catch (quotaErr: any) {
            setError(quotaErr);
          }
        } else {
          console.error("Error fetching orders:", err);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [user]);

  if (!user) return <Navigate to="/login" />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 space-y-6 md:space-y-0">
        <div>
          <h1 className="text-5xl font-black tracking-tighter uppercase">My Orders</h1>
          <p className="text-gray-500 mt-2">Track and manage your sneaker drops</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('open-chatbot'))}
            className="flex items-center space-x-2 px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-full text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-black/10"
          >
            <MessageCircle size={18} />
            <span>Support</span>
          </button>
          
          <div className="relative w-full md:w-64">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search orders..." 
            className="w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-gray-900 rounded-full focus:outline-none"
          />
        </div>
      </div>
    </div>

    {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-gray-50 dark:bg-gray-950 rounded-[2.5rem] animate-pulse" />
          ))}
        </div>
      ) : orders.length > 0 ? (
        <div className="space-y-6">
          {orders.map(order => (
            <div key={order.id} className="bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-900 rounded-[2.5rem] overflow-hidden shadow-xl shadow-black/5">
              <div className="p-8 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-50 dark:border-gray-900 space-y-4 md:space-y-0">
                <div className="flex space-x-8">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Order ID</p>
                    <p className="text-sm font-black uppercase tracking-tighter">#{order.id.slice(-8)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Placed On</p>
                    <p className="text-sm font-bold">{format(new Date(order.createdAt), "MMM dd, yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Total</p>
                    <p className="text-sm font-black">{formatCurrency(order.totalAmount)}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    order.orderStatus === 'delivered' ? 'bg-green-100 text-green-600' : 
                    order.orderStatus === 'cancelled' ? 'bg-red-100 text-red-600' : 
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {order.orderStatus}
                  </span>
                  <Link to={`/track/${order.id}`} className="flex items-center text-xs font-black uppercase tracking-widest underline underline-offset-4">
                    Track Order <ChevronRight size={14} className="ml-1" />
                  </Link>
                </div>
              </div>

              <div className="p-8 flex items-center space-x-6 overflow-x-auto">
                {order.items?.map((item, idx) => (
                  <div key={idx} className="flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                ))}
                {(order.items?.length || 0) > 4 && (
                  <div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex items-center justify-center text-xs font-bold text-gray-400">
                    +{(order.items?.length || 0) - 4}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-32 bg-gray-50 dark:bg-gray-950 rounded-[3rem]">
          <div className="flex justify-center mb-8 text-gray-200">
            <Package size={100} strokeWidth={1} />
          </div>
          <h2 className="text-3xl font-black tracking-tighter uppercase mb-4">No orders yet</h2>
          <p className="text-gray-500 mb-10">Your sneaker collection starts here. Go grab your first pair!</p>
          <Link to="/shop" className="px-10 py-4 bg-black dark:bg-white text-white dark:text-black font-black text-sm uppercase tracking-widest rounded-full">
            Shop Now
          </Link>
        </div>
      )}
    </div>
  );
}
