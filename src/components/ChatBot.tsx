import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageCircle, X, Send, Loader2, Bot, Sparkles, User } from "lucide-react";
import { getChatResponse } from "../services/gemini";
import { toast } from "react-hot-toast";

interface Message {
  role: "user" | "model";
  parts: { text: string }[];
}

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "model",
      parts: [{ text: "Hello! I'm your MUNNU Support Assistant. How can I help you with your sneaker journey today?" }]
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-chatbot', handleOpen);
    return () => window.removeEventListener('open-chatbot', handleOpen);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      parts: [{ text: input }]
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const history = messages.slice(-10); // Keep last 10 messages for context
      const response = await getChatResponse(input, history);
      
      if (response) {
        setMessages(prev => [...prev, {
          role: "model",
          parts: [{ text: response }]
        }]);
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      if (error.message?.includes("API key")) {
        toast.error("Chatbot is currently unavailable. Please contact support via email.");
      } else {
        toast.error("Failed to get response. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-20 right-0 w-[350px] sm:w-[400px] h-[500px] bg-white dark:bg-gray-950 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-900 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 bg-black dark:bg-white text-white dark:text-black flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 dark:bg-black/20 rounded-xl">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">MUNNU Support</h3>
                  <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Powered by Gemini</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 dark:hover:bg-black/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-grow overflow-y-auto p-6 space-y-4 scrollbar-hide">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex items-start space-x-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-gray-100 dark:bg-gray-900' : 'bg-black dark:bg-white text-white dark:text-black'}`}>
                      {msg.role === 'user' ? <User size={14} /> : <Sparkles size={14} />}
                    </div>
                    <div className={`p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-gray-100 dark:bg-gray-900 font-medium' : 'bg-gray-50 dark:bg-gray-900/50'}`}>
                      {msg.parts[0].text}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-2">
                    <div className="w-8 h-8 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center">
                      <Sparkles size={14} className="animate-pulse" />
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
                      <Loader2 size={16} className="animate-spin" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-6 border-t border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-900/50">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your order, shipping..."
                  className="w-full pl-6 pr-14 py-4 bg-white dark:bg-gray-950 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-sm font-medium"
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-black dark:bg-white text-white dark:text-black rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Send size={16} />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`p-5 rounded-full shadow-2xl flex items-center justify-center transition-all ${isOpen ? 'bg-red-500 text-white rotate-90' : 'bg-black dark:bg-white text-white dark:text-black'}`}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </motion.button>
    </div>
  );
}
