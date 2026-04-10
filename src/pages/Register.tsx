import React, { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { auth } from "../firebase";
import { signInWithCustomToken } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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
  const [step, setStep] = useState<"form" | "otp">("form");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [honeypot, setHoneypot] = useState(""); // Bot protection
  const [otpToken, setOtpToken] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [formData, setFormData] = useState({
    phoneNumber: "",
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    otp: ""
  });

  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from || "/";

  React.useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  React.useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (honeypot) return;

    if (!checkRateLimit("register_otp", 3, 60000)) {
      toast.error("Too many attempts. Please wait a minute.");
      return;
    }

    if (!formData.email.includes("@")) {
      toast.error("Please enter a valid email address");
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
    const otpToast = toast.loading("Sending verification code...");
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          identifier: formData.email,
          phoneNumber: formData.phoneNumber,
          type: "register"
        })
      }).catch(err => {
        console.error("Fetch error:", err);
        throw new Error("Network error: Could not reach the server. Please check your internet connection or try again later.");
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send OTP");
      }

      setOtpToken(data.otpToken);
      setStep("otp");
      setResendTimer(60);
      toast.success("Verification code sent to your email!", { id: otpToast });
    } catch (error: any) {
      console.error("OTP Error:", error);
      toast.error(error.message || "Failed to send verification code.", { id: otpToast });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.otp || formData.otp.length !== 6) {
      toast.error("Please enter the 6-digit verification code");
      return;
    }

    setLoading(true);
    const regToast = toast.loading("Creating your account...");
    try {
      const phone = formData.phoneNumber.replace(/\D/g, "").slice(-10);
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phone,
          fullName: formData.fullName,
          email: formData.email,
          password: formData.password,
          otp: formData.otp,
          otpToken
        })
      }).catch(err => {
        console.error("Fetch error:", err);
        throw new Error("Network error: Could not reach the server. Please check your internet connection or try again later.");
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      if (data.customToken) {
        await signInWithCustomToken(auth, data.customToken);
        toast.success("Registration successful!", { id: regToast });
        navigate(from, { replace: true });
      }
    } catch (error: any) {
      console.error("Registration Error:", error);
      toast.error(error.message || "Registration failed. Please try again.", { id: regToast });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-20">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-md bg-white dark:bg-gray-950 p-8 md:p-12 rounded-[2.5rem] border border-gray-100 dark:border-gray-900 shadow-2xl shadow-black/5"
      >
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Join Munnu</h1>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-widest">
            {step === "form" ? "Create your account" : "Verify your email"}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === "form" ? (
            <motion.form 
              key="register-form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleSendOtp} 
              className="space-y-4"
            >
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
                  placeholder="Email Address" 
                  className="w-full pl-14 pr-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
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
                  <>Continue <ArrowRight className="ml-2" size={18} /></>
                )}
              </button>
              <p className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest mt-4">
                Already have an account? <Link to="/login" state={{ from }} className="text-black dark:text-white underline">Login</Link>
              </p>
            </motion.form>
          ) : (
            <motion.form 
              key="otp-form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleRegister} 
              className="space-y-6"
            >
              <div className="text-center mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Verification code sent to {formData.email}
                </p>
              </div>
              <div className="relative">
                <ShieldCheck className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="text" 
                  placeholder="6-digit OTP" 
                  className="w-full pl-14 pr-6 py-5 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-black text-2xl tracking-[0.5em] text-center"
                  value={formData.otp}
                  onChange={(e) => setFormData({...formData, otp: e.target.value.replace(/\D/g, "")})}
                  maxLength={6}
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-5 bg-black dark:bg-white text-white dark:text-black font-black text-sm uppercase tracking-[0.2em] rounded-full hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : (
                  <>Verify & Register <ArrowRight className="ml-2" size={18} /></>
                )}
              </button>

              <div className="flex flex-col items-center space-y-4">
                <button 
                  type="button"
                  disabled={loading || resendTimer > 0}
                  onClick={handleSendOtp}
                  className="text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-black dark:hover:text-white transition-colors disabled:opacity-50"
                >
                  {resendTimer > 0 ? `Resend code in ${resendTimer}s` : "Resend Verification Code"}
                </button>

                <button 
                  type="button"
                  onClick={() => setStep("form")}
                  className="text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-black dark:hover:text-white transition-colors"
                >
                  Change Details
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
