import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { toast } from "react-hot-toast";
import { Shield, Save, Loader2, Database as DatabaseIcon, Trash2, AlertTriangle, Tag } from "lucide-react";
import ConfirmModal from "../../components/ConfirmModal";

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [settings, setSettings] = useState({
    isCodEnabled: true,
    isCouponSystemEnabled: false,
    supportEmail: "support@munnu.com"
  });

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "global"));
        if (snap.exists()) {
          setSettings(prev => ({ ...prev, ...snap.data() }));
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "global"), settings);
      toast.success("Settings updated successfully");
    } catch (error) {
      toast.error("Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl space-y-12 pb-20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-4">
            <div className="h-12 w-64 bg-gray-100 dark:bg-gray-900 rounded-2xl animate-pulse" />
            <div className="h-4 w-48 bg-gray-100 dark:bg-gray-900 rounded animate-pulse" />
          </div>
        </div>
        <div className="space-y-8">
          <div className="h-64 bg-white dark:bg-gray-950 rounded-[3rem] border border-gray-100 dark:border-gray-900 animate-pulse" />
          <div className="grid grid-cols-2 gap-8">
            <div className="h-48 bg-white dark:bg-gray-950 rounded-[3rem] border border-gray-100 dark:border-gray-900 animate-pulse" />
            <div className="h-48 bg-white dark:bg-gray-950 rounded-[3rem] border border-gray-100 dark:border-gray-900 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-12 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-5xl font-black tracking-tighter uppercase mb-2">System Settings</h1>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-widest">Configure your store integrations</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Payment Controls */}
        <section className="bg-white dark:bg-gray-950 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-900 shadow-xl shadow-black/5">
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 text-orange-500 rounded-2xl">
                  <Shield size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Cash on Delivery</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Enable or disable COD for all customers</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setSettings({...settings, isCodEnabled: !settings.isCodEnabled})}
                className={`w-16 h-8 rounded-full transition-all relative ${settings.isCodEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${settings.isCodEnabled ? 'left-9' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between pt-8 border-t border-gray-50 dark:border-gray-900">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-500 rounded-2xl">
                  <Tag size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Coupon System</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Enable or disable the discount coupon system</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setSettings({...settings, isCouponSystemEnabled: !settings.isCouponSystemEnabled})}
                className={`w-16 h-8 rounded-full transition-all relative ${settings.isCouponSystemEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${settings.isCouponSystemEnabled ? 'left-9' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </section>

        {/* Support Settings */}
        <section className="bg-white dark:bg-gray-950 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-900 shadow-xl shadow-black/5">
          <div className="space-y-6">
            <div className="flex items-center space-x-4 mb-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-2xl">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">Support Configuration</h3>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Manage customer support details</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Support Email Address</label>
              <input
                type="email"
                required
                className="w-full px-8 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                value={settings.supportEmail}
                onChange={(e) => setSettings({...settings, supportEmail: e.target.value})}
              />
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-950 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-900 shadow-xl shadow-black/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-2xl">
                <DatabaseIcon size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">Clear Store Data</h3>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Remove all products and categories to start fresh</p>
              </div>
            </div>
            <button 
              type="button"
              disabled={clearing}
              onClick={() => setIsConfirmOpen(true)}
              className="px-8 py-3 bg-red-500 text-white font-black text-xs uppercase tracking-widest rounded-full hover:bg-red-600 transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              {clearing ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
              <span>{clearing ? "Clearing..." : "Clear All Data"}</span>
            </button>
          </div>
        </section>

        <ConfirmModal
          isOpen={isConfirmOpen}
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={async () => {
            setIsConfirmOpen(false);
            setClearing(true);
            const toastId = toast.loading("Clearing store data...");
            
            try {
              // Delete Products
              const productsSnap = await getDocs(collection(db, "products"));
              const productDeletions = productsSnap.docs.map(d => deleteDoc(doc(db, "products", d.id)));
              await Promise.all(productDeletions);

              // Delete Categories
              const categoriesSnap = await getDocs(collection(db, "categories"));
              const categoryDeletions = categoriesSnap.docs.map(d => deleteDoc(doc(db, "categories", d.id)));
              await Promise.all(categoryDeletions);

              // Delete Orders
              const ordersSnap = await getDocs(collection(db, "orders"));
              const orderDeletions = ordersSnap.docs.map(d => deleteDoc(doc(db, "orders", d.id)));
              await Promise.all(orderDeletions);

              toast.success("Store data (Products, Categories, and Orders) cleared successfully!", { id: toastId });
            } catch (e) { 
              console.error("Error clearing data:", e);
              toast.error("Failed to clear data. Check console for details.", { id: toastId }); 
            } finally {
              setClearing(false);
            }
          }}
          title="Clear All Data"
          message="CRITICAL: This will delete ALL products, categories, and orders. This action cannot be undone. Are you sure?"
          confirmText="Clear Everything"
          isLoading={clearing}
        />

        <div className="flex justify-end">
          <button 
            type="submit"
            disabled={saving}
            className="px-12 py-5 bg-black dark:bg-white text-white dark:text-black font-black text-sm uppercase tracking-widest rounded-full hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50 shadow-2xl shadow-black/20"
          >
            {saving ? <Loader2 className="animate-spin mr-2" size={20} /> : <Save className="mr-2" size={20} />}
            Save All Settings
          </button>
        </div>
      </form>
    </div>
  );
}
