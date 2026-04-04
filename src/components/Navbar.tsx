import { Link, useNavigate } from "react-router-dom";
import { ShoppingCart, User as UserIcon, Search, Menu, X, ArrowRight } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { User, Product } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { db } from "../firebase";
import LazyImage from "./LazyImage";

interface NavbarProps {
  user: User | null;
}

export default function Navbar({ user }: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'menu' | 'search'>('menu');
  const [isSearchOpen, setIsSearchOpen] = useState(false); // For desktop search
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        // For a real app, you'd use a search service or more complex Firestore queries.
        // Here we fetch a subset and filter locally for better UX in this demo.
        const q = query(collection(db, "products"), limit(20));
        const snap = await getDocs(q);
        const allProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        
        const filtered = allProducts.filter(p => 
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.brand.toLowerCase().includes(searchQuery.toLowerCase())
        ).slice(0, 5);

        setSuggestions(filtered);
        setShowSuggestions(true);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsMobileMenuOpen(false);
      setIsSearchOpen(false);
      setShowSuggestions(false);
      setSearchQuery("");
    }
  };

  const toggleMobileMenu = (tab: 'menu' | 'search') => {
    if (isMobileMenuOpen && activeTab === tab) {
      setIsMobileMenuOpen(false);
    } else {
      setActiveTab(tab);
      setIsMobileMenuOpen(true);
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Link to="/" className="text-2xl font-black tracking-tighter">
              MUNNU
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/shop" className="text-sm font-medium hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              SHOP
            </Link>
            <Link to="/shop?category=trending" className="text-sm font-medium hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              TRENDING
            </Link>
            <Link to="/shop?category=limited" className="text-sm font-medium hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              LIMITED
            </Link>
            {user?.role === 'admin' && (
              <Link to="/admin" className="text-sm font-black text-purple-600 hover:text-purple-700 transition-colors">
                ADMIN
              </Link>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative hidden sm:block" ref={searchRef}>
              <AnimatePresence>
                {isSearchOpen && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2">
                    <motion.form
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 300, opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      onSubmit={handleSearch}
                      className="relative overflow-visible"
                    >
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search sneakers..."
                        className="w-full pl-4 pr-10 py-2 bg-gray-100 dark:bg-gray-900 rounded-full text-sm focus:outline-none border border-transparent focus:border-black dark:focus:border-white transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => searchQuery.trim().length >= 2 && setShowSuggestions(true)}
                      />
                      
                      {/* Desktop Suggestions Dropdown */}
                      <AnimatePresence>
                        {showSuggestions && suggestions.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute top-full right-0 mt-2 w-full bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-900 overflow-hidden z-[60]"
                          >
                            <div className="p-2">
                              {suggestions.map(product => (
                                <button
                                  key={product.id}
                                  onClick={() => {
                                    navigate(`/product/${product.id}`);
                                    setIsSearchOpen(false);
                                    setShowSuggestions(false);
                                    setSearchQuery("");
                                  }}
                                  className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-xl transition-colors text-left group"
                                >
                                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                                    <LazyImage src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                                  </div>
                                  <div className="flex-grow min-w-0">
                                    <p className="text-xs font-bold truncate uppercase tracking-tight">{product.name}</p>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{product.brand}</p>
                                  </div>
                                  <ArrowRight size={14} className="text-gray-300 group-hover:text-black dark:group-hover:text-white transition-colors" />
                                </button>
                              ))}
                              <button
                                onClick={() => handleSearch()}
                                className="w-full p-3 text-[10px] font-black uppercase tracking-widest text-center text-gray-400 hover:text-black dark:hover:text-white transition-colors border-t border-gray-50 dark:border-gray-900 mt-1"
                              >
                                View all results for "{searchQuery}"
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.form>
                  </div>
                )}
              </AnimatePresence>
              <button 
                onClick={() => {
                  setIsSearchOpen(!isSearchOpen);
                  setIsMobileMenuOpen(false);
                  if (!isSearchOpen) {
                    setSearchQuery("");
                    setSuggestions([]);
                  }
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full transition-colors relative z-10"
              >
                {isSearchOpen ? <X size={20} /> : <Search size={20} />}
              </button>
            </div>
            
            <button 
              className="sm:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full transition-colors"
              onClick={() => toggleMobileMenu('search')}
            >
              <Search size={20} />
            </button>
            <Link to="/cart" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full transition-colors relative">
              <ShoppingCart size={20} />
            </Link>
            <Link to={user ? "/profile" : "/login"} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full transition-colors">
              <UserIcon size={20} />
            </Link>
            <button 
              className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full transition-colors"
              onClick={() => toggleMobileMenu('menu')}
            >
              {isMobileMenuOpen && activeTab === 'menu' ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 overflow-hidden shadow-xl"
          >
            <div className="px-4 py-6 space-y-6">
              {/* Tab Switcher */}
              <div className="flex p-1 bg-gray-100 dark:bg-gray-900 rounded-2xl">
                <button 
                  onClick={() => setActiveTab('menu')}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'menu' ? 'bg-white dark:bg-black shadow-sm' : 'text-gray-400'}`}
                >
                  Menu
                </button>
                <button 
                  onClick={() => setActiveTab('search')}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'search' ? 'bg-white dark:bg-black shadow-sm' : 'text-gray-400'}`}
                >
                  Search
                </button>
              </div>

              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: activeTab === 'menu' ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: activeTab === 'menu' ? 20 : -20 }}
                transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              >
                {activeTab === 'search' ? (
                  <div className="space-y-4">
                    <form onSubmit={handleSearch} className="relative">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search products..."
                        className="w-full pl-12 pr-4 py-4 bg-gray-100 dark:bg-gray-900 rounded-2xl text-lg font-bold focus:outline-none"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    </form>

                    {/* Mobile Suggestions */}
                    <AnimatePresence>
                      {suggestions.length > 0 && searchQuery.trim().length >= 2 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-2"
                        >
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-2">Suggestions</p>
                          <div className="space-y-1">
                            {suggestions.map(product => (
                              <button
                                key={product.id}
                                onClick={() => {
                                  navigate(`/product/${product.id}`);
                                  setIsMobileMenuOpen(false);
                                  setSearchQuery("");
                                }}
                                className="w-full flex items-center space-x-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl text-left"
                              >
                                <div className="w-12 h-12 rounded-xl overflow-hidden bg-white dark:bg-black flex-shrink-0">
                                  <LazyImage src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-grow">
                                  <p className="text-sm font-bold uppercase tracking-tight">{product.name}</p>
                                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{product.brand}</p>
                                </div>
                                <ArrowRight size={16} className="text-gray-300" />
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {user?.role === 'admin' && (
                      <Link to="/admin" className="block text-lg font-black text-purple-600" onClick={() => setIsMobileMenuOpen(false)}>ADMIN PANEL</Link>
                    )}
                    <Link to="/shop" className="block text-lg font-bold" onClick={() => setIsMobileMenuOpen(false)}>SHOP</Link>
                    <Link to="/shop?category=trending" className="block text-lg font-bold" onClick={() => setIsMobileMenuOpen(false)}>TRENDING</Link>
                    <Link to="/shop?category=limited" className="block text-lg font-bold" onClick={() => setIsMobileMenuOpen(false)}>LIMITED</Link>
                    <Link to="/orders" className="block text-lg font-bold" onClick={() => setIsMobileMenuOpen(false)}>MY ORDERS</Link>
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
