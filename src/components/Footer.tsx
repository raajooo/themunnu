import { Link } from "react-router-dom";
import { Instagram, Twitter, Facebook } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gray-50 dark:bg-gray-950 border-t border-gray-200 dark:border-gray-900 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <Link to="/" className="text-3xl font-black tracking-tighter">
              MUNNU
            </Link>
            <p className="mt-4 text-gray-500 max-w-xs">
              Premium sneaker destination for the next generation. Bold designs, limited drops, and authentic athletic style.
            </p>
            <div className="flex space-x-4 mt-6">
              <a href="#" className="p-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-full hover:scale-110 transition-transform">
                <Instagram size={20} />
              </a>
              <a href="#" className="p-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-full hover:scale-110 transition-transform">
                <Twitter size={20} />
              </a>
              <a href="#" className="p-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-full hover:scale-110 transition-transform">
                <Facebook size={20} />
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest mb-4">Shop</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link to="/shop" className="hover:text-black dark:hover:text-white transition-colors">All Sneakers</Link></li>
              <li><Link to="/shop?category=trending" className="hover:text-black dark:hover:text-white transition-colors">Trending</Link></li>
              <li><Link to="/shop?category=limited" className="hover:text-black dark:hover:text-white transition-colors">Limited Edition</Link></li>
              <li><Link to="/shop?category=new" className="hover:text-black dark:hover:text-white transition-colors">New Arrivals</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link to="/orders" className="hover:text-black dark:hover:text-white transition-colors">Track Order</Link></li>
              <li><Link to="/shipping" className="hover:text-black dark:hover:text-white transition-colors">Shipping Policy</Link></li>
              <li><Link to="/returns" className="hover:text-black dark:hover:text-white transition-colors">Returns & Exchanges</Link></li>
              <li><Link to="/contact" className="hover:text-black dark:hover:text-white transition-colors">Contact Us</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-900 flex flex-col md:flex-row justify-between items-center text-xs text-gray-400 space-y-4 md:space-y-0">
          <p>© 2026 MUNNU. All rights reserved.</p>
          <div className="flex space-x-6">
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
