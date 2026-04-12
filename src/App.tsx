import { useEffect, useState, lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { User } from "./types";
import { handleFirestoreError, OperationType } from "./lib/firestore-errors";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Pages
const Home = lazy(() => import("./pages/Home"));
const Shop = lazy(() => import("./pages/Shop"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Profile = lazy(() => import("./pages/Profile"));
const OrderHistory = lazy(() => import("./pages/OrderHistory"));
const OrderTracking = lazy(() => import("./pages/OrderTracking"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const ShippingPolicy = lazy(() => import("./pages/ShippingPolicy"));
const ReturnExchange = lazy(() => import("./pages/ReturnExchange"));
const AdminDashboard = lazy(() => import("./pages/Admin/Dashboard"));
const AdminProducts = lazy(() => import("./pages/Admin/Products"));
const AdminCategories = lazy(() => import("./pages/Admin/Categories"));
const AdminOrders = lazy(() => import("./pages/Admin/Orders"));
const AdminCoupons = lazy(() => import("./pages/Admin/Coupons"));
const AdminSettings = lazy(() => import("./pages/Admin/Settings"));
const AdminUsers = lazy(() => import("./pages/Admin/Users"));
const AdminBanners = lazy(() => import("./pages/Admin/Banners"));
const AdminNewsletters = lazy(() => import("./pages/Admin/Newsletters"));
const AdminReviews = lazy(() => import("./pages/Admin/Reviews"));

// Components
import Layout from "./components/Layout";
import AdminLayout from "./components/Admin/AdminLayout";
import ScrollToTop from "./components/ScrollToTop";
import FloatingBackButton from "./components/FloatingBackButton";
import PerformanceOptimizer from "./components/PerformanceOptimizer";

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Check session storage first
        const cachedUser = sessionStorage.getItem(`user_${firebaseUser.uid}`);
        if (cachedUser) {
          setUser(JSON.parse(cachedUser));
        }

        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const docSnap = await getDoc(userDocRef);
          
          if (docSnap.exists()) {
            const userData = docSnap.data() as User;
            setUser(userData);
            sessionStorage.setItem(`user_${firebaseUser.uid}`, JSON.stringify(userData));
          } else {
            const newUser: User = {
              uid: firebaseUser.uid,
              phoneNumber: firebaseUser.phoneNumber || "",
              role: "user",
              addresses: [],
              createdAt: new Date().toISOString(),
            };
            setUser(newUser);
            // We don't cache new user until it's saved in DB (usually happens during registration)
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setUser(null);
        // Clear all user-related session storage on logout
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('user_')) sessionStorage.removeItem(key);
        });
      }
    });

    // Copy Protection System
    const handleContextMenu = (e: MouseEvent) => {
      if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (isInput) return;

      // Disable Ctrl+C, Ctrl+X, Ctrl+S, Ctrl+U, Ctrl+Shift+I, F12
      if (
        (e.ctrlKey && (e.key === 'c' || e.key === 'x' || e.key === 's' || e.key === 'u')) ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        e.key === 'F12'
      ) {
        e.preventDefault();
      }
    };

    const handleDragStart = (e: DragEvent) => {
      if (e.target instanceof HTMLImageElement) {
        e.preventDefault();
      }
    };

    if (window.location.pathname !== '/admin' && !window.location.pathname.startsWith('/admin/')) {
      document.addEventListener('contextmenu', handleContextMenu);
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('dragstart', handleDragStart);
      document.body.style.userSelect = 'none';
    }

    return () => {
      unsubscribeAuth();
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('dragstart', handleDragStart);
      document.body.style.userSelect = 'auto';
    };
  }, []);

  const LoadingFallback = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-white dark:bg-black flex items-center justify-center"
    >
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-black dark:text-white" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 animate-pulse">MUNNU</p>
      </div>
    </motion.div>
  );

  const AnimatedRoutes = () => {
    const location = useLocation();
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Routes location={location}>
            {/* Public Routes */}
            <Route element={<Layout user={user} />}>
              <Route path="/" element={<Home />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout user={user} />} />
              <Route path="/login" element={<Login user={user} />} />
              <Route path="/register" element={<Register user={user} />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/profile" element={<Profile user={user} />} />
              <Route path="/orders" element={<OrderHistory user={user} />} />
              <Route path="/track/:id" element={<OrderTracking />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-service" element={<TermsOfService />} />
              <Route path="/shipping-policy" element={<ShippingPolicy />} />
              <Route path="/return-exchange" element={<ReturnExchange />} />
            </Route>

            {/* Admin Routes */}
            <Route path="/admin" element={user?.role === 'admin' ? <AdminLayout /> : <Navigate to="/login" />}>
              <Route index element={<AdminDashboard />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="coupons" element={<AdminCoupons />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="banners" element={<AdminBanners />} />
              <Route path="newsletters" element={<AdminNewsletters />} />
              <Route path="reviews" element={<AdminReviews />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
          </Routes>
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <Router>
      <ScrollToTop />
      <PerformanceOptimizer />
      <FloatingBackButton />
      <Toaster position="top-center" />
      <Suspense fallback={<LoadingFallback />}>
        <AnimatedRoutes />
      </Suspense>
    </Router>
  );
}
