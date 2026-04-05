import React from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Product } from "../types";
import { formatCurrency } from "../lib/utils";
import { ShoppingCart, Heart, Star, Share2 } from "lucide-react";
import LazyImage from "./LazyImage";
import { toast } from "react-hot-toast";

interface ProductCardProps {
  product: Product;
  key?: React.Key;
}

export default function ProductCard({ product }: ProductCardProps) {
  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/product/${product.id}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard!");
  };

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="group relative bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-900 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-black/5 dark:hover:shadow-white/5"
    >
      <Link to={`/product/${product.id}`} className="block aspect-[4/5] overflow-hidden bg-gray-100 dark:bg-gray-900">
        <LazyImage
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        {product.isLimited && (
          <div className="absolute top-4 left-4 bg-black text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest">
            Limited
          </div>
        )}
        {product.averageRating && product.averageRating > 0 && (
          <div className="absolute top-4 right-4 bg-white/90 dark:bg-black/90 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center space-x-1 shadow-sm">
            <Star size={10} className="text-yellow-500" fill="currentColor" />
            <span className="text-[10px] font-black">{product.averageRating.toFixed(1)}</span>
          </div>
        )}
      </Link>

      <div className="p-5">
        <div className="flex justify-between items-start mb-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {product.brand}
          </span>
          <div className="flex items-center space-x-2">
            <button 
              onClick={handleShare}
              className="text-gray-300 hover:text-black dark:hover:text-white transition-colors p-1"
              title="Share"
            >
              <Share2 size={16} />
            </button>
            <button className="text-gray-300 hover:text-red-500 transition-colors p-1">
              <Heart size={16} />
            </button>
          </div>
        </div>
        
        <Link to={`/product/${product.id}`} className="block">
          <h3 className="text-lg font-bold truncate group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
            {product.name}
          </h3>
        </Link>
        
        <div className="mt-3 flex justify-between items-center">
          <span className="text-xl font-black">{formatCurrency(product.price)}</span>
          <button className="p-2 bg-black dark:bg-white text-white dark:text-black rounded-full hover:scale-110 transition-transform">
            <ShoppingCart size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
