import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { collection, query, where, limit, getDocs, orderBy, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Product, Banner, Category } from "../types";
import ProductCard from "../components/ProductCard";
import { ArrowRight, Zap, TrendingUp, Star, ChevronLeft, ChevronRight, CheckCircle2, Loader2 } from "lucide-react";
import LazyImage from "../components/LazyImage";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { toast } from "react-hot-toast";

export default function Home() {
  // Initialize state from cache to prevent flicker
  const getCachedData = () => {
    const sessionData = sessionStorage.getItem("home_data_session");
    if (sessionData) return JSON.parse(sessionData);
    
    const localData = localStorage.getItem("home_data");
    if (localData) {
      const parsed = JSON.parse(localData);
      if (Date.now() - parsed.timestamp < 30 * 60 * 1000) return parsed;
    }
    return null;
  };

  const cached = getCachedData();

  const [featuredProducts, setFeaturedProducts] = useState<Product[]>(cached?.featured || []);
  const [trendingProducts, setTrendingProducts] = useState<Product[]>(cached?.trending || []);
  const [categories, setCategories] = useState<Category[]>(cached?.cats || []);
  const [banners, setBanners] = useState<Banner[]>(cached?.bans || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<Error | null>(null);

  const [currentBanner, setCurrentBanner] = useState(0);
  
  // Newsletter State
  const [email, setEmail] = useState("");
  const [subscribing, setSubscribing] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const nextBanner = useCallback(() => {
    setCurrentBanner((prev) => (prev + 1) % (banners.length || 1));
  }, [banners.length]);

  const prevBanner = useCallback(() => {
    setCurrentBanner((prev) => (prev - 1 + (banners.length || 1)) % (banners.length || 1));
  }, [banners.length]);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setSubscribing(true);
    try {
      // Check if already subscribed
      const q = query(collection(db, "subscribers"), where("email", "==", email.toLowerCase()));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        toast.error("You are already subscribed!");
        setSubscribed(true);
        return;
      }
      
      await addDoc(collection(db, "subscribers"), {
        email: email.toLowerCase(),
        status: "active",
        createdAt: new Date().toISOString()
      });
      
      setSubscribed(true);
      toast.success("Welcome to the Inner Circle!");
    } catch (error) {
      console.error("Subscription error:", error);
      toast.error("Failed to subscribe. Please try again.");
    } finally {
      setSubscribing(false);
    }
  };

  useEffect(() => {
    if (banners.length > 1) {
      const timer = setInterval(nextBanner, 5000);
      return () => clearInterval(timer);
    }
  }, [banners.length, nextBanner]);

  if (error) {
    throw error;
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        // If we already have valid cache, we can skip the background fetch 
        // or do it silently without showing loading state
        const localData = localStorage.getItem("home_data");
        if (localData) {
          const parsed = JSON.parse(localData);
          if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
            setLoading(false);
            return;
          }
        }

        // Only show loading if we don't have data yet
        if (featuredProducts.length === 0) {
          setLoading(true);
        }

        const productsRef = collection(db, "products");
        
        // Fetch Featured
        const qFeatured = query(productsRef, where("isFeatured", "==", true), limit(4));
        const featuredSnap = await getDocs(qFeatured);
        const featured = featuredSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));

        // Fetch Trending
        const qTrending = query(productsRef, where("isTrending", "==", true), limit(4));
        const trendingSnap = await getDocs(qTrending);
        const trending = trendingSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));

        // Fetch Categories
        const qCategories = collection(db, "categories");
        const categoriesSnap = await getDocs(qCategories);
        const cats = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));

        // Fetch Banners
        const qBanners = query(collection(db, "banners"), where("isActive", "==", true), orderBy("order", "asc"));
        const bannersSnap = await getDocs(qBanners);
        const bans = bannersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));

        // Update state only after all data is fetched to avoid multiple renders
        setFeaturedProducts(featured);
        setTrendingProducts(trending);
        setCategories(cats);
        setBanners(bans);

        // Cache the data in localStorage
        localStorage.setItem("home_data", JSON.stringify({
          featured,
          trending,
          cats,
          bans,
          timestamp: Date.now()
        }));

        // Also cache in session storage for instant back-navigation
        sessionStorage.setItem("home_data_session", JSON.stringify({
          featured,
          trending,
          cats,
          bans
        }));
      } catch (err: any) {
        console.error("Error fetching home data:", err);
        // If quota is exceeded, handleFirestoreError will throw and be caught by ErrorBoundary
        if (err.message?.includes('resource-exhausted') || err.message?.includes('Quota limit exceeded')) {
          try {
            handleFirestoreError(err, OperationType.GET, "home_data");
          } catch (quotaErr: any) {
            setError(quotaErr);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="space-y-20 pb-20">
      {/* Hero Section */}
      <section className="relative h-[85vh] overflow-hidden bg-black">
        <AnimatePresence mode="wait">
          {banners.length > 0 ? (
            <motion.div
              key={banners[currentBanner].id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0"
            >
              <div className="absolute inset-0 opacity-60">
                <LazyImage 
                  src={banners[currentBanner].imageUrl} 
                  alt={banners[currentBanner].title} 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              
              <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-start">
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="max-w-2xl"
                >
                  <span className="inline-block px-3 py-1 bg-white text-black text-[10px] font-black uppercase tracking-[0.3em] mb-6">
                    Featured Drop
                  </span>
                  <h1 className="text-6xl md:text-8xl font-black text-white leading-none tracking-tighter mb-8 uppercase">
                    {banners[currentBanner].title}
                  </h1>
                  {banners[currentBanner].subtitle && (
                    <p className="text-xl text-gray-300 mb-10 max-w-md uppercase tracking-widest font-bold">
                      {banners[currentBanner].subtitle}
                    </p>
                  )}
                  <div className="flex space-x-4">
                    <Link to={banners[currentBanner].link || "/shop"} className="px-8 py-4 bg-white text-black font-black text-sm uppercase tracking-widest hover:bg-gray-200 transition-colors flex items-center">
                      Shop Now <ArrowRight className="ml-2" size={18} />
                    </Link>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          ) : (
            <div className="absolute inset-0">
              <div className="absolute inset-0 opacity-60">
                <LazyImage 
                  src="https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&q=80&w=2070" 
                  alt="Hero" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              
              <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-start">
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8 }}
                  className="max-w-2xl"
                >
                  <span className="inline-block px-3 py-1 bg-white text-black text-[10px] font-black uppercase tracking-[0.3em] mb-6">
                    New Season Drop
                  </span>
                  <h1 className="text-6xl md:text-8xl font-black text-white leading-none tracking-tighter mb-8">
                    STEP INTO <br /> THE FUTURE.
                  </h1>
                  <p className="text-xl text-gray-300 mb-10 max-w-md">
                    Experience the pinnacle of sneaker technology and bold street aesthetic. Designed for the next generation.
                  </p>
                  <div className="flex space-x-4">
                    <Link to="/shop" className="px-8 py-4 bg-white text-black font-black text-sm uppercase tracking-widest hover:bg-gray-200 transition-colors flex items-center">
                      Shop Now <ArrowRight className="ml-2" size={18} />
                    </Link>
                  </div>
                </motion.div>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Banner Controls */}
        {banners.length > 1 && (
          <div className="absolute bottom-10 right-10 flex space-x-4 z-20">
            <button 
              onClick={prevBanner}
              className="p-4 bg-white/10 backdrop-blur-md text-white rounded-full hover:bg-white/20 transition-all border border-white/20"
            >
              <ChevronLeft size={24} />
            </button>
            <button 
              onClick={nextBanner}
              className="p-4 bg-white/10 backdrop-blur-md text-white rounded-full hover:bg-white/20 transition-all border border-white/20"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        )}

        {/* Banner Indicators */}
        {banners.length > 1 && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex space-x-2 z-20">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentBanner(idx)}
                className={`w-12 h-1 rounded-full transition-all ${idx === currentBanner ? 'bg-white' : 'bg-white/30'}`}
              />
            ))}
          </div>
        )}
      </section>

      {/* Featured Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-12">
          <div>
            <div className="flex items-center text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2">
              <Star className="mr-2 text-yellow-500" size={14} /> Featured Collection
            </div>
            <h2 className="text-4xl font-black tracking-tighter">THE HOT LIST</h2>
          </div>
          <Link to="/shop" className="text-sm font-bold border-b-2 border-black dark:border-white pb-1 hover:opacity-70 transition-opacity">
            VIEW ALL
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {featuredProducts.length > 0 ? (
            featuredProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))
          ) : (
            [1, 2, 3, 4].map(i => (
              <div key={i} className="aspect-[4/5] bg-gray-100 dark:bg-gray-900 rounded-2xl animate-pulse" />
            ))
          )}
        </div>
      </section>

      {/* Categories / Bento Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-auto md:h-[600px]">
          {loading ? (
            <>
              <div className="md:col-span-2 h-[300px] md:h-full bg-gray-100 dark:bg-gray-900 rounded-3xl animate-pulse" />
              <div className="h-[300px] md:h-full bg-gray-100 dark:bg-gray-900 rounded-3xl animate-pulse" />
              <div className="h-[300px] md:h-full bg-gray-100 dark:bg-gray-900 rounded-3xl animate-pulse" />
            </>
          ) : categories.length > 0 ? (
            categories.slice(0, 3).map((cat, index) => (
              <Link 
                key={cat.id} 
                to={`/shop?category=${cat.slug}`} 
                className={`${index === 0 ? 'md:col-span-2' : ''} relative group overflow-hidden rounded-3xl h-[300px] md:h-full`}
              >
                <LazyImage 
                  src={cat.imageUrl || (index === 0 ? "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=2070" : index === 1 ? "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&q=80&w=1000" : "https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&q=80&w=1000")} 
                  alt={cat.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                <div className="absolute bottom-10 left-10 text-white">
                  <div className="flex items-center space-x-3 mb-2">
                    {cat.logoUrl && (
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-white/20 backdrop-blur-md border border-white/30">
                        <img src={cat.logoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    )}
                    <h3 className="text-4xl font-black tracking-tighter uppercase">{cat.name}</h3>
                  </div>
                  <p className="text-sm font-medium opacity-80">Explore the collection.</p>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full text-center py-20 text-gray-400 font-bold uppercase tracking-widest">
              Add categories in admin to see them here
            </div>
          )}
        </div>
      </section>

      {/* Trending Section */}
      <section className="bg-gray-50 dark:bg-gray-950 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-12">
            <div>
              <div className="flex items-center text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2">
                <TrendingUp className="mr-2 text-red-500" size={14} /> Trending Now
              </div>
              <h2 className="text-4xl font-black tracking-tighter">STREET FAVORITES</h2>
            </div>
            <Link to="/shop?category=trending" className="text-sm font-bold border-b-2 border-black dark:border-white pb-1 hover:opacity-70 transition-opacity">
              EXPLORE TRENDS
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {trendingProducts.length > 0 ? (
              trendingProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))
            ) : (
              [1, 2, 3, 4].map(i => (
                <div key={i} className="aspect-[4/5] bg-gray-100 dark:bg-gray-900 rounded-2xl animate-pulse" />
              ))
            )}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-black text-white rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden">
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-6 uppercase">Join the Inner Circle</h2>
            <p className="text-gray-400 mb-10 text-lg">Get early access to limited drops, exclusive events, and the latest sneaker news.</p>
            
            <AnimatePresence mode="wait">
              {subscribed ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center space-y-4"
                >
                  <div className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center">
                    <CheckCircle2 size={32} />
                  </div>
                  <p className="text-2xl font-black uppercase tracking-widest">You're in!</p>
                  <p className="text-gray-400">Welcome to the inner circle. Stay tuned for updates.</p>
                </motion.div>
              ) : (
                <motion.form 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSubscribe} 
                  className="flex flex-col md:flex-row gap-4"
                >
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email" 
                    required
                    className="flex-grow bg-white/10 border border-white/20 rounded-full px-8 py-4 focus:outline-none focus:border-white transition-colors"
                  />
                  <button 
                    type="submit"
                    disabled={subscribing}
                    className="bg-white text-black font-black px-10 py-4 rounded-full hover:bg-gray-200 transition-colors uppercase tracking-widest text-sm flex items-center justify-center disabled:opacity-50"
                  >
                    {subscribing ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                    Subscribe
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl" />
        </div>
      </section>
    </div>
  );
}
