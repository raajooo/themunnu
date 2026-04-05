import React from "react";
import { motion } from "motion/react";
import { RotateCcw, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

export default function ReturnExchange() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-12"
      >
        <div className="text-center space-y-4">
          <div className="inline-flex p-4 bg-black dark:bg-white text-white dark:text-black rounded-3xl mb-4">
            <RotateCcw size={32} />
          </div>
          <h1 className="text-5xl font-black tracking-tighter uppercase">Return & Exchange</h1>
          <p className="text-gray-500 font-medium uppercase tracking-widest text-sm">Last Updated: April 2026</p>
        </div>

        <div className="prose prose-lg dark:prose-invert max-w-none space-y-8 text-gray-600 dark:text-gray-400">
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black dark:text-white uppercase tracking-tight">1. Return Eligibility</h2>
            <p>
              Items must be returned within 7 days of delivery. To be eligible for a return, your item must be unused and in the same condition that you received it. It must also be in the original packaging.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black dark:text-white uppercase tracking-tight">2. Non-Returnable Items</h2>
            <p>
              Several types of goods are exempt from being returned. Perishable goods such as food, flowers, newspapers, or magazines cannot be returned. We also do not accept products that are intimate or sanitary goods, hazardous materials, or flammable liquids or gases.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black dark:text-white uppercase tracking-tight">3. Exchange Policy</h2>
            <p>
              We only replace items if they are defective or damaged. If you need to exchange it for the same item, send us an email at support@munnu.com and send your item to our return address.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black dark:text-white uppercase tracking-tight">4. Refund Process</h2>
            <p>
              Once your return is received and inspected, we will send you an email to notify you that we have received your returned item. We will also notify you of the approval or rejection of your refund.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black dark:text-white uppercase tracking-tight">5. Shipping Costs for Returns</h2>
            <p>
              You will be responsible for paying for your own shipping costs for returning your item. Shipping costs are non-refundable. If you receive a refund, the cost of return shipping will be deducted from your refund.
            </p>
          </section>
        </div>
      </motion.div>
    </div>
  );
}
