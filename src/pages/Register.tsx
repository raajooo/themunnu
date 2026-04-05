import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDocs, collection, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "react-hot-toast";
import { Phone, User, Mail, Lock, ShieldCheck, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { checkRateLimit } from "../lib/rate-limit";

import { User as UserType } from "../types";

interface RegisterProps {
  user: UserType | null;
}

export default function Register({ user }: RegisterProps) {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [honeypot, setHoneypot] = useState(""); // Bot protection
  const [formData, setFormData] = useState({
    phoneNumber: "",
    fullName: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

  const navigate = useNavigate();

  React.useEffect(() => {
    if (user) {
      navigate("/profile");
    }
  }, [user, navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Bot protection: if honeypot is filled, ignore the request
    if (honeypot) {
      console.warn("Bot detected via honeypot");
      return;
    }

    // Rate limiting: max 3 attempts per minute for registration
    if (!checkRateLimit("register", 3, 60000)) {
      toast.error("Too many registration attempts. Please wait a minute.");
      return;
    }

    const phone = formData.phoneNumber.replace(/\D/g, "").slice(-10);
    if (phone.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }
    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      // Check if phone number already exists in Firestore (since it's our primary identifier)
      const phoneSnap = await getDocs(query(collection(db, "users"), where("phoneNumber", "==", phone)));
      if (!phoneSnap.empty) {
        toast.error("Phone number already registered");
        setLoading(false);
        return;
      }

      // Use email if provided, otherwise use phone-based email
      const email = formData.email ? formData.email.toLowerCase() : `${phone}@munnu.com`;

      // 1. Create Firebase Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, email, formData.password);
      const firebaseUser = userCredential.user;

      // 2. Create User Profile in Firestore
      const adminEmail = "raajooothakur0@gmail.com";
      const adminPhone = "9193731911";
      const isAdmin = (phone === adminPhone || (formData.email && formData.email.toLowerCase() === adminEmail));

      const userDoc: UserType = {
        uid: firebaseUser.uid,
        phoneNumber: phone,
        displayName: formData.fullName,
        email: formData.email ? formData.email.toLowerCase() : "",
        role: isAdmin ? "admin" : "user",
        addresses: [],
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "users", firebaseUser.uid), userDoc);
      
      toast.success("Registration successful!");
      navigate("/");
    } catch (error: any) {
      console.error("Registration Error:", error);
      let message = "Registration failed. Please try again.";
      if (error.code === "auth/email-already-in-use") message = "Email already in use.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-20">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-gray-950 p-8 md:p-12 rounded-[2.5rem] border border-gray-100 dark:border-gray-900 shadow-2xl shadow-black/5"
      >
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Join Munnu</h1>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-widest">
            Create your account
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {/* Honeypot field - hidden from users but visible to bots */}
          <div className="hidden" aria-hidden="true">
            <input 
              type="text" 
              name="website" 
              value={honeypot} 
              onChange={(e) => setHoneypot(e.target.value)} 
              tabIndex={-1} 
              autoComplete="off" 
            />
          </div>

          <div className="relative">
            <User className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Full Name" 
              className="w-full pl-14 pr-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})}
              required
            />
          </div>
          <div className="relative">
            <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="tel" 
              placeholder="Phone Number" 
              className="w-full pl-14 pr-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({...formData, phoneNumber: e.target.value.replace(/\D/g, "")})}
              maxLength={10}
              required
            />
          </div>
          <div className="relative">
            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="email" 
              placeholder="Email (Recommended for Login)" 
              className="w-full pl-14 pr-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Create Password" 
              className="w-full pl-14 pr-14 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <div className="relative">
            <ShieldCheck className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type={showConfirmPassword ? "text" : "password"} 
              placeholder="Confirm Password" 
              className="w-full pl-14 pr-14 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
            >
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-5 bg-black dark:bg-white text-white dark:text-black font-black text-sm uppercase tracking-[0.2em] rounded-full hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50 mt-4"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (
              <>Register <ArrowRight className="ml-2" size={18} /></>
            )}
          </button>
          <p className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest mt-4">
            Already have an account? <Link to="/login" className="text-black dark:text-white underline">Login</Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
