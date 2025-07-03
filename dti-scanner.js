/**
 * DTI Scanner Module
 * Server-side implementation of DTI Backtest logic for Telegram bot scanning
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Function to load comprehensive stock lists from the web interface
function loadComprehensiveStockLists() {
    try {
        // Read the comprehensive stock data from the web interface
        const dtiDataPath = path.join(__dirname, 'public', 'js', 'dti-data.js');
        const dtiDataContent = fs.readFileSync(dtiDataPath, 'utf8');
        
        // Extract stock arrays using regex (simpler than parsing JS)
        const extractStockArray = (arrayName) => {
            const regex = new RegExp(`const ${arrayName} = \\[(.*?)\\];`, 's');
            const match = dtiDataContent.match(regex);
            if (match) {
                try {
                    // Convert the JS array string to actual array
                    const arrayStr = '[' + match[1] + ']';
                    return eval(arrayStr);
                } catch (e) {
                    console.warn(`Failed to parse ${arrayName}, using fallback`);
                    return null;
                }
            }
            return null;
        };
        
        const comprehensive = {
            nifty50: extractStockArray('nifty50Stocks'),
            niftyNext50: extractStockArray('niftyNext50Stocks'),
            niftyMidcap150: extractStockArray('niftyMidcap150Stocks'),
            ftse100: extractStockArray('ftse100Stocks'),
            ftse250: extractStockArray('ftse250Stocks'),
            usStocks: extractStockArray('usStocks')
        };
        
        // If extraction was successful, return comprehensive lists
        if (comprehensive.nifty50 && comprehensive.usStocks) {
            console.log(`✅ Loaded comprehensive stock lists: ${
                (comprehensive.nifty50?.length || 0) +
                (comprehensive.niftyNext50?.length || 0) +
                (comprehensive.niftyMidcap150?.length || 0) +
                (comprehensive.ftse100?.length || 0) +
                (comprehensive.ftse250?.length || 0) +
                (comprehensive.usStocks?.length || 0)
            } total stocks`);
            return comprehensive;
        }
    } catch (error) {
        console.warn('Failed to load comprehensive stock lists, using fallback:', error.message);
    }
    
    // Return null to use fallback lists
    return null;
}

// Try to load comprehensive stock lists, fallback to limited lists if needed
const COMPREHENSIVE_STOCK_LISTS = loadComprehensiveStockLists();

// Stock lists (fallback for when comprehensive loading fails)
const STOCK_LISTS = {
    nifty50: [
        { name: "Reliance Industries", symbol: "RELIANCE.NS" },
        { name: "HDFC Bank", symbol: "HDFCBANK.NS" },
        { name: "Infosys", symbol: "INFY.NS" },
        { name: "ICICI Bank", symbol: "ICICIBANK.NS" },
        { name: "TCS", symbol: "TCS.NS" },
        { name: "ITC", symbol: "ITC.NS" },
        { name: "Kotak Mahindra Bank", symbol: "KOTAKBANK.NS" },
        { name: "Hindustan Unilever", symbol: "HINDUNILVR.NS" },
        { name: "Axis Bank", symbol: "AXISBANK.NS" },
        { name: "State Bank of India", symbol: "SBIN.NS" },
        { name: "Bharti Airtel", symbol: "BHARTIARTL.NS" },
        { name: "Bajaj Finance", symbol: "BAJFINANCE.NS" },
        { name: "Asian Paints", symbol: "ASIANPAINT.NS" },
        { name: "Maruti Suzuki", symbol: "MARUTI.NS" },
        { name: "HCL Technologies", symbol: "HCLTECH.NS" },
        { name: "Larsen & Toubro", symbol: "LT.NS" },
        { name: "Wipro", symbol: "WIPRO.NS" },
        { name: "Mahindra & Mahindra", symbol: "M&M.NS" },
        { name: "NTPC", symbol: "NTPC.NS" },
        { name: "Power Grid Corporation", symbol: "POWERGRID.NS" },
        { name: "Titan Company", symbol: "TITAN.NS" },
        { name: "Nestle India", symbol: "NESTLEIND.NS" },
        { name: "Adani Total Gas", symbol: "ATGL.NS" },
        { name: "Adani Enterprises", symbol: "ADANIENT.NS" },
        { name: "Adani Green Energy", symbol: "ADANIGREEN.NS" },
        { name: "Adani Ports", symbol: "ADANIPORTS.NS" },
        { name: "Adani Power", symbol: "ADANIPOWER.NS" },
        { name: "Adani Transmission", symbol: "ADANITRANS.NS" },
        { name: "Adani Wilmar", symbol: "AWL.NS" },
        { name: "Sun Pharma", symbol: "SUNPHARMA.NS" },
        { name: "Tech Mahindra", symbol: "TECHM.NS" },
        { name: "Bajaj Auto", symbol: "BAJAJ-AUTO.NS" },
        { name: "Dr. Reddy's", symbol: "DRREDDY.NS" },
        { name: "Tata Motors", symbol: "TATAMOTORS.NS" },
        { name: "Tata Steel", symbol: "TATASTEEL.NS" },
        { name: "IndusInd Bank", symbol: "INDUSINDBK.NS" },
        { name: "Coal India", symbol: "COALINDIA.NS" },
        { name: "ONGC", symbol: "ONGC.NS" },
        { name: "JSW Steel", symbol: "JSWSTEEL.NS" },
        { name: "Grasim Industries", symbol: "GRASIM.NS" },
        { name: "Divis Laboratories", symbol: "DIVISLAB.NS" },
        { name: "HDFC Life", symbol: "HDFCLIFE.NS" },
        { name: "SBI Life Insurance", symbol: "SBILIFE.NS" },
        { name: "Britannia Industries", symbol: "BRITANNIA.NS" },
        { name: "Tata Consumer Products", symbol: "TATACONSUM.NS" },
        { name: "Eicher Motors", symbol: "EICHERMOT.NS" },
        { name: "Shree Cement", symbol: "SHREECEM.NS" },
        { name: "Apollo Hospitals", symbol: "APOLLOHOSP.NS" },
        { name: "Hero MotoCorp", symbol: "HEROMOTOCO.NS" },
        { name: "Bajaj Finserv", symbol: "BAJAJFINSV.NS" }
    ],
    niftyNext50: [
        { name: "ABB India", symbol: "ABB.NS" },
        { name: "ACC", symbol: "ACC.NS" },
        { name: "Adani Total Gas", symbol: "ATGL.NS" },
        { name: "Ambuja Cements", symbol: "AMBUJACEM.NS" },
        { name: "Apollo Tyres", symbol: "APOLLOTYRE.NS" },
        { name: "Ashok Leyland", symbol: "ASHOKLEY.NS" },
        { name: "Astral", symbol: "ASTRAL.NS" },
        { name: "Aurobindo Pharma", symbol: "AUROPHARMA.NS" },
        { name: "Avenue Supermarts", symbol: "DMART.NS" },
        { name: "Bank of Baroda", symbol: "BANKBARODA.NS" },
        { name: "Berger Paints", symbol: "BERGEPAINT.NS" },
        { name: "Bharat Electronics", symbol: "BEL.NS" },
        { name: "Bharat Petroleum", symbol: "BPCL.NS" },
        { name: "Biocon", symbol: "BIOCON.NS" },
        { name: "Bosch", symbol: "BOSCHLTD.NS" },
        { name: "Cholamandalam Investment", symbol: "CHOLAFIN.NS" },
        { name: "Cipla", symbol: "CIPLA.NS" },
        { name: "Colgate Palmolive", symbol: "COLPAL.NS" },
        { name: "Dabur India", symbol: "DABUR.NS" },
        { name: "DLF", symbol: "DLF.NS" },
        { name: "Godrej Consumer Products", symbol: "GODREJCP.NS" },
        { name: "Godrej Properties", symbol: "GODREJPROP.NS" },
        { name: "Havells India", symbol: "HAVELLS.NS" },
        { name: "HDFC Asset Management", symbol: "HDFCAMC.NS" },
        { name: "Hindustan Petroleum", symbol: "HINDPETRO.NS" },
        { name: "ICICI Lombard", symbol: "ICICIGI.NS" },
        { name: "ICICI Prudential Life", symbol: "ICICIPRULI.NS" },
        { name: "IDBI Bank", symbol: "IDBI.NS" },
        { name: "Indian Oil Corporation", symbol: "IOC.NS" },
        { name: "Info Edge", symbol: "NAUKRI.NS" },
        { name: "Jindal Steel & Power", symbol: "JINDALSTEL.NS" },
        { name: "L&T Finance", symbol: "LTF.NS" },
        { name: "L&T Technology Services", symbol: "LTTS.NS" },
        { name: "LIC Housing Finance", symbol: "LICHSGFIN.NS" },
        { name: "Lupin", symbol: "LUPIN.NS" },
        { name: "Max Financial Services", symbol: "MFSL.NS" },
        { name: "Max Healthcare", symbol: "MAXHEALTH.NS" },
        { name: "Muthoot Finance", symbol: "MUTHOOTFIN.NS" },
        { name: "NMDC", symbol: "NMDC.NS" },
        { name: "Page Industries", symbol: "PAGEIND.NS" },
        { name: "Pidilite Industries", symbol: "PIDILITIND.NS" },
        { name: "Piramal Enterprises", symbol: "PEL.NS" },
        { name: "Punjab National Bank", symbol: "PNB.NS" },
        { name: "SBI Cards", symbol: "SBICARD.NS" },
        { name: "Shriram Finance", symbol: "SHRIRAMFIN.NS" },
        { name: "Siemens", symbol: "SIEMENS.NS" },
        { name: "SRF", symbol: "SRF.NS" },
        { name: "Tata Communications", symbol: "TATACOMM.NS" },
        { name: "Tata Elxsi", symbol: "TATAELXSI.NS" },
        { name: "Tata Power", symbol: "TATAPOWER.NS" }
    ],
    niftyMidcap150: [
        { name: "3M India", symbol: "3MINDIA.NS" },
        { name: "Aarti Industries", symbol: "AARTIIND.NS" },
        { name: "Aditya Birla Capital", symbol: "ABCAPITAL.NS" },
        { name: "Aditya Birla Fashion", symbol: "ABFRL.NS" },
        { name: "Ajanta Pharma", symbol: "AJANTPHARM.NS" },
        { name: "Alkem Laboratories", symbol: "ALKEM.NS" },
        { name: "Amara Raja Batteries", symbol: "AMARAJABAT.NS" },
        { name: "APL Apollo Tubes", symbol: "APLAPOLLO.NS" },
        { name: "AU Small Finance Bank", symbol: "AUBANK.NS" },
        { name: "Bajaj Holdings", symbol: "BAJAJHLDNG.NS" },
        { name: "Bandhan Bank", symbol: "BANDHANBNK.NS" },
        { name: "Bata India", symbol: "BATAINDIA.NS" },
        { name: "Bharat Forge", symbol: "BHARATFORG.NS" },
        { name: "Blue Star", symbol: "BLUESTARCO.NS" },
        { name: "Can Fin Homes", symbol: "CANFINHOME.NS" },
        { name: "Carborundum Universal", symbol: "CARBORUNIV.NS" },
        { name: "Castrol India", symbol: "CASTROLIND.NS" },
        { name: "Ceat", symbol: "CEATLTD.NS" },
        { name: "Central Bank of India", symbol: "CENTRALBK.NS" },
        { name: "Century Textiles", symbol: "CENTURYTEX.NS" },
        { name: "Chambal Fertilizers", symbol: "CHAMBLFERT.NS" },
        { name: "Coforge", symbol: "COFORGE.NS" },
        { name: "Crompton Greaves Consumer", symbol: "CROMPTON.NS" },
        { name: "Cummins India", symbol: "CUMMINSIND.NS" },
        { name: "Cyient", symbol: "CYIENT.NS" },
        { name: "Deepak Nitrite", symbol: "DEEPAKNTR.NS" },
        { name: "Delta Corp", symbol: "DELTACORP.NS" },
        { name: "Dixon Technologies", symbol: "DIXON.NS" },
        { name: "Dr. Lal PathLabs", symbol: "LALPATHLAB.NS" },
        { name: "Edelweiss Financial", symbol: "EDELWEISS.NS" },
        { name: "Emami", symbol: "EMAMILTD.NS" },
        { name: "Endurance Technologies", symbol: "ENDURANCE.NS" },
        { name: "Equitas Holdings", symbol: "EQUITAS.NS" },
        { name: "Escorts", symbol: "ESCORTS.NS" },
        { name: "Exide Industries", symbol: "EXIDEIND.NS" },
        { name: "Federal Bank", symbol: "FEDERALBNK.NS" },
        { name: "Finolex Cables", symbol: "FINCABLES.NS" },
        { name: "Fortis Healthcare", symbol: "FORTIS.NS" },
        { name: "Future Retail", symbol: "FRETAIL.NS" },
        { name: "GAIL India", symbol: "GAIL.NS" },
        { name: "Galaxy Surfactants", symbol: "GALAXYSURF.NS" },
        { name: "General Insurance Corp", symbol: "GICRE.NS" },
        { name: "Gillette India", symbol: "GILLETTE.NS" },
        { name: "Glaxosmithkline Pharma", symbol: "GLAXO.NS" },
        { name: "Glenmark Pharmaceuticals", symbol: "GLENMARK.NS" },
        { name: "GMR Infrastructure", symbol: "GMRINFRA.NS" },
        { name: "Godfrey Phillips", symbol: "GODFRYPHLP.NS" },
        { name: "Godrej Agrovet", symbol: "GODREJAGROVET.NS" },
        { name: "Godrej Industries", symbol: "GODREJIND.NS" },
        { name: "Graphite India", symbol: "GRAPHITE.NS" }
    ],
    ftse100: [
        { name: "3i Group", symbol: "III.L" },
        { name: "Abrdn", symbol: "ABDN.L" },
        { name: "Admiral Group", symbol: "ADM.L" },
        { name: "Anglo American", symbol: "AAL.L" },
        { name: "Antofagasta", symbol: "ANTO.L" },
        { name: "Ashtead Group", symbol: "AHT.L" },
        { name: "Associated British Foods", symbol: "ABF.L" },
        { name: "AstraZeneca", symbol: "AZN.L" },
        { name: "Auto Trader Group", symbol: "AUTO.L" },
        { name: "Aviva", symbol: "AV.L" },
        { name: "B&M European Value Retail", symbol: "BME.L" },
        { name: "BAE Systems", symbol: "BA.L" },
        { name: "Barclays", symbol: "BARC.L" },
        { name: "Barratt Developments", symbol: "BDEV.L" },
        { name: "Berkeley Group Holdings", symbol: "BKG.L" },
        { name: "BHP Group", symbol: "BHP.L" },
        { name: "BP", symbol: "BP.L" },
        { name: "British American Tobacco", symbol: "BATS.L" },
        { name: "British Land", symbol: "BLND.L" },
        { name: "BT Group", symbol: "BT.A.L" },
        { name: "Bunzl", symbol: "BNZL.L" },
        { name: "Burberry", symbol: "BRBY.L" },
        { name: "Centrica", symbol: "CNA.L" },
        { name: "Coca-Cola HBC", symbol: "CCH.L" },
        { name: "Compass Group", symbol: "CPG.L" },
        { name: "CRH", symbol: "CRH.L" },
        { name: "Croda International", symbol: "CRDA.L" },
        { name: "DCC", symbol: "DCC.L" },
        { name: "Diageo", symbol: "DGE.L" },
        { name: "Endeavour Mining", symbol: "EDV.L" },
        { name: "Entain", symbol: "ENT.L" },
        { name: "Experian", symbol: "EXPN.L" },
        { name: "F&C Investment Trust", symbol: "FCIT.L" },
        { name: "Flutter Entertainment", symbol: "FLTR.L" },
        { name: "Fresnillo", symbol: "FRES.L" },
        { name: "Glencore", symbol: "GLEN.L" },
        { name: "GSK", symbol: "GSK.L" },
        { name: "Haleon", symbol: "HLN.L" },
        { name: "Halma", symbol: "HLMA.L" },
        { name: "Hargreaves Lansdown", symbol: "HL.L" },
        { name: "HSBC", symbol: "HSBA.L" },
        { name: "Imperial Brands", symbol: "IMB.L" },
        { name: "Informa", symbol: "INF.L" },
        { name: "InterContinental Hotels", symbol: "IHG.L" },
        { name: "Intermediate Capital Group", symbol: "ICP.L" },
        { name: "International Airlines Group", symbol: "IAG.L" },
        { name: "Intertek", symbol: "ITRK.L" },
        { name: "JD Sports Fashion", symbol: "JD.L" },
        { name: "Johnson Matthey", symbol: "JMAT.L" },
        { name: "Kingfisher", symbol: "KGF.L" }
    ],
    ftse250: [
        { name: "4imprint Group", symbol: "FOUR.L" },
        { name: "888 Holdings", symbol: "888.L" },
        { name: "Aberforth Smaller Companies Trust", symbol: "ASL.L" },
        { name: "AG Barr", symbol: "BAG.L" },
        { name: "Aggreko", symbol: "AGK.L" },
        { name: "Airtel Africa", symbol: "AAF.L" },
        { name: "Alliance Trust", symbol: "ATST.L" },
        { name: "Allianz Technology Trust", symbol: "ATT.L" },
        { name: "AO World", symbol: "AO.L" },
        { name: "Apax Global Alpha", symbol: "APAX.L" },
        { name: "Ascential", symbol: "ASCL.L" },
        { name: "Ashmore Group", symbol: "ASHM.L" },
        { name: "ASOS", symbol: "ASC.L" },
        { name: "Assura", symbol: "AGR.L" },
        { name: "Auction Technology Group", symbol: "ATG.L" },
        { name: "Avast", symbol: "AVST.L" },
        { name: "Babcock International", symbol: "BAB.L" },
        { name: "Baillie Gifford European Growth Trust", symbol: "BGEU.L" },
        { name: "Baillie Gifford Japan Trust", symbol: "BGFD.L" },
        { name: "Baillie Gifford US Growth Trust", symbol: "USA.L" },
        { name: "Bakkavor Group", symbol: "BAKK.L" },
        { name: "Baltic Classifieds Group", symbol: "BCG.L" },
        { name: "Bankers Investment Trust", symbol: "BNKR.L" },
        { name: "Bank of Georgia Group", symbol: "BGEO.L" },
        { name: "Barr (A.G.)", symbol: "BAG.L" },
        { name: "BBGI SICAV", symbol: "BBGI.L" },
        { name: "BCA Marketplace", symbol: "BCA.L" },
        { name: "Beazley", symbol: "BEZ.L" },
        { name: "Bellway", symbol: "BWY.L" },
        { name: "Biffa", symbol: "BIFF.L" },
        { name: "Big Yellow Group", symbol: "BYG.L" },
        { name: "BlackRock Smaller Companies Trust", symbol: "BRSC.L" },
        { name: "BlackRock Throgmorton Trust", symbol: "THRG.L" },
        { name: "BlackRock World Mining Trust", symbol: "BRWM.L" },
        { name: "Bodycote", symbol: "BOY.L" },
        { name: "boohoo group", symbol: "BOO.L" },
        { name: "Brewin Dolphin Holdings", symbol: "BRW.L" },
        { name: "Bridgepoint Group", symbol: "BPT.L" },
        { name: "Britvic", symbol: "BVIC.L" },
        { name: "Brown (N.) Group", symbol: "BWNG.L" },
        { name: "Brunner Investment Trust", symbol: "BUT.L" },
        { name: "BTG", symbol: "BTG.L" },
        { name: "Bytes Technology Group", symbol: "BYIT.L" },
        { name: "C&C Group", symbol: "CCR.L" },
        { name: "Cairn Energy", symbol: "CNE.L" },
        { name: "Caledonia Investments", symbol: "CLDN.L" },
        { name: "Capital & Counties Properties", symbol: "CAPC.L" },
        { name: "Capital Gearing Trust", symbol: "CGT.L" },
        { name: "Capri Holdings", symbol: "CPRI.L" },
        { name: "Card Factory", symbol: "CARD.L" }
    ],
    usStocks: [
        { name: "Apple", symbol: "AAPL" },
        { name: "Microsoft", symbol: "MSFT" },
        { name: "Amazon", symbol: "AMZN" },
        { name: "Alphabet (Google)", symbol: "GOOGL" },
        { name: "Meta Platforms", symbol: "META" },
        { name: "Tesla", symbol: "TSLA" },
        { name: "NVIDIA", symbol: "NVDA" },
        { name: "Berkshire Hathaway", symbol: "BRK-B" },
        { name: "JPMorgan Chase", symbol: "JPM" },
        { name: "Johnson & Johnson", symbol: "JNJ" },
        { name: "Visa", symbol: "V" },
        { name: "Procter & Gamble", symbol: "PG" },
        { name: "Mastercard", symbol: "MA" },
        { name: "Bank of America", symbol: "BAC" },
        { name: "Home Depot", symbol: "HD" },
        { name: "Netflix", symbol: "NFLX" },
        { name: "Adobe", symbol: "ADBE" },
        { name: "Salesforce", symbol: "CRM" },
        { name: "PayPal", symbol: "PYPL" },
        { name: "Walt Disney", symbol: "DIS" },
        { name: "Intel", symbol: "INTC" },
        { name: "Cisco Systems", symbol: "CSCO" },
        { name: "Oracle", symbol: "ORCL" },
        { name: "Qualcomm", symbol: "QCOM" },
        { name: "IBM", symbol: "IBM" },
        { name: "AMD", symbol: "AMD" },
        { name: "Starbucks", symbol: "SBUX" },
        { name: "Boeing", symbol: "BA" },
        { name: "General Electric", symbol: "GE" },
        { name: "Ford Motor", symbol: "F" },
        { name: "Twitter", symbol: "TWTR" },
        { name: "Snap", symbol: "SNAP" },
        { name: "Uber", symbol: "UBER" },
        { name: "Airbnb", symbol: "ABNB" },
        { name: "Zoom", symbol: "ZM" },
        { name: "Square (Block)", symbol: "SQ" },
        { name: "Spotify", symbol: "SPOT" },
        { name: "Palantir", symbol: "PLTR" },
        { name: "Snowflake", symbol: "SNOW" },
        { name: "Datadog", symbol: "DDOG" },
        { name: "Cloudflare", symbol: "NET" },
        { name: "CrowdStrike", symbol: "CRWD" },
        { name: "Okta", symbol: "OKTA" },
        { name: "Twilio", symbol: "TWLO" },
        { name: "MongoDB", symbol: "MDB" },
        { name: "Elastic", symbol: "ESTC" },
        { name: "Splunk", symbol: "SPLK" },
        { name: "ServiceNow", symbol: "NOW" },
        { name: "Workday", symbol: "WDAY" },
        { name: "Atlassian", symbol: "TEAM" }
    ]
};

// DTI calculation functions
function calculateATR(high, low, close, period = 14) {
    const tr = [];
    for (let i = 0; i < high.length; i++) {
        if (i === 0) {
            tr.push(high[i] - low[i]);
        } else {
            const highLow = high[i] - low[i];
            const highClose = Math.abs(high[i] - close[i - 1]);
            const lowClose = Math.abs(low[i] - close[i - 1]);
            tr.push(Math.max(highLow, highClose, lowClose));
        }
    }
    
    const atr = [];
    let sum = 0;
    
    for (let i = 0; i < tr.length; i++) {
        if (i < period - 1) {
            sum += tr[i];
            atr.push(null);
        } else if (i === period - 1) {
            sum += tr[i];
            atr.push(sum / period);
        } else {
            const atrValue = (atr[i - 1] * (period - 1) + tr[i]) / period;
            atr.push(atrValue);
        }
    }
    
    return atr;
}

// Calculate Exponential Moving Average (EMA) - matches browser-side implementation
function calculateEMA(data, period) {
    if (!data || !data.length || period <= 0) {
        console.error('Invalid inputs for EMA calculation');
        return [];
    }
    
    const k = 2 / (period + 1);
    let emaData = [data[0]]; // Initialize with first value
    
    for (let i = 1; i < data.length; i++) {
        // EMA formula: Current EMA = (Price - Previous EMA) * K + Previous EMA
        emaData.push(data[i] * k + emaData[i-1] * (1-k));
    }
    
    return emaData;
}

function calculateDTI(high, low, r = 14, s = 10, u = 5) {
    // Use same algorithm as browser-side DTI calculation
    // Validate inputs
    if (!high || !low || high.length !== low.length || high.length === 0) {
        console.error('Invalid price data for DTI calculation');
        return [];
    }
    
    if (r <= 0 || s <= 0 || u <= 0) {
        console.error('Invalid EMA periods for DTI calculation');
        return []; 
    }
    
    const xHMU = [];  // Higher momentum up
    const xLMD = [];  // Lower momentum down
    const xPrice = []; // Price momentum = xHMU - xLMD
    const xPriceAbs = []; // Absolute value of xPrice
    
    // First point has no previous value, so we'll set it to 0
    xHMU.push(0);
    xLMD.push(0);
    xPrice.push(0);
    xPriceAbs.push(0);
    
    // Calculate xHMU, xLMD, xPrice, and xPriceAbs for each data point
    for (let i = 1; i < high.length; i++) {
        // Calculate xHMU: if high is greater than previous high, take the difference, otherwise 0
        if (high[i] - high[i-1] > 0) {
            xHMU.push(high[i] - high[i-1]);
        } else {
            xHMU.push(0);
        }
        
        // Calculate xLMD: if low is less than previous low, take the negative of the difference, otherwise 0
        if (low[i] - low[i-1] < 0) {
            xLMD.push(-(low[i] - low[i-1]));
        } else {
            xLMD.push(0);
        }
        
        // Calculate xPrice: xHMU - xLMD
        xPrice.push(xHMU[i] - xLMD[i]);
        
        // Calculate xPriceAbs: absolute value of xPrice
        xPriceAbs.push(Math.abs(xPrice[i]));
    }
    
    // Apply triple EMA to xPrice with periods r, s, and u
    const ema1 = calculateEMA(xPrice, r);
    const ema2 = calculateEMA(ema1, s);
    const xuXA = calculateEMA(ema2, u);
    
    // Apply triple EMA to xPriceAbs with periods r, s, and u
    const emaAbs1 = calculateEMA(xPriceAbs, r);
    const emaAbs2 = calculateEMA(emaAbs1, s);
    const xuXAAbs = calculateEMA(emaAbs2, u);
    
    // Calculate DTI: if xuXAAbs is not 0, then 100 * xuXA / xuXAAbs, otherwise 0
    const dti = [];
    for (let i = 0; i < xuXA.length; i++) {
        const val1 = 100 * xuXA[i];
        const val2 = xuXAAbs[i];
        
        if (val2 !== 0) {
            dti.push(val1 / val2);
        } else {
            dti.push(0);
        }
    }
    
    return dti;
}

function calculate7DayDTI(dates, high, low, r = 14, s = 10, u = 5) {
    const sevenDayData = [];
    const sevenDayDTI = [];
    const daily7DayDTI = new Array(dates.length).fill(null);
    
    for (let i = 0; i < dates.length; i += 7) {
        const endIndex = Math.min(i + 6, dates.length - 1);
        const periodHigh = high.slice(i, endIndex + 1);
        const periodLow = low.slice(i, endIndex + 1);
        
        const avgHigh = periodHigh.reduce((a, b) => a + b, 0) / periodHigh.length;
        const avgLow = periodLow.reduce((a, b) => a + b, 0) / periodLow.length;
        
        sevenDayData.push({
            startDate: dates[i],
            endDate: dates[endIndex],
            startIndex: i,
            endIndex: endIndex,
            avgHigh: avgHigh,
            avgLow: avgLow
        });
    }
    
    const weeklyHighs = sevenDayData.map(d => d.avgHigh);
    const weeklyLows = sevenDayData.map(d => d.avgLow);
    
    const weeklyDTI = calculateDTI(weeklyHighs, weeklyLows, Math.ceil(r/7), Math.ceil(s/7), Math.ceil(u/7));
    
    sevenDayData.forEach((period, idx) => {
        sevenDayDTI.push(weeklyDTI[idx] || 0);
        
        for (let j = period.startIndex; j <= period.endIndex && j < dates.length; j++) {
            daily7DayDTI[j] = weeklyDTI[idx] || 0;
        }
    });
    
    return {
        sevenDayData: sevenDayData,
        sevenDayDTI: sevenDayDTI,
        daily7DayDTI: daily7DayDTI
    };
}

// Backtest functions
function backtestWithActiveDetection(dates, prices, dti, sevenDayDTIData, params) {
    const {
        entryThreshold = 0,
        takeProfitPercent = 8,
        stopLossPercent = 5,
        maxHoldingDays = 30
    } = params;
    
    const { daily7DayDTI, sevenDayData, sevenDayDTI } = sevenDayDTIData;
    
    // Calculate the earliest allowed trade date (6 months after the first date)
    const firstDate = new Date(dates[0]);
    const earliestAllowableDate = new Date(firstDate);
    earliestAllowableDate.setMonth(firstDate.getMonth() + 6);
    
    let completedTrades = [];
    let activeTrade = null;
    
    for (let i = 1; i < dti.length; i++) {
        const currentDate = dates[i];
        const currentPrice = prices[i];
        const currentDTI = dti[i];
        const previousDTI = dti[i-1];
        const currentDateObj = new Date(currentDate);
        
        // Skip if we're still in the warm-up period
        if (currentDateObj < earliestAllowableDate) {
            continue;
        }
        
        // Get current 7-day DTI value
        const current7DayDTI = daily7DayDTI[i];
        
        // Find previous 7-day period's DTI
        let previous7DayDTI = null;
        let currentPeriodIndex = -1;
        
        for (let p = 0; p < sevenDayData.length; p++) {
            if (i >= sevenDayData[p].startIndex && i <= sevenDayData[p].endIndex) {
                currentPeriodIndex = p;
                break;
            }
        }
        
        if (currentPeriodIndex > 0) {
            previous7DayDTI = sevenDayDTI[currentPeriodIndex - 1];
        }
        
        // Process active trade
        if (activeTrade) {
            const holdingDays = Math.floor((currentDateObj - new Date(activeTrade.entryDate)) / (24 * 60 * 60 * 1000));
            const plPercent = ((currentPrice - activeTrade.entryPrice) / activeTrade.entryPrice) * 100;
            
            // Check exit conditions
            if (plPercent >= takeProfitPercent) {
                activeTrade.exitDate = currentDate;
                activeTrade.exitPrice = currentPrice;
                activeTrade.plPercent = plPercent;
                activeTrade.exitReason = 'Take Profit';
                completedTrades.push(activeTrade);
                activeTrade = null;
            } else if (plPercent <= -stopLossPercent) {
                activeTrade.exitDate = currentDate;
                activeTrade.exitPrice = currentPrice;
                activeTrade.plPercent = plPercent;
                activeTrade.exitReason = 'Stop Loss';
                completedTrades.push(activeTrade);
                activeTrade = null;
            } else if (holdingDays >= maxHoldingDays) {
                activeTrade.exitDate = currentDate;
                activeTrade.exitPrice = currentPrice;
                activeTrade.plPercent = plPercent;
                activeTrade.exitReason = 'Time Exit';
                completedTrades.push(activeTrade);
                activeTrade = null;
            }
        }
        
        // Check entry conditions
        if (!activeTrade && currentDTI !== null && previousDTI !== null) {
            let sevenDayConditionMet = true;
            if (previous7DayDTI !== null) {
                sevenDayConditionMet = current7DayDTI > previous7DayDTI;
            }
            
            // Log entry condition details every 100 days for debugging
            if (i % 100 === 0) {
                console.log(`📈 Entry check (day ${i}): DTI=${currentDTI?.toFixed(2)}, prevDTI=${previousDTI?.toFixed(2)}, threshold=${entryThreshold}, 7dayOK=${sevenDayConditionMet}`);
            }
            
            if (currentDTI < entryThreshold && 
                currentDTI > previousDTI && 
                sevenDayConditionMet) {
                
                console.log(`🚀 ENTRY SIGNAL: Date=${currentDate}, Price=${currentPrice}, DTI=${currentDTI?.toFixed(2)}, 7dayDTI=${current7DayDTI?.toFixed(2)}`);
                
                activeTrade = {
                    entryDate: currentDate,
                    entryPrice: currentPrice,
                    entryDTI: currentDTI,
                    entry7DayDTI: current7DayDTI
                };
            }
        }
    }
    
    return { completedTrades, activeTrade };
}

// Fetch stock data using the SAME proxy endpoint as manual scan to avoid rate limiting
async function fetchStockData(symbol, period = '5y', retries = 3) {
    const isServer = typeof window === 'undefined';
    
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            // Calculate timestamps (same as manual scan)
            const endDate = Math.floor(Date.now() / 1000);
            let startDate;
            
            switch(period) {
                case '1mo':
                    startDate = endDate - (30 * 24 * 60 * 60);
                    break;
                case '3mo':
                    startDate = endDate - (91 * 24 * 60 * 60);
                    break;
                case '6mo':
                    startDate = endDate - (182 * 24 * 60 * 60);
                    break;
                case '1y':
                    startDate = endDate - (365 * 24 * 60 * 60);
                    break;
                case '2y':
                    startDate = endDate - (730 * 24 * 60 * 60);
                    break;
                case '5y':
                    startDate = endDate - (1825 * 24 * 60 * 60);
                    break;
                case 'max':
                    startDate = endDate - (3650 * 24 * 60 * 60); // 10 years
                    break;
                default:
                    startDate = endDate - (1825 * 24 * 60 * 60); // Default to 5 years
            }
            
            // Add progressive delay to avoid rate limiting
            if (attempt > 0) {
                const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff, max 5s
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            let data = [];
            
            // CRITICAL FIX: Use the SAME proxy endpoint as manual scan
            // This is the key difference - manual scan uses local proxy, 7AM scan was using direct API
            // For Render deployment, use the app's own URL
            const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
            const proxyUrl = `${baseUrl}/yahoo/history?symbol=${symbol}&period1=${startDate}&period2=${endDate}&interval=1d`;
            
            try {
                console.log(`📡 Using proxy endpoint for ${symbol}: ${proxyUrl}`);
                
                // Use local proxy endpoint (same as manual scan)
                const response = await axios.get(proxyUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'text/csv,application/csv',
                    },
                    timeout: 20000
                });
                
                // Parse CSV response from proxy (same format as manual scan)
                const csvText = response.data;
                const lines = csvText.trim().split('\n');
                
                if (lines.length > 1) {
                    // Skip header row
                    for (let i = 1; i < lines.length; i++) {
                        const values = lines[i].split(',');
                        // Validate that we have all required fields and valid numeric data
                        if (values.length >= 6 && values[4] !== 'null' && !isNaN(parseFloat(values[4]))) {
                            data.push({
                                date: values[0],
                                open: parseFloat(values[1]) || parseFloat(values[4]),
                                high: parseFloat(values[2]),
                                low: parseFloat(values[3]),
                                close: parseFloat(values[4]),
                                volume: parseInt(values[6]) || 0
                            });
                        }
                    }
                } else {
                    throw new Error('No valid data received from proxy');
                }
                
            } catch (proxyError) {
                console.log(`Proxy failed for ${symbol}, trying direct API fallback...`);
                
                // Fallback to direct API only if proxy fails (same as before)
                const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startDate}&period2=${endDate}&interval=1d&includePrePost=false`;
                
                try {
                    const response = await axios.get(chartUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Accept': 'application/json, text/plain, */*',
                            'Accept-Language': 'en-US,en;q=0.9',
                            'Accept-Encoding': 'gzip, deflate, br',
                            'Referer': 'https://finance.yahoo.com/',
                            'Origin': 'https://finance.yahoo.com',
                            'Connection': 'keep-alive',
                            'Sec-Fetch-Dest': 'empty',
                            'Sec-Fetch-Mode': 'cors',
                            'Sec-Fetch-Site': 'same-site'
                        },
                        timeout: 20000
                    });
                    
                    // Parse chart API response
                    if (response.data && response.data.chart && response.data.chart.result && response.data.chart.result[0]) {
                        const result = response.data.chart.result[0];
                        const timestamps = result.timestamp;
                        const quotes = result.indicators.quote[0];
                        
                        for (let i = 0; i < timestamps.length; i++) {
                            if (quotes.close[i] !== null && quotes.high[i] !== null && quotes.low[i] !== null) {
                                data.push({
                                    date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
                                    open: quotes.open[i] || quotes.close[i],
                                    high: quotes.high[i],
                                    low: quotes.low[i],
                                    close: quotes.close[i],
                                    volume: quotes.volume[i] || 0
                                });
                            }
                        }
                    } else {
                        throw new Error('Invalid chart API response');
                    }
                } catch (chartError) {
                    // Final fallback to download API
                    const downloadUrl = `https://query1.finance.yahoo.com/v7/finance/download/${symbol}?period1=${startDate}&period2=${endDate}&interval=1d&events=history`;
                    
                    const response = await axios.get(downloadUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': 'text/csv,application/csv',
                            'Referer': 'https://finance.yahoo.com/',
                            'Origin': 'https://finance.yahoo.com'
                        },
                        timeout: 20000
                    });
                    
                    const lines = response.data.trim().split('\n');
                    if (lines.length > 1) {
                        for (let i = 1; i < lines.length; i++) {
                            const values = lines[i].split(',');
                            if (values.length >= 6 && values[4] !== 'null' && !isNaN(parseFloat(values[4]))) {
                                data.push({
                                    date: values[0],
                                    open: parseFloat(values[1]) || parseFloat(values[4]),
                                    high: parseFloat(values[2]),
                                    low: parseFloat(values[3]),
                                    close: parseFloat(values[4]),
                                    volume: parseInt(values[6]) || 0
                                });
                            }
                        }
                    }
                }
            }
            
            if (data.length > 0) {
                console.log(`✅ Successfully fetched ${data.length} data points for ${symbol}`);
                return data;
            } else {
                throw new Error('No valid data points found');
            }
            
        } catch (error) {
            if (attempt < retries) {
                console.log(`🔄 Retry ${attempt + 1}/${retries} for ${symbol}: ${error.message}`);
            } else {
                console.error(`❌ Failed to fetch ${symbol} after ${retries + 1} attempts: ${error.message}`);
            }
        }
    }
    console.log(`❌ No data available for ${symbol}`);
    return null;
}

// Process a single stock and check for active trades
async function processStock(stock, params) {
    try {
        const data = await fetchStockData(stock.symbol, '5y');
        
        if (!data || data.length < 30) {
            console.log(`⚠️ ${stock.symbol}: Insufficient data (${data?.length || 0} points, need 30+)`);
            return null;
        }
        
        // Extract arrays and validate data
        const dates = data.map(d => d.date);
        const prices = data.map(d => d.close);
        const high = data.map(d => d.high);
        const low = data.map(d => d.low);
        
        // Validate data quality
        const validPrices = prices.filter(p => p && !isNaN(p) && p > 0);
        const validHighs = high.filter(h => h && !isNaN(h) && h > 0);
        const validLows = low.filter(l => l && !isNaN(l) && l > 0);
        
        console.log(`🔍 ${stock.symbol}: Processing ${data.length} data points, date range: ${dates[0]} to ${dates[dates.length - 1]}`);
        console.log(`📊 ${stock.symbol}: Data quality - Valid prices: ${validPrices.length}/${prices.length}, Valid highs: ${validHighs.length}/${high.length}, Valid lows: ${validLows.length}/${low.length}`);
        
        if (validPrices.length < data.length * 0.8) {
            console.log(`⚠️ ${stock.symbol}: Poor data quality, skipping (${validPrices.length}/${data.length} valid prices)`);
            return null;
        }
        
        // Calculate DTI
        const dti = calculateDTI(high, low, 14, 10, 5);
        const sevenDayDTIData = calculate7DayDTI(dates, high, low, 14, 10, 5);
        
        console.log(`📊 ${stock.symbol}: DTI calculated, last 5 values: [${dti.slice(-5).map(v => v?.toFixed(2) || 'null').join(', ')}]`);
        
        // Run backtest with detailed logging
        const { completedTrades, activeTrade } = backtestWithActiveDetection(
            dates, 
            prices, 
            dti, 
            sevenDayDTIData,
            params
        );
        
        console.log(`🎯 ${stock.symbol}: Backtest complete - ${completedTrades.length} completed trades, activeTrade: ${activeTrade ? 'YES' : 'NO'}`);
        
        if (activeTrade) {
            console.log(`✅ ${stock.symbol}: ACTIVE OPPORTUNITY FOUND!`, {
                entryDate: activeTrade.entryDate,
                entryPrice: activeTrade.entryPrice,
                entryDTI: activeTrade.entryDTI,
                currentPrice: prices[prices.length - 1]
            });
            
            return {
                stock: stock,
                activeTrade: activeTrade,
                currentPrice: prices[prices.length - 1],
                currentDTI: dti[dti.length - 1],
                trades: completedTrades
            };
        }
        
        return null;
    } catch (error) {
        console.error(`❌ Error processing ${stock.symbol}:`, error.message);
        return null;
    }
}

// Scan all stocks for opportunities
async function scanAllStocks(params = {}) {
    const defaultParams = {
        entryThreshold: 0,
        takeProfitPercent: 8,
        stopLossPercent: 5,
        maxHoldingDays: 30
    };
    
    const scanParams = { ...defaultParams, ...params };
    const opportunities = [];
    
    // Use comprehensive stock lists if available, otherwise fallback to limited lists
    const stockLists = COMPREHENSIVE_STOCK_LISTS || STOCK_LISTS;
    
    // Combine all stock lists
    const allStocks = [
        ...(stockLists.nifty50 || []),
        ...(stockLists.niftyNext50 || []),
        ...(stockLists.niftyMidcap150 || []),
        ...(stockLists.ftse100 || []),
        ...(stockLists.ftse250 || []),
        ...(stockLists.usStocks || [])
    ];
    
    // Remove duplicates
    const uniqueStocks = Array.from(new Map(allStocks.map(s => [s.symbol, s])).values());
    
    console.log(`📋 Stock list breakdown:`);
    console.log(`   Nifty 50: ${stockLists.nifty50?.length || 0} stocks`);
    console.log(`   Nifty Next 50: ${stockLists.niftyNext50?.length || 0} stocks`);
    console.log(`   Nifty Midcap 150: ${stockLists.niftyMidcap150?.length || 0} stocks`);
    console.log(`   FTSE 100: ${stockLists.ftse100?.length || 0} stocks`);
    console.log(`   FTSE 250: ${stockLists.ftse250?.length || 0} stocks`);
    console.log(`   US Stocks: ${stockLists.usStocks?.length || 0} stocks`);
    console.log(`   Total unique: ${uniqueStocks.length} stocks`);
    
    if (COMPREHENSIVE_STOCK_LISTS) {
        console.log(`✅ Using comprehensive stock lists loaded from dti-data.js`);
    } else {
        console.log(`⚠️  Using fallback limited stock lists - comprehensive loading failed`);
    }
    
    // Log sample of first few stocks to verify structure
    console.log(`📋 Sample stocks:`, uniqueStocks.slice(0, 3).map(s => `${s.symbol} (${s.name})`));
    
    // Process all stocks concurrently for faster scanning
    let successCount = 0;
    let errorCount = 0;
    
    // For debugging: process only first 10 stocks to test DTI calculation
    const DEBUG_MODE = process.env.DTI_DEBUG === 'true';
    const stocksToProcess = DEBUG_MODE ? uniqueStocks.slice(0, 10) : uniqueStocks;
    
    if (DEBUG_MODE) {
        console.log(`🔍 DEBUG MODE: Processing only ${stocksToProcess.length} stocks for testing`);
    } else {
        console.log(`Processing ${stocksToProcess.length} stocks in optimized batches for faster scanning...`);
    }
    
    // Optimized batch processing for 5-10 minute completion
    const BATCH_SIZE = DEBUG_MODE ? 3 : 75; // Smaller batches in debug mode for easier tracking
    const BATCH_DELAY = DEBUG_MODE ? 500 : 1500; // Faster in debug mode
    
    // Process stocks in batches with controlled concurrency
    for (let i = 0; i < stocksToProcess.length; i += BATCH_SIZE) {
        const batch = stocksToProcess.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(stocksToProcess.length / BATCH_SIZE);
        
        console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} stocks)...`);
        
        // Add delay between batches (not individual stocks) 
        if (i > 0) {
            console.log(`⏳ Waiting ${BATCH_DELAY / 1000}s before next batch to avoid rate limiting...`);
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
        
        // Process entire batch in parallel
        const batchPromises = batch.map(stock => 
            processStock(stock, scanParams).catch(error => {
                console.log(`❌ ${stock.symbol}: ${error.message || 'Data fetch failed'}`);
                return null;
            })
        );
        
        // Wait for all stocks in batch to complete
        const batchResults = await Promise.all(batchPromises);
        
        // Count results
        batchResults.forEach((result, index) => {
            const stock = batch[index];
            if (result) {
                opportunities.push(result);
                successCount++;
                console.log(`✅ ${stock.symbol}: Found active opportunity`);
            } else {
                errorCount++;
                // Note: Individual stock processing details already logged in processStock
            }
        });
        
        const processed = Math.min((batchNumber * BATCH_SIZE), stocksToProcess.length);
        const progressPercent = Math.round((processed / stocksToProcess.length) * 100);
        console.log(`🚀 Progress: ${processed}/${stocksToProcess.length} stocks (${progressPercent}%) - ${successCount} opportunities found`);
    }
    
    console.log(`Scan complete: ${successCount} opportunities found, ${errorCount} errors/no opportunities`);
    
    // Sort opportunities by potential (current P/L %)
    opportunities.sort((a, b) => {
        const aPlPercent = ((a.currentPrice - a.activeTrade.entryPrice) / a.activeTrade.entryPrice) * 100;
        const bPlPercent = ((b.currentPrice - b.activeTrade.entryPrice) / b.activeTrade.entryPrice) * 100;
        return bPlPercent - aPlPercent;
    });
    
    return opportunities;
}

// Format opportunities for Telegram message
function formatOpportunitiesMessage(opportunities) {
    // Filter for opportunities from last 2 trading days only
    // Use UK timezone to match the cron job schedule
    const ukNow = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/London"}));
    const today = new Date(ukNow);
    today.setHours(0, 0, 0, 0);
    
    console.log(`[DTI Scanner] Filtering opportunities - UK Time: ${ukNow.toISOString()}, Today (midnight): ${today.toISOString()}, Total opportunities: ${opportunities.length}`);
    
    const recentOpportunities = opportunities.filter(opp => {
        if (!opp.activeTrade || !opp.activeTrade.entryDate) return false;
        
        const entryDate = new Date(opp.activeTrade.entryDate);
        entryDate.setHours(0, 0, 0, 0);
        
        // Calculate days difference (excluding weekends)
        let tradingDays = 0;
        let tempDate = new Date(today);
        
        while (tempDate >= entryDate && tradingDays < 3) {
            const dayOfWeek = tempDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not weekend
                tradingDays++;
            }
            tempDate.setDate(tempDate.getDate() - 1);
            
            if (tempDate < entryDate) break;
        }
        
        return tradingDays <= 2; // Only last 2 trading days
    });
    
    console.log(`[DTI Scanner] Filtered opportunities: ${recentOpportunities.length} out of ${opportunities.length} total opportunities meet the 2-day criteria`);
    
    if (!recentOpportunities || recentOpportunities.length === 0) {
        return `📊 *Daily Scan Complete*\n\nNo high conviction opportunities from last 2 days.\n\nNext scan: Tomorrow at 7 AM UK time`;
    }
    
    let message = `🎯 *HIGH CONVICTION OPPORTUNITIES*\n`;
    message += `Found ${recentOpportunities.length} signals from last 2 days:\n\n`;
    
    // Take up to 5 opportunities
    const topOpportunities = recentOpportunities.slice(0, 5);
    
    topOpportunities.forEach((opp, index) => {
        const entryPrice = opp.currentPrice || opp.activeTrade.entryPrice;
        const targetPrice = entryPrice * 1.08; // 8% profit target
        const stopLossPrice = entryPrice * 0.95; // 5% stop loss
        
        // Calculate exit date (30 days from entry)
        const entryDate = new Date(opp.activeTrade.entryDate);
        const exitDate = new Date(entryDate);
        exitDate.setDate(exitDate.getDate() + 30);
        
        // Get currency symbol
        const currencySymbol = opp.stock.symbol.endsWith('.NS') ? '₹' : 
                           opp.stock.symbol.endsWith('.L') ? '£' : '$';
        
        message += `${index + 1}. *${opp.stock.name}*\n`;
        message += `   Entry: ${currencySymbol}${entryPrice.toFixed(2)}\n`;
        message += `   Target: ${currencySymbol}${targetPrice.toFixed(2)}\n`;
        message += `   Stop Loss: ${currencySymbol}${stopLossPrice.toFixed(2)}\n`;
        message += `   Entry Date: ${entryDate.toLocaleDateString()}\n`;
        message += `   Exit Date: ${exitDate.toLocaleDateString()}\n\n`;
    });
    
    message += `\nNext scan: Tomorrow at 7 AM UK time`;
    return message;
}

module.exports = {
    scanAllStocks,
    formatOpportunitiesMessage,
    STOCK_LISTS
};