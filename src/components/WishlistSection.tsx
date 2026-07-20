import React, { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Product, User } from "../types";
import { useWishlist } from "../hooks/useWishlist";
import ProductCard from "./ProductCard";
import { Loader2, Heart, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface WishlistSectionProps {
  user: User;
}

export default function WishlistSection({ user }: WishlistSectionProps) {
  const { wishlistIds, loading: wishlistIdsLoading } = useWishlist();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    const fetchWishlistProducts = async () => {
      if (wishlistIds.length === 0) {
        setProducts([]);
        return;
      }

      setLoadingProducts(true);
      try {
        const productPromises = wishlistIds.map(async (id) => {
          // Check session/localStorage cache if available to prevent excessive reads
          const cacheKey = `product_${id}`;
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            try {
              const { data, timestamp } = JSON.parse(cached);
              // Cache valid for 30 mins
              if (Date.now() - timestamp < 30 * 60 * 1000) {
                return data as Product;
              }
            } catch (e) {
              console.error("Failed to parse cached product", e);
            }
          }

          const docSnap = await getDoc(doc(db, "products", id));
          if (docSnap.exists()) {
            const prodData = { id: docSnap.id, ...docSnap.data() } as Product;
            // Cache it
            localStorage.setItem(cacheKey, JSON.stringify({ data: prodData, timestamp: Date.now() }));
            return prodData;
          }
          return null;
        });

        const fetchedProducts = await Promise.all(productPromises);
        setProducts(fetchedProducts.filter((p): p is Product => p !== null));
      } catch (error) {
        console.error("Error fetching wishlist products:", error);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchWishlistProducts();
  }, [wishlistIds]);

  if (wishlistIdsLoading || loadingProducts) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-gray-500 mb-4" size={40} />
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest animate-pulse">Loading Wishlist...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-20 bg-gray-50/50 dark:bg-gray-950/20 border border-dashed border-gray-200 dark:border-gray-800 rounded-3xl p-8 max-w-md mx-auto">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-950/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <Heart size={28} />
        </div>
        <h3 className="text-xl font-black uppercase tracking-tight mb-2">Your wishlist is empty</h3>
        <p className="text-sm text-gray-400 mb-8 max-w-sm mx-auto">
          Explore our collection and add your favorite sneakers to keep track of them!
        </p>
        <Link
          to="/shop"
          className="inline-flex items-center space-x-3 px-8 py-4 bg-black dark:bg-white text-white dark:text-black font-bold text-xs uppercase tracking-widest rounded-full hover:opacity-95 transition-opacity"
        >
          <span>Explore Shop</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-black tracking-tight uppercase">My Wishlist</h2>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
          {products.length} {products.length === 1 ? "item" : "items"} saved
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
