import React, { useState, useEffect } from "react";
import { collection, getDocs, setDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { Coupon } from "../../types";
import { toast } from "react-hot-toast";
import { Plus, Trash2, Tag, Percent, DollarSign, Calendar, Loader2, BarChart3, ToggleLeft, ToggleRight, Search, Filter } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { formatCurrency } from "../../lib/utils";
import { format } from "date-fns";
import ConfirmModal from "../../components/ConfirmModal";

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [formData, setFormData] = useState({
    code: "",
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: 0,
    minOrderAmount: 0,
    maxDiscountAmount: 0,
    expiryDate: "",
    isActive: true
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const q = query(collection(db, "coupons"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon));
      setCoupons(data);
    } catch (error) {
      console.error("Error fetching coupons:", error);
      toast.error("Failed to load coupons");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim()) return toast.error("Coupon code is required");
    
    setLoading(true);
    try {
      const couponCode = formData.code.toUpperCase().trim();
      const newCoupon = {
        ...formData,
        code: couponCode,
        usageCount: 0,
        totalDiscountGenerated: 0,
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, "coupons", couponCode), newCoupon);
      toast.success("Coupon created successfully");
      setIsModalOpen(false);
      setFormData({
        code: "",
        discountType: "percentage",
        discountValue: 0,
        minOrderAmount: 0,
        maxDiscountAmount: 0,
        expiryDate: "",
        isActive: true
      });
      fetchCoupons();
    } catch (error) {
      toast.error("Failed to create coupon");
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (coupon: Coupon) => {
    try {
      await updateDoc(doc(db, "coupons", coupon.id), {
        isActive: !coupon.isActive
      });
      toast.success(`Coupon ${coupon.isActive ? 'disabled' : 'enabled'}`);
      fetchCoupons();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async () => {
    if (!selectedCoupon) return;
    try {
      await deleteDoc(doc(db, "coupons", selectedCoupon.id));
      toast.success("Coupon deleted");
      setIsConfirmOpen(false);
      fetchCoupons();
    } catch (error) {
      toast.error("Failed to delete coupon");
    }
  };

  const filteredCoupons = coupons.filter(c => 
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-5xl font-black tracking-tighter uppercase mb-2">Coupon Management</h1>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-widest">Create and track discount codes</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-8 py-4 bg-black dark:bg-white text-white dark:text-black font-black text-xs uppercase tracking-widest rounded-full hover:opacity-90 transition-opacity flex items-center space-x-2 shadow-2xl shadow-black/20"
        >
          <Plus size={16} />
          <span>Create Coupon</span>
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white dark:bg-gray-950 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-900 shadow-xl shadow-black/5">
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-2xl">
              <Tag size={20} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Coupons</p>
          </div>
          <p className="text-4xl font-black">{coupons.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-950 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-900 shadow-xl shadow-black/5">
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-500 rounded-2xl">
              <BarChart3 size={20} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Uses</p>
          </div>
          <p className="text-4xl font-black">{coupons.reduce((acc, curr) => acc + curr.usageCount, 0)}</p>
        </div>
        <div className="bg-white dark:bg-gray-950 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-900 shadow-xl shadow-black/5">
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-500 rounded-2xl">
              <DollarSign size={20} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Savings</p>
          </div>
          <p className="text-4xl font-black">{formatCurrency(coupons.reduce((acc, curr) => acc + curr.totalDiscountGenerated, 0))}</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search by coupon code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-14 pr-6 py-5 bg-white dark:bg-gray-950 rounded-[2rem] border border-gray-100 dark:border-gray-900 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-sm font-bold uppercase tracking-widest"
        />
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
      </div>

      {/* Coupons List */}
      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-32 bg-white dark:bg-gray-950 rounded-[2rem] animate-pulse" />
          ))
        ) : filteredCoupons.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-gray-950 rounded-[3rem] border border-dashed border-gray-200 dark:border-gray-800">
            <Tag size={48} className="mx-auto text-gray-200 mb-4" />
            <p className="text-gray-400 font-bold uppercase tracking-widest">No coupons found</p>
          </div>
        ) : (
          filteredCoupons.map((coupon) => (
            <motion.div
              layout
              key={coupon.id}
              className="bg-white dark:bg-gray-950 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-900 shadow-xl shadow-black/5 flex flex-col md:flex-row items-center justify-between gap-8 group"
            >
              <div className="flex items-center space-x-6 w-full md:w-auto">
                <div className={`p-5 rounded-2xl ${coupon.isActive ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-gray-100 dark:bg-gray-900 text-gray-400'}`}>
                  <Tag size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black tracking-tighter uppercase">{coupon.code}</h3>
                  <div className="flex items-center space-x-3 mt-1">
                    <span className="text-[10px] font-black px-2 py-0.5 bg-gray-100 dark:bg-gray-900 rounded uppercase tracking-widest">
                      {coupon.discountType === 'percentage' ? `${coupon.discountValue}% OFF` : `${formatCurrency(coupon.discountValue)} OFF`}
                    </span>
                    {coupon.expiryDate && (
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
                        <Calendar size={10} className="mr-1" />
                        Exp: {format(new Date(coupon.expiryDate), 'MMM dd, yyyy')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-8 flex-grow max-w-xl w-full">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Uses</p>
                  <p className="text-xl font-black">{coupon.usageCount}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Discount</p>
                  <p className="text-xl font-black">{formatCurrency(coupon.totalDiscountGenerated)}</p>
                </div>
                <div className="hidden md:block">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Min Order</p>
                  <p className="text-xl font-black">{formatCurrency(coupon.minOrderAmount)}</p>
                </div>
              </div>

              <div className="flex items-center space-x-4 w-full md:w-auto justify-end">
                <button 
                  onClick={() => toggleStatus(coupon)}
                  className={`p-3 rounded-xl transition-all ${coupon.isActive ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900'}`}
                >
                  {coupon.isActive ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </button>
                <button 
                  onClick={() => {
                    setSelectedCoupon(coupon);
                    setIsConfirmOpen(true);
                  }}
                  className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Create Coupon Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-gray-950 rounded-[3rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-900"
            >
              <div className="p-10">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h2 className="text-3xl font-black tracking-tighter uppercase">Create New Coupon</h2>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Define your discount rules</p>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Coupon Code</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. MUNNU20"
                        className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-black uppercase tracking-widest"
                        value={formData.code}
                        onChange={(e) => setFormData({...formData, code: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Discount Type</label>
                      <select
                        className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                        value={formData.discountType}
                        onChange={(e) => setFormData({...formData, discountType: e.target.value as any})}
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed Amount (₹)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Discount Value</label>
                      <div className="relative">
                        <input
                          type="number"
                          required
                          className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                          value={formData.discountValue}
                          onChange={(e) => setFormData({...formData, discountValue: Number(e.target.value)})}
                        />
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400">
                          {formData.discountType === 'percentage' ? <Percent size={16} /> : <DollarSign size={16} />}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Min Order Amount</label>
                      <input
                        type="number"
                        className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                        value={formData.minOrderAmount}
                        onChange={(e) => setFormData({...formData, minOrderAmount: Number(e.target.value)})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Max Discount (Optional)</label>
                      <input
                        type="number"
                        className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                        value={formData.maxDiscountAmount}
                        onChange={(e) => setFormData({...formData, maxDiscountAmount: Number(e.target.value)})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Expiry Date</label>
                      <input
                        type="date"
                        className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                        value={formData.expiryDate}
                        onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-5 bg-black dark:bg-white text-white dark:text-black font-black text-sm uppercase tracking-widest rounded-2xl hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50 mt-4"
                  >
                    {loading ? <Loader2 className="animate-spin mr-2" size={20} /> : <Plus className="mr-2" size={20} />}
                    Create Coupon
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Coupon"
        message={`Are you sure you want to delete the coupon "${selectedCoupon?.code}"? This action cannot be undone.`}
        confirmText="Delete Coupon"
      />
    </div>
  );
}

function X({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}
