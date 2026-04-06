import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth, googleProvider, facebookProvider } from "../firebase";
import { createUserWithEmailAndPassword, signInWithPopup, AuthProvider } from "firebase/auth";
import { doc, setDoc, getDocs, collection, query, where, getDoc } from "firebase/firestore";
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
      if (error.code === "auth/network-request-failed") message = "Network error. Please check your internet connection or disable ad blockers/Brave shields.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: AuthProvider, providerName: string) => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user exists in Firestore
      const userDocRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(userDocRef);

      if (!docSnap.exists()) {
        // Create new user document
        const adminEmail = "raajooothakur0@gmail.com";
        const isAdmin = (user.email && user.email.toLowerCase() === adminEmail);

        const newUser: UserType = {
          uid: user.uid,
          phoneNumber: user.phoneNumber || "",
          email: user.email || "",
          displayName: user.displayName || "",
          role: isAdmin ? "admin" : "user",
          addresses: [],
          createdAt: new Date().toISOString(),
        };
        await setDoc(userDocRef, newUser);
      }

      toast.success(`Registered with ${providerName}!`);
      navigate("/profile");
    } catch (error: any) {
      console.error(`${providerName} Registration Error:`, error);
      let message = `${providerName} registration failed.`;
      if (error.code === 'auth/popup-closed-by-user') {
        message = "Registration popup closed.";
      } else if (error.code === 'auth/network-request-failed') {
        message = "Network error. Please check your internet connection or disable ad blockers/Brave shields.";
      }
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

        <div className="mt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-950 text-gray-500 font-bold uppercase tracking-widest text-[10px]">Or continue with</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleSocialLogin(googleProvider, 'Google')}
              disabled={loading}
              className="w-full inline-flex justify-center py-3 px-4 border border-gray-300 dark:border-gray-800 rounded-2xl shadow-sm bg-white dark:bg-gray-900 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
                <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z" fill="#EA4335" />
                <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4" />
                <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05" />
                <path d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26537 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z" fill="#34A853" />
              </svg>
              <span className="sr-only">Sign up with Google</span>
            </button>

            <button
              type="button"
              onClick={() => handleSocialLogin(facebookProvider, 'Facebook')}
              disabled={loading}
              className="w-full inline-flex justify-center py-3 px-4 border border-gray-300 dark:border-gray-800 rounded-2xl shadow-sm bg-white dark:bg-gray-900 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <svg className="h-5 w-5 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
              </svg>
              <span className="sr-only">Sign up with Facebook</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
