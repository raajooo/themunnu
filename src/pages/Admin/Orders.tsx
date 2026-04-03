import { useState, useEffect, useRef } from "react";
import { collection, onSnapshot, updateDoc, doc, query, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import { Order } from "../../types";
import { formatCurrency } from "../../lib/utils";
import { format } from "date-fns";
import { Search, Filter, Printer, ChevronRight, Loader2, Truck, CheckCircle2, XCircle, ShoppingCart, Bell, Package } from "lucide-react";
import { toast } from "react-hot-toast";
import { handleFirestoreError, OperationType } from "../../lib/firestore-errors";
import { motion } from "motion/react";

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'pending' | 'shipped' | 'delivered' | 'cancelled'>('all');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    // Initialize notification sound
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
    
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const newOrders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      
      if (!isFirstLoad.current && newOrders.length > orders.length) {
        // New order arrived
        const latestOrder = newOrders[0];
        toast.success(`New Order Received! #${latestOrder.id.slice(-8)}`, {
          duration: 5000,
          icon: '🔔',
          style: {
            borderRadius: '20px',
            background: '#000',
            color: '#fff',
            fontWeight: '900',
            textTransform: 'uppercase',
            fontSize: '12px',
            letterSpacing: '0.1em'
          }
        });
        
        // Play notification sound
        audioRef.current?.play().catch(e => console.log("Audio play failed:", e));
        setNewOrderCount(prev => prev + 1);
      }
      
      setOrders(newOrders);
      setLoading(false);
      isFirstLoad.current = false;
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "orders");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [orders.length]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, "orders", id), { orderStatus: status });
      toast.success(`Order marked as ${status}`);
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const printLabel = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const labelHtml = `
      <html>
        <head>
          <title>Shipping Label - ${order.id}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 20px; }
            .label { border: 2px solid black; padding: 20px; width: 400px; }
            .header { border-bottom: 2px solid black; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
            .brand { font-weight: 900; font-size: 24px; }
            .section { margin-bottom: 15px; }
            .label-text { font-size: 10px; font-weight: 900; text-transform: uppercase; color: #666; }
            .value { font-size: 14px; font-weight: 700; }
            .address { font-size: 12px; }
            .barcode { background: black; height: 60px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="header">
              <div class="brand">MUNNU</div>
              <div class="label-text">Delhivery Express</div>
            </div>
            <div class="section">
              <div class="label-text">Ship To:</div>
              <div class="value">${order.address.name}</div>
              <div class="address">${order.address.address}, ${order.address.city}, ${order.address.state} - ${order.address.pincode}</div>
              <div class="value">Phone: ${order.address.phone}</div>
            </div>
            <div class="section">
              <div class="label-text">Order Details:</div>
              <div class="value">Order ID: #${order.id.slice(-8)}</div>
              <div class="value">Payment: ${order.paymentMethod.toUpperCase()} (${order.paymentStatus.toUpperCase()})</div>
            </div>
            <div class="barcode"></div>
            <div style="text-align: center; font-size: 10px; margin-top: 10px;">${order.id}</div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `;

    printWindow.document.write(labelHtml);
    printWindow.document.close();
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    if (filter === 'pending') return order.orderStatus === 'pending' || order.orderStatus === 'confirmed';
    return order.orderStatus === filter;
  });

  if (loading && orders.length === 0) {
    return (
      <div className="space-y-12 pb-20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-4">
            <div className="h-12 w-64 bg-gray-100 dark:bg-gray-900 rounded-2xl animate-pulse" />
            <div className="h-4 w-48 bg-gray-100 dark:bg-gray-900 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 h-96 bg-white dark:bg-gray-950 rounded-[3rem] border border-gray-100 dark:border-gray-900 animate-pulse" />
          <div className="lg:col-span-1 h-96 bg-white dark:bg-gray-950 rounded-[3rem] border border-gray-100 dark:border-gray-900 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <h1 className="text-5xl font-black tracking-tighter uppercase">Orders</h1>
            {newOrderCount > 0 && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="bg-red-500 text-white px-3 py-1 rounded-full text-[10px] font-black flex items-center"
              >
                <Bell size={12} className="mr-1 animate-bounce" />
                {newOrderCount} NEW
              </motion.div>
            )}
          </div>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-widest">Manage customer fulfillment</p>
        </div>
        <div className="flex flex-wrap gap-4">
          {newOrderCount > 0 && (
            <button 
              onClick={() => setNewOrderCount(0)}
              className="px-6 py-4 bg-red-50 text-red-500 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all"
            >
              Clear Notifications
            </button>
          )}
          <div className="flex bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-900 rounded-full p-1">
            {(['all', 'pending', 'shipped', 'delivered'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-black text-white dark:bg-white dark:text-black' : 'hover:bg-gray-50 dark:hover:bg-gray-900'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-gray-950 rounded-[3rem] border border-gray-100 dark:border-gray-900 overflow-hidden shadow-xl shadow-black/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-50 dark:border-gray-900">
                  <th className="px-8 py-6">Order</th>
                  <th className="px-8 py-6">Customer</th>
                  <th className="px-8 py-6">Amount</th>
                  <th className="px-8 py-6">Status</th>
                  <th className="px-8 py-6 text-right">Label</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-900">
                {filteredOrders.length > 0 ? (
                  filteredOrders.map(order => (
                    <tr 
                      key={order.id} 
                      onClick={() => setSelectedOrder(order)}
                      className={`cursor-pointer transition-colors ${selectedOrder?.id === order.id ? 'bg-gray-50 dark:bg-gray-900' : 'hover:bg-gray-50/50 dark:hover:bg-gray-900/50'}`}
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-3">
                          <div>
                            <p className="text-sm font-black uppercase tracking-tighter">#{order.id.slice(-8)}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{format(new Date(order.createdAt), "MMM dd")}</p>
                          </div>
                          {(order.orderStatus === 'pending' || order.orderStatus === 'confirmed') && (
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" title="Ready to Print" />
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-sm font-bold uppercase tracking-tight">{order.address.name}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{order.address.city}</p>
                      </td>
                      <td className="px-8 py-6 text-sm font-black">{formatCurrency(order.totalAmount)}</td>
                      <td className="px-8 py-6">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          order.orderStatus === 'delivered' ? 'bg-green-100 text-green-600' : 
                          order.orderStatus === 'cancelled' ? 'bg-red-100 text-red-600' : 
                          'bg-blue-100 text-blue-600'
                        }`}>
                          {order.orderStatus}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            printLabel(order);
                          }}
                          className={`p-2 rounded-full transition-colors ${
                            (order.orderStatus === 'pending' || order.orderStatus === 'confirmed') 
                              ? 'bg-black text-white dark:bg-white dark:text-black hover:scale-110' 
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400'
                          }`}
                        >
                          <Printer size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-300">
                        <Package size={48} strokeWidth={1} className="mb-4" />
                        <p className="text-sm font-bold uppercase tracking-widest">No {filter} orders found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Order Details Panel */}
        <div className="lg:col-span-1">
          {selectedOrder ? (
            <div className="bg-white dark:bg-gray-950 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-900 shadow-2xl shadow-black/5 sticky top-24">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl font-black tracking-tighter uppercase mb-1">Order Details</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">#{selectedOrder.id}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full"><XCircle size={20} /></button>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  {selectedOrder.items?.map((item, idx) => (
                    <div key={idx} className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-900">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-grow">
                        <p className="text-xs font-bold uppercase truncate">{item.name}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Size: {item.size} • Qty: {item.quantity}</p>
                      </div>
                      <p className="text-xs font-black">{formatCurrency(item.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-8 border-t border-gray-50 dark:border-gray-900 space-y-4">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
                    <span>Payment Method</span>
                    <span className="text-black dark:text-white">{selectedOrder.paymentMethod.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
                    <span>Payment Status</span>
                    <span className="text-black dark:text-white">{selectedOrder.paymentStatus.toUpperCase()}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Update Status</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => updateStatus(selectedOrder.id, 'confirmed')}
                      className="py-3 bg-gray-50 dark:bg-gray-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
                    >
                      Confirm
                    </button>
                    <button 
                      onClick={() => updateStatus(selectedOrder.id, 'shipped')}
                      className="py-3 bg-gray-50 dark:bg-gray-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
                    >
                      Ship
                    </button>
                    <button 
                      onClick={() => updateStatus(selectedOrder.id, 'delivered')}
                      className="py-3 bg-gray-50 dark:bg-gray-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
                    >
                      Deliver
                    </button>
                    <button 
                      onClick={() => updateStatus(selectedOrder.id, 'cancelled')}
                      className="py-3 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                <button 
                  onClick={() => printLabel(selectedOrder)}
                  className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-black text-sm uppercase tracking-widest rounded-full flex items-center justify-center"
                >
                  <Printer size={18} className="mr-2" /> Print Shipping Label
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-10 border-2 border-dashed border-gray-100 dark:border-gray-900 rounded-[3rem] text-gray-300">
              <ShoppingCart size={64} strokeWidth={1} className="mb-4" />
              <p className="text-sm font-bold uppercase tracking-widest">Select an order to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
