import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, AlertTriangle, Loader2 } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = true,
  isLoading = false
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-md bg-white dark:bg-gray-950 rounded-[2.5rem] overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-900"
          >
            <div className="p-8">
              <div className="flex items-center space-x-4 mb-6">
                <div className={`p-3 rounded-2xl ${isDestructive ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-500'}`}>
                  <AlertTriangle size={24} />
                </div>
                <h2 className="text-2xl font-black tracking-tighter uppercase">{title}</h2>
              </div>
              
              <p className="text-gray-500 font-medium leading-relaxed mb-8">
                {message}
              </p>

              <div className="flex space-x-4">
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1 py-4 bg-gray-100 dark:bg-gray-900 text-black dark:text-white font-black text-xs uppercase tracking-widest rounded-full hover:opacity-70 transition-opacity disabled:opacity-50"
                >
                  {cancelText}
                </button>
                <button
                  onClick={onConfirm}
                  disabled={isLoading}
                  className={`flex-1 py-4 font-black text-xs uppercase tracking-widest rounded-full hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50 ${
                    isDestructive 
                      ? 'bg-red-500 text-white' 
                      : 'bg-black dark:bg-white text-white dark:text-black'
                  }`}
                >
                  {isLoading ? <Loader2 className="animate-spin" size={18} /> : confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
