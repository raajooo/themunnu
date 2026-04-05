import React, { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { Product, Category } from "../../types";
import { formatCurrency } from "../../lib/utils";
import { Plus, Search, Edit2, Trash2, X, Upload, Loader2, AlertTriangle, ShieldAlert } from "lucide-react";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";
import ConfirmModal from "../../components/ConfirmModal";
import { handleFirestoreError, OperationType } from "../../lib/firestore-errors";
import imageCompression from 'browser-image-compression';

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({
    name: "",
    brand: "",
    price: 0,
    description: "",
    images: [],
    sizes: ["7", "8", "9", "10", "11"],
    stock: 0,
    category: "",
    isLimited: false,
    isTrending: false,
    isFeatured: false
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

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

  const [isUserAdmin, setIsUserAdmin] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    
    // Check if current user is admin in Firestore
    const checkAdmin = async () => {
      if (auth.currentUser) {
        try {
          const userDoc = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc")));
          // This is a bit inefficient, but we'll just check the current user's role
          const currentUserDoc = userDoc.docs.find(d => d.id === auth.currentUser?.uid);
          if (currentUserDoc && currentUserDoc.data().role === 'admin') {
            setIsUserAdmin(true);
          } else {
            // Fallback to checking the email/phone if the doc isn't found or role isn't admin
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

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const fetchCategories = async () => {
    try {
      const snap = await getDocs(collection(db, "categories"));
      setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setUploading(true);
    const newImages: string[] = [...(formData.images || [])];
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    const compressionOptions = {
      maxSizeMB: 0.3, // Target 300KB to stay safe within Firestore 1MB doc limit
      maxWidthOrHeight: 1280,
      useWebWorker: true,
      initialQuality: 0.8
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Check file type
      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name} is not a valid image. Please use JPG, PNG, WEBP or GIF.`);
        continue;
      }

      // Allow up to 5MB for initial selection, but compress it
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 5MB allowed for upload, will be compressed)`);
        continue;
      }

      try {
        const compressedFile = await imageCompression(file, compressionOptions);
        
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(compressedFile);
        });
        newImages.push(base64);
      } catch (error) {
        console.error("Compression error:", error);
        toast.error(`Failed to process ${file.name}`);
      }
    }

    setFormData({ ...formData, images: newImages });
    setUploading(false);
  };

  const removeImage = (index: number) => {
    const newImages = [...(formData.images || [])];
    newImages.splice(index, 1);
    setFormData({ ...formData, images: newImages });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingProduct) {
        await updateDoc(doc(db, "products", editingProduct.id), formData);
        toast.success("Product updated");
      } else {
        await addDoc(collection(db, "products"), {
          ...formData,
          createdAt: new Date().toISOString()
        });
        toast.success("Product added");
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (error: any) {
      console.error("Error saving product:", error);
      let errorMessage = "Failed to save product";
      
      if (error.code === 'permission-denied') {
        errorMessage = "Permission denied: You must be an admin to perform this action. Check if your email is verified.";
      } else if (error.message?.includes('too large') || error.code === 'invalid-argument') {
        errorMessage = "Failed to save: The product data (likely images) is too large for Firestore (max 1MB per document). Try smaller images.";
      } else if (error.message) {
        errorMessage = `Failed to save product: ${error.message}`;
      }
      
      toast.error(errorMessage);
      try {
        handleFirestoreError(error, editingProduct ? OperationType.UPDATE : OperationType.CREATE, "products");
      } catch (e) {
        // handleFirestoreError throws, but we already handled it with toast
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Product",
      message: "Are you sure you want to delete this product? This action cannot be undone.",
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          await deleteDoc(doc(db, "products", id));
          toast.success("Product deleted");
          fetchProducts();
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          toast.error("Failed to delete product");
        } finally {
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id));
    }
  };

  const handleSelectProduct = (id: string) => {
    setSelectedProducts(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    setConfirmModal({
      isOpen: true,
      title: "Bulk Delete",
      message: `Are you sure you want to delete ${selectedProducts.length} products? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        const toastId = toast.loading(`Deleting ${selectedProducts.length} products...`);
        try {
          await Promise.all(selectedProducts.map(id => deleteDoc(doc(db, "products", id))));
          toast.success("Bulk delete successful", { id: toastId });
          setSelectedProducts([]);
          fetchProducts();
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          toast.error("Bulk delete failed", { id: toastId });
        } finally {
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  const handleBulkUpdateStatus = async (field: 'isLimited' | 'isTrending' | 'isFeatured', value: boolean) => {
    setBulkActionLoading(true);
    const toastId = toast.loading(`Updating ${selectedProducts.length} products...`);
    try {
      await Promise.all(selectedProducts.map(id => updateDoc(doc(db, "products", id), { [field]: value })));
      toast.success("Bulk update successful", { id: toastId });
      setSelectedProducts([]);
      fetchProducts();
    } catch (error) {
      toast.error("Bulk update failed", { id: toastId });
    } finally {
      setBulkActionLoading(false);
    }
  };

  if (loading && products.length === 0) {
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
          <h1 className="text-5xl font-black tracking-tighter uppercase mb-2">Inventory</h1>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-widest">Manage your sneaker stock</p>
        </div>
        <button 
          onClick={() => {
            if (!isUserAdmin) {
              toast.error("You don't have admin permissions to add products.");
              return;
            }
            setEditingProduct(null);
            setFormData({
              name: "", brand: "", price: 0, description: "", images: [], 
              sizes: ["7", "8", "9", "10", "11"], stock: 0, category: "lifestyle",
              isLimited: false, isTrending: false, isFeatured: false
            });
            setIsModalOpen(true);
          }}
          className="flex items-center space-x-2 px-10 py-5 bg-black dark:bg-white text-white dark:text-black rounded-full font-black text-sm uppercase tracking-widest hover:scale-105 transition-transform shadow-xl shadow-black/10"
        >
          <Plus size={20} />
          <span>New Product</span>
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
              Your account does not have write permissions. Please contact the owner or verify your email.
            </p>
          </div>
        </div>
      )}

      {/* Product List */}
      <div className="bg-white dark:bg-gray-950 rounded-[3rem] border border-gray-100 dark:border-gray-900 overflow-hidden shadow-xl shadow-black/5">
        <div className="p-8 border-b border-gray-50 dark:border-gray-900 flex justify-between items-center">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search inventory..." 
              className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-full focus:outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={() => setSearchTerm("")}
              className="p-3 bg-gray-50 dark:bg-gray-900 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-50 dark:border-gray-900">
                <th className="px-8 py-6 w-10">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 accent-black dark:accent-white cursor-pointer"
                    checked={filteredProducts.length > 0 && selectedProducts.length === filteredProducts.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="px-8 py-6">Product</th>
                <th className="px-8 py-6">Category</th>
                <th className="px-8 py-6">Price</th>
                <th className="px-8 py-6">Stock</th>
                <th className="px-8 py-6">Status</th>
                <th className="px-8 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-900">
              {filteredProducts.map(product => (
                <tr key={product.id} className={`hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors ${selectedProducts.includes(product.id) ? 'bg-gray-50 dark:bg-gray-900' : ''}`}>
                  <td className="px-8 py-6">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 accent-black dark:accent-white cursor-pointer"
                      checked={selectedProducts.includes(product.id)}
                      onChange={() => handleSelectProduct(product.id)}
                    />
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-900">
                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div>
                        <p className="text-sm font-bold uppercase tracking-tight">{product.name}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{product.brand}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-sm font-bold uppercase tracking-widest text-gray-500">{product.category}</td>
                  <td className="px-8 py-6 text-sm font-black">{formatCurrency(product.price)}</td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${product.stock < 5 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                      {product.stock} in stock
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex space-x-2">
                      {product.isLimited && <span className="w-2 h-2 bg-purple-500 rounded-full" title="Limited" />}
                      {product.isTrending && <span className="w-2 h-2 bg-blue-500 rounded-full" title="Trending" />}
                      {product.isFeatured && <span className="w-2 h-2 bg-yellow-500 rounded-full" title="Featured" />}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end space-x-2">
                      <button 
                        onClick={() => {
                          setEditingProduct(product);
                          setFormData(product);
                          setIsModalOpen(true);
                        }}
                        className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all text-xs font-bold uppercase tracking-widest"
                      >
                        <Edit2 size={14} />
                        <span>Rename</span>
                      </button>
                      <button 
                        onClick={() => handleDelete(product.id)}
                        className="flex items-center space-x-2 px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-xl transition-all text-xs font-bold uppercase tracking-widest"
                      >
                        <Trash2 size={14} />
                        <span>Remove</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
              className="w-full max-w-4xl bg-white dark:bg-gray-950 rounded-[3rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-gray-100 dark:border-gray-900 flex justify-between items-center">
                <h2 className="text-2xl font-black tracking-tighter uppercase">{editingProduct ? "Edit Product" : "Add Product"}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full"><X size={24} /></button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 overflow-y-auto max-h-[70vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Product Name</label>
                      <input 
                        type="text" 
                        required
                        className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Brand</label>
                      <input 
                        type="text" 
                        required
                        className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                        value={formData.brand}
                        onChange={(e) => setFormData({...formData, brand: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Price (₹)</label>
                        <input 
                          type="number" 
                          required
                          className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                          value={isNaN(formData.price || 0) ? "" : formData.price}
                          onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Stock</label>
                        <input 
                          type="number" 
                          required
                          className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                          value={isNaN(formData.stock || 0) ? "" : formData.stock}
                          onChange={(e) => setFormData({...formData, stock: parseInt(e.target.value) || 0})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Description</label>
                      <textarea 
                        required
                        className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold min-h-[120px]"
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Product Images</label>
                      <div className="grid grid-cols-3 gap-4">
                        {formData.images?.map((img, idx) => (
                          <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden group border border-gray-100 dark:border-gray-900">
                            <img src={img} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <button 
                              type="button"
                              onClick={() => removeImage(idx)}
                              className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                        <label className="aspect-square rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center cursor-pointer hover:border-black dark:hover:border-white transition-colors group">
                          {uploading ? (
                            <Loader2 className="animate-spin text-gray-400" size={24} />
                          ) : (
                            <>
                              <Upload className="text-gray-400 group-hover:text-black dark:group-hover:text-white transition-colors" size={24} />
                              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-2">Upload</span>
                            </>
                          )}
                          <input 
                            type="file" 
                            multiple 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleImageUpload}
                            disabled={uploading}
                          />
                        </label>
                      </div>
                      <p className="text-[10px] text-gray-400 font-medium">Recommended: Square images, max 300KB each (Firestore limit).</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sizes (Comma separated)</label>
                      <input 
                        type="text" 
                        required
                        placeholder="7, 8, 9, 10, 11"
                        className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                        value={formData.sizes?.join(", ")}
                        onChange={(e) => setFormData({...formData, sizes: e.target.value.split(",").map(s => s.trim()).filter(s => s)})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Category</label>
                      <select 
                        required
                        className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                      >
                        <option value="">Select Category</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.slug}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-4 pt-4">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 accent-black dark:accent-white"
                          checked={formData.isLimited}
                          onChange={(e) => setFormData({...formData, isLimited: e.target.checked})}
                        />
                        <span className="text-xs font-bold uppercase tracking-widest">Limited Drop</span>
                      </label>
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 accent-black dark:accent-white"
                          checked={formData.isTrending}
                          onChange={(e) => setFormData({...formData, isTrending: e.target.checked})}
                        />
                        <span className="text-xs font-bold uppercase tracking-widest">Trending</span>
                      </label>
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 accent-black dark:accent-white"
                          checked={formData.isFeatured}
                          onChange={(e) => setFormData({...formData, isFeatured: e.target.checked})}
                        />
                        <span className="text-xs font-bold uppercase tracking-widest">Featured</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-12 flex space-x-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-grow py-5 bg-gray-100 dark:bg-gray-900 text-black dark:text-white font-black text-sm uppercase tracking-widest rounded-full hover:opacity-70 transition-opacity"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-[2] py-5 bg-black dark:bg-white text-white dark:text-black font-black text-sm uppercase tracking-widest rounded-full hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : (editingProduct ? "Update Product" : "Add Product")}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedProducts.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[90] w-full max-w-2xl px-4"
          >
            <div className="bg-black dark:bg-white text-white dark:text-black p-6 rounded-3xl shadow-2xl flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="bg-white/20 dark:bg-black/20 px-4 py-2 rounded-xl">
                  <span className="text-xs font-black uppercase tracking-widest">{selectedProducts.length} Selected</span>
                </div>
                <button 
                  onClick={() => setSelectedProducts([])}
                  className="text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity"
                >
                  Deselect All
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <div className="h-8 w-[1px] bg-white/10 dark:bg-black/10 mx-2" />
                
                <div className="flex space-x-1">
                  <button 
                    onClick={() => handleBulkUpdateStatus('isLimited', true)}
                    className="p-2 hover:bg-white/10 dark:hover:bg-black/10 rounded-xl transition-all"
                    title="Mark as Limited"
                  >
                    <div className="w-3 h-3 bg-purple-500 rounded-full" />
                  </button>
                  <button 
                    onClick={() => handleBulkUpdateStatus('isTrending', true)}
                    className="p-2 hover:bg-white/10 dark:hover:bg-black/10 rounded-xl transition-all"
                    title="Mark as Trending"
                  >
                    <div className="w-3 h-3 bg-blue-500 rounded-full" />
                  </button>
                  <button 
                    onClick={() => handleBulkUpdateStatus('isFeatured', true)}
                    className="p-2 hover:bg-white/10 dark:hover:bg-black/10 rounded-xl transition-all"
                    title="Mark as Featured"
                  >
                    <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                  </button>
                </div>

                <div className="h-8 w-[1px] bg-white/10 dark:bg-black/10 mx-2" />

                <button 
                  onClick={handleBulkDelete}
                  disabled={bulkActionLoading}
                  className="flex items-center space-x-2 px-6 py-3 bg-red-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {bulkActionLoading ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </motion.div>
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
