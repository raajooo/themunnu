import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../firebase";
import { signInWithCustomToken } from "firebase/auth";
import { motion } from "motion/react";
import { toast } from "react-hot-toast";
import { Phone, Lock, ArrowRight, Loader2 } from "lucide-react";

export default function Login() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, password })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        await signInWithCustomToken(auth, data.customToken);
        toast.success("Logged in successfully!");
        navigate("/profile");
      } else {
        const errorMsg = data.details ? `${data.error}: ${data.details}` : (data.error || "Login failed");
        toast.error(errorMsg);
      }
    } catch (error: any) {
      console.error("Login Error:", error);
      toast.error(error.message || "Something went wrong. Please try again later.");
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
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Welcome Back</h1>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-widest">Login with your phone and password</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="relative">
            <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="tel" 
              placeholder="Phone Number" 
              className="w-full pl-14 pr-6 py-5 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold text-lg"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
              maxLength={10}
              required
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="password" 
              placeholder="Password" 
              className="w-full pl-14 pr-6 py-5 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold text-lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
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
