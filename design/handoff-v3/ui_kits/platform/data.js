window.SA = {
  user: { name: 'Ketan Joshi', email: 'ketan@sutralgo.com' },
  nav: [
    { id: 'scanner',   label: 'Scanner',   icon: 'radar' },
    { id: 'positions', label: 'Positions', icon: 'account_balance_wallet', count: 4 },
    { id: 'simulator', label: 'Simulator', icon: 'science' },
    { id: 'alerts',    label: 'Alerts',    icon: 'notifications' },
    { id: 'account',   label: 'Account',   icon: 'person' }
  ],
  markets: [
    { market: 'India', status: 'open',   note: 'Closes in 2h 10m' },
    { market: 'UK',    status: 'open',   note: 'Closes in 4h 45m' },
    { market: 'US',    status: 'soon',   note: 'Opens 14:30 UK' }
  ],
  positions: [
    { symbol: 'RELIANCE.NS', name: 'Reliance Industries', currency: '₹', plPercent: 3.42, plLabel: '+₹4,875', entry: '2,847.50', current: '2,945.00', target: '3,075.30', stop: '2,705.13', daysHeld: 12 },
    { symbol: 'AAPL', name: 'Apple Inc.', currency: '$', plPercent: -2.63, plLabel: '−$36.40', entry: '214.80', current: '209.15', target: '231.98', stop: '204.06', daysHeld: 26 },
    { symbol: 'SHEL.L', name: 'Shell plc', currency: '', plPercent: 2.99, plLabel: '+£38.90', entry: '2,610.00p', current: '2,688.00p', target: '2,818.80p', stop: '2,479.50p', daysHeld: 21 },
    { symbol: 'TCS.NS', name: 'Tata Consultancy', currency: '₹', plPercent: 0.47, plLabel: '+₹925', entry: '3,912.00', current: '3,930.45', target: '4,224.96', stop: '3,716.40', daysHeld: 3 }
  ],
  closed: [
    { symbol: 'INFY.NS', name: 'Infosys', closed: '4 Mar', held: '14 days', pl: '+8.00%', money: '+₹4,000', reason: 'Hit the +8% target' },
    { symbol: 'MSFT', name: 'Microsoft', closed: '26 Feb', held: '6 days', pl: '-5.00%', money: '−$32.50', reason: 'Hit the −5% stop' },
    { symbol: 'BP.L', name: 'BP plc', closed: '19 Feb', held: '19 days', pl: '+8.00%', money: '+£40.00', reason: 'Hit the +8% target' },
    { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', closed: '11 Feb', held: '30 days', pl: '+2.00%', money: '+₹1,000', reason: 'Ran out of time' },
    { symbol: 'NVDA', name: 'NVIDIA', closed: '3 Feb', held: '4 days', pl: '-5.00%', money: '−$32.50', reason: 'Hit the −5% stop' },
    { symbol: 'ULVR.L', name: 'Unilever', closed: '22 Jan', held: '17 days', pl: '+8.00%', money: '+£40.00', reason: 'Hit the +8% target' }
  ],
  signals: [
    { symbol: 'BAJFINANCE.NS', name: 'Bajaj Finance', market: 'India', price: '₹7,215.40', target: '₹7,792.63', stop: '₹6,854.63', confidence: 78, confirmed: true },
    { symbol: 'GSK.L', name: 'GSK plc', market: 'UK', price: '1,412.50p', target: '1,525.50p', stop: '1,341.88p', confidence: 74, confirmed: true },
    { symbol: 'COST', name: 'Costco Wholesale', market: 'US', price: '$921.16', target: '$994.85', stop: '$875.10', confidence: 69, confirmed: false }
  ],
  equity: [100,101.2,100.4,102.8,104.1,103.2,105.6,107.9,106.8,105.1,107.4,110.2,111.8,110.9,113.4,116.1,114.9,117.6,116.2,119.4,122.1,120.8,123.7,126.4,125.1,128.3,131.2,129.8,133.1,136.4],
  plans: [
    { id: 'explorer', name: 'Explorer', blurb: 'Try the whole thing before you pay anything.', currency: '£', price: '0', period: 'for 90 days',
      features: ['Every signal, every market', 'Alerts on Telegram', 'Full history to test against'], cta: 'Current plan', note: 'No card needed.', current: true },
    { id: 'trader', name: 'Trader', blurb: 'Keep the signals coming after your 90 days.', currency: '£', price: '24', period: 'a month', featured: true,
      ribbon: 'Most people start here', features: ['Everything in Explorer', 'Priority support', 'Cancel any time'], cta: 'Choose Trader' }
  ]
};
