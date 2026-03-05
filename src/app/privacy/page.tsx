import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | Modern Mosaics',
  description: 'How Modern Mosaics collects, uses, and protects your personal data.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-dark-900 pt-28 pb-16">
      <div className="fixed inset-0 bg-glow-gradient opacity-20 pointer-events-none" />
      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center text-dark-400 hover:text-brand-400 transition-colors mb-6 group text-sm">
          <svg className="w-4 h-4 mr-1.5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>

        <h1 className="font-display text-4xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-dark-400 text-sm mb-10">Last updated: February 2026</p>

        <div className="prose-dark space-y-8 text-dark-200 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. What We Collect</h2>
            <ul className="list-disc list-inside space-y-1 text-dark-300">
              <li><strong className="text-dark-100">Account data</strong> — if you sign in, we store your email and profile details via Firebase Authentication; guest checkout uses an anonymous session.</li>
              <li><strong className="text-dark-100">Images</strong> — photos you upload or artwork you generate, stored in Cloudinary.</li>
              <li><strong className="text-dark-100">Order data</strong> — shipping address, order details, and payment confirmation stored in Firestore.</li>
              <li><strong className="text-dark-100">Payment data</strong> — processed entirely by Stripe. We never see or store full card numbers.</li>
              <li><strong className="text-dark-100">Usage data</strong> — anonymous page-view and feature-usage analytics.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. How We Use Your Data</h2>
            <ul className="list-disc list-inside space-y-1 text-dark-300">
              <li>Fulfil and deliver your print orders via Gelato&apos;s global print network.</li>
              <li>Send order-status and shipping-tracking updates.</li>
              <li>Improve print-quality checks and site reliability.</li>
              <li>Respond to support requests.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Third-Party Services</h2>
            <p className="text-dark-300">
              We share the minimum data needed with each provider:
            </p>
            <ul className="list-disc list-inside space-y-1 text-dark-300 mt-2">
              <li><strong className="text-dark-100">Firebase / Google Cloud</strong> — authentication and database.</li>
              <li><strong className="text-dark-100">Stripe</strong> — payment processing.</li>
              <li><strong className="text-dark-100">Gelato</strong> — print fulfillment and shipping.</li>
              <li><strong className="text-dark-100">Cloudinary</strong> — image storage and transformation.</li>
              <li><strong className="text-dark-100">OpenAI</strong> — creative-art image generation (prompts only, no personal data).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Data Retention</h2>
            <p className="text-dark-300">
              We retain account and order data for as long as your account is active, plus any period required by law.
              You may request deletion of your account and associated data at any time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Your Rights</h2>
            <p className="text-dark-300">
              Depending on your jurisdiction, you may have the right to access, correct, or delete your personal data, 
              or to object to or restrict certain processing. Contact us at the email below to exercise these rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Security</h2>
            <p className="text-dark-300">
              All connections use TLS encryption. Payments are handled by Stripe (PCI-DSS compliant).
              Firebase authentication tokens are short-lived and refreshed automatically.
              We perform rate limiting and input validation on all API endpoints.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Contact</h2>
            <p className="text-dark-300">
              For privacy-related questions, email{' '}
              <a className="text-brand-400 hover:text-brand-300 underline" href="mailto:privacy@modernmosaics.co">
                privacy@modernmosaics.co
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
