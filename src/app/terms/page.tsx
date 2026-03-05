import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service | Modern Mosaics',
  description: 'Terms and conditions for using the Modern Mosaics print service.',
};

export default function TermsPage() {
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

        <h1 className="font-display text-4xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-dark-400 text-sm mb-10">Last updated: February 2026</p>

        <div className="prose-dark space-y-8 text-dark-200 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Service Overview</h2>
            <p className="text-dark-300">
              Modern Mosaics is a print-on-demand service that lets you upload photos or generate artwork and order
              museum-quality prints delivered worldwide. By using the site you agree to these terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Accounts</h2>
            <p className="text-dark-300">
              You may check out as a guest or use a signed-in account. Signed-in accounts keep your gallery and order history synced.
              You are responsible for activity under your account, and we may suspend accounts that violate these terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Orders &amp; Payment</h2>
            <ul className="list-disc list-inside space-y-1 text-dark-300">
              <li>All prices include applicable taxes and are displayed in your local currency at checkout.</li>
              <li>Payments are processed securely by Stripe. We never handle raw card details.</li>
              <li>Once an order enters production it cannot be cancelled. Orders in &ldquo;queued&rdquo; status may be cancelled from your dashboard.</li>
              <li>Pricing is computed server-side; client-displayed totals are indicative until checkout confirmation.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Print Quality &amp; Returns</h2>
            <ul className="list-disc list-inside space-y-1 text-dark-300">
              <li>We show print-confidence indicators before checkout so you know the expected quality at each size.</li>
              <li>If your print arrives damaged or materially defective, contact us within 30 days with a photo. We will reprint or refund at our discretion.</li>
              <li>We do not guarantee colour-exact reproduction across all monitors; however, prints are produced at 300 DPI on archival paper with fade-resistant inks.</li>
              <li>Sizes marked &ldquo;Low&rdquo; quality are blocked from checkout to protect print integrity.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Intellectual Property</h2>
            <p className="text-dark-300">
              You retain ownership of photos you upload. By uploading, you confirm you have the right to reproduce
              the image. AI-generated artwork is created via OpenAI and subject to OpenAI&apos;s usage policy.
              We do not claim ownership of your generated images.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Prohibited Use</h2>
            <p className="text-dark-300">
              You may not use the service to produce content that is illegal, harmful, or infringes on others&apos; rights.
              We reserve the right to refuse any order or terminate any account at our sole discretion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Fulfillment</h2>
            <p className="text-dark-300">
              Prints are fulfilled by Gelato&apos;s global print network. Delivery times are estimates and not guarantees.
              Shipping delays caused by carriers or customs are outside our control.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Limitation of Liability</h2>
            <p className="text-dark-300">
              To the maximum extent permitted by law, Modern Mosaics is not liable for indirect, incidental, or
              consequential damages. Our total liability for any claim is limited to the amount you paid for the order in question.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Changes</h2>
            <p className="text-dark-300">
              We may update these terms from time to time. Continued use of the service after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Contact</h2>
            <p className="text-dark-300">
              Questions? Email{' '}
              <a className="text-brand-400 hover:text-brand-300 underline" href="mailto:support@modernmosaics.co">
                support@modernmosaics.co
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
