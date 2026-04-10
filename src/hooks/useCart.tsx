import React, { useState, useEffect, createContext, useContext } from "react";
import { OrderItem, Product } from "../types";
import { toast } from "react-hot-toast";

interface CartContextType {
  items: OrderItem[];
  addToCart: (product: Product, size: string, quantity: number) => void;
  removeFromCart: (productId: string, size: string) => void;
  updateQuantity: (productId: string, size: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<OrderItem[]>(() => {
    const saved = localStorage.getItem("munnu_cart");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("munnu_cart", JSON.stringify(items));
  }, [items]);

  const addToCart = (product: Product, size: string, quantity: number) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === product.id && i.size === size);
      if (existing) {
        toast.success(`Updated ${product.name} quantity`);
        return prev.map(i => 
          (i.productId === product.id && i.size === size) 
            ? { ...i, quantity: i.quantity + quantity } 
            : i
        );
      }
      toast.success(`Added ${product.name} to cart`);
      return [...prev, {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity,
        size,
        image: product.images?.[0] || "https://picsum.photos/seed/sneaker/400/400"
      }];
    });
  };

  const removeFromCart = (productId: string, size: string) => {
    setItems(prev => prev.filter(i => !(i.productId === productId && i.size === size)));
    toast.error("Removed from cart");
  };

  const updateQuantity = (productId: string, size: string, quantity: number) => {
    if (quantity < 1) return;
    setItems(prev => prev.map(i => 
      (i.productId === productId && i.size === size) 
        ? { ...i, quantity } 
        : i
    ));
  };

  const clearCart = () => {
    setItems([]);
    localStorage.removeItem("munnu_cart");
  };

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
