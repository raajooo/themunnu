import { useState, useEffect, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";
import { Product, Category } from "../types";
import ProductCard from "../components/ProductCard";
import Breadcrumbs from "../components/Breadcrumbs";
import { SlidersHorizontal, ChevronDown, Search, Loader2, X, RotateCcw, Filter } from "lucide-react";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { motion, AnimatePresence } from "motion/react";

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get("category");
  const queryParam = searchParams.get("q") || "";

  // Synchronous cache check for initial state
  const getInitialProducts = () => {
    const sessionKey = `shop_products_session_${categoryParam || 'all'}`;
    const sessionData = sessionStorage.getItem(sessionKey);
    if (sessionData) return JSON.parse(sessionData);

    const cacheKey = `shop_products_${categoryParam || 'all'}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 30 * 60 * 1000) return data;
    }
    return [];
  };

  const initialProducts = getInitialProducts();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<Category[]>(() => {
    const cached = localStorage.getItem("shop_categories");
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(initialProducts.length === 0);
  const [searchQuery, setSearchQuery] = useState(queryParam);
  const [debouncedSearch, setDebouncedSearch] = useState(queryParam);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 50000]);
  const [selectedBrand, setSelectedBrand] = useState<string>("All");
  const [sortOrder, setSortOrder] = useState<"none" | "asc" | "desc">("none");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasActiveCoupons, setHasActiveCoupons] = useState(false);

  const brands = useMemo(() => ["All", "Nike", "Adidas", "Jordan", "Puma", "New Balance", "Yeezy"], []);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedBrand("All");
    setPriceRange([0, 50000]);
    setSortOrder("none");
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedBrand !== "All") count++;
    if (priceRange[1] < 50000) count++;
    if (searchQuery) count++;
    return count;
  }, [selectedBrand, priceRange, searchQuery]);

  useEffect(() => {
    setSearchQuery(queryParam);
  }, [queryParam]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const cachedCats = localStorage.getItem("shop_categories");
        if (cachedCats) {
          setCategories(JSON.parse(cachedCats));
          return;
        }
        const snap = await getDocs(collection(db, "categories"));
        const cats = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
        setCategories(cats);
        localStorage.setItem("shop_categories", JSON.stringify(cats));
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();

    const fetchCoupons = async () => {
      try {
        const q = query(collection(db, "coupons"), where("isActive", "==", true), limit(1));
        const snap = await getDocs(q);
        setHasActiveCoupons(!snap.empty);
      } catch (error) {
        console.error("Error fetching coupons:", error);
      }
    };
    fetchCoupons();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const cacheKey = `shop_products_${categoryParam || 'all'}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 30 * 60 * 1000) {
            setLoading(false);
            // We still need to apply client-side filters/sort if we use cached data
            // but for simplicity, let's just re-fetch for now or handle client-side
          }
        }

        if (products.length === 0) {
          setLoading(true);
        }
        
        const productsRef = collection(db, "products");
        let q = query(productsRef, orderBy("createdAt", "desc"));

        if (categoryParam) {
          if (categoryParam === "trending") {
            q = query(productsRef, where("isTrending", "==", true));
          } else if (categoryParam === "limited") {
            q = query(productsRef, where("isLimited", "==", true));
          } else {
            q = query(productsRef, where("category", "==", categoryParam));
          }
        }

        const snap = await getDocs(q);
        let results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));

        if (searchQuery) {
          results = results.filter(p => 
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            p.brand.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }

        if (selectedBrand !== "All") {
          results = results.filter(p => p.brand === selectedBrand);
        }

        results = results.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);

        if (sortOrder === "asc") {
          results.sort((a, b) => a.price - b.price);
        } else if (sortOrder === "desc") {
          results.sort((a, b) => b.price - a.price);
        }

        setProducts(results);
        
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            data: results,
            timestamp: Date.now()
          }));
          sessionStorage.setItem(`shop_products_session_${categoryParam || 'all'}`, JSON.stringify(results));
        } catch (storageErr) {
          console.warn("Storage quota exceeded, clearing old cache...");
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('shop_products_')) localStorage.removeItem(key);
          });
          Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith('shop_products_session_')) sessionStorage.removeItem(key);
          });
        }
      } catch (err: any) {
        console.error("Error fetching products:", err);
        if (err.message?.includes('resource-exhausted') || err.message?.includes('Quota limit exceeded')) {
          try {
            handleFirestoreError(err, OperationType.GET, "products");
          } catch (quotaErr: any) {
            setError(quotaErr);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [categoryParam, debouncedSearch, selectedBrand, priceRange, sortOrder]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Breadcrumbs 
        items={[
          { label: "SHOP", path: "/shop" },
          ...(categoryParam ? [{ label: (categories.find(c => c.slug === categoryParam)?.name || categoryParam).toUpperCase() }] : [])
        ]} 
      />
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-12 space-y-6 lg:space-y-0">
        <div className="w-full lg:w-auto">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-none mb-2">
            {categoryParam ? (categories.find(c => c.slug === categoryParam)?.name || categoryParam.replace("-", " ")) : "All Sneakers"}
          </h1>
          <div className="flex items-center space-x-3">
            <p className="text-gray-500 font-medium">{products.length} Products found</p>
            {activeFilterCount > 0 && (
              <button 
                onClick={clearFilters}
                className="text-xs font-bold uppercase tracking-widest text-red-500 hover:text-red-600 flex items-center space-x-1"
              >
                <RotateCcw size={12} />
                <span>Clear Filters</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-stretch sm:items-center">
          <div className="relative flex-grow sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search sneakers..." 
              className="w-full pl-12 pr-4 py-4 bg-gray-100 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-sm font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <div className="relative flex-grow sm:flex-grow-0">
              <select 
                className="w-full sm:w-auto appearance-none pl-6 pr-12 py-4 bg-gray-100 dark:bg-gray-900 rounded-2xl font-bold text-xs uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white cursor-pointer"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "none" | "asc" | "desc")}
              >
                <option value="none">Sort: Default</option>
                <option value="asc">Price: Low to High</option>
                <option value="desc">Price: High to Low</option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" size={16} />
            </div>

            <button 
              onClick={() => setIsFilterOpen(true)}
              className="relative flex items-center justify-center space-x-2 px-8 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all"
            >
              <SlidersHorizontal size={18} />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white dark:border-black">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Filter Slide-over Panel */}
      <AnimatePresence>
        {isFilterOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.aside 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-black z-[101] shadow-2xl overflow-y-auto"
            >
              <div className="sticky top-0 bg-white dark:bg-black z-10 px-8 py-6 border-bottom border-gray-100 dark:border-gray-800 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <Filter size={20} />
                  <h2 className="text-xl font-black uppercase tracking-tighter">Refine Selection</h2>
                </div>
                <button 
                  onClick={() => setIsFilterOpen(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 space-y-12">
                {/* Categories */}
                <section>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-6 text-gray-400">Categories</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Link 
                      to="/shop"
                      onClick={() => setIsFilterOpen(false)}
                      className={`px-4 py-3 rounded-xl text-sm font-bold transition-all text-center border-2 ${!categoryParam ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white' : 'bg-transparent border-gray-100 dark:border-gray-800 text-gray-500 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white'}`}
                    >
                      All
                    </Link>
                    {categories.map(cat => (
                      <Link 
                        key={cat.id}
                        to={`/shop?category=${cat.slug}`}
                        onClick={() => setIsFilterOpen(false)}
                        className={`px-4 py-3 rounded-xl text-sm font-bold transition-all text-center border-2 ${categoryParam === cat.slug ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white' : 'bg-transparent border-gray-100 dark:border-gray-800 text-gray-500 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white'}`}
                      >
                        {cat.name}
                      </Link>
                    ))}
                    <Link 
                      to="/shop?category=trending"
                      onClick={() => setIsFilterOpen(false)}
                      className={`px-4 py-3 rounded-xl text-sm font-bold transition-all text-center border-2 ${categoryParam === 'trending' ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white' : 'bg-transparent border-gray-100 dark:border-gray-800 text-gray-500 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white'}`}
                    >
                      Trending
                    </Link>
                    <Link 
                      to="/shop?category=limited"
                      onClick={() => setIsFilterOpen(false)}
                      className={`px-4 py-3 rounded-xl text-sm font-bold transition-all text-center border-2 ${categoryParam === 'limited' ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white' : 'bg-transparent border-gray-100 dark:border-gray-800 text-gray-500 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white'}`}
                    >
                      Limited
                    </Link>
                  </div>
                </section>

                {/* Brands */}
                <section>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-6 text-gray-400">Brands</h3>
                  <div className="flex flex-wrap gap-2">
                    {brands.map(brand => (
                      <button 
                        key={brand}
                        onClick={() => setSelectedBrand(brand)}
                        className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all border-2 ${selectedBrand === brand ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white' : 'bg-transparent border-gray-100 dark:border-gray-800 text-gray-500 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white'}`}
                      >
                        {brand}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Price Range */}
                <section>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Price Range</h3>
                    <span className="text-sm font-black">₹0 - ₹{priceRange[1].toLocaleString()}</span>
                  </div>
                  <div className="space-y-6">
                    <input 
                      type="range" 
                      min="0" 
                      max="50000" 
                      step="1000"
                      className="w-full h-2 bg-gray-100 dark:bg-gray-900 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white"
                      value={priceRange[1]}
                      onChange={(e) => setPriceRange([0, parseInt(e.target.value)])}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                        <span className="block text-[10px] uppercase tracking-widest text-gray-400 mb-1">Min Price</span>
                        <span className="text-lg font-bold">₹0</span>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                        <span className="block text-[10px] uppercase tracking-widest text-gray-400 mb-1">Max Price</span>
                        <span className="text-lg font-bold">₹{priceRange[1].toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <div className="sticky bottom-0 bg-white dark:bg-black p-8 border-t border-gray-100 dark:border-gray-800">
                <button 
                  onClick={() => setIsFilterOpen(false)}
                  className="w-full py-5 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-black/10 dark:shadow-white/5"
                >
                  Show {products.length} Results
                </button>
                <button 
                  onClick={clearFilters}
                  className="w-full mt-4 py-3 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                >
                  Reset All Filters
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="w-full">
        {/* Product Grid */}
        <div className="w-full">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="aspect-[4/5] bg-gray-100 dark:bg-gray-900 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {products.map(product => (
                <ProductCard key={product.id} product={product} hasCoupon={hasActiveCoupons} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <h3 className="text-2xl font-bold mb-4">No sneakers found</h3>
              <p className="text-gray-500">Try adjusting your filters or search query.</p>
              <button 
                onClick={() => {
                  setSearchQuery("");
                  setSelectedBrand("All");
                  setPriceRange([0, 50000]);
                }}
                className="mt-6 px-8 py-3 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold uppercase tracking-widest text-sm"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
