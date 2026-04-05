import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { collection, query, where, limit, getDocs, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Product, Banner, Category } from "../types";
import ProductCard from "../components/ProductCard";
import { ArrowRight, Zap, TrendingUp, Star } from "lucide-react";
import LazyImage from "../components/LazyImage";

export default function Home() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check session storage for cached data
    const cachedData = sessionStorage.getItem("home_data");
    if (cachedData) {
      const { featured, trending, cats, bans, timestamp } = JSON.parse(cachedData);
      // Cache for 5 minutes
      if (Date.now() - timestamp < 5 * 60 * 1000) {
        setFeaturedProducts(featured);
        setTrendingProducts(trending);
        setCategories(cats);
        setBanners(bans);
        setLoading(false);
      }
    }

    const productsRef = collection(db, "products");
    
    // Use onSnapshot for real-time updates and better caching
    const qFeatured = query(productsRef, where("isFeatured", "==", true), limit(4));
    const qTrending = query(productsRef, where("isTrending", "==", true), limit(4));
    const qCategories = collection(db, "categories");
    const qBanners = collection(db, "banners");

    const unsubFeatured = onSnapshot(qFeatured, (snap) => {
      setFeaturedProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    const unsubTrending = onSnapshot(qTrending, (snap) => {
      setTrendingProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    const unsubCats = onSnapshot(qCategories, (snap) => {
      setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    });

    const unsubBanners = onSnapshot(qBanners, (snap) => {
      setBanners(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner)));
      setLoading(false);
    });

    return () => {
      unsubFeatured();
      unsubTrending();
      unsubCats();
      unsubBanners();
    };
  }, []);

  return (
    <div className="space-y-20 pb-20">
      {/* Hero Section */}
      <section className="relative h-[85vh] overflow-hidden bg-black">
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
              <Link to="/shop?category=limited" className="px-8 py-4 bg-transparent border-2 border-white text-white font-black text-sm uppercase tracking-widest hover:bg-white/10 transition-colors">
                Limited Drops
              </Link>
            </div>
          </motion.div>
        </div>
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
                  <h3 className="text-4xl font-black tracking-tighter mb-2 uppercase">{cat.name}</h3>
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
            <form className="flex flex-col md:flex-row gap-4">
              <input 
                type="email" 
                placeholder="Enter your email" 
                className="flex-grow bg-white/10 border border-white/20 rounded-full px-8 py-4 focus:outline-none focus:border-white transition-colors"
              />
              <button className="bg-white text-black font-black px-10 py-4 rounded-full hover:bg-gray-200 transition-colors uppercase tracking-widest text-sm">
                Subscribe
              </button>
            </form>
          </div>
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl" />
        </div>
      </section>
    </div>
  );
}
