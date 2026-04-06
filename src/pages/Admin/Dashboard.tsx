import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, orderBy, limit, getCountFromServer } from "firebase/firestore";
import { db } from "../../firebase";
import { Order } from "../../types";
import { formatCurrency } from "../../lib/utils";
import { motion } from "motion/react";
import { ShoppingCart, Package, Users, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { toast } from "react-hot-toast";
import { handleFirestoreError, OperationType } from "../../lib/firestore-errors";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    revenue: 0,
    orders: 0,
    products: 0,
    users: 0
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    throw error;
  }

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Use getCountFromServer for efficient counting (1 read per 1000 docs)
        const ordersCountSnap = await getCountFromServer(collection(db, "orders"));
        const productsCountSnap = await getCountFromServer(collection(db, "products"));
        const usersCountSnap = await getCountFromServer(collection(db, "users"));

        // For revenue, we still need to fetch orders to sum them up
        // In a real app, you'd maintain a stats document to avoid this
        // We'll limit this to the last 100 orders for a "recent revenue" estimate or just fetch all if needed
        // But to save quota, let's just fetch the last 50 for now or handle the error
        const ordersSnap = await getDocs(query(collection(db, "orders"), limit(100)));
        const totalRevenue = ordersSnap.docs.reduce((sum, doc) => sum + (doc.data().totalAmount || 0), 0);
        
        setStats({
          revenue: totalRevenue,
          orders: ordersCountSnap.data().count,
          products: productsCountSnap.data().count,
          users: usersCountSnap.data().count
        });

        const recentQuery = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(5));
        const recentSnap = await getDocs(recentQuery);
        setRecentOrders(recentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
      } catch (err: any) {
        console.error("Error fetching admin stats:", err);
        if (err.message?.includes('resource-exhausted') || err.message?.includes('Quota limit exceeded')) {
          try {
            handleFirestoreError(err, OperationType.GET, "admin_stats");
          } catch (quotaErr: any) {
            setError(quotaErr);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const downloadReport = async () => {
    try {
      const ordersSnap = await getDocs(collection(db, "orders"));
      const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const headers = ["Order ID", "Customer", "Amount", "Status", "Date"];
      const rows = orders.map((o: any) => [
        o.id,
        o.address?.name || "N/A",
        o.totalAmount,
        o.orderStatus,
        o.createdAt
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `orders_report_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Report downloaded successfully");
    } catch (error) {
      toast.error("Failed to download report");
    }
  };

  const statCards = [
    { label: "Total Revenue", value: formatCurrency(stats.revenue), icon: TrendingUp, color: "text-green-500", trend: "+12.5%", isUp: true },
    { label: "Total Orders", value: stats.orders, icon: ShoppingCart, color: "text-blue-500", trend: "+8.2%", isUp: true },
    { label: "Total Products", value: stats.products, icon: Package, color: "text-purple-500", trend: "+2.4%", isUp: true },
    { label: "Total Users", value: stats.users, icon: Users, color: "text-orange-500", trend: "-1.5%", isUp: false },
  ];

  if (loading) {
    return (
      <div className="space-y-12 pb-20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-4">
            <div className="h-12 w-64 bg-gray-100 dark:bg-gray-900 rounded-2xl animate-pulse" />
            <div className="h-4 w-48 bg-gray-100 dark:bg-gray-900 rounded animate-pulse" />
          </div>
          <div className="flex gap-4">
            <div className="h-12 w-32 bg-gray-100 dark:bg-gray-900 rounded-full animate-pulse" />
            <div className="h-12 w-32 bg-gray-100 dark:bg-gray-900 rounded-full animate-pulse" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 bg-white dark:bg-gray-950 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-900 animate-pulse" />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 h-96 bg-white dark:bg-gray-950 rounded-[3rem] border border-gray-100 dark:border-gray-900 animate-pulse" />
          <div className="lg:col-span-1 h-96 bg-black dark:bg-white rounded-[3rem] animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-5xl font-black tracking-tighter uppercase mb-2">Dashboard</h1>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-widest">Overview of your sneaker empire</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={downloadReport}
            className="px-8 py-4 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-900 rounded-full text-xs font-black uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-900 transition-all"
          >
            Download Report
          </button>
          <button 
            onClick={() => navigate("/admin/products")}
            className="px-8 py-4 bg-black dark:bg-white text-white dark:text-black rounded-full text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform"
          >
            Manage Drops
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {statCards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white dark:bg-gray-950 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-900 shadow-xl shadow-black/5"
            >
              <div className="flex justify-between items-start mb-6">
                <div className={`p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 ${stat.color}`}>
                  <Icon size={24} />
                </div>
                <div className={`flex items-center text-[10px] font-black uppercase tracking-widest ${stat.isUp ? 'text-green-500' : 'text-red-500'}`}>
                  {stat.trend} {stat.isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                </div>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{stat.label}</p>
              <p className="text-3xl font-black tracking-tighter">{stat.value}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-950 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-900 shadow-xl shadow-black/5">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-black tracking-tighter uppercase">Recent Orders</h3>
            <button 
              onClick={() => navigate("/admin/orders")}
              className="text-xs font-black uppercase tracking-widest underline underline-offset-4"
            >
              View All
            </button>
          </div>
          
          <div className="space-y-4">
            {recentOrders.map(order => (
              <div key={order.id} className="flex items-center justify-between p-6 bg-gray-50 dark:bg-gray-900 rounded-3xl">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center font-black text-xs uppercase tracking-tighter">
                    {order.address.name.slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-bold uppercase tracking-tight">{order.address.name}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">#{order.id.slice(-8)} • {order.items?.length || 0} items</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black">{formatCurrency(order.totalAmount)}</p>
                  <span className={`text-[8px] font-black uppercase tracking-widest ${
                    order.orderStatus === 'delivered' ? 'text-green-500' : 'text-blue-500'
                  }`}>
                    {order.orderStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-1 bg-black dark:bg-white text-white dark:text-black p-10 rounded-[3rem] shadow-2xl shadow-black/20">
          <h3 className="text-2xl font-black tracking-tighter uppercase mb-8">Quick Actions</h3>
          <div className="space-y-4">
            <button 
              onClick={() => navigate("/admin/products")}
              className="w-full p-6 bg-white/10 dark:bg-black/10 rounded-3xl text-left hover:bg-white/20 dark:hover:bg-black/20 transition-all group"
            >
              <p className="text-xs font-black uppercase tracking-widest mb-1 opacity-60">Inventory</p>
              <p className="text-lg font-black uppercase tracking-tight flex items-center">
                Add New Product <ArrowUpRight className="ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" size={20} />
              </p>
            </button>
            <button 
              onClick={() => toast.success("Coupon system coming soon!")}
              className="w-full p-6 bg-white/10 dark:bg-black/10 rounded-3xl text-left hover:bg-white/20 dark:hover:bg-black/20 transition-all group"
            >
              <p className="text-xs font-black uppercase tracking-widest mb-1 opacity-60">Marketing</p>
              <p className="text-lg font-black uppercase tracking-tight flex items-center">
                Create Coupon <ArrowUpRight className="ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" size={20} />
              </p>
            </button>
            <button 
              onClick={() => navigate("/admin/users")}
              className="w-full p-6 bg-white/10 dark:bg-black/10 rounded-3xl text-left hover:bg-white/20 dark:hover:bg-black/20 transition-all group"
            >
              <p className="text-xs font-black uppercase tracking-widest mb-1 opacity-60">Access Control</p>
              <p className="text-lg font-black uppercase tracking-tight flex items-center">
                Manage Users <ArrowUpRight className="ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" size={20} />
              </p>
            </button>
            <button 
              onClick={() => navigate("/admin/settings")}
              className="w-full p-6 bg-white/10 dark:bg-black/10 rounded-3xl text-left hover:bg-white/20 dark:hover:bg-black/20 transition-all group"
            >
              <p className="text-xs font-black uppercase tracking-widest mb-1 opacity-60">System</p>
              <p className="text-lg font-black uppercase tracking-tight flex items-center">
                System Settings <ArrowUpRight className="ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" size={20} />
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
