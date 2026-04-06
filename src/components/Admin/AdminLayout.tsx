import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, ShoppingCart, Settings, LogOut, Menu, X, Tags, Users, ArrowRight, ChevronLeft, Tag, Image as ImageIcon } from "lucide-react";
import React, { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";

export default function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Minimum swipe distance
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    // Don't trigger swipe if we're touching a scrollable element
    const target = e.target as HTMLElement;
    const isScrollable = target.closest('.overflow-x-auto');
    if (isScrollable) return;

    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isRightSwipe) {
      setIsSidebarOpen(true);
    } else if (isLeftSwipe) {
      setIsSidebarOpen(false);
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  };

  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    toast.success("Admin logged out");
    navigate("/login");
  };

  const navItems = [
    { path: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/admin/products", icon: Package, label: "Products" },
    { path: "/admin/categories", icon: Tags, label: "Categories" },
    { path: "/admin/coupons", icon: Tag, label: "Coupons" },
    { path: "/admin/orders", icon: ShoppingCart, label: "Orders" },
    { path: "/admin/banners", icon: ImageIcon, label: "Banners" },
    { path: "/admin/users", icon: Users, label: "Users" },
    { path: "/admin/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div 
      className="min-h-screen bg-gray-50 dark:bg-black flex"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.1}
        onDragEnd={(_, info) => {
          if (info.offset.x < -50) {
            setIsSidebarOpen(false);
          }
        }}
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-900 transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-gray-200 dark:border-gray-900 flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <Link to="/admin" onClick={() => setIsSidebarOpen(false)} className="text-2xl font-black tracking-tighter">MUNNU ADMIN</Link>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full">
                <X size={20} />
              </button>
            </div>
          </div>

          <nav className="flex-grow p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center space-x-4 p-4 rounded-2xl transition-all font-bold text-sm uppercase tracking-widest ${isActive ? 'bg-black dark:bg-white text-white dark:text-black shadow-xl shadow-black/10' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900'}`}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-200 dark:border-gray-900 space-y-2">
            <Link 
              to="/"
              className="flex items-center space-x-4 p-4 rounded-2xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900 transition-all font-bold text-sm uppercase tracking-widest"
            >
              <ArrowRight size={20} className="rotate-180" />
              <span>Exit Admin Panel</span>
            </Link>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center space-x-4 p-4 rounded-2xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all font-bold text-sm uppercase tracking-widest"
            >
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-grow lg:ml-64">
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-900 h-16 flex items-center justify-between px-8">
          <div className="flex items-center space-x-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full">
              <Menu size={20} />
            </button>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-black uppercase tracking-widest">Administrator</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{auth.currentUser?.phoneNumber}</p>
            </div>
            <div className="w-10 h-10 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center font-black">A</div>
          </div>
        </header>

        <div className="p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
