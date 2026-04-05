import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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

        <p className="mt-10 text-[10px] text-gray-400 text-center uppercase tracking-widest leading-relaxed">
          By continuing, you agree to Munnu's <br />
          <span className="underline cursor-pointer">Terms of Service</span> and <span className="underline cursor-pointer">Privacy Policy</span>.
        </p>
      </motion.div>
    </div>
  );
}
