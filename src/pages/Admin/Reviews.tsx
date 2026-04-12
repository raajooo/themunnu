import React, { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, addDoc, runTransaction, getDocs, where } from "firebase/firestore";
import { db } from "../../firebase";
import { Review, Product } from "../../types";
import { motion, AnimatePresence } from "motion/react";
import { Star, Trash2, Plus, Search, Filter, X, Loader2, MessageSquare } from "lucide-react";
import { toast } from "react-hot-toast";
import { format } from "date-fns";

export default function AdminReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  
  // Fake Review Form State
  const [isAddingFake, setIsAddingFake] = useState(false);
  const [fakeReview, setFakeReview] = useState({
    productId: "",
    userName: "",
    rating: 5,
    comment: "",
    createdAt: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    setLoading(true);
    
    // Fetch Products for the dropdown
    const unsubscribeProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    // Real-time Reviews
    const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"));
    const unsubscribeReviews = onSnapshot(q, (snapshot) => {
      setReviews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review)));
      setLoading(false);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeReviews();
    };
  }, []);

  const handleDeleteReview = async (review: Review) => {
    if (!window.confirm("Are you sure you want to delete this review? This will also update the product rating.")) return;

    try {
      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, "products", review.productId);
        const productSnap = await transaction.get(productRef);
        
        if (productSnap.exists()) {
          const productData = productSnap.data() as Product;
          const oldCount = productData.reviewCount || 0;
          const oldAvg = productData.averageRating || 0;
          
          if (oldCount > 1) {
            const newCount = oldCount - 1;
            const newAvg = ((oldAvg * oldCount) - review.rating) / newCount;
            transaction.update(productRef, {
              reviewCount: newCount,
              averageRating: newAvg
            });
          } else {
            transaction.update(productRef, {
              reviewCount: 0,
              averageRating: 0
            });
          }
        }
        
        const reviewRef = doc(db, "reviews", review.id);
        transaction.delete(reviewRef);
      });
      toast.success("Review deleted successfully");
    } catch (error) {
      console.error("Error deleting review:", error);
      toast.error("Failed to delete review");
    }
  };

  const handleAddFakeReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fakeReview.productId || !fakeReview.userName || !fakeReview.comment) {
      toast.error("Please fill all fields");
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, "products", fakeReview.productId);
        const productSnap = await transaction.get(productRef);
        
        if (!productSnap.exists()) throw new Error("Product not found");
        
        const productData = productSnap.data() as Product;
        const oldCount = productData.reviewCount || 0;
        const oldAvg = productData.averageRating || 0;
        
        const newCount = oldCount + 1;
        const newAvg = ((oldAvg * oldCount) + fakeReview.rating) / newCount;

        const reviewRef = collection(db, "reviews");
        const newReviewDocRef = doc(reviewRef);
        
        transaction.set(newReviewDocRef, {
          ...fakeReview,
          userId: "admin_fake",
          createdAt: new Date(fakeReview.createdAt).toISOString()
        });

        transaction.update(productRef, {
          reviewCount: newCount,
          averageRating: newAvg
        });
      });

      toast.success("Fake review added successfully!");
      setIsAddingFake(false);
      setFakeReview({
        productId: "",
        userName: "",
        rating: 5,
        comment: "",
        createdAt: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error("Error adding fake review:", error);
      toast.error("Failed to add review");
    }
  };

  const filteredReviews = reviews.filter(review => {
    const matchesSearch = review.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         review.comment.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProduct = selectedProduct === "all" || review.productId === selectedProduct;
    return matchesSearch && matchesProduct;
  });

  const getProductName = (id: string) => {
    return products.find(p => p.id === id)?.name || "Unknown Product";
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase">Reviews Management</h1>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Manage customer feedback and add custom reviews</p>
        </div>
        <button 
          onClick={() => setIsAddingFake(true)}
          className="flex items-center space-x-2 px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-full font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all"
        >
          <Plus size={16} />
          <span>Add Custom Review</span>
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Search reviews or users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold text-sm"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <select 
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold text-sm appearance-none"
          >
            <option value="all">All Products</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Reviews Table */}
      <div className="bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-900 rounded-[2.5rem] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-900">
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">User</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Product</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Rating</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Comment</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Date</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {filteredReviews.map((review) => (
                  <motion.tr 
                    key={review.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="border-b border-gray-50 dark:border-gray-900/50 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors"
                  >
                    <td className="p-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center font-black text-xs">
                          {review.userName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-sm">{review.userName}</span>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{getProductName(review.productId)}</span>
                    </td>
                    <td className="p-6">
                      <div className="flex text-yellow-500">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star key={star} size={12} fill={review.rating >= star ? "currentColor" : "none"} />
                        ))}
                      </div>
                    </td>
                    <td className="p-6">
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 max-w-xs italic">"{review.comment}"</p>
                    </td>
                    <td className="p-6">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {review.createdAt ? format(new Date(review.createdAt), "MMM dd, yyyy") : "N/A"}
                      </span>
                    </td>
                    <td className="p-6 text-right">
                      <button 
                        onClick={() => handleDeleteReview(review)}
                        className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        
        {filteredReviews.length === 0 && !loading && (
          <div className="py-20 text-center">
            <MessageSquare className="mx-auto mb-4 text-gray-200" size={48} />
            <p className="text-gray-400 font-bold uppercase tracking-widest">No reviews found</p>
          </div>
        )}

        {loading && (
          <div className="py-20 text-center">
            <Loader2 className="mx-auto mb-4 text-black dark:text-white animate-spin" size={48} />
            <p className="text-gray-400 font-bold uppercase tracking-widest">Loading reviews...</p>
          </div>
        )}
      </div>

      {/* Add Fake Review Modal */}
      <AnimatePresence>
        {isAddingFake && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingFake(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-gray-950 rounded-[3rem] p-8 md:p-12 shadow-2xl overflow-hidden"
            >
              <button 
                onClick={() => setIsAddingFake(false)}
                className="absolute top-8 right-8 p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full transition-all"
              >
                <X size={20} />
              </button>

              <h2 className="text-3xl font-black tracking-tighter uppercase mb-8">Add Custom Review</h2>

              <form onSubmit={handleAddFakeReview} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Select Product</label>
                  <select 
                    required
                    value={fakeReview.productId}
                    onChange={(e) => setFakeReview({...fakeReview, productId: e.target.value})}
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold text-sm appearance-none"
                  >
                    <option value="">Choose a product...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">User Name</label>
                    <input 
                      required
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={fakeReview.userName}
                      onChange={(e) => setFakeReview({...fakeReview, userName: e.target.value})}
                      className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Date</label>
                    <input 
                      required
                      type="date"
                      value={fakeReview.createdAt}
                      onChange={(e) => setFakeReview({...fakeReview, createdAt: e.target.value})}
                      className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Rating</label>
                  <div className="flex space-x-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFakeReview({...fakeReview, rating: star})}
                        className={`p-2 transition-all ${fakeReview.rating >= star ? 'text-yellow-500' : 'text-gray-300'}`}
                      >
                        <Star size={24} fill={fakeReview.rating >= star ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Comment</label>
                  <textarea 
                    required
                    placeholder="Write the custom review here..."
                    value={fakeReview.comment}
                    onChange={(e) => setFakeReview({...fakeReview, comment: e.target.value})}
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold text-sm min-h-[100px]"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-5 bg-black dark:bg-white text-white dark:text-black font-black text-xs uppercase tracking-widest rounded-full hover:opacity-90 transition-all shadow-xl shadow-black/10"
                >
                  Post Custom Review
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
