window.SAAdmin = {
  admin: { name: 'Ketan Joshi', email: 'ketan@sutralgo.com' },
  sections: [
    { title: 'Overview', items: [{ id: 'analytics', label: 'Analytics', icon: 'monitoring' }] },
    { title: 'People', items: [
      { id: 'users', label: 'Users', icon: 'group', count: 1284 },
      { id: 'subs', label: 'Subscriptions', icon: 'credit_card', count: 412 }
    ] },
    { title: 'Product', items: [
      { id: 'signals', label: 'Signal testing', icon: 'science' },
      { id: 'broadcast', label: 'Broadcasts', icon: 'campaign' }
    ] },
    { title: 'System', items: [
      { id: 'database', label: 'Database', icon: 'database' },
      { id: 'audit', label: 'Audit log', icon: 'receipt_long' },
      { id: 'settings', label: 'Settings & roles', icon: 'shield_person' }
    ] }
  ],
  users: [
    { name: 'Priya Sharma', email: 'priya@example.com', plan: 'Trader', region: 'India', joined: '12 Jun 2026', status: 'Active', positions: 4 },
    { name: 'Tom Whitfield', email: 'tom.w@example.co.uk', plan: 'Explorer', region: 'UK', joined: '2 Jul 2026', status: 'Trial', positions: 2 },
    { name: 'Dana Reyes', email: 'dana@example.com', plan: 'Trader', region: 'US', joined: '28 Mar 2026', status: 'Active', positions: 7 },
    { name: 'Arun Nair', email: 'arun.n@example.in', plan: 'Explorer', region: 'India', joined: '19 Jul 2026', status: 'Trial', positions: 0 },
    { name: 'Helen Cross', email: 'h.cross@example.co.uk', plan: 'Trader', region: 'UK', joined: '5 Jan 2026', status: 'Past due', positions: 3 },
    { name: 'Marcus Bell', email: 'marcus@example.com', plan: 'Trader', region: 'US', joined: '14 Feb 2026', status: 'Cancelled', positions: 0 }
  ],
  payments: [
    { date: '1 Aug 2026', user: 'Priya Sharma', plan: 'Trader', method: 'Card · 4242', amount: '₹999', status: 'Paid' },
    { date: '1 Aug 2026', user: 'Dana Reyes', plan: 'Trader', method: 'Card · 1881', amount: '$29', status: 'Paid' },
    { date: '1 Aug 2026', user: 'Helen Cross', plan: 'Trader', method: 'Card · 9021', amount: '£24', status: 'Failed' },
    { date: '1 Jul 2026', user: 'Priya Sharma', plan: 'Trader', method: 'Card · 4242', amount: '₹999', status: 'Paid' },
    { date: '1 Jul 2026', user: 'Marcus Bell', plan: 'Trader', method: 'Card · 3310', amount: '$29', status: 'Refunded' }
  ],
  audit: [
    { when: 'Today 09:41', who: 'ketan@sutralgo.com', action: 'Changed plan price', detail: 'Trader UK £22 → £24', ip: '81.2.69.142' },
    { when: 'Today 08:12', who: 'system', action: 'Ran morning scan', detail: '3 signals sent to 412 subscribers', ip: '—' },
    { when: 'Yesterday 17:55', who: 'ketan@sutralgo.com', action: 'Granted complimentary access', detail: 'tom.w@example.co.uk · 6 months', ip: '81.2.69.142' },
    { when: 'Yesterday 14:03', who: 'ops@sutralgo.com', action: 'Exported user list', detail: '1,284 rows · CSV', ip: '81.2.69.9' },
    { when: '5 Aug 15:20', who: 'system', action: 'Migration applied', detail: '021_push_subscriptions.sql', ip: '—' }
  ],
  tables: [
    { name: 'users', rows: '1,284', size: '4.2 MB' },
    { name: 'trades', rows: '48,910', size: '61.8 MB' },
    { name: 'subscriptions', rows: '412', size: '1.1 MB' },
    { name: 'signals', rows: '112,405', size: '92.4 MB' },
    { name: 'audit_log', rows: '204,118', size: '138.0 MB' }
  ],
  signalTests: [
    { symbol: 'BAJFINANCE.NS', market: 'India', trigger: '−41.2', weekly: 'Confirmed', winRate: '78%', trades: 42 },
    { symbol: 'GSK.L', market: 'UK', trigger: '−38.7', weekly: 'Confirmed', winRate: '74%', trades: 38 },
    { symbol: 'COST', market: 'US', trigger: '−35.1', weekly: 'Pending', winRate: '69%', trades: 51 }
  ],
  signups: [12,18,9,24,31,27,22,35,41,38,29,44,52,47,39,55,61,58,49,66,72,68,59,77,84,79,71,88,95,91]
};
