import React from "react";
import { motion } from "motion/react";
import { FileText, Scale, Gavel, ShieldCheck } from "lucide-react";

export default function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-12"
      >
        <div className="text-center space-y-4">
          <div className="inline-flex p-4 bg-black dark:bg-white text-white dark:text-black rounded-3xl mb-4">
            <Gavel size={32} />
          </div>
          <h1 className="text-5xl font-black tracking-tighter uppercase">Terms of Service</h1>
          <p className="text-gray-500 font-medium uppercase tracking-widest text-sm">Last Updated: April 2026</p>
        </div>

        <div className="prose prose-lg dark:prose-invert max-w-none space-y-8 text-gray-600 dark:text-gray-400">
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black dark:text-white uppercase tracking-tight">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the MUNNU website, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black dark:text-white uppercase tracking-tight">2. Use License</h2>
            <p>
              Permission is granted to temporarily download one copy of the materials on MUNNU's website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black dark:text-white uppercase tracking-tight">3. Disclaimer</h2>
            <p>
              The materials on MUNNU's website are provided on an 'as is' basis. MUNNU makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black dark:text-white uppercase tracking-tight">4. Limitations</h2>
            <p>
              In no event shall MUNNU or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on MUNNU's website.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black dark:text-white uppercase tracking-tight">5. Governing Law</h2>
            <p>
              These terms and conditions are governed by and construed in accordance with the laws of India and you irrevocably submit to the exclusive jurisdiction of the courts in that State or location.
            </p>
          </section>
        </div>
      </motion.div>
    </div>
  );
}
