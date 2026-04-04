import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  placeholderClassName?: string;
  style?: React.CSSProperties;
}

export default function LazyImage({ 
  src, 
  alt, 
  className = "", 
  placeholderClassName = "",
  ...props 
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <AnimatePresence>
        {!isLoaded && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 bg-gray-100 dark:bg-gray-900 animate-pulse ${placeholderClassName}`}
          />
        )}
      </AnimatePresence>
      
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
        referrerPolicy="no-referrer"
        {...props}
      />
    </div>
  );
}
