import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, runTransaction } from "firebase/firestore";
import { db, auth } from "../firebase";
import { Product, Review } from "../types";
import { useCart } from "../hooks/useCart";
import { formatCurrency } from "../lib/utils";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { motion, AnimatePresence } from "motion/react";
import { ShoppingBag, ChevronLeft, ChevronRight, Star, ShieldCheck, Truck, RotateCcw, MessageSquare, Send, User } from "lucide-react";
import { toast } from "react-hot-toast";
import { format } from "date-fns";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState("");
  const [currentImage, setCurrentImage] = useState(0);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.pageX - left - window.scrollX) / width) * 100;
    const y = ((e.pageY - top - window.scrollY) / height) * 100;
    setZoomPos({ x, y });
  };

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, "products", id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setProduct({ id: snap.id, ...snap.data() } as Product);
        }
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();

    // Real-time reviews
    const q = query(
      collection(db, "reviews"),
      where("productId", "==", id),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setReviews(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `reviews?productId=${id}`);
    });

    return () => unsubscribe();
  }, [id]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !id || !product) {
      toast.error("Please login to leave a review");
      return;
    }
    if (!newComment.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    setSubmittingReview(true);
    try {
      await runTransaction(db, async (transaction) => {
        // 1. Add the review
        const reviewRef = collection(db, "reviews");
        const newReviewData = {
          productId: id,
          userId: auth.currentUser?.uid,
          userName: auth.currentUser?.displayName || auth.currentUser?.phoneNumber || "Anonymous",
          rating: newRating,
          comment: newComment,
          createdAt: new Date().toISOString()
        };
        
        // We can't use addDoc inside a transaction easily with the standard SDK without a ref
        // So we'll just use a doc ref with auto-id
        const newReviewDocRef = doc(reviewRef);
        transaction.set(newReviewDocRef, newReviewData);

        // 2. Update product stats
        const productRef = doc(db, "products", id);
        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists()) throw "Product does not exist!";

        const currentData = productSnap.data() as Product;
        const oldCount = currentData.reviewCount || 0;
        const oldAvg = currentData.averageRating || 0;
        
        const newCount = oldCount + 1;
        const newAvg = ((oldAvg * oldCount) + newRating) / newCount;

        transaction.update(productRef, {
          reviewCount: newCount,
          averageRating: newAvg
        });
      });

      toast.success("Review submitted!");
      setNewComment("");
      setNewRating(5);
    } catch (error) {
      console.error("Error submitting review:", error);
      toast.error("Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div className="space-y-6">
            <div className="aspect-[4/5] bg-gray-100 dark:bg-gray-900 rounded-3xl animate-pulse" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="aspect-square bg-gray-100 dark:bg-gray-900 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="h-4 w-24 bg-gray-100 dark:bg-gray-900 rounded animate-pulse" />
              <div className="h-16 w-3/4 bg-gray-100 dark:bg-gray-900 rounded-2xl animate-pulse" />
              <div className="h-10 w-1/2 bg-gray-100 dark:bg-gray-900 rounded-xl animate-pulse" />
            </div>
            <div className="h-32 w-full bg-gray-100 dark:bg-gray-900 rounded-2xl animate-pulse" />
            <div className="space-y-4">
              <div className="h-6 w-32 bg-gray-100 dark:bg-gray-900 rounded animate-pulse" />
              <div className="grid grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-14 bg-gray-100 dark:bg-gray-900 rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4 uppercase tracking-tighter">Sneaker not found</h2>
        <button onClick={() => navigate("/shop")} className="px-8 py-3 bg-black text-white rounded-full font-bold uppercase tracking-widest text-sm">
          Back to Shop
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        {/* Image Gallery */}
        <div className="space-y-6">
          <div 
            className="relative aspect-[4/5] bg-gray-100 dark:bg-gray-900 rounded-3xl overflow-hidden group cursor-zoom-in"
            onMouseEnter={() => setIsZoomed(true)}
            onMouseLeave={() => setIsZoomed(false)}
            onMouseMove={handleMouseMove}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentImage}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full"
              >
                <img
                  src={product.images?.[currentImage] || ""}
                  alt={product.name}
                  className={`w-full h-full object-cover transition-transform duration-200 ${isZoomed ? 'scale-[2.5]' : 'scale-100'}`}
                  style={isZoomed ? {
                    transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`
                  } : {}}
                  referrerPolicy="no-referrer"
                />
              </motion.div>
            </AnimatePresence>
            
            <button 
              onClick={() => setCurrentImage(prev => (prev > 0 ? prev - 1 : (product.images?.length || 1) - 1))}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/80 dark:bg-black/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={() => setCurrentImage(prev => (prev < (product.images?.length || 0) - 1 ? prev + 1 : 0))}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/80 dark:bg-black/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {product.images?.map((img, idx) => (
              <button 
                key={idx}
                onClick={() => setCurrentImage(idx)}
                className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${currentImage === idx ? 'border-black dark:border-white scale-95' : 'border-transparent opacity-60 hover:opacity-100'}`}
              >
                <img src={img} alt={`${product.name} ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </button>
            ))}
          </div>
        </div>

        {/* Product Info */}
        <div className="flex flex-col">
          <div className="mb-8">
            <div className="flex items-center space-x-2 text-gray-400 text-xs font-black uppercase tracking-widest mb-4">
              <span>{product.brand}</span>
              <span>•</span>
              <span>{product.category}</span>
            </div>
            <h1 className="text-5xl font-black tracking-tighter uppercase mb-4 leading-none">
              {product.name}
            </h1>
            <div className="flex items-center space-x-4 mb-6">
              <span className="text-3xl font-black">{formatCurrency(product.price)}</span>
              <div className="flex items-center text-yellow-500">
                <Star size={16} fill={product.averageRating && product.averageRating >= 1 ? "currentColor" : "none"} />
                <Star size={16} fill={product.averageRating && product.averageRating >= 2 ? "currentColor" : "none"} />
                <Star size={16} fill={product.averageRating && product.averageRating >= 3 ? "currentColor" : "none"} />
                <Star size={16} fill={product.averageRating && product.averageRating >= 4 ? "currentColor" : "none"} />
                <Star size={16} fill={product.averageRating && product.averageRating >= 5 ? "currentColor" : "none"} />
                <span className="ml-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                  ({product.reviewCount || 0} Reviews)
                </span>
              </div>
            </div>
            <p className="text-gray-500 leading-relaxed text-lg">
              {product.description}
            </p>
          </div>

          <div className="mb-10">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-black uppercase tracking-widest">Select Size (UK)</h3>
              <button className="text-xs font-bold underline underline-offset-4">Size Guide</button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {(product.sizes?.length || 0) > 0 ? (
                product.sizes?.map(size => (
                  <button 
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`py-4 rounded-xl font-bold text-sm transition-all border-2 ${selectedSize === size ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'bg-transparent border-gray-100 dark:border-gray-900 hover:border-gray-300 dark:hover:border-gray-700'}`}
                  >
                    {size}
                  </button>
                ))
              ) : (
                <div className="col-span-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl text-center">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No sizes available for this product</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 mb-12">
            <button 
              onClick={() => {
                if (!selectedSize) return;
                addToCart(product, selectedSize, 1);
              }}
              disabled={!selectedSize}
              className="w-full py-5 bg-black dark:bg-white text-white dark:text-black font-black text-sm uppercase tracking-[0.2em] rounded-full hover:opacity-90 transition-opacity disabled:opacity-30 flex items-center justify-center"
            >
              <ShoppingBag className="mr-3" size={20} />
              Add to Cart
            </button>
            <button className="w-full py-5 bg-transparent border-2 border-black dark:border-white text-black dark:text-white font-black text-sm uppercase tracking-[0.2em] rounded-full hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all">
              Buy Now
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-10 border-t border-gray-100 dark:border-gray-900">
            <div className="text-center">
              <div className="flex justify-center mb-2 text-gray-400"><ShieldCheck size={24} /></div>
              <p className="text-[10px] font-bold uppercase tracking-widest">100% Authentic</p>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-2 text-gray-400"><Truck size={24} /></div>
              <p className="text-[10px] font-bold uppercase tracking-widest">Free Shipping</p>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-2 text-gray-400"><RotateCcw size={24} /></div>
              <p className="text-[10px] font-bold uppercase tracking-widest">7 Day Returns</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="mt-24 pt-24 border-t border-gray-100 dark:border-gray-900">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          {/* Review Summary & Form */}
          <div className="lg:col-span-1 space-y-10">
            <div>
              <h2 className="text-4xl font-black tracking-tighter uppercase mb-2">Reviews</h2>
              <div className="flex items-center space-x-4">
                <div className="text-5xl font-black">{(product.averageRating || 0).toFixed(1)}</div>
                <div>
                  <div className="flex text-yellow-500">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} size={16} fill={(product.averageRating || 0) >= star ? "currentColor" : "none"} />
                    ))}
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Based on {product.reviewCount || 0} reviews</p>
                </div>
              </div>
            </div>

            {auth.currentUser ? (
              <form onSubmit={handleSubmitReview} className="p-8 bg-gray-50 dark:bg-gray-900 rounded-[2.5rem] space-y-6">
                <h3 className="text-sm font-black uppercase tracking-widest">Write a Review</h3>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Rating</label>
                  <div className="flex space-x-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewRating(star)}
                        className={`p-2 transition-all ${newRating >= star ? 'text-yellow-500' : 'text-gray-300'}`}
                      >
                        <Star size={24} fill={newRating >= star ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Comment</label>
                  <textarea
                    required
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Share your experience with this sneaker..."
                    className="w-full px-6 py-4 bg-white dark:bg-gray-950 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-medium text-sm min-h-[120px]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingReview}
                  className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-black text-xs uppercase tracking-widest rounded-full hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50"
                >
                  {submittingReview ? "Submitting..." : (
                    <>
                      <Send className="mr-2" size={16} />
                      Post Review
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="p-8 bg-gray-50 dark:bg-gray-900 rounded-[2.5rem] text-center">
                <MessageSquare className="mx-auto mb-4 text-gray-300" size={32} />
                <p className="text-sm font-bold uppercase tracking-widest mb-4">Login to leave a review</p>
                <button 
                  onClick={() => navigate("/login")}
                  className="px-8 py-3 bg-black dark:bg-white text-white dark:text-black font-black text-xs uppercase tracking-widest rounded-full"
                >
                  Login Now
                </button>
              </div>
            )}
          </div>

          {/* Review List */}
          <div className="lg:col-span-2 space-y-8">
            {reviews.length > 0 ? (
              reviews.map((review) => (
                <div key={review.id} className="p-8 border border-gray-100 dark:border-gray-900 rounded-[2.5rem] hover:shadow-xl hover:shadow-black/5 transition-all">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center font-black">
                        {review.userName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-black uppercase tracking-tight">{review.userName}</h4>
                        <div className="flex items-center space-x-2">
                          <div className="flex text-yellow-500">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star key={star} size={12} fill={review.rating >= star ? "currentColor" : "none"} />
                            ))}
                          </div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {review.createdAt ? format(new Date(review.createdAt), "MMM dd, yyyy") : "Recently"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-500 leading-relaxed italic">"{review.comment}"</p>
                </div>
              ))
            ) : (
              <div className="py-20 text-center border-2 border-dashed border-gray-100 dark:border-gray-900 rounded-[3rem]">
                <p className="text-gray-400 font-bold uppercase tracking-widest">No reviews yet. Be the first!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
