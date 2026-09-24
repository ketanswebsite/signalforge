window.SACheckout = {
  // Prices, currencies and tax lines come from the billing API — never typed into markup.
  regions: {
    UK:    { currency: '£', amount: '24',  tax: 'VAT included',        provider: 'Stripe',   nextBilling: '8 September 2026' },
    US:    { currency: '$', amount: '29',  tax: 'Sales tax not added', provider: 'Stripe',   nextBilling: '8 September 2026' },
    India: { currency: '₹', amount: '999', tax: 'GST included',        provider: 'Razorpay', nextBilling: '8 September 2026' }
  },
  card: { brand: 'Visa', last4: '4242' },
  paidOn: '8 August 2026',
  agreeing: 'Your price is fixed for 12 months. Cancel any time from your account — you keep access to the end of the month you\'ve paid for.',
  failures: [
    { id: 'declined',  title: 'The bank said no',                what: 'Usually a limit or a block on online payments. A call to your bank, or a different card, clears it.' },
    { id: 'abandoned', title: 'The verification step was closed', what: 'Your bank asked for a confirmation and the window was closed before it finished. Trying again restarts it.' },
    { id: 'network',   title: 'The connection dropped',           what: 'Nothing was charged. Check your connection and try again — the payment only completes when you see a receipt.' }
  ]
};
