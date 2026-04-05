import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function FloatingBackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show on home page
  if (location.pathname === "/") return null;

  return (
    <AnimatePresence>
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        onClick={() => navigate(-1)}
        className="fixed bottom-8 left-8 z-[60] p-4 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all group"
        title="Go Back"
      >
        <ChevronLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
      </motion.button>
    </AnimatePresence>
  );
}
