import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth, googleProvider, facebookProvider } from "../firebase";
import { signInWithEmailAndPassword, signInWithPopup, AuthProvider } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { motion } from "motion/react";
import { toast } from "react-hot-toast";
import { Phone, Lock, ArrowRight, Loader2, Eye, EyeOff, Mail } from "lucide-react";
import { checkRateLimit } from "../lib/rate-limit";

import { User } from "../types";

interface LoginProps {
  user: User | null;
}

export default function Login({ user }: LoginProps) {
  const [identifier, setIdentifier] = useState(""); // Can be email or phone
  const [password, setPassword] = useState("");
  const [honeypot, setHoneypot] = useState(""); // Bot protection
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user) {
      navigate("/profile");
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Bot protection: if honeypot is filled, ignore the request
    if (honeypot) {
      console.warn("Bot detected via honeypot");
      return;
    }

    // Rate limiting: max 5 attempts per minute
    if (!checkRateLimit("login", 5, 60000)) {
      toast.error("Too many login attempts. Please wait a minute.");
      return;
    }

    if (!identifier.trim()) {
      toast.error("Please enter your email or phone number");
      return;
    }

    setLoading(true);
    try {
      // If it's a phone number, convert to email format for Firebase Auth
      const isEmail = identifier.includes("@");
      const email = isEmail ? identifier.toLowerCase() : `${identifier.replace(/\D/g, "").slice(-10)}@munnu.com`;

      await signInWithEmailAndPassword(auth, email, password);
      
      toast.success("Logged in successfully!");
      navigate("/profile");
    } catch (error: any) {
      console.error("Login Error:", error);
      let message = "Login failed. Please check your credentials.";
      if (error.code === "auth/user-not-found") message = "User not found.";
      if (error.code === "auth/wrong-password") message = "Incorrect password.";
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
        const newUser: User = {
          uid: user.uid,
          phoneNumber: user.phoneNumber || "",
          email: user.email || "",
          displayName: user.displayName || "",
          role: "user",
          addresses: [],
          createdAt: new Date().toISOString(),
        };
        await setDoc(userDocRef, newUser);
      }

      toast.success(`Logged in with ${providerName}!`);
      navigate("/profile");
    } catch (error: any) {
      console.error(`${providerName} Login Error:`, error);
      let message = `${providerName} login failed.`;
      if (error.code === 'auth/popup-closed-by-user') {
        message = "Login popup closed.";
      } else if (error.code === 'auth/network-request-failed') {
        message = "Network error. Please check your internet connection or disable ad blockers/Brave shields.";
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const isEmail = identifier.includes("@");

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-20">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-gray-950 p-8 md:p-12 rounded-[2.5rem] border border-gray-100 dark:border-gray-900 shadow-2xl shadow-black/5"
      >
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Welcome Back</h1>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-widest">Login with your email/phone and password</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
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
            {isEmail ? (
              <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            ) : (
              <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            )}
            <input 
              type="text" 
              placeholder="Email or Phone Number" 
              className="w-full pl-14 pr-6 py-5 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold text-lg"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Password" 
              className="w-full pl-14 pr-14 py-5 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold text-lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
          <div className="flex justify-end">
            <Link to="/forgot-password" title="Forgot Password" className="text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-black dark:hover:text-white transition-colors">
              Forgot Password?
            </Link>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-5 bg-black dark:bg-white text-white dark:text-black font-black text-sm uppercase tracking-[0.2em] rounded-full hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (
              <>Login <ArrowRight className="ml-2" size={18} /></>
            )}
          </button>
          <p className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest mt-4">
            Don't have an account? <Link to="/register" className="text-black dark:text-white underline">Register</Link>
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
              <span className="sr-only">Sign in with Google</span>
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
              <span className="sr-only">Sign in with Facebook</span>
            </button>
          </div>
        </div>

        <p className="mt-10 text-[10px] text-gray-400 text-center uppercase tracking-widest leading-relaxed">
          By continuing, you agree to Munnu's <br />
          <span className="underline cursor-pointer">Terms of Service</span> and <span className="underline cursor-pointer">Privacy Policy</span>.
        </p>
      </motion.div>
    </div>
  );
}
