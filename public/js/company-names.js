/**
 * Company Name Mapping
 * Maps stock symbols to their full company names
 */

window.CompanyNames = (function() {
    // Company name mappings by market
    const companyMappings = {
        // US Stocks
        'AAPL': 'Apple Inc.',
        'MSFT': 'Microsoft Corporation',
        'GOOGL': 'Alphabet Inc.',
        'AMZN': 'Amazon.com Inc.',
        'META': 'Meta Platforms Inc.',
        'TSLA': 'Tesla Inc.',
        'NVDA': 'NVIDIA Corporation',
        'JPM': 'JPMorgan Chase & Co.',
        'V': 'Visa Inc.',
        'WMT': 'Walmart Inc.',
        'PG': 'Procter & Gamble Co.',
        'JNJ': 'Johnson & Johnson',
        'MA': 'Mastercard Inc.',
        'UNH': 'UnitedHealth Group Inc.',
        'HD': 'The Home Depot Inc.',
        'DIS': 'The Walt Disney Company',
        'BAC': 'Bank of America Corp.',
        'ADBE': 'Adobe Inc.',
        'NFLX': 'Netflix Inc.',
        'CRM': 'Salesforce Inc.',
        'PFE': 'Pfizer Inc.',
        'KO': 'The Coca-Cola Company',
        'PEP': 'PepsiCo Inc.',
        'TMO': 'Thermo Fisher Scientific Inc.',
        'CSCO': 'Cisco Systems Inc.',
        'ABT': 'Abbott Laboratories',
        'AVGO': 'Broadcom Inc.',
        'NKE': 'Nike Inc.',
        'CVX': 'Chevron Corporation',
        'WFC': 'Wells Fargo & Company',
        'INTC': 'Intel Corporation',
        'AMD': 'Advanced Micro Devices Inc.',
        'NEM': 'Newmont Corporation',
        
        // UK Stocks (.L suffix)
        'MGNS.L': 'Morgan Sindall Group',
        'BYIT.L': 'Bytes Technology Group',
        'CCR.L': 'C&C Group',
        'FGP.L': 'FirstGroup',
        'TW.L': 'Taylor Wimpey',
        'BP.L': 'BP plc',
        'HSBA.L': 'HSBC Holdings',
        'ULVR.L': 'Unilever',
        'AZN.L': 'AstraZeneca',
        'RIO.L': 'Rio Tinto',
        'GSK.L': 'GSK plc',
        'DGE.L': 'Diageo',
        'SHEL.L': 'Shell plc',
        'VOD.L': 'Vodafone Group',
        'BA.L': 'BAE Systems',
        'LLOY.L': 'Lloyds Banking Group',
        'BARC.L': 'Barclays',
        'TSCO.L': 'Tesco',
        'PRU.L': 'Prudential',
        'BT.A.L': 'BT Group',
        
        // Indian Stocks (.NS suffix - NSE)
        'RELIANCE.NS': 'Reliance Industries',
        'TCS.NS': 'Tata Consultancy Services',
        'HDFCBANK.NS': 'HDFC Bank',
        'INFY.NS': 'Infosys',
        'HINDUNILVR.NS': 'Hindustan Unilever',
        'ICICIBANK.NS': 'ICICI Bank',
        'SBIN.NS': 'State Bank of India',
        'BHARTIARTL.NS': 'Bharti Airtel',
        'ITC.NS': 'ITC Limited',
        'KOTAKBANK.NS': 'Kotak Mahindra Bank',
        'LT.NS': 'Larsen & Toubro',
        'AXISBANK.NS': 'Axis Bank',
        'ASIANPAINT.NS': 'Asian Paints',
        'MARUTI.NS': 'Maruti Suzuki India',
        'SUNPHARMA.NS': 'Sun Pharmaceutical',
        'TITAN.NS': 'Titan Company',
        'WIPRO.NS': 'Wipro',
        'ULTRACEMCO.NS': 'UltraTech Cement',
        'ONGC.NS': 'Oil & Natural Gas Corporation',
        'NTPC.NS': 'NTPC Limited',
        'POWERGRID.NS': 'Power Grid Corporation',
        'TATASTEEL.NS': 'Tata Steel',
        'TATAMOTORS.NS': 'Tata Motors',
        'ADANIGREEN.NS': 'Adani Green Energy',
        'ADANIPORTS.NS': 'Adani Ports',
        'BAJFINANCE.NS': 'Bajaj Finance',
        'BAJAJFINSV.NS': 'Bajaj Finserv',
        'HCLTECH.NS': 'HCL Technologies',
        'TECHM.NS': 'Tech Mahindra',
        'DRREDDY.NS': 'Dr. Reddy\'s Laboratories',
        'CIPLA.NS': 'Cipla',
        'DIVISLAB.NS': 'Divi\'s Laboratories',
        'EICHERMOT.NS': 'Eicher Motors',
        'GRASIM.NS': 'Grasim Industries',
        'HEROMOTOCO.NS': 'Hero MotoCorp',
        'HINDALCO.NS': 'Hindalco Industries',
        'INDUSINDBK.NS': 'IndusInd Bank',
        'JSWSTEEL.NS': 'JSW Steel',
        'M&M.NS': 'Mahindra & Mahindra',
        'NESTLEIND.NS': 'Nestle India',
        'SBILIFE.NS': 'SBI Life Insurance',
        'SHREECEM.NS': 'Shree Cement',
        'TATACONSUM.NS': 'Tata Consumer Products',
        'UPL.NS': 'UPL Limited',
        'VEDL.NS': 'Vedanta Limited',
        'ZOMATO.NS': 'Zomato',
        'PAYTM.NS': 'One97 Communications (Paytm)',
        'NYKAA.NS': 'FSN E-Commerce (Nykaa)',
        'PNB.NS': 'Punjab National Bank',
        'CANBK.NS': 'Canara Bank',
        'BANKBARODA.NS': 'Bank of Baroda',
        'IDFCFIRSTB.NS': 'IDFC First Bank',
        'FEDERALBNK.NS': 'Federal Bank',
        'RBLBANK.NS': 'RBL Bank',
        'YESBANK.NS': 'Yes Bank',
        'ADANIENT.NS': 'Adani Enterprises',
        'AMBUJACEM.NS': 'Ambuja Cements',
        'APOLLOHOSP.NS': 'Apollo Hospitals',
        'AUROPHARMA.NS': 'Aurobindo Pharma',
        'BIOCON.NS': 'Biocon',
        'BOSCHLTD.NS': 'Bosch Limited',
        'BPCL.NS': 'Bharat Petroleum',
        'BRITANNIA.NS': 'Britannia Industries',
        'CADILAHC.NS': 'Cadila Healthcare',
        'COALINDIA.NS': 'Coal India',
        'COLPAL.NS': 'Colgate-Palmolive India',
        'DABUR.NS': 'Dabur India',
        'DLF.NS': 'DLF Limited',
        'GAIL.NS': 'GAIL India',
        'GODREJCP.NS': 'Godrej Consumer Products',
        'HAVELLS.NS': 'Havells India',
        'HDFC.NS': 'Housing Development Finance',
        'HDFCLIFE.NS': 'HDFC Life Insurance',
        'HINDPETRO.NS': 'Hindustan Petroleum',
        'ICICIPRULI.NS': 'ICICI Prudential Life',
        'IDEA.NS': 'Vodafone Idea',
        'INDIGO.NS': 'InterGlobe Aviation (IndiGo)',
        'IOC.NS': 'Indian Oil Corporation',
        'IRCTC.NS': 'Indian Railway Catering & Tourism',
        'JINDALSTEL.NS': 'Jindal Steel & Power',
        'JUBLFOOD.NS': 'Jubilant FoodWorks',
        'LICHSGFIN.NS': 'LIC Housing Finance',
        'LUPIN.NS': 'Lupin Limited',
        'MARICO.NS': 'Marico',
        'MOTHERSUMI.NS': 'Motherson Sumi Systems',
        'MUTHOOTFIN.NS': 'Muthoot Finance',
        'NHPC.NS': 'NHPC Limited',
        'NMDC.NS': 'NMDC Limited',
        'OFSS.NS': 'Oracle Financial Services',
        'PAGEIND.NS': 'Page Industries',
        'PETRONET.NS': 'Petronet LNG',
        'PIDILITIND.NS': 'Pidilite Industries',
        'PVR.NS': 'PVR Limited',
        'RECLTD.NS': 'REC Limited',
        'SAIL.NS': 'Steel Authority of India',
        'SIEMENS.NS': 'Siemens India',
        'SRF.NS': 'SRF Limited',
        'TATACOMM.NS': 'Tata Communications',
        'TATAELXSI.NS': 'Tata Elxsi',
        'TATAPOWER.NS': 'Tata Power',
        'TORNTPHARM.NS': 'Torrent Pharmaceuticals',
        'TORNTPOWER.NS': 'Torrent Power',
        'VOLTAS.NS': 'Voltas',
        'CGPOWER.NS': 'CG Power & Industrial Solutions',
        'THERMAX.NS': 'Thermax Limited',
        'JSWENERGY.NS': 'JSW Energy',
        'PHOENIXLTD.NS': 'The Phoenix Mills',
        
        // Indian Stocks (.BO suffix - BSE)
        'RELIANCE.BO': 'Reliance Industries',
        'TCS.BO': 'Tata Consultancy Services',
        'HDFCBANK.BO': 'HDFC Bank',
        'INFY.BO': 'Infosys',
        'ICICIBANK.BO': 'ICICI Bank',
        'SBIN.BO': 'State Bank of India',
        'BHARTIARTL.BO': 'Bharti Airtel',
        'ITC.BO': 'ITC Limited',
        'KOTAKBANK.BO': 'Kotak Mahindra Bank',
        'LT.BO': 'Larsen & Toubro',
        'AXISBANK.BO': 'Axis Bank',
        'ASIANPAINT.BO': 'Asian Paints',
        'MARUTI.BO': 'Maruti Suzuki India',
        'SUNPHARMA.BO': 'Sun Pharmaceutical',
        'TITAN.BO': 'Titan Company',
        'WIPRO.BO': 'Wipro',
        'ULTRACEMCO.BO': 'UltraTech Cement',
        'ONGC.BO': 'Oil & Natural Gas Corporation',
        'NTPC.BO': 'NTPC Limited',
        'POWERGRID.BO': 'Power Grid Corporation'
    };
    
    /**
     * Get company name for a given symbol
     * @param {string} symbol - Stock symbol
     * @returns {string} Company name or formatted symbol if not found
     */
    function getCompanyName(symbol) {
        if (!symbol) return 'Unknown';
        
        // First try exact match
        if (companyMappings[symbol]) {
            return companyMappings[symbol];
        }
        
        // Try uppercase version
        const upperSymbol = symbol.toUpperCase();
        if (companyMappings[upperSymbol]) {
            return companyMappings[upperSymbol];
        }
        
        // If not found, return a formatted version of the symbol
        // Remove exchange suffix and format nicely
        const parts = symbol.split('.');
        const baseSymbol = parts[0];
        
        // Convert to title case if it's all lowercase
        if (baseSymbol === baseSymbol.toLowerCase()) {
            return baseSymbol.charAt(0).toUpperCase() + baseSymbol.slice(1).toLowerCase();
        }
        
        return baseSymbol;
    }
    
    /**
     * Add or update a company name mapping
     * @param {string} symbol - Stock symbol
     * @param {string} companyName - Company name
     */
    function addMapping(symbol, companyName) {
        companyMappings[symbol] = companyName;
    }
    
    /**
     * Add multiple mappings at once
     * @param {Object} mappings - Object with symbol: companyName pairs
     */
    function addMappings(mappings) {
        Object.assign(companyMappings, mappings);
    }
    
    /**
     * Get all mappings
     * @returns {Object} All company mappings
     */
    function getAllMappings() {
        return { ...companyMappings };
    }
    
    // Return public API
    return {
        getCompanyName,
        addMapping,
        addMappings,
        getAllMappings
    };
})();