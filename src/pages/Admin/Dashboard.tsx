import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { Order } from "../../types";
import { formatCurrency } from "../../lib/utils";
import { motion } from "motion/react";
import { ShoppingCart, Package, Users, TrendingUp, ArrowUpRight, ArrowDownRight, Calendar } from "lucide-react";
import { toast } from "react-hot-toast";
import { handleFirestoreError, OperationType } from "../../lib/firestore-errors";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from "recharts";
import { 
  startOfMonth, 
  subMonths, 
  endOfMonth, 
  isWithinInterval, 
  format, 
  subDays, 
  eachDayOfInterval,
  isSameDay
} from "date-fns";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [productsCount, setProductsCount] = useState(0);
  const [usersCount, setUsersCount] = useState(0);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    throw error;
  }

  useEffect(() => {
    setLoading(true);
    
    // Real-time Orders
    const unsubscribeOrders = onSnapshot(
      query(collection(db, "orders"), orderBy("createdAt", "desc")),
      (snapshot) => {
        const orderData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
        setOrders(orderData);
        setLoading(false);
      },
      (err) => {
        console.error("Orders snapshot error:", err);
        handleFirestoreError(err, OperationType.LIST, "orders");
      }
    );

    // Real-time Products
    const unsubscribeProducts = onSnapshot(
      collection(db, "products"),
      (snapshot) => {
        setProductsCount(snapshot.size);
        setAllProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    // Real-time Users
    const unsubscribeUsers = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        setUsersCount(snapshot.size);
        setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    return () => {
      unsubscribeOrders();
      unsubscribeProducts();
      unsubscribeUsers();
    };
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    const calculateGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    // Revenue Stats
    const currentMonthRevenue = orders
      .filter(o => isWithinInterval(new Date(o.createdAt), { start: currentMonthStart, end: currentMonthEnd }))
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    
    const lastMonthRevenue = orders
      .filter(o => isWithinInterval(new Date(o.createdAt), { start: lastMonthStart, end: lastMonthEnd }))
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    // Order Stats
    const currentMonthOrders = orders.filter(o => isWithinInterval(new Date(o.createdAt), { start: currentMonthStart, end: currentMonthEnd })).length;
    const lastMonthOrders = orders.filter(o => isWithinInterval(new Date(o.createdAt), { start: lastMonthStart, end: lastMonthEnd })).length;

    // Product Stats
    const currentMonthProducts = allProducts.filter(p => p.createdAt && isWithinInterval(new Date(p.createdAt), { start: currentMonthStart, end: currentMonthEnd })).length;
    const lastMonthProducts = allProducts.filter(p => p.createdAt && isWithinInterval(new Date(p.createdAt), { start: lastMonthStart, end: lastMonthEnd })).length;

    // User Stats
    const currentMonthUsers = allUsers.filter(u => u.createdAt && isWithinInterval(new Date(u.createdAt), { start: currentMonthStart, end: currentMonthEnd })).length;
    const lastMonthUsers = allUsers.filter(u => u.createdAt && isWithinInterval(new Date(u.createdAt), { start: lastMonthStart, end: lastMonthEnd })).length;

    return {
      revenue: {
        total: totalRevenue,
        growth: calculateGrowth(currentMonthRevenue, lastMonthRevenue)
      },
      orders: {
        total: orders.length,
        growth: calculateGrowth(currentMonthOrders, lastMonthOrders)
      },
      products: {
        total: productsCount,
        growth: calculateGrowth(currentMonthProducts, lastMonthProducts)
      },
      users: {
        total: usersCount,
        growth: calculateGrowth(currentMonthUsers, lastMonthUsers)
      }
    };
  }, [orders, allProducts, allUsers, productsCount, usersCount]);

  const chartData = useMemo(() => {
    const last7Days = eachDayOfInterval({
      start: subDays(new Date(), 6),
      end: new Date()
    });

    return last7Days.map(day => {
      const dayOrders = orders.filter(o => isSameDay(new Date(o.createdAt), day));
      const revenue = dayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      return {
        name: format(day, "EEE"),
        revenue: revenue,
        orders: dayOrders.length
      };
    });
  }, [orders]);

  const downloadReport = () => {
    try {
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
    { label: "Total Revenue", value: formatCurrency(stats.revenue.total), icon: TrendingUp, color: "text-green-500", trend: stats.revenue.growth.toFixed(1) + "%", isUp: stats.revenue.growth >= 0 },
    { label: "Total Orders", value: stats.orders.total, icon: ShoppingCart, color: "text-blue-500", trend: stats.orders.growth.toFixed(1) + "%", isUp: stats.orders.growth >= 0 },
    { label: "Total Products", value: stats.products.total, icon: Package, color: "text-purple-500", trend: stats.products.growth.toFixed(1) + "%", isUp: stats.products.growth >= 0 },
    { label: "Total Users", value: stats.users.total, icon: Users, color: "text-orange-500", trend: stats.users.growth.toFixed(1) + "%", isUp: stats.users.growth >= 0 },
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
                  {stat.isUp ? '+' : ''}{stat.trend} {stat.isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                </div>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{stat.label}</p>
              <p className="text-3xl font-black tracking-tighter">{stat.value}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Chart */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 bg-white dark:bg-gray-950 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-900 shadow-xl shadow-black/5"
        >
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-black tracking-tighter uppercase">Revenue Performance</h3>
            <div className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <Calendar size={14} />
              <span>Last 7 Days</span>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: '#999' }}
                  dy={10}
                />
                <YAxis 
                  hide 
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '20px', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    padding: '15px'
                  }}
                  itemStyle={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase' }}
                  labelStyle={{ fontSize: '10px', fontWeight: 900, color: '#999', marginBottom: '5px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#10b981" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Order Volume Chart */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-1 bg-black dark:bg-white text-white dark:text-black p-10 rounded-[3rem] shadow-2xl shadow-black/20"
        >
          <h3 className="text-2xl font-black tracking-tighter uppercase mb-8">Order Volume</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: '#666' }}
                  dy={10}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                  contentStyle={{ 
                    borderRadius: '20px', 
                    border: 'none', 
                    backgroundColor: '#111',
                    color: '#fff',
                    padding: '15px'
                  }}
                  itemStyle={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', color: '#fff' }}
                  labelStyle={{ fontSize: '10px', fontWeight: 900, color: '#666', marginBottom: '5px' }}
                />
                <Bar dataKey="orders" radius={[10, 10, 10, 10]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#fff' : '#333'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Orders */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="lg:col-span-2 bg-white dark:bg-gray-950 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-900 shadow-xl shadow-black/5"
        >
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
            {orders.slice(0, 5).map((order, idx) => (
              <motion.div 
                key={order.id} 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + (idx * 0.1) }}
                className="flex items-center justify-between p-6 bg-gray-50 dark:bg-gray-900 rounded-3xl hover:scale-[1.01] transition-transform cursor-pointer"
                onClick={() => navigate("/admin/orders")}
              >
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
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="lg:col-span-1 bg-gray-50 dark:bg-gray-900 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-800"
        >
          <h3 className="text-2xl font-black tracking-tighter uppercase mb-8">Quick Actions</h3>
          <div className="space-y-4">
            <button 
              onClick={() => navigate("/admin/products")}
              className="w-full p-6 bg-white dark:bg-gray-950 rounded-3xl text-left border border-gray-100 dark:border-gray-800 hover:scale-[1.02] transition-all group shadow-sm"
            >
              <p className="text-xs font-black uppercase tracking-widest mb-1 text-gray-400">Inventory</p>
              <p className="text-lg font-black uppercase tracking-tight flex items-center">
                Add New Product <ArrowUpRight className="ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" size={20} />
              </p>
            </button>
            <button 
              onClick={() => navigate("/admin/coupons")}
              className="w-full p-6 bg-white dark:bg-gray-950 rounded-3xl text-left border border-gray-100 dark:border-gray-800 hover:scale-[1.02] transition-all group shadow-sm"
            >
              <p className="text-xs font-black uppercase tracking-widest mb-1 text-gray-400">Marketing</p>
              <p className="text-lg font-black uppercase tracking-tight flex items-center">
                Manage Coupons <ArrowUpRight className="ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" size={20} />
              </p>
            </button>
            <button 
              onClick={() => navigate("/admin/users")}
              className="w-full p-6 bg-white dark:bg-gray-950 rounded-3xl text-left border border-gray-100 dark:border-gray-800 hover:scale-[1.02] transition-all group shadow-sm"
            >
              <p className="text-xs font-black uppercase tracking-widest mb-1 text-gray-400">Access Control</p>
              <p className="text-lg font-black uppercase tracking-tight flex items-center">
                Manage Users <ArrowUpRight className="ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" size={20} />
              </p>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
