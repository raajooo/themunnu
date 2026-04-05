import React from "react";
import { motion } from "motion/react";
import { Shield, Lock, Eye, FileText } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-12"
      >
        <div className="text-center space-y-4">
          <div className="inline-flex p-4 bg-black dark:bg-white text-white dark:text-black rounded-3xl mb-4">
            <Shield size={32} />
          </div>
          <h1 className="text-5xl font-black tracking-tighter uppercase">Privacy Policy</h1>
          <p className="text-gray-500 font-medium uppercase tracking-widest text-sm">Last Updated: April 2026</p>
        </div>

        <div className="prose prose-lg dark:prose-invert max-w-none space-y-8 text-gray-600 dark:text-gray-400">
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black dark:text-white uppercase tracking-tight">1. Information We Collect</h2>
            <p>
              We collect information you provide directly to us when you create an account, make a purchase, or communicate with us. This includes your name, email address, shipping address, and payment information.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black dark:text-white uppercase tracking-tight">2. How We Use Your Information</h2>
            <p>
              We use the information we collect to process your orders, provide customer support, and send you updates about our products and services. We also use this data to improve our website and prevent fraudulent activity.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black dark:text-white uppercase tracking-tight">3. Data Security</h2>
            <p>
              We implement a variety of security measures to maintain the safety of your personal information. Your personal data is contained behind secured networks and is only accessible by a limited number of persons who have special access rights to such systems.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black dark:text-white uppercase tracking-tight">4. Cookies</h2>
            <p>
              We use cookies to help us remember and process the items in your shopping cart and understand and save your preferences for future visits.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black dark:text-white uppercase tracking-tight">5. Contact Us</h2>
            <p>
              If you have any questions regarding this privacy policy, you may contact us at support@munnu.com.
            </p>
          </section>
        </div>
      </motion.div>
    </div>
  );
}
