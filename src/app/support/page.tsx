import Link from 'next/link';

export const metadata = {
  title: 'Support | Modern Mosaics',
  description: 'Get help with orders, cancellations, and print quality support.',
};

export default function SupportPage() {
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

        <h1 className="font-display text-4xl font-bold text-white mb-2">Support</h1>
        <p className="text-dark-300 mb-8">Need help with your order or account? We typically respond within one business day.</p>

        <div className="space-y-5">
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Contact</h2>
            <p className="text-dark-300 text-sm mb-1">
              General support: <a className="text-brand-300 hover:text-brand-200 underline" href="mailto:support@modernmosaics.co">support@modernmosaics.co</a>
            </p>
            <p className="text-dark-300 text-sm">
              Privacy requests: <a className="text-brand-300 hover:text-brand-200 underline" href="mailto:privacy@modernmosaics.co">privacy@modernmosaics.co</a>
            </p>
          </div>

          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Cancellation and Refunds</h2>
            <ul className="list-disc list-inside text-dark-300 text-sm space-y-1">
              <li>Orders in <span className="text-dark-100">QUEUED</span> status can be cancelled from your order screen.</li>
              <li>Orders already in production cannot be cancelled.</li>
              <li>If your print arrives damaged or defective, contact support within 30 days with a photo of the issue.</li>
            </ul>
          </div>

          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-2">What Happens After Checkout</h2>
            <ol className="list-decimal list-inside text-dark-300 text-sm space-y-1">
              <li>Stripe confirms payment.</li>
              <li>Our webhook pipeline creates your fulfillment order with Gelato.</li>
              <li>Your dashboard status updates from queued to production to shipped.</li>
              <li>You receive tracking details when available.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
