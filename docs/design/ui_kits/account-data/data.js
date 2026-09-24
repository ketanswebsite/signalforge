window.SAData = {
  exports: [
    { file: 'trades.csv',    what: 'Every closed trade — dates, prices, results, exit reasons', size: '112 KB', icon: 'table_view' },
    { file: 'positions.csv', what: 'Open positions with their stops, targets and day counts',   size: '4 KB',   icon: 'account_balance_wallet' },
    { file: 'signals.csv',   what: 'Every signal the scanner sent you, taken or not',           size: '86 KB',  icon: 'radar' },
    { file: 'account.json',  what: 'Profile, plan history, alert settings',                     size: '2 KB',   icon: 'person' }
  ],
  stored: [
    { what: 'Name and email',            why: 'From Google sign-in. It is how your account exists.' },
    { what: 'Region',                    why: 'Sets your currency and price. Nothing more precise than country.' },
    { what: 'Positions and trades',      why: 'Your history in the app — the thing the exports contain.' },
    { what: 'Telegram chat id',          why: 'Only if you connected the bot; deleting the link removes it.' }
  ],
  notStored: 'No card numbers (the payment provider keeps those), no broker connections, no browsing analytics beyond page counts.'
};
