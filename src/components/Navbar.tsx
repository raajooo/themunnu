import { Link, useNavigate } from "react-router-dom";
import { ShoppingCart, User as UserIcon, Search, Menu, X } from "lucide-react";
import React, { useState } from "react";
import { User } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface NavbarProps {
  user: User | null;
}

export default function Navbar({ user }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
      setSearchQuery("");
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
            <div className="relative hidden sm:block">
              <AnimatePresence>
                {isSearchOpen && (
                  <motion.form
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 240, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    onSubmit={handleSearch}
                    className="absolute right-0 top-1/2 -translate-y-1/2 overflow-hidden"
                  >
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search..."
                      className="w-full pl-4 pr-10 py-2 bg-gray-100 dark:bg-gray-900 rounded-full text-sm focus:outline-none"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </motion.form>
                )}
              </AnimatePresence>
              <button 
                onClick={() => {
                  setIsSearchOpen(!isSearchOpen);
                  setIsMenuOpen(false);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full transition-colors relative z-10"
              >
                {isSearchOpen ? <X size={20} /> : <Search size={20} />}
              </button>
            </div>
            
            <button 
              className="sm:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full transition-colors"
              onClick={() => {
                setIsSearchOpen(!isSearchOpen);
                setIsMenuOpen(false);
              }}
            >
              <Search size={20} />
            </button>
            <Link to="/cart" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full transition-colors relative">
              <ShoppingCart size={20} />
              {/* Cart Badge would go here */}
            </Link>
            <Link to={user ? "/profile" : "/login"} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full transition-colors">
              <UserIcon size={20} />
            </Link>
            <button 
              className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full transition-colors"
              onClick={() => {
                setIsMenuOpen(!isMenuOpen);
                setIsSearchOpen(false);
              }}
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {(isMenuOpen || isSearchOpen) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-4">
              {isSearchOpen && (
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
              )}
              {isMenuOpen && (
                <>
                  {user?.role === 'admin' && (
                    <Link to="/admin" className="block text-lg font-black text-purple-600" onClick={() => setIsMenuOpen(false)}>ADMIN PANEL</Link>
                  )}
                  <Link to="/shop" className="block text-lg font-bold" onClick={() => setIsMenuOpen(false)}>SHOP</Link>
                  <Link to="/shop?category=trending" className="block text-lg font-bold" onClick={() => setIsMenuOpen(false)}>TRENDING</Link>
                  <Link to="/shop?category=limited" className="block text-lg font-bold" onClick={() => setIsMenuOpen(false)}>LIMITED</Link>
                  <Link to="/orders" className="block text-lg font-bold" onClick={() => setIsMenuOpen(false)}>MY ORDERS</Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
