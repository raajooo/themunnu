import React from "react";
import { motion } from "motion/react";
import { Truck, Package, Globe, Clock } from "lucide-react";

export default function ShippingPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-12"
      >
        <div className="text-center space-y-4">
          <div className="inline-flex p-4 bg-black dark:bg-white text-white dark:text-black rounded-3xl mb-4">
            <Truck size={32} />
          </div>
          <h1 className="text-5xl font-black tracking-tighter uppercase">Shipping Policy</h1>
          <p className="text-gray-500 font-medium uppercase tracking-widest text-sm">Last Updated: April 2026</p>
        </div>

        <div className="prose prose-lg dark:prose-invert max-w-none space-y-8 text-gray-600 dark:text-gray-400">
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black dark:text-white uppercase tracking-tight">1. Shipping Methods</h2>
            <p>
              We offer standard and express shipping options. Standard shipping typically takes 5-7 business days, while express shipping takes 2-3 business days.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black dark:text-white uppercase tracking-tight">2. Shipping Costs</h2>
            <p>
              Shipping costs are calculated at checkout based on the weight of your order and the shipping method selected. We offer free standard shipping on all orders over ₹5,000.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black dark:text-white uppercase tracking-tight">3. International Shipping</h2>
            <p>
              Currently, we only ship within India. We are working on expanding our shipping capabilities to international locations in the near future.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black dark:text-white uppercase tracking-tight">4. Order Tracking</h2>
            <p>
              Once your order has shipped, you will receive a confirmation email with a tracking number. You can also track your order in the "My Orders" section of your profile.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black dark:text-white uppercase tracking-tight">5. Shipping Delays</h2>
            <p>
              While we strive to meet our shipping estimates, delays may occur due to unforeseen circumstances such as extreme weather or carrier issues. We appreciate your patience.
            </p>
          </section>
        </div>
      </motion.div>
    </div>
  );
}
