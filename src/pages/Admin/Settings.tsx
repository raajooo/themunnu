import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { toast } from "react-hot-toast";
import { Shield, Key, Truck, MessageSquare, Save, Loader2, Database as DatabaseIcon } from "lucide-react";

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    razorpayKeyId: "",
    razorpayKeySecret: "",
    fast2smsApiKey: "",
    delhiveryApiKey: "",
    isCodEnabled: true
  });

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
          <h1 className="text-5xl font-black tracking-tighter uppercase mb-2">API Settings</h1>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-widest">Configure your external integrations</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Razorpay */}
        <section className="bg-white dark:bg-gray-950 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-900 shadow-xl shadow-black/5">
          <div className="flex items-center space-x-4 mb-8">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-2xl">
              <CreditCardIcon size={24} />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight">Razorpay Integration</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Key ID</label>
              <input 
                type="text" 
                className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-mono text-xs"
                value={settings.razorpayKeyId}
                onChange={(e) => setSettings({...settings, razorpayKeyId: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Key Secret</label>
              <input 
                type="password" 
                className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-mono text-xs"
                value={settings.razorpayKeySecret}
                onChange={(e) => setSettings({...settings, razorpayKeySecret: e.target.value})}
              />
            </div>
          </div>
        </section>

        {/* SMS & Shipping */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="bg-white dark:bg-gray-950 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-900 shadow-xl shadow-black/5">
            <div className="flex items-center space-x-4 mb-8">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-500 rounded-2xl">
                <MessageSquare size={24} />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">Fast2SMS</h3>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">API Key</label>
              <input 
                type="password" 
                className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-mono text-xs"
                value={settings.fast2smsApiKey}
                onChange={(e) => setSettings({...settings, fast2smsApiKey: e.target.value})}
              />
            </div>
          </section>

          <section className="bg-white dark:bg-gray-950 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-900 shadow-xl shadow-black/5">
            <div className="flex items-center space-x-4 mb-8">
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-500 rounded-2xl">
                <Truck size={24} />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">Delhivery</h3>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">API Key</label>
              <input 
                type="password" 
                className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-mono text-xs"
                value={settings.delhiveryApiKey}
                onChange={(e) => setSettings({...settings, delhiveryApiKey: e.target.value})}
              />
            </div>
          </section>
        </div>

        {/* Payment Controls */}
        <section className="bg-white dark:bg-gray-950 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-900 shadow-xl shadow-black/5">
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
        </section>

        <section className="bg-white dark:bg-gray-950 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-900 shadow-xl shadow-black/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-2xl">
                <DatabaseIcon size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">System Maintenance</h3>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Populate your store with initial sneakers</p>
              </div>
            </div>
            <button 
              type="button"
              onClick={async () => {
                const products = [
                  { name: "Air Max Pulse", brand: "Nike", price: 13995, stock: 10, category: "lifestyle", isFeatured: true, images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff"], sizes: ["7", "8", "9", "10", "11"] },
                  { name: "Yeezy Boost 350", brand: "Adidas", price: 22999, stock: 5, category: "limited", isLimited: true, images: ["https://images.unsplash.com/photo-1584735175315-9d5df23860e6"], sizes: ["7", "8", "9", "10", "11"] },
                  { name: "Jordan 1 Retro", brand: "Jordan", price: 15995, stock: 8, category: "trending", isTrending: true, images: ["https://images.unsplash.com/photo-1552346154-21d32810aba3"], sizes: ["7", "8", "9", "10", "11"] },
                  { name: "RS-X Efekt", brand: "Puma", price: 8999, stock: 15, category: "lifestyle", images: ["https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a"], sizes: ["7", "8", "9", "10", "11"] }
                ];
                try {
                  const { collection, addDoc } = await import("firebase/firestore");
                  for (const p of products) {
                    await addDoc(collection(db, "products"), { ...p, createdAt: new Date().toISOString(), description: "Premium sneaker for the next generation. Bold design and ultimate comfort." });
                  }
                  toast.success("Store seeded successfully!");
                } catch (e) { toast.error("Seeding failed"); }
              }}
              className="px-8 py-3 bg-red-500 text-white font-black text-xs uppercase tracking-widest rounded-full hover:bg-red-600 transition-colors"
            >
              Seed Store Data
            </button>
          </div>
        </section>

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

function CreditCardIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}
