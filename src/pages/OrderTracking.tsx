import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Order } from "../types";
import { format } from "date-fns";
import { motion } from "motion/react";
import { Package, Truck, CheckCircle2, MapPin, ArrowLeft, Clock, Loader2, AlertCircle } from "lucide-react";

export default function OrderTracking() {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [trackingData, setTrackingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchTracking = async (trackingId: string, isSilent = false) => {
    if (!isSilent) setTrackingLoading(true);
    try {
      const response = await fetch(`/api/shipping/track/${trackingId}`);
      const data = await response.json();
      if (data.success) {
        setTrackingData(data.data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error("Error fetching tracking:", error);
    } finally {
      if (!isSilent) setTrackingLoading(false);
    }
  };

  useEffect(() => {
    const fetchOrder = async () => {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, "orders", id));
        if (snap.exists()) {
          const orderData = { id: snap.id, ...snap.data() } as Order;
          setOrder(orderData);
          
          if (orderData.trackingId) {
            fetchTracking(orderData.trackingId);
          }
        }
      } catch (error) {
        console.error("Error fetching order:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id]);

  // Periodic updates
  useEffect(() => {
    if (!order?.trackingId) return;

    const interval = setInterval(() => {
      fetchTracking(order.trackingId!, true);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [order?.trackingId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="h-8 w-32 bg-gray-100 dark:bg-gray-900 rounded animate-pulse mb-8" />
        <div className="bg-white dark:bg-gray-950 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-900 animate-pulse h-96" />
      </div>
    );
  }
  if (!order) return <div className="py-20 text-center">Order not found</div>;

  const delhiveryStatus = trackingData?.ShipmentData?.[0]?.Shipment?.Status?.Status?.toLowerCase() || "";
  
  const steps = [
    { id: 'placed', label: 'Order Placed', icon: Clock, date: order.createdAt, completed: true },
    { 
      id: 'processed', 
      label: 'Processed', 
      icon: CheckCircle2, 
      completed: !!trackingData || order.orderStatus !== 'pending' 
    },
    { 
      id: 'shipped', 
      label: 'In Transit', 
      icon: Truck, 
      completed: delhiveryStatus.includes('transit') || delhiveryStatus.includes('shipped') || delhiveryStatus.includes('out for delivery') || delhiveryStatus.includes('delivered')
    },
    { 
      id: 'out_for_delivery', 
      label: 'Out for Delivery', 
      icon: MapPin, 
      completed: delhiveryStatus.includes('out for delivery') || delhiveryStatus.includes('delivered')
    },
    { 
      id: 'delivered', 
      label: 'Delivered', 
      icon: Package, 
      completed: delhiveryStatus.includes('delivered')
    },
  ];

  const currentStepIdx = steps.reduce((acc, step, idx) => step.completed ? idx : acc, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link to="/orders" className="flex items-center text-xs font-bold uppercase tracking-widest mb-8 hover:opacity-70 transition-opacity">
        <ArrowLeft size={16} className="mr-2" /> Back to Orders
      </Link>

      <div className="bg-white dark:bg-gray-950 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-900 shadow-2xl shadow-black/5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 space-y-4 md:space-y-0">
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Track Order</h1>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Order ID: #{order.id.slice(-8)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Estimated Delivery</p>
            <p className="text-xl font-black uppercase tracking-tighter">{order.deliveryEstimate || "Calculating..."}</p>
            <div className="flex items-center justify-end mt-2 space-x-2">
              <div className={`w-2 h-2 rounded-full ${trackingLoading ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`} />
              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">
                Live Updates Active • Last: {format(lastUpdated, "HH:mm:ss")}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative mb-20">
          <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 dark:bg-gray-900 -translate-y-1/2" />
          <div 
            className="absolute top-1/2 left-0 h-1 bg-black dark:bg-white -translate-y-1/2 transition-all duration-1000" 
            style={{ width: `${(currentStepIdx / (steps.length - 1)) * 100}%` }}
          />
          
          <div className="relative flex justify-between">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx <= currentStepIdx;
              const isCurrent = idx === currentStepIdx;

              return (
                <div key={step.id} className="flex flex-col items-center">
                  <motion.div 
                    initial={false}
                    animate={{ 
                      scale: isCurrent ? 1.2 : 1,
                      backgroundColor: isActive ? (isCurrent ? "#3b82f6" : "#000") : "#f3f4f6"
                    }}
                    className={`w-12 h-12 rounded-full flex items-center justify-center z-10 transition-all duration-500 ${
                      isActive ? 'text-white' : 'text-gray-400'
                    }`}
                  >
                    <Icon size={20} />
                  </motion.div>
                  <div className="absolute mt-14 text-center w-24">
                    <p className={`text-[10px] font-black uppercase tracking-widest leading-tight ${isActive ? 'text-black dark:text-white' : 'text-gray-400'}`}>
                      {step.label}
                    </p>
                    {step.date && (
                      <p className="text-[8px] font-bold text-gray-400 uppercase mt-1">
                        {format(new Date(step.date), "MMM dd")}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Shipping Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-12 border-t border-gray-50 dark:border-gray-900">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest mb-6 flex items-center">
              <MapPin size={14} className="mr-2" /> Delivery Address
            </h3>
            <div className="p-6 bg-gray-50 dark:bg-gray-900 rounded-3xl">
              <p className="font-bold uppercase tracking-tight mb-1">{order.address.name}</p>
              <p className="text-sm text-gray-500 leading-relaxed">
                {order.address.address}, {order.address.city}, {order.address.state} - {order.address.pincode}
              </p>
              <p className="text-xs font-bold mt-2 text-gray-400">{order.address.phone}</p>
            </div>
          </div>
          
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest mb-6 flex items-center">
              <Package size={14} className="mr-2" /> Shipment Info
            </h3>
            <div className="p-6 bg-gray-50 dark:bg-gray-900 rounded-3xl space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Courier</p>
                <p className="text-sm font-bold">Delhivery</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Tracking ID</p>
                <p className="text-sm font-black uppercase tracking-tighter">{order.trackingId || "Pending Assignment"}</p>
              </div>
              {trackingLoading ? (
                <div className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest text-blue-500">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Fetching Real-time Status...</span>
                </div>
              ) : trackingData?.ShipmentData?.[0]?.Shipment?.Status?.Status ? (
                <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Current Status</p>
                  <p className="text-sm font-black text-blue-500 uppercase tracking-tighter">
                    {trackingData.ShipmentData[0].Shipment.Status.Status}
                  </p>
                  <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">
                    Last Update: {trackingData.ShipmentData[0].Shipment.Status.StatusLocation}
                  </p>
                  {trackingData.ShipmentData[0].Shipment.Scans && (
                    <div className="mt-4 space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Recent Activity</p>
                      {trackingData.ShipmentData[0].Shipment.Scans.slice(0, 3).map((scan: any, idx: number) => (
                        <div key={idx} className="flex items-start space-x-3">
                          <div className="w-1 h-1 rounded-full bg-blue-500 mt-1.5" />
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-tight">{scan.ScanDetail.Scan}</p>
                            <p className="text-[8px] font-medium text-gray-400 uppercase">{scan.ScanDetail.ScannedLocation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : order.trackingId && (
                <div className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest text-red-500">
                  <AlertCircle size={12} />
                  <span>Tracking data unavailable</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
