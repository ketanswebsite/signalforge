window.SAMkt = {
  plans: [
    { id: 'explorer', name: 'Explorer', blurb: 'Try the whole thing before you pay anything.',
      price: { UK: ['£','0'], US: ['$','0'], India: ['₹','0'] }, period: 'for 90 days',
      features: ['Every signal, every market', 'Alerts on Telegram', 'Full history to test against', 'No card needed'],
      cta: 'Start free' },
    { id: 'trader', name: 'Trader', blurb: 'Keep the signals coming after your 90 days.',
      price: { UK: ['£','24'], US: ['$','29'], India: ['₹','999'] }, period: 'a month', featured: true,
      ribbon: 'Most people start here',
      features: ['Everything in Explorer', 'Priority support', 'Cancel any time', 'Price fixed for 12 months'],
      cta: 'Choose Trader' }
  ],
  faq: [
    ['What actually arrives on my phone?', 'A short message with the stock, roughly what to pay, the price it should be sold at, and the price to sell it at if it goes the wrong way. Nothing to interpret.'],
    ['Do you place trades for me?', 'No. SutrAlgo never touches your broker or your money. It tells you what the formula found; what you do next is entirely yours.'],
    ['What happens after 90 days?', 'The signals stop and the app becomes read-only. Your history stays exactly as it is, and moving to Trader turns everything back on.'],
    ['Why only three exit rules?', 'Because the hard part of investing is deciding when to sell, and a rule you set in advance beats a decision made while watching the price move.'],
    ['Can I cancel?', 'Any time, from your account page. You keep access until the end of the month you have paid for.'],
    ['Is this financial advice?', 'No. SutrAlgo is an educational tool. It shows what a mechanical rule would have done and what it is doing now. It does not know your circumstances and cannot advise you.']
  ]
};
