import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * PerformanceOptimizer
 * Handles pre-fetching of routes and assets to make the site feel faster.
 */
export default function PerformanceOptimizer() {
  const location = useLocation();

  useEffect(() => {
    // Pre-fetch common routes when on home page
    if (location.pathname === '/') {
      const routesToPrefetch = ['/shop', '/cart', '/login'];
      routesToPrefetch.forEach(route => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = route;
        document.head.appendChild(link);
      });
    }

    // Add dns-prefetch for common external domains
    const domains = [
      'https://images.unsplash.com',
      'https://picsum.photos',
      'https://firebasestorage.googleapis.com'
    ];

    domains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = domain;
      document.head.appendChild(link);
    });
  }, [location.pathname]);

  return null;
}
