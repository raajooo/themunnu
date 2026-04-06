import React, { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, getDoc } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { Banner } from "../../types";
import { Plus, Search, Edit2, Trash2, X, Loader2, Upload, AlertTriangle, ShieldAlert, Image as ImageIcon, Eye, EyeOff, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";
import LazyImage from "../../components/LazyImage";
import ConfirmModal from "../../components/ConfirmModal";
import { handleFirestoreError, OperationType } from "../../lib/firestore-errors";
import imageCompression from 'browser-image-compression';

export default function AdminBanners() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [formData, setFormData] = useState<Partial<Banner>>({
    title: "",
    subtitle: "",
    imageUrl: "",
    link: "",
    isActive: true,
    order: 0
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isLoading?: boolean;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    isLoading: false
  });

  if (error) {
    throw error;
  }

  useEffect(() => {
    fetchBanners();
    
    const checkAdmin = async () => {
      if (auth.currentUser) {
        try {
          const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
          if (userSnap.exists() && userSnap.data().role === 'admin') {
            setIsUserAdmin(true);
          } else {
            const email = auth.currentUser.email;
            const phone = auth.currentUser.phoneNumber;
            if (email === "raajooothakur0@gmail.com" || phone === "+919193731911") {
              setIsUserAdmin(true);
            }
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
        }
      }
    };
    checkAdmin();
  }, []);

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "banners"), orderBy("order", "asc"));
      const snap = await getDocs(q);
      setBanners(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner)));
    } catch (err: any) {
      if (err.message?.includes('resource-exhausted') || err.message?.includes('Quota limit exceeded')) {
        try {
          handleFirestoreError(err, OperationType.GET, "banners");
        } catch (quotaErr: any) {
          setError(quotaErr);
        }
      } else {
        console.error("Error fetching banners:", err);
        toast.error("Failed to fetch banners");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Please upload an image (JPG, PNG, WEBP or GIF).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image is too large (max 5MB allowed for upload, will be compressed)");
      return;
    }

    setUploading(true);
    try {
      const compressionOptions = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        initialQuality: 0.8
      };

      const compressedFile = await imageCompression(file, compressionOptions);
      
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(compressedFile);
      });
      setFormData({ ...formData, imageUrl: base64 });
    } catch (error) {
      console.error("Compression error:", error);
      toast.error("Failed to process image");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.imageUrl) {
      toast.error("Please provide a title and an image");
      return;
    }

    setLoading(true);
    try {
      if (editingBanner) {
        await updateDoc(doc(db, "banners", editingBanner.id), formData);
        toast.success("Banner updated");
      } else {
        const nextOrder = banners.length > 0 ? Math.max(...banners.map(b => b.order)) + 1 : 0;
        await addDoc(collection(db, "banners"), {
          ...formData,
          order: nextOrder,
          createdAt: new Date().toISOString()
        });
        toast.success("Banner added");
      }
      setIsModalOpen(false);
      fetchBanners();
    } catch (error: any) {
      console.error("Error saving banner:", error);
      let errorMessage = "Failed to save banner";
      
      if (error.code === 'permission-denied') {
        errorMessage = "Permission denied: You must be an admin to perform this action.";
      } else if (error.message?.includes('too large') || error.code === 'invalid-argument') {
        errorMessage = "Failed to save: The banner data (likely image) is too large for Firestore (max 1MB per document). Try a smaller image.";
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Banner",
      message: "Are you sure you want to delete this banner?",
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          await deleteDoc(doc(db, "banners", id));
          toast.success("Banner deleted");
          fetchBanners();
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          toast.error("Failed to delete banner");
        } finally {
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  const toggleStatus = async (banner: Banner) => {
    try {
      await updateDoc(doc(db, "banners", banner.id), {
        isActive: !banner.isActive
      });
      toast.success(`Banner ${!banner.isActive ? 'enabled' : 'disabled'}`);
      fetchBanners();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const moveOrder = async (index: number, direction: 'up' | 'down') => {
    const newBanners = [...banners];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= banners.length) return;

    const temp = newBanners[index].order;
    newBanners[index].order = newBanners[targetIndex].order;
    newBanners[targetIndex].order = temp;

    try {
      await Promise.all([
        updateDoc(doc(db, "banners", newBanners[index].id), { order: newBanners[index].order }),
        updateDoc(doc(db, "banners", newBanners[targetIndex].id), { order: newBanners[targetIndex].order })
      ]);
      fetchBanners();
    } catch (error) {
      toast.error("Failed to reorder banners");
    }
  };

  const filteredBanners = banners.filter(b => 
    b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.subtitle && b.subtitle.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading && banners.length === 0) {
    return (
      <div className="space-y-12 pb-20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-4">
            <div className="h-12 w-64 bg-gray-100 dark:bg-gray-900 rounded-2xl animate-pulse" />
            <div className="h-4 w-48 bg-gray-100 dark:bg-gray-900 rounded animate-pulse" />
          </div>
          <div className="h-16 w-48 bg-gray-100 dark:bg-gray-900 rounded-full animate-pulse" />
        </div>
        <div className="h-96 bg-white dark:bg-gray-950 rounded-[3rem] border border-gray-100 dark:border-gray-900 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-5xl font-black tracking-tighter uppercase mb-2">Hero Banners</h1>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-widest">Manage homepage banners</p>
        </div>
        <button 
          onClick={() => {
            if (!isUserAdmin) {
              toast.error("You don't have admin permissions to add banners.");
              return;
            }
            setEditingBanner(null);
            setFormData({ title: "", subtitle: "", imageUrl: "", link: "", isActive: true });
            setIsModalOpen(true);
          }}
          className="flex items-center space-x-2 px-10 py-5 bg-black dark:bg-white text-white dark:text-black rounded-full font-black text-sm uppercase tracking-widest hover:scale-105 transition-transform shadow-xl shadow-black/10"
        >
          <Plus size={20} />
          <span>New Banner</span>
        </button>
      </div>

      {!isUserAdmin && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 p-6 rounded-[2rem] flex items-center space-x-4">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600">
            <ShieldAlert size={24} />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-red-600">Admin Access Restricted</p>
            <p className="text-xs font-medium text-red-500/80 uppercase tracking-widest mt-1">
              Your account does not have write permissions.
            </p>
          </div>
        </div>
      )}

      {/* Banner List */}
      <div className="bg-white dark:bg-gray-950 rounded-[3rem] border border-gray-100 dark:border-gray-900 overflow-hidden shadow-xl shadow-black/5">
        <div className="p-8 border-b border-gray-50 dark:border-gray-900 flex justify-between items-center">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search banners..." 
              className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-full focus:outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-50 dark:border-gray-900">
                <th className="px-8 py-6">Order</th>
                <th className="px-8 py-6">Image</th>
                <th className="px-8 py-6">Title / Subtitle</th>
                <th className="px-8 py-6">Status</th>
                <th className="px-8 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-900">
              {filteredBanners.map((banner, index) => (
                <tr key={banner.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex flex-col items-center space-y-1">
                      <button 
                        onClick={() => moveOrder(index, 'up')}
                        disabled={index === 0}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded disabled:opacity-30"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <span className="text-xs font-bold">{banner.order}</span>
                      <button 
                        onClick={() => moveOrder(index, 'down')}
                        disabled={index === banners.length - 1}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded disabled:opacity-30"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="w-32 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                      <LazyImage src={banner.imageUrl} alt={banner.title} className="w-full h-full object-cover" />
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-sm font-bold uppercase tracking-tight">{banner.title}</p>
                    {banner.subtitle && <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">{banner.subtitle}</p>}
                  </td>
                  <td className="px-8 py-6">
                    <button 
                      onClick={() => toggleStatus(banner)}
                      className={`flex items-center space-x-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${banner.isActive ? 'bg-green-100 text-green-600 dark:bg-green-900/30' : 'bg-gray-100 text-gray-500 dark:bg-gray-900'}`}
                    >
                      {banner.isActive ? <Eye size={12} /> : <EyeOff size={12} />}
                      <span>{banner.isActive ? 'Active' : 'Hidden'}</span>
                    </button>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end space-x-3">
                      <button 
                        onClick={() => {
                          setEditingBanner(banner);
                          setFormData(banner);
                          setIsModalOpen(true);
                        }}
                        className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all text-xs font-bold uppercase tracking-widest"
                      >
                        <Edit2 size={14} />
                        <span>Edit</span>
                      </button>
                      <button 
                        onClick={() => handleDelete(banner.id)}
                        className="flex items-center space-x-2 px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-xl transition-all text-xs font-bold uppercase tracking-widest"
                      >
                        <Trash2 size={14} />
                        <span>Remove</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredBanners.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-gray-400 font-bold uppercase tracking-widest">
                    No banners found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-white dark:bg-gray-950 rounded-[3rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-gray-100 dark:border-gray-900 flex justify-between items-center">
                <h2 className="text-2xl font-black tracking-tighter uppercase">{editingBanner ? "Edit Banner" : "Add Banner"}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full"><X size={24} /></button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Banner Image</label>
                  <div className="flex flex-col space-y-4">
                    <div className="w-full aspect-[21/9] rounded-3xl overflow-hidden bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-200 dark:border-gray-800 flex items-center justify-center relative group">
                      {formData.imageUrl ? (
                        <>
                          <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <button 
                            type="button"
                            onClick={() => setFormData({ ...formData, imageUrl: "" })}
                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="text-white" size={24} />
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center space-y-2">
                          <Upload className="text-gray-400" size={32} />
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recommended: 1920x800</span>
                        </div>
                      )}
                    </div>
                    <label className="w-full">
                      <div className="px-6 py-4 bg-gray-100 dark:bg-gray-900 text-black dark:text-white text-[10px] font-black uppercase tracking-widest rounded-full cursor-pointer hover:opacity-70 transition-opacity text-center">
                        {uploading ? "Uploading..." : "Select Banner Image"}
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Title</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. SUMMER SALE"
                      className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Subtitle</label>
                    <input 
                      type="text" 
                      placeholder="e.g. UP TO 50% OFF"
                      className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                      value={formData.subtitle}
                      onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Link URL</label>
                  <input 
                    type="text" 
                    placeholder="e.g. /shop or https://..."
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-mono text-sm"
                    value={formData.link}
                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  />
                </div>

                <div className="flex items-center space-x-4">
                  <button 
                    type="button"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`flex items-center space-x-3 px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all ${formData.isActive ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-gray-50 text-gray-400 border border-gray-100'}`}
                  >
                    {formData.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                    <span>{formData.isActive ? 'Visible' : 'Hidden'}</span>
                  </button>
                </div>

                <div className="pt-8 flex space-x-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-grow py-5 bg-gray-100 dark:bg-gray-900 text-black dark:text-white font-black text-sm uppercase tracking-widest rounded-full hover:opacity-70 transition-opacity"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={loading || uploading}
                    className="flex-[2] py-5 bg-black dark:bg-white text-white dark:text-black font-black text-sm uppercase tracking-widest rounded-full hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : (editingBanner ? "Update Banner" : "Add Banner")}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        isLoading={confirmModal.isLoading}
      />
    </div>
  );
}
