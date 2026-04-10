import React, { useState, useEffect } from "react";
import { collection, query, orderBy, getDocs, doc, deleteDoc, where, limit } from "firebase/firestore";
import { db } from "../../firebase";
import { motion, AnimatePresence } from "motion/react";
import { Mail, Users, Send, Trash2, Search, Package, CheckCircle2, Loader2, Plus, X, ExternalLink } from "lucide-react";
import { toast } from "react-hot-toast";
import { Product } from "../../types";
import { formatCurrency } from "../../lib/utils";

interface Subscriber {
  id: string;
  email: string;
  status: string;
  createdAt: string;
}

export default function AdminNewsletters() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Newsletter Form
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    fetchSubscribers();
    fetchProducts();
  }, []);

  const fetchSubscribers = async () => {
    try {
      const q = query(collection(db, "subscribers"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setSubscribers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subscriber)));
    } catch (error) {
      console.error("Error fetching subscribers:", error);
      toast.error("Failed to load subscribers");
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const q = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(20));
      const snap = await getDocs(q);
      setAllProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const handleDeleteSubscriber = async (id: string) => {
    if (!window.confirm("Are you sure you want to remove this subscriber?")) return;
    try {
      await deleteDoc(doc(db, "subscribers", id));
      setSubscribers(prev => prev.filter(s => s.id !== id));
      toast.success("Subscriber removed");
    } catch (error) {
      toast.error("Failed to remove subscriber");
    }
  };

  const handleSendNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subscribers.length === 0) {
      toast.error("No subscribers to send to");
      return;
    }
    if (!subject || !message) {
      toast.error("Subject and message are required");
      return;
    }

    setSending(true);
    const toastId = toast.loading("Sending newsletter...");
    
    try {
      const response = await fetch("/api/admin/send-newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          message,
          products: selectedProducts.map(p => ({
            name: p.name,
            price: p.price,
            image: p.images[0],
            id: p.id
          })),
          subscribers: subscribers.map(s => s.email)
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to send newsletter");

      toast.success("Newsletter sent successfully!", { id: toastId });
      setSubject("");
      setMessage("");
      setSelectedProducts([]);
    } catch (error: any) {
      console.error("Newsletter error:", error);
      toast.error(error.message || "Failed to send newsletter", { id: toastId });
    } finally {
      setSending(false);
    }
  };

  const filteredSubscribers = subscribers.filter(s => 
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredProducts = allProducts.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.brand.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Newsletters</h1>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Manage subscribers and send updates</p>
        </div>
        <div className="flex items-center space-x-4 bg-white dark:bg-gray-950 px-6 py-3 rounded-2xl border border-gray-100 dark:border-gray-900">
          <Users size={20} className="text-gray-400" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Subscribers</p>
            <p className="text-xl font-black">{subscribers.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Compose Newsletter */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSendNewsletter} className="bg-white dark:bg-gray-950 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-900 space-y-6">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-10 h-10 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center">
                <Mail size={20} />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight">Compose Newsletter</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Subject Line</label>
                <input 
                  type="text" 
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. New Stock Alert! 👟"
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Message Body</label>
                <textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your newsletter content here..."
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold min-h-[200px]"
                  required
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Featured Products (Optional)</label>
                  <button 
                    type="button"
                    onClick={() => setIsProductModalOpen(true)}
                    className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest text-black dark:text-white hover:opacity-70 transition-opacity"
                  >
                    <Plus size={14} />
                    <span>Add Products</span>
                  </button>
                </div>

                {selectedProducts.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {selectedProducts.map(product => (
                      <div key={product.id} className="relative group bg-gray-50 dark:bg-gray-900 p-3 rounded-2xl border border-gray-100 dark:border-gray-800">
                        <button 
                          type="button"
                          onClick={() => setSelectedProducts(prev => prev.filter(p => p.id !== product.id))}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >
                          <X size={14} />
                        </button>
                        <div className="aspect-square rounded-xl overflow-hidden mb-2">
                          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                        </div>
                        <p className="text-[10px] font-black uppercase truncate">{product.name}</p>
                        <p className="text-[10px] font-bold text-gray-400">{formatCurrency(product.price)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 border-2 border-dashed border-gray-100 dark:border-gray-900 rounded-2xl flex flex-col items-center justify-center text-gray-400">
                    <Package size={24} className="mb-2 opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No products selected</p>
                  </div>
                )}
              </div>
            </div>

            <button 
              type="submit"
              disabled={sending || subscribers.length === 0}
              className="w-full py-5 bg-black dark:bg-white text-white dark:text-black font-black text-sm uppercase tracking-[0.2em] rounded-full hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50"
            >
              {sending ? <Loader2 className="animate-spin mr-2" size={20} /> : <Send className="mr-2" size={20} />}
              Send to {subscribers.length} Subscribers
            </button>
          </form>
        </div>

        {/* Subscriber List */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-950 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-900 flex flex-col h-[700px]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black uppercase tracking-tight">Subscribers</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input 
                  type="text" 
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-xl text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all w-32 md:w-48"
                />
              </div>
            </div>

            <div className="flex-grow overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <div key={i} className="h-16 bg-gray-50 dark:bg-gray-900 rounded-2xl animate-pulse" />
                ))
              ) : filteredSubscribers.length > 0 ? (
                filteredSubscribers.map(subscriber => (
                  <div key={subscriber.id} className="group flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-transparent hover:border-gray-200 dark:hover:border-gray-800 transition-all">
                    <div className="min-w-0">
                      <p className="text-xs font-black truncate">{subscriber.email}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {new Date(subscriber.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button 
                      onClick={() => handleDeleteSubscriber(subscriber.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Users size={32} className="mb-4 opacity-20" />
                  <p className="text-xs font-black uppercase tracking-widest">No subscribers found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Product Selection Modal */}
      <AnimatePresence>
        {isProductModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-2xl bg-white dark:bg-gray-950 rounded-[3rem] p-8 md:p-12 shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black tracking-tighter uppercase">Select Products</h2>
                <button onClick={() => setIsProductModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full">
                  <X size={24} />
                </button>
              </div>

              <div className="relative mb-6">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Search products by name or brand..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-14 pr-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                />
              </div>

              <div className="flex-grow overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4 pr-2 custom-scrollbar">
                {filteredProducts.map(product => {
                  const isSelected = selectedProducts.some(p => p.id === product.id);
                  return (
                    <button 
                      key={product.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedProducts(prev => prev.filter(p => p.id !== product.id));
                        } else {
                          setSelectedProducts(prev => [...prev, product]);
                        }
                      }}
                      className={`flex items-center space-x-4 p-4 rounded-2xl border-2 transition-all text-left ${isSelected ? 'border-black dark:border-white bg-black/5 dark:bg-white/5' : 'border-gray-100 dark:border-gray-900 hover:border-gray-200 dark:hover:border-gray-800'}`}
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-grow">
                        <p className="text-xs font-black uppercase truncate">{product.name}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{product.brand}</p>
                        <p className="text-xs font-black mt-1">{formatCurrency(product.price)}</p>
                      </div>
                      {isSelected && <CheckCircle2 size={20} className="text-black dark:text-white flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-900 flex justify-between items-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{selectedProducts.length} Products Selected</p>
                <button 
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-8 py-4 bg-black dark:bg-white text-white dark:text-black font-black text-xs uppercase tracking-widest rounded-full hover:opacity-90 transition-opacity"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
