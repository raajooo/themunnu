import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { User } from "./types";
import { handleFirestoreError, OperationType } from "./lib/firestore-errors";

// Pages
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Profile from "./pages/Profile";
import OrderHistory from "./pages/OrderHistory";
import OrderTracking from "./pages/OrderTracking";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import ShippingPolicy from "./pages/ShippingPolicy";
import ReturnExchange from "./pages/ReturnExchange";
import AdminDashboard from "./pages/Admin/Dashboard";
import AdminProducts from "./pages/Admin/Products";
import AdminCategories from "./pages/Admin/Categories";
import AdminOrders from "./pages/Admin/Orders";
import AdminCoupons from "./pages/Admin/Coupons";
import AdminSettings from "./pages/Admin/Settings";
import AdminUsers from "./pages/Admin/Users";

// Components
import Layout from "./components/Layout";
import AdminLayout from "./components/Admin/AdminLayout";
import ScrollToTop from "./components/ScrollToTop";
import FloatingBackButton from "./components/FloatingBackButton";

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

  return (
    <Router>
      <ScrollToTop />
      <FloatingBackButton />
      <Toaster position="top-center" />
      <Routes>
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
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Routes>
    </Router>
  );
}
