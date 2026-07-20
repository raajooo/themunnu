import React from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Product } from "../types";
import { formatCurrency } from "../lib/utils";
import { ShoppingCart, Heart, Star, Share2, Tag } from "lucide-react";
import LazyImage from "./LazyImage";
import { toast } from "react-hot-toast";
import { useWishlist } from "../hooks/useWishlist";

interface ProductCardProps {
  product: Product;
  hasCoupon?: boolean;
  key?: React.Key;
}

export default React.memo(function ProductCard({ product, hasCoupon }: ProductCardProps) {
  const { isWishlisted, toggleWishlist } = useWishlist();
  const isWish = isWishlisted(product.id);

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/product/${product.id}`;
    const title = `Check out this ${product.name} on Munnu!`;
    const text = `I found this amazing ${product.name} from ${product.brand}. You should check it out!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      // Fallback: Copy to clipboard and show social options
      navigator.clipboard.writeText(url);
      toast.success("Link copied! Share it with your friends.");
      
      // Open WhatsApp as a quick social share fallback
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`;
      window.open(whatsappUrl, '_blank');
    }
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
        {hasCoupon && (
          <div className={`absolute ${product.isLimited ? 'top-12' : 'top-4'} left-4 bg-green-500 text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest flex items-center`}>
            <Tag size={10} className="mr-1" />
            Coupon
          </div>
        )}
        {product.averageRating && product.averageRating > 0 && (
          <div className="absolute top-4 right-4 bg-white/90 dark:bg-black/90 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center space-x-1 shadow-sm">
            <Star size={10} className="text-yellow-500" fill="currentColor" />
            <span className="text-[10px] font-black">{product.averageRating.toFixed(1)}</span>
          </div>
        )}
        {product.stock <= 5 && product.stock > 0 && (
          <div className="absolute bottom-4 left-4 bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md">
            Low Stock ({product.stock})
          </div>
        )}
        {product.stock === 0 && (
          <div className="absolute bottom-4 left-4 bg-gray-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md">
            Out Of Stock
          </div>
        )}
      </Link>

      <div className="p-5">
        <div className="flex justify-between items-start mb-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {product.brand}
          </span>
          <div className="flex items-center space-x-2">
            <motion.button 
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleShare}
              className="text-gray-300 hover:text-black dark:hover:text-white transition-colors p-1"
              title="Share on Social Media"
            >
              <Share2 size={16} />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleWishlistToggle}
              className={`transition-colors p-1 ${isWish ? "text-red-500 hover:text-red-600" : "text-gray-300 hover:text-red-500"}`}
              title={isWish ? "Remove from Wishlist" : "Add to Wishlist"}
            >
              <Heart size={16} fill={isWish ? "currentColor" : "none"} />
            </motion.button>
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
});
