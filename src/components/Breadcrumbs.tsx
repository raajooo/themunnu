import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

const Breadcrumbs = ({ items }: BreadcrumbsProps) => {
  return (
    <nav className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-8 overflow-x-auto whitespace-nowrap pb-2 md:pb-0 no-scrollbar">
      <Link 
        to="/" 
        className="hover:text-black dark:hover:text-white transition-colors flex items-center flex-shrink-0"
      >
        <Home size={12} className="mr-1.5" />
        HOME
      </Link>
      {items.map((item, index) => (
        <div key={index} className="flex items-center space-x-2 flex-shrink-0">
          <ChevronRight size={10} className="text-gray-300" />
          {item.path ? (
            <Link 
              to={item.path} 
              className="hover:text-black dark:hover:text-white transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-black dark:text-white">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
};

export default React.memo(Breadcrumbs);
