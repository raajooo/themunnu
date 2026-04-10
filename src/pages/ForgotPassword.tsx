import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "react-hot-toast";
import { Phone, Lock, ShieldCheck, ArrowRight, Loader2, Mail, Eye, EyeOff } from "lucide-react";

export default function ForgotPassword() {
  const [step, setStep] = useState<"identifier" | "otp">("identifier");
  const [loading, setLoading] = useState(false);
  const [otpToken, setOtpToken] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [formData, setFormData] = useState({
    email: "",
    phoneNumber: "", // Will be populated from backend
    newPassword: "",
    confirmPassword: "",
    otp: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigate = useNavigate();

  React.useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email.trim() || !formData.email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          identifier: formData.email,
          type: "forgot-password"
        })
      }).catch(err => {
        console.error("Fetch error:", err);
        throw new Error("Network error: Could not reach the server. Please check your internet connection or try again later.");
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setOtpToken(data.otpToken);
        setFormData(prev => ({ ...prev, phoneNumber: data.phoneNumber }));
        setStep("otp");
        setResendTimer(60);
        toast.success("Verification code sent to your email!");
      } else {
        toast.error(data.error || "Failed to send OTP. Please check your email.");
      }
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          phoneNumber: formData.phoneNumber,
          newPassword: formData.newPassword,
          otp: formData.otp,
          otpToken 
        })
      }).catch(err => {
        console.error("Fetch error:", err);
        throw new Error("Network error: Could not reach the server. Please check your internet connection or try again later.");
      });
      const data = await response.json();
      if (data.success) {
        toast.success("Password reset successfully!");
        navigate("/login");
      } else {
        toast.error(data.error || "Reset failed");
      }
    } catch (error) {
      toast.error("Something went wrong");
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
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Reset Password</h1>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-widest">
            {step === "identifier" ? "Enter your email to receive OTP" : "Enter OTP and new password"}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === "identifier" ? (
            <motion.form 
              key="identifier-step"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleSendOtp} 
              className="space-y-6"
            >
              <div className="relative">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="email" 
                  placeholder="Email Address" 
                  className="w-full pl-14 pr-6 py-5 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold text-lg"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-5 bg-black dark:bg-white text-white dark:text-black font-black text-sm uppercase tracking-[0.2em] rounded-full hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : (
                  <>Send Code <ArrowRight className="ml-2" size={18} /></>
                )}
              </button>
              <p className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest mt-4">
                Remembered? <Link to="/login" className="text-black dark:text-white underline">Back to Login</Link>
              </p>
            </motion.form>
          ) : (
            <motion.form 
              key="otp-step"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleResetPassword} 
              className="space-y-6"
            >
              <div className="text-center mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  OTP sent to {formData.phoneNumber}
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
              <div className="space-y-4">
                <div className="relative">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="New Password" 
                    className="w-full pl-14 pr-12 py-5 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold text-lg"
                    value={formData.newPassword}
                    onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    placeholder="Confirm New Password" 
                    className="w-full pl-14 pr-12 py-5 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold text-lg"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-5 bg-black dark:bg-white text-white dark:text-black font-black text-sm uppercase tracking-[0.2em] rounded-full hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : "Reset Password"}
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
                  onClick={() => setStep("identifier")}
                  className="w-full text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-black dark:hover:text-white transition-colors"
                >
                  Change Credentials
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
