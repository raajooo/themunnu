import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { toast } from "react-hot-toast";

interface WishlistContextType {
  wishlistIds: string[];
  toggleWishlist: (productId: string) => Promise<void>;
  isWishlisted: (productId: string) => boolean;
  loading: boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
        setWishlistIds([]);
        setLoading(false);
      }
    });

    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    if (!userId) {
      setWishlistIds([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, "wishlists"), where("userId", "==", userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = snapshot.docs.map(doc => doc.data().productId as string);
      setWishlistIds(ids);
      setLoading(false);
    }, (error) => {
      console.error("Wishlist listener error:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [userId]);

  const isWishlisted = useCallback((productId: string) => {
    return wishlistIds.includes(productId);
  }, [wishlistIds]);

  const toggleWishlist = useCallback(async (productId: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast.error("Please log in to add items to your wishlist");
      return;
    }

    const docId = `${currentUser.uid}_${productId}`;
    const docRef = doc(db, "wishlists", docId);

    const wishlisted = wishlistIds.includes(productId);

    try {
      if (wishlisted) {
        await deleteDoc(docRef);
        toast.success("Removed from wishlist");
      } else {
        await setDoc(docRef, {
          id: docId,
          userId: currentUser.uid,
          productId: productId,
          createdAt: new Date().toISOString()
        });
        toast.success("Added to wishlist");
      }
    } catch (error) {
      console.error("Error toggling wishlist:", error);
      toast.error("Failed to update wishlist");
    }
  }, [wishlistIds]);

  return (
    <WishlistContext.Provider value={{ wishlistIds, toggleWishlist, isWishlisted, loading }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}
