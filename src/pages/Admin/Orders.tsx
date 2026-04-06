import { useState, useEffect, useRef } from "react";
import { collection, getDocs, updateDoc, doc, query, orderBy, limit, startAfter, getCountFromServer, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { db } from "../../firebase";
import { Order } from "../../types";
import { formatCurrency } from "../../lib/utils";
import { format } from "date-fns";
import { Search, Filter, Printer, ChevronRight, Loader2, Truck, CheckCircle2, XCircle, ShoppingCart, Bell, Package, RefreshCw, ChevronDown } from "lucide-react";
import { toast } from "react-hot-toast";
import { handleFirestoreError, OperationType } from "../../lib/firestore-errors";
import { motion } from "motion/react";

const CACHE_KEY = "admin_orders_cache";
const CACHE_EXPIRY = 2 * 60 * 1000; // 2 minutes

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shipping, setShipping] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'shipped' | 'delivered' | 'cancelled'>('all');
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    throw error;
  }

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastOrderCount = useRef(0);

  const fetchOrders = async (isInitial = false, isLoadMore = false) => {
    if (isInitial) setLoading(true);
    else if (isLoadMore) setShipping(true); // Using shipping state as a generic loading for load more
    else setRefreshing(true);

    try {
      if (isInitial && !isLoadMore) {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp, total } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_EXPIRY) {
            setOrders(data);
            setTotalOrders(total);
            setLoading(false);
            // Still fetch in background to stay updated but don't block
            setRefreshing(true);
          }
        }
      }

      if (isInitial || !isLoadMore) {
        const countSnap = await getCountFromServer(collection(db, "orders"));
        setTotalOrders(countSnap.data().count);
      }

      const ordersRef = collection(db, "orders");
      let q = query(ordersRef, orderBy("createdAt", "desc"), limit(50));

      if (isLoadMore && lastDoc) {
        q = query(ordersRef, orderBy("createdAt", "desc"), startAfter(lastDoc), limit(50));
      }

      const snap = await getDocs(q);
      const newDocs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      
      let finalOrders = orders;
      if (isLoadMore) {
        finalOrders = [...orders, ...newDocs];
        setOrders(finalOrders);
      } else {
        if (!isInitial && newDocs.length > 0 && newDocs[0].id !== orders[0]?.id) {
          toast.success(`New Orders Received!`, { icon: '🔥' });
          audioRef.current?.play().catch(e => console.log("Audio play failed:", e));
          setNewOrderCount(prev => prev + 1);
        }
        finalOrders = newDocs;
        setOrders(finalOrders);
      }

      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === 50);
      lastOrderCount.current = isLoadMore ? orders.length + newDocs.length : newDocs.length;

      // Update cache
      if (!isLoadMore) {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          data: finalOrders,
          total: isInitial ? totalOrders : totalOrders, // Use current total
          timestamp: Date.now()
        }));
      }
    } catch (err: any) {
      if (err.message?.includes('resource-exhausted') || err.message?.includes('Quota limit exceeded')) {
        try {
          handleFirestoreError(err, OperationType.GET, "orders");
        } catch (quotaErr: any) {
          setError(quotaErr);
        }
      } else {
        console.error("Error fetching orders:", err);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      if (isLoadMore) setShipping(false);
    }
  };

  useEffect(() => {
    // Initialize notification sound
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
    audioRef.current.volume = 0.5;
    
    fetchOrders(true);

    // Auto refresh every 5 minutes to save quota but stay updated
    const interval = setInterval(() => {
      if (document.hasFocus()) {
        fetchOrders();
      }
    }, 300000);
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, "orders", id), { orderStatus: status });
      toast.success(`Order marked as ${status}`);
      fetchOrders();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const createShipment = async (orderId: string) => {
    setShipping(true);
    try {
      const response = await fetch('/api/shipping/create-shipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Shipment created! Tracking ID: ${data.trackingId}`);
        fetchOrders();
      } else {
        toast.error(data.error || "Failed to create shipment");
      }
    } catch (error) {
      console.error("Shipping error:", error);
      toast.error("Failed to connect to shipping API");
    } finally {
      setShipping(false);
    }
  };

  const printLabel = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const labelHtml = `
      <html>
        <head>
          <title>Shipping Label - ${order.id}</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            @page { size: 4in 6in; margin: 0; }
            body { 
              font-family: 'Inter', sans-serif; 
              margin: 0; 
              padding: 0; 
              background: white;
              color: black;
            }
            .label-container {
              width: 4in;
              height: 6in;
              padding: 15px;
              box-sizing: border-box;
              border: 1px solid #eee;
              display: flex;
              flex-direction: column;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 3px solid black;
              padding-bottom: 10px;
              margin-bottom: 15px;
            }
            .brand-section h1 {
              margin: 0;
              font-size: 32px;
              font-weight: 900;
              letter-spacing: -2px;
              line-height: 1;
            }
            .brand-section p {
              margin: 2px 0 0;
              font-size: 8px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 2px;
              color: #666;
            }
            .courier-logo {
              text-align: right;
            }
            .courier-logo div {
              font-size: 14px;
              font-weight: 900;
              text-transform: uppercase;
              background: black;
              color: white;
              padding: 4px 8px;
              border-radius: 4px;
            }
            .courier-logo span {
              font-size: 8px;
              font-weight: 700;
              display: block;
              margin-top: 4px;
            }
            .address-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin-bottom: 20px;
            }
            .address-box {
              font-size: 10px;
            }
            .address-box h3 {
              margin: 0 0 5px;
              font-size: 8px;
              font-weight: 900;
              text-transform: uppercase;
              color: #888;
              letter-spacing: 1px;
            }
            .address-box p {
              margin: 0;
              line-height: 1.4;
            }
            .address-box .name {
              font-size: 14px;
              font-weight: 900;
              margin-bottom: 4px;
              text-transform: uppercase;
            }
            .main-barcode {
              flex-grow: 1;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              border: 2px dashed #ddd;
              border-radius: 12px;
              margin: 10px 0;
              padding: 20px;
            }
            .barcode-lines {
              width: 100%;
              height: 80px;
              background: repeating-linear-gradient(
                90deg,
                #000,
                #000 2px,
                #fff 2px,
                #fff 4px,
                #000 4px,
                #000 5px,
                #fff 5px,
                #fff 8px
              );
            }
            .barcode-text {
              font-size: 12px;
              font-weight: 900;
              margin-top: 10px;
              letter-spacing: 4px;
            }
            .order-info {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 10px;
              border-top: 2px solid black;
              padding-top: 15px;
              margin-top: auto;
            }
            .info-item {
              font-size: 9px;
            }
            .info-item h4 {
              margin: 0 0 2px;
              font-size: 7px;
              font-weight: 900;
              text-transform: uppercase;
              color: #888;
            }
            .info-item p {
              margin: 0;
              font-weight: 700;
            }
            .payment-badge {
              display: inline-block;
              padding: 2px 6px;
              background: #f0f0f0;
              border-radius: 4px;
              font-size: 8px;
              font-weight: 900;
              text-transform: uppercase;
            }
            .qr-placeholder {
              width: 60px;
              height: 60px;
              border: 1px solid #eee;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 6px;
              text-align: center;
              color: #ccc;
            }
            .fragile-badge {
              border: 2px solid black;
              padding: 4px 8px;
              text-align: center;
              font-weight: 900;
              font-size: 10px;
              text-transform: uppercase;
              margin-top: 10px;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 5px;
            }
            .fragile-badge span {
              font-size: 14px;
            }
            @media print {
              .label-container { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="label-container">
            <div class="header">
              <div class="brand-section">
                <h1>MUNNU</h1>
                <p>Premium Streetwear</p>
              </div>
              <div class="courier-logo">
                <div>DELHIVERY</div>
                <span>Express Surface</span>
              </div>
            </div>

            <div class="address-grid">
              <div class="address-box">
                <h3>Ship To</h3>
                <p class="name">${order.address.name}</p>
                <p>${order.address.address}</p>
                <p>${order.address.city}, ${order.address.state}</p>
                <p>PIN: <strong>${order.address.pincode}</strong></p>
                <p style="margin-top: 5px;">PH: <strong>${order.address.phone}</strong></p>
              </div>
              <div class="address-box" style="text-align: right;">
                <h3>Return Address</h3>
                <p class="name" style="font-size: 10px;">MUNNU STORE</p>
                <p>Sector 12, Noida</p>
                <p>Uttar Pradesh - 201301</p>
                <p>PH: 9193731911</p>
                <div class="fragile-badge" style="margin-left: auto; width: fit-content;">
                  <span>📦</span> FRAGILE
                </div>
              </div>
            </div>

            <div class="main-barcode">
              <div class="barcode-lines"></div>
              <div class="barcode-text">${order.id.slice(0, 12).toUpperCase()}</div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 15px;">
              <div class="address-box">
                <h3>Order ID</h3>
                <p style="font-size: 14px; font-weight: 900;">#${order.id.slice(-8).toUpperCase()}</p>
                <p style="font-size: 8px; color: #666;">Date: ${format(new Date(order.createdAt), "dd MMM yyyy")}</p>
              </div>
              <div style="text-align: right;">
                <div class="qr-placeholder" style="margin-left: auto;">
                  SCAN FOR<br>DETAILS
                </div>
                <p style="font-size: 6px; font-weight: 900; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;">Premium Packaging</p>
              </div>
            </div>

            <div class="order-info">
              <div class="info-item">
                <h4>Weight</h4>
                <p>0.50 KG</p>
              </div>
              <div class="info-item">
                <h4>Payment</h4>
                <p><span class="payment-badge">${order.paymentMethod}</span></p>
                <p style="font-size: 10px; margin-top: 2px;">${formatCurrency(order.totalAmount)}</p>
              </div>
              <div class="info-item" style="text-align: right;">
                <h4>Tracking</h4>
                <p>${order.trackingId || 'PENDING'}</p>
              </div>
            </div>
          </div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
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
          <button 
            onClick={() => fetchOrders()}
            disabled={refreshing}
            className="flex items-center space-x-2 px-6 py-4 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-900 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-900 transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
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
          
          {hasMore && (
            <div className="p-8 flex justify-center border-t border-gray-50 dark:border-gray-900">
              <button 
                onClick={() => fetchOrders(false, true)}
                className="flex items-center space-x-2 px-8 py-4 bg-gray-50 dark:bg-gray-900 rounded-full text-xs font-black uppercase tracking-widest hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
              >
                <ChevronDown size={16} />
                <span>Load More Orders</span>
              </button>
            </div>
          )}
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
                      Mark Shipped
                    </button>
                    <button 
                      onClick={() => createShipment(selectedOrder.id)}
                      disabled={shipping || !!selectedOrder.trackingId}
                      className="py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
                    >
                      {shipping ? <Loader2 size={12} className="animate-spin" /> : <Truck size={12} />}
                      <span>{selectedOrder.trackingId ? "Waybill: " + selectedOrder.trackingId : "Ship w/ Delivery One"}</span>
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
