import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Order } from "../types";
import { format } from "date-fns";
import { motion } from "motion/react";
import { Package, Truck, CheckCircle2, MapPin, ArrowLeft, Clock } from "lucide-react";

export default function OrderTracking() {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, "orders", id));
        if (snap.exists()) {
          setOrder({ id: snap.id, ...snap.data() } as Order);
        }
      } catch (error) {
        console.error("Error fetching order:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="h-8 w-32 bg-gray-100 dark:bg-gray-900 rounded animate-pulse mb-8" />
        <div className="bg-white dark:bg-gray-950 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-900 animate-pulse h-96" />
      </div>
    );
  }
  if (!order) return <div className="py-20 text-center">Order not found</div>;

  const steps = [
    { status: 'pending', label: 'Order Placed', icon: Clock, date: order.createdAt },
    { status: 'confirmed', label: 'Confirmed', icon: CheckCircle2, date: null },
    { status: 'shipped', label: 'Shipped', icon: Truck, date: null },
    { status: 'delivered', label: 'Delivered', icon: Package, date: null },
  ];

  const currentStepIdx = steps.findIndex(s => s.status === order.orderStatus);

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
                <div key={step.status} className="flex flex-col items-center">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center z-10 transition-all duration-500 ${
                    isActive ? 'bg-black dark:bg-white text-white dark:text-black scale-110' : 'bg-gray-100 dark:bg-gray-900 text-gray-400'
                  }`}>
                    <Icon size={20} />
                  </div>
                  <div className="absolute mt-14 text-center">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-black dark:text-white' : 'text-gray-400'}`}>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
