import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { Product, Category } from "../types";
import ProductCard from "../components/ProductCard";
import { SlidersHorizontal, ChevronDown, Search } from "lucide-react";

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get("category");
  const queryParam = searchParams.get("q") || "";
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(queryParam);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 50000]);
  const [selectedBrand, setSelectedBrand] = useState<string>("All");

  const brands = ["All", "Nike", "Adidas", "Jordan", "Puma", "New Balance", "Yeezy"];

  useEffect(() => {
    setSearchQuery(queryParam);
  }, [queryParam]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const snap = await getDocs(collection(db, "categories"));
        setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
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

        // Client-side filtering for search, price, and brand
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

        setProducts(results);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [categoryParam, searchQuery, selectedBrand, priceRange]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 space-y-6 md:space-y-0">
        <div>
          <h1 className="text-5xl font-black tracking-tighter uppercase">
            {categoryParam ? (categories.find(c => c.slug === categoryParam)?.name || categoryParam.replace("-", " ")) : "All Sneakers"}
          </h1>
          <p className="text-gray-500 mt-2">{products.length} Products found</p>
        </div>

        <div className="flex flex-wrap gap-4 w-full md:w-auto">
          <div className="relative flex-grow md:flex-grow-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search sneakers..." 
              className="w-full md:w-64 pl-12 pr-4 py-3 bg-gray-100 dark:bg-gray-900 rounded-full focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="flex items-center space-x-2 px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold text-sm uppercase tracking-widest">
            <SlidersHorizontal size={18} />
            <span>Filters</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
        {/* Sidebar Filters - Desktop */}
        <aside className="hidden lg:block space-y-10">
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-6">Categories</h3>
            <div className="space-y-3">
              <Link 
                to="/shop"
                className={`block text-sm font-medium transition-colors ${!categoryParam ? 'text-black dark:text-white font-bold underline underline-offset-8' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
              >
                All
              </Link>
              {categories.map(cat => (
                <Link 
                  key={cat.id}
                  to={`/shop?category=${cat.slug}`}
                  className={`block text-sm font-medium transition-colors ${categoryParam === cat.slug ? 'text-black dark:text-white font-bold underline underline-offset-8' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
                >
                  {cat.name}
                </Link>
              ))}
              <Link 
                to="/shop?category=trending"
                className={`block text-sm font-medium transition-colors ${categoryParam === 'trending' ? 'text-black dark:text-white font-bold underline underline-offset-8' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
              >
                Trending
              </Link>
              <Link 
                to="/shop?category=limited"
                className={`block text-sm font-medium transition-colors ${categoryParam === 'limited' ? 'text-black dark:text-white font-bold underline underline-offset-8' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
              >
                Limited Drop
              </Link>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-6">Brands</h3>
            <div className="space-y-3">
              {brands.map(brand => (
                <button 
                  key={brand}
                  onClick={() => setSelectedBrand(brand)}
                  className={`block text-sm font-medium transition-colors ${selectedBrand === brand ? 'text-black dark:text-white font-bold underline underline-offset-8' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
                >
                  {brand}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-6">Price Range</h3>
            <div className="space-y-4">
              <input 
                type="range" 
                min="0" 
                max="50000" 
                step="1000"
                className="w-full accent-black dark:accent-white"
                value={priceRange[1]}
                onChange={(e) => setPriceRange([0, parseInt(e.target.value)])}
              />
              <div className="flex justify-between text-xs font-bold">
                <span>₹0</span>
                <span>₹{priceRange[1].toLocaleString()}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Product Grid */}
        <div className="lg:col-span-3">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="aspect-[4/5] bg-gray-100 dark:bg-gray-900 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {products.map(product => (
                <ProductCard key={product.id} product={product} />
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
