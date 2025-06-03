/**
 * DTI Scanner Module
 * Server-side implementation of DTI Backtest logic for Telegram bot scanning
 */

const axios = require('axios');

// Stock lists
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

function calculateDTI(high, low, r = 14, s = 10, u = 5) {
    const dtiResult = [];
    
    if (!high || !low || high.length < r + s + u) {
        return dtiResult;
    }
    
    const atr = calculateATR(high, low, high, r);
    
    for (let i = 0; i < high.length; i++) {
        if (i < r + s - 1 || atr[i - s + 1] === null) {
            dtiResult.push(null);
            continue;
        }
        
        let sumDirection = 0;
        let sumVolatility = 0;
        
        for (let j = 0; j < s; j++) {
            const idx = i - j;
            if (idx >= 1) {
                const direction = high[idx] - high[idx - 1] >= 0 ? 1 : -1;
                const volatility = atr[idx - s + 1] || 0;
                
                sumDirection += direction * volatility;
                sumVolatility += volatility;
            }
        }
        
        if (sumVolatility > 0) {
            const rawDTI = (sumDirection / sumVolatility) * 100;
            
            if (i < r + s + u - 1) {
                dtiResult.push(rawDTI);
            } else {
                let sumDTI = 0;
                let count = 0;
                for (let k = 0; k < u; k++) {
                    const dtiIdx = i - k;
                    if (dtiIdx >= r + s - 1 && dtiResult[dtiIdx] !== null) {
                        sumDTI += dtiResult[dtiIdx];
                        count++;
                    }
                }
                
                const smoothedDTI = count > 0 ? sumDTI / count : rawDTI;
                dtiResult.push(smoothedDTI);
            }
        } else {
            dtiResult.push(0);
        }
    }
    
    return dtiResult;
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
            
            if (currentDTI < entryThreshold && 
                currentDTI > previousDTI && 
                sevenDayConditionMet) {
                
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

// Fetch stock data from Yahoo Finance
async function fetchStockData(symbol, period = '6mo') {
    try {
        // Calculate timestamps
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
            default:
                startDate = endDate - (182 * 24 * 60 * 60); // Default to 6 months
        }
        
        const url = `https://query1.finance.yahoo.com/v7/finance/download/${symbol}?period1=${startDate}&period2=${endDate}&interval=1d&events=history`;
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        
        // Parse CSV data
        const lines = response.data.trim().split('\n');
        const headers = lines[0].split(',');
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            if (values.length === headers.length) {
                data.push({
                    date: values[0],
                    open: parseFloat(values[1]),
                    high: parseFloat(values[2]),
                    low: parseFloat(values[3]),
                    close: parseFloat(values[4]),
                    volume: parseInt(values[6])
                });
            }
        }
        
        return data;
    } catch (error) {
        console.error(`Error fetching data for ${symbol}:`, error.message);
        return null;
    }
}

// Process a single stock and check for active trades
async function processStock(stock, params) {
    try {
        const data = await fetchStockData(stock.symbol);
        
        if (!data || data.length < 30) {
            return null;
        }
        
        // Extract arrays
        const dates = data.map(d => d.date);
        const prices = data.map(d => d.close);
        const high = data.map(d => d.high);
        const low = data.map(d => d.low);
        
        // Calculate DTI
        const dti = calculateDTI(high, low, 14, 10, 5);
        const sevenDayDTIData = calculate7DayDTI(dates, high, low, 14, 10, 5);
        
        // Run backtest
        const { completedTrades, activeTrade } = backtestWithActiveDetection(
            dates, 
            prices, 
            dti, 
            sevenDayDTIData,
            params
        );
        
        if (activeTrade) {
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
        console.error(`Error processing ${stock.symbol}:`, error.message);
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
    
    // Combine all stock lists
    const allStocks = [
        ...STOCK_LISTS.nifty50,
        ...STOCK_LISTS.niftyNext50,
        ...STOCK_LISTS.niftyMidcap150,
        ...STOCK_LISTS.ftse100,
        ...STOCK_LISTS.ftse250,
        ...STOCK_LISTS.usStocks
    ];
    
    // Remove duplicates
    const uniqueStocks = Array.from(new Map(allStocks.map(s => [s.symbol, s])).values());
    
    console.log(`Scanning ${uniqueStocks.length} stocks for DTI opportunities...`);
    
    // Process in batches to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < uniqueStocks.length; i += batchSize) {
        const batch = uniqueStocks.slice(i, i + batchSize);
        const batchPromises = batch.map(stock => processStock(stock, scanParams));
        
        const results = await Promise.allSettled(batchPromises);
        
        results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value) {
                opportunities.push(result.value);
            }
        });
        
        // Progress update
        console.log(`Processed ${Math.min(i + batchSize, uniqueStocks.length)} of ${uniqueStocks.length} stocks`);
        
        // Small delay between batches
        if (i + batchSize < uniqueStocks.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
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
    if (!opportunities || opportunities.length === 0) {
        return `📊 *DTI Backtest Scan Complete*\n\nNo high conviction opportunities found at this time.\n\nNext scan: Tomorrow at 7 AM UK time`;
    }
    
    let message = `🎯 *DTI High Conviction Opportunities*\n\n`;
    message += `Found ${opportunities.length} active trading opportunities:\n\n`;
    
    // Group by market
    const byMarket = {
        NSE: opportunities.filter(o => o.stock.symbol.endsWith('.NS')),
        UK: opportunities.filter(o => o.stock.symbol.endsWith('.L')),
        US: opportunities.filter(o => !o.stock.symbol.endsWith('.NS') && !o.stock.symbol.endsWith('.L'))
    };
    
    for (const [market, stocks] of Object.entries(byMarket)) {
        if (stocks.length === 0) continue;
        
        message += `*${market} Market (${stocks.length}):*\n`;
        
        // Show top 5 for each market
        stocks.slice(0, 5).forEach(opp => {
            const plPercent = ((opp.currentPrice - opp.activeTrade.entryPrice) / opp.activeTrade.entryPrice) * 100;
            const holdingDays = Math.floor((new Date() - new Date(opp.activeTrade.entryDate)) / (24 * 60 * 60 * 1000));
            const emoji = plPercent > 0 ? '📈' : '📉';
            
            message += `${emoji} *${opp.stock.name}* (${opp.stock.symbol})\n`;
            message += `   Entry: ${opp.activeTrade.entryPrice.toFixed(2)} | Current: ${opp.currentPrice.toFixed(2)}\n`;
            message += `   P/L: ${plPercent > 0 ? '+' : ''}${plPercent.toFixed(2)}% | Days: ${holdingDays}\n`;
            message += `   DTI: ${opp.currentDTI.toFixed(2)}\n\n`;
        });
        
        if (stocks.length > 5) {
            message += `... and ${stocks.length - 5} more\n\n`;
        }
    }
    
    message += `\n⏰ Next scan: Tomorrow at 7 AM UK time`;
    
    return message;
}

module.exports = {
    scanAllStocks,
    formatOpportunitiesMessage,
    STOCK_LISTS
};