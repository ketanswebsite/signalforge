/**
 * DTI Backtester - Data Module
 * Handles data management, fetching, and processing
 */

// Create DTIData module
const DTIData = (function() {
    // Stock lists
    const nifty50Stocks = [
        { name: "Adani Enterprises", symbol: "ADANIENT.NS" },
        { name: "Adani Ports", symbol: "ADANIPORTS.NS" },
        { name: "Apollo Hospitals", symbol: "APOLLOHOSP.NS" },
        { name: "Asian Paints", symbol: "ASIANPAINT.NS" },
        { name: "Axis Bank", symbol: "AXISBANK.NS" },
        { name: "Bajaj Auto", symbol: "BAJAJ-AUTO.NS" },
        { name: "Bajaj Finance", symbol: "BAJFINANCE.NS" },
        { name: "Bajaj Finserv", symbol: "BAJAJFINSV.NS" },
        { name: "BPCL", symbol: "BPCL.NS" },
        { name: "Bharti Airtel", symbol: "BHARTIARTL.NS" },
        { name: "Britannia", symbol: "BRITANNIA.NS" },
        { name: "CIPLA", symbol: "CIPLA.NS" },
        { name: "Coal India", symbol: "COALINDIA.NS" },
        { name: "Divis Labs", symbol: "DIVISLAB.NS" },
        { name: "Dr Reddy's Labs", symbol: "DRREDDY.NS" },
        { name: "Eicher Motors", symbol: "EICHERMOT.NS" },
        { name: "Grasim", symbol: "GRASIM.NS" },
        { name: "HCL Tech", symbol: "HCLTECH.NS" },
        { name: "HDFC Bank", symbol: "HDFCBANK.NS" },
        { name: "Hero MotoCorp", symbol: "HEROMOTOCO.NS" },
        { name: "Hindalco", symbol: "HINDALCO.NS" },
        { name: "HUL", symbol: "HINDUNILVR.NS" },
        { name: "ICICI Bank", symbol: "ICICIBANK.NS" },
        { name: "IndusInd Bank", symbol: "INDUSINDBK.NS" },
        { name: "InfoEdge", symbol: "NAUKRI.NS" },
        { name: "Infosys", symbol: "INFY.NS" },
        { name: "ITC", symbol: "ITC.NS" },
        { name: "JSW Steel", symbol: "JSWSTEEL.NS" },
        { name: "Kotak Mahindra", symbol: "KOTAKBANK.NS" },
        { name: "L&T", symbol: "LT.NS" },
        { name: "M&M", symbol: "M&M.NS" },
        { name: "Maruti Suzuki", symbol: "MARUTI.NS" },
        { name: "Nestle India", symbol: "NESTLEIND.NS" },
        { name: "NTPC", symbol: "NTPC.NS" },
        { name: "ONGC", symbol: "ONGC.NS" },
        { name: "Power Grid", symbol: "POWERGRID.NS" },
        { name: "Reliance", symbol: "RELIANCE.NS" },
        { name: "SBI", symbol: "SBIN.NS" },
        { name: "SBI Life", symbol: "SBILIFE.NS" },
        { name: "Shree Cement", symbol: "SHREECEM.NS" },
        { name: "Sun Pharma", symbol: "SUNPHARMA.NS" },
        { name: "TCS", symbol: "TCS.NS" },
        { name: "Tata Consumer", symbol: "TATACONSUM.NS" },
        { name: "Tata Motors", symbol: "TATAMOTORS.NS" },
        { name: "Tata Steel", symbol: "TATASTEEL.NS" },
        { name: "Tech Mahindra", symbol: "TECHM.NS" },
        { name: "Titan", symbol: "TITAN.NS" },
        { name: "UltraTech Cement", symbol: "ULTRACEMCO.NS" },
        { name: "UPL", symbol: "UPL.NS" },
        { name: "Wipro", symbol: "WIPRO.NS" },
        { name: "Adani Green Energy", symbol: "ADANIGREEN.NS" },
        { name: "Zomato", symbol: "ZOMATO.NS" },
        { name: "Paytm", symbol: "PAYTM.NS" },
        { name: "LIC", symbol: "LICI.NS" },
        { name: "Adani Total Gas", symbol: "ATGL.NS" },
        { name: "Tata Chemicals", symbol: "TATACHEM.NS" },
        { name: "Godrej Consumer Products", symbol: "GODREJCP.NS" },
        { name: "Avenue Supermarts", symbol: "DMART.NS" },
        { name: "Torrent Pharma", symbol: "TORNTPHARM.NS" },
        { name: "Indian Hotels", symbol: "INDHOTEL.NS" },
        { name: "Trent", symbol: "TRENT.NS" },
        { name: "P&G Hygiene", symbol: "PGHH.NS" },
        { name: "United Spirits", symbol: "UNITDSPR.NS" },
        { name: "Varun Beverages", symbol: "VBL.NS" },
        { name: "JSW Energy", symbol: "JSWENERGY.NS" },
        { name: "Tata Elxsi", symbol: "TATAELXSI.NS" },
        { name: "MRF", symbol: "MRF.NS" },
        { name: "Page Industries", symbol: "PAGEIND.NS" },
        { name: "Coforge", symbol: "COFORGE.NS" },
        { name: "L&T Technology Services", symbol: "LTTS.NS" },
        { name: "Persistent Systems", symbol: "PERSISTENT.NS" },
        { name: "Birlasoft", symbol: "BSOFT.NS" },
        { name: "Mphasis", symbol: "MPHASIS.NS" },
        { name: "Happiest Minds", symbol: "HAPPSTMNDS.NS" },
        { name: "Route Mobile", symbol: "ROUTE.NS" },
        { name: "Tanla Platforms", symbol: "TANLA.NS" },
        { name: "Intellect Design", symbol: "INTELLECT.NS" },
        { name: "Zensar Technologies", symbol: "ZENSARTECH.NS" },
        { name: "Cyient", symbol: "CYIENT.NS" },
        { name: "Sonata Software", symbol: "SONATSOFTW.NS" },
        { name: "Mastek", symbol: "MASTEK.NS" },
        { name: "KPIT Technologies", symbol: "KPITTECH.NS" },
        { name: "Firstsource Solutions", symbol: "FSL.NS" },
        { name: "Affle India", symbol: "AFFLE.NS" },
        { name: "IndiaMART", symbol: "INDIAMART.NS" },
        { name: "Just Dial", symbol: "JUSTDIAL.NS" },
        { name: "Matrimony.com", symbol: "MATRIMONY.NS" },
        { name: "EaseMyTrip", symbol: "EASEMYTRIP.NS" },
        { name: "IRCTC", symbol: "IRCTC.NS" },
        { name: "Thomas Cook", symbol: "THOMASCOOK.NS" },
        { name: "Wonderla Holidays", symbol: "WONDERLA.NS" },
        { name: "Mahindra Holidays", symbol: "MHRIL.NS" },
        { name: "Lemon Tree Hotels", symbol: "LEMONTREE.NS" },
        { name: "EIH", symbol: "EIHOTEL.NS" },
        { name: "Chalet Hotels", symbol: "CHALET.NS" },
        { name: "Brigade Enterprises", symbol: "BRIGADE.NS" },
        { name: "Prestige Estates", symbol: "PRESTIGE.NS" },
        { name: "Sobha", symbol: "SOBHA.NS" },
        { name: "Godrej Properties", symbol: "GODREJPROP.NS" },
        { name: "Oberoi Realty", symbol: "OBEROIRLTY.NS" },
        { name: "DLF", symbol: "DLF.NS" },
        { name: "Phoenix Mills", symbol: "PHOENIXLTD.NS" },
        { name: "Indiabulls Real Estate", symbol: "IBREALEST.NS" },
        { name: "Sunteck Realty", symbol: "SUNTECK.NS" },
        { name: "Kolte-Patil", symbol: "KOLTEPATIL.NS" },
        { name: "Puravankara", symbol: "PURVA.NS" },
        { name: "Mahindra Lifespace", symbol: "MAHLIFE.NS" },
        { name: "Arvind", symbol: "ARVIND.NS" },
        { name: "Raymond", symbol: "RAYMOND.NS" },
        { name: "Vardhman Textiles", symbol: "VTL.NS" },
        { name: "Trident", symbol: "TRIDENT.NS" },
        { name: "KPR Mill", symbol: "KPRMILL.NS" },
        { name: "Indo Count Industries", symbol: "ICIL.NS" },
        { name: "Himatsingka Seide", symbol: "HIMATSEIDE.NS" },
        { name: "Bombay Dyeing", symbol: "BOMDYEING.NS" },
        { name: "Garden Reach Shipbuilders", symbol: "GRSE.NS" },
        { name: "Cochin Shipyard", symbol: "COCHINSHIP.NS" },
        { name: "Mazagon Dock", symbol: "MAZDOCK.NS" },
        { name: "Reliance Naval", symbol: "RNAVAL.NS" },
        { name: "ABB India", symbol: "ABB.NS" },
        { name: "Bharat Electronics", symbol: "BEL.NS" },
        { name: "Bharat Dynamics", symbol: "BDL.NS" },
        { name: "HAL", symbol: "HAL.NS" },
        { name: "BEML", symbol: "BEML.NS" },
        { name: "Mishra Dhatu Nigam", symbol: "MIDHANI.NS" },
        { name: "Solar Industries", symbol: "SOLARINDS.NS" },
        { name: "Premier Explosives", symbol: "PREMEXPLN.NS" },
        { name: "Astra Microwave", symbol: "ASTRAMICRO.NS" },
        { name: "Paras Defence", symbol: "PARAS.NS" },
        { name: "Data Patterns", symbol: "DATAPATTNS.NS" },
        { name: "Zen Technologies", symbol: "ZENTEC.NS" },
        { name: "Taneja Aerospace", symbol: "TAJGVK.NS" },
        { name: "Dynamatic Technologies", symbol: "DYNAMATECH.NS" },
        { name: "MTAR Technologies", symbol: "MTARTECH.NS" },
        { name: "Hindustan Copper", symbol: "HINDCOPPER.NS" },
        { name: "National Aluminium", symbol: "NATIONALUM.NS" },
        { name: "NMDC", symbol: "NMDC.NS" },
        { name: "MOIL", symbol: "MOIL.NS" },
        { name: "Gujarat Mineral", symbol: "GMDCLTD.NS" },
        { name: "Vedanta Limited", symbol: "VEDL.NS" },
        { name: "Hindustan Zinc", symbol: "HINDZINC.NS" },
        { name: "Tata Metaliks", symbol: "TATAMETALI.NS" },
        { name: "Ratnamani Metals", symbol: "RATNAMANI.NS" },
        { name: "Jindal Saw", symbol: "JINDALSAW.NS" },
        { name: "Welspun Corp", symbol: "WELCORP.NS" },
        { name: "Man Industries", symbol: "MANINDS.NS" },
        { name: "Maharashtra Seamless", symbol: "MAHSEAMLES.NS" },
        { name: "APL Apollo Tubes", symbol: "APLAPOLLO.NS" },
        { name: "Surya Roshni", symbol: "SURYAROSNI.NS" },
        { name: "Kirloskar Ferrous", symbol: "KIRLFER.NS" },
        { name: "Jai Balaji Industries", symbol: "JAIBALAJI.NS" },
        { name: "Kalyani Steels", symbol: "KSL.NS" },
        { name: "Sunflag Iron", symbol: "SUNFLAG.NS" },
        { name: "Vardhman Special Steels", symbol: "VSSL.NS" },
        { name: "Ramkrishna Forgings", symbol: "RKFORGE.NS" },
        { name: "MM Forgings", symbol: "MMFL.NS" },
        { name: "Bharat Forge", symbol: "BHARATFORG.NS" },
        { name: "Exide Industries", symbol: "EXIDEIND.NS" },
        { name: "Uflex", symbol: "UFLEX.NS" },
        { name: "Jindal Poly Films", symbol: "JINDALPOLY.NS" },
        { name: "Garware Technical Fibres", symbol: "GARFIBRES.NS" },
        { name: "SRF Limited", symbol: "SRF.NS" },
        { name: "Time Technoplast", symbol: "TIMETECHNO.NS" },
        { name: "Nilkamal", symbol: "NILKAMAL.NS" },
        { name: "VIP Industries", symbol: "VIPIND.NS" },
        { name: "Safari Industries", symbol: "SAFARI.NS" },
        { name: "Cello World", symbol: "CELLO.NS" },
        { name: "La Opala", symbol: "LAOPALA.NS" },
        { name: "TTK Prestige", symbol: "TTKPRESTIG.NS" },
        { name: "Butterfly Gandhimathi", symbol: "BUTTERFLY.NS" },
        { name: "Bajaj Electricals", symbol: "BAJAJELEC.NS" },
        { name: "Crompton Greaves Consumer", symbol: "CROMPTON.NS" },
        { name: "Orient Electric", symbol: "ORIENTELEC.NS" },
        { name: "V-Guard Industries", symbol: "VGUARD.NS" },
        { name: "Havells India", symbol: "HAVELLS.NS" },
        { name: "Polycab India", symbol: "POLYCAB.NS" },
        { name: "KEI Industries", symbol: "KEI.NS" },
        { name: "Finolex Cables", symbol: "FINCABLES.NS" },
        { name: "RR Kabel", symbol: "RRKABEL.NS" },
        { name: "Universal Cables", symbol: "UNIVCABLES.NS" },
        { name: "HPL Electric", symbol: "HPL.NS" },
        { name: "Indo Tech Transformers", symbol: "INDOTECH.NS" },
        { name: "Voltamp Transformers", symbol: "VOLTAMP.NS" },
        { name: "Genus Power", symbol: "GENUSPOWER.NS" },
        { name: "Control Print", symbol: "CONTROLPR.NS" }
    ];

    const niftyNext50Stocks = [
        { name: "Abbott India", symbol: "ABBOTINDIA.NS" },
        { name: "Adani Green Energy", symbol: "ADANIGREEN.NS" },
        { name: "Adani Total Gas", symbol: "ATGL.NS" },
        { name: "Adani Wilmar", symbol: "AWL.NS" },
        { name: "Ambuja Cements", symbol: "AMBUJACEM.NS" },
        { name: "Apollo Hospitals", symbol: "APOLLOHOSP.NS" },
        { name: "Ashok Leyland", symbol: "ASHOKLEY.NS" },
        { name: "AU Small Finance Bank", symbol: "AUBANK.NS" },
        { name: "Avenue Supermarts", symbol: "DMART.NS" },
        { name: "Bajaj Holdings", symbol: "BAJAJHLDNG.NS" },
        { name: "Balkrishna Industries", symbol: "BALKRISIND.NS" },
        { name: "Bandhan Bank", symbol: "BANDHANBNK.NS" },
        { name: "Bata India", symbol: "BATAINDIA.NS" },
        { name: "Berger Paints", symbol: "BERGEPAINT.NS" },
        { name: "Bharat Electronics", symbol: "BEL.NS" },
        { name: "Bharat Forge", symbol: "BHARATFORG.NS" },
        { name: "Biocon", symbol: "BIOCON.NS" },
        { name: "Bosch", symbol: "BOSCHLTD.NS" },
        { name: "Cholamandalam Investment", symbol: "CHOLAFIN.NS" },
        { name: "Colgate Palmolive", symbol: "COLPAL.NS" },
        { name: "Container Corporation", symbol: "CONCOR.NS" },
        { name: "Dabur India", symbol: "DABUR.NS" },
        { name: "Dalmia Bharat", symbol: "DALBHARAT.NS" },
        { name: "DLF", symbol: "DLF.NS" },
        { name: "Federal Bank", symbol: "FEDERALBNK.NS" },
        { name: "Godrej Consumer Products", symbol: "GODREJCP.NS" },
        { name: "Godrej Properties", symbol: "GODREJPROP.NS" },
        { name: "Havells India", symbol: "HAVELLS.NS" },
        { name: "HDFC Asset Management", symbol: "HDFCAMC.NS" },
        { name: "HDFC Life Insurance", symbol: "HDFCLIFE.NS" },
        { name: "ICICI Lombard", symbol: "ICICIGI.NS" },
        { name: "ICICI Prudential Life", symbol: "ICICIPRULI.NS" },
        { name: "Indian Hotels", symbol: "INDHOTEL.NS" },
        { name: "Indian Railway Catering", symbol: "IRCTC.NS" },
        { name: "Indus Towers", symbol: "INDUSTOWER.NS" },
        { name: "Info Edge", symbol: "NAUKRI.NS" },
        { name: "LIC Housing Finance", symbol: "LICHSGFIN.NS" },
        { name: "LTIMindtree", symbol: "LTIM.NS" },
        { name: "Lupin", symbol: "LUPIN.NS" },
        { name: "Marico", symbol: "MARICO.NS" },
        { name: "Muthoot Finance", symbol: "MUTHOOTFIN.NS" },
        { name: "Pidilite Industries", symbol: "PIDILITIND.NS" },
        { name: "Procter & Gamble Hygiene", symbol: "PGHH.NS" },
        { name: "SBI Cards", symbol: "SBICARD.NS" },
        { name: "Siemens", symbol: "SIEMENS.NS" },
        { name: "SRF", symbol: "SRF.NS" },
        { name: "Tata Power", symbol: "TATAPOWER.NS" },
        { name: "Zydus Lifesciences", symbol: "ZYDUSLIFE.NS" },
        { name: "Nykaa", symbol: "NYKAA.NS" },
        { name: "PB Fintech", symbol: "POLICYBZR.NS" },
        { name: "Delhivery", symbol: "DELHIVERY.NS" },
        { name: "Vedanta", symbol: "VEDL.NS" },
        { name: "Aditya Birla Fashion", symbol: "ABFRL.NS" },
        { name: "Ajanta Pharma", symbol: "AJANTPHARM.NS" },
        { name: "Alkem Laboratories", symbol: "ALKEM.NS" },
        { name: "Amara Raja Energy", symbol: "ARE&M.NS" },
        { name: "APL Apollo", symbol: "APLAPOLLO.NS" },
        { name: "Astral", symbol: "ASTRAL.NS" },
        { name: "Bank of Baroda", symbol: "BANKBARODA.NS" },
        { name: "Bank of India", symbol: "BANKINDIA.NS" },
        { name: "Bank of Maharashtra", symbol: "MAHABANK.NS" },
        { name: "Bharat Heavy Electricals", symbol: "BHEL.NS" },
        { name: "Blue Star", symbol: "BLUESTARCO.NS" },
        { name: "Canara Bank", symbol: "CANBK.NS" },
        { name: "Castrol India", symbol: "CASTROLIND.NS" },
        { name: "Central Bank of India", symbol: "CENTRALBK.NS" },
        { name: "Century Plyboards", symbol: "CENTURYPLY.NS" },
        { name: "CESC", symbol: "CESC.NS" },
        { name: "Chambal Fertilizers", symbol: "CHAMBLFERT.NS" },
        { name: "Chennai Petroleum", symbol: "CHENNPETRO.NS" },
        { name: "Cholamandalam Financial", symbol: "CHOLAHLDNG.NS" },
        { name: "City Union Bank", symbol: "CUB.NS" },
        { name: "Coal India Limited", symbol: "COALINDIA.NS" },
        { name: "Cochin Shipyard", symbol: "COCHINSHIP.NS" },
        { name: "Coromandel International", symbol: "COROMANDEL.NS" },
        { name: "CreditAccess Grameen", symbol: "CREDITACC.NS" },
        { name: "Crisil", symbol: "CRISIL.NS" },
        { name: "CSB Bank", symbol: "CSBBANK.NS" },
        { name: "Cummins India", symbol: "CUMMINSIND.NS" },
        { name: "Cyient", symbol: "CYIENT.NS" },
        { name: "DB Corp", symbol: "DBCORP.NS" },
        { name: "DCB Bank", symbol: "DCBBANK.NS" },
        { name: "DCM Shriram", symbol: "DCMSHRIRAM.NS" },
        { name: "Deepak Fertilizers", symbol: "DEEPAKFERT.NS" },
        { name: "Deepak Nitrite", symbol: "DEEPAKNTR.NS" },
        { name: "Delta Corp", symbol: "DELTACORP.NS" },
        { name: "Dhani Services", symbol: "DHANI.NS" },
        { name: "Dilip Buildcon", symbol: "DBL.NS" },
        { name: "Dish TV", symbol: "DISHTV.NS" },
        { name: "Dixon Technologies", symbol: "DIXON.NS" },
        { name: "Dr Lal PathLabs", symbol: "LALPATHLAB.NS" },
        { name: "E.I.D. Parry", symbol: "EIDPARRY.NS" },
        { name: "eClerx Services", symbol: "ECLERX.NS" },
        { name: "Edelweiss Financial", symbol: "EDELWEISS.NS" },
        { name: "EIH Associated Hotels", symbol: "EIHAHOTELS.NS" },
        { name: "Elgi Equipments", symbol: "ELGIEQUIP.NS" },
        { name: "Emami", symbol: "EMAMILTD.NS" },
        { name: "Embassy Office Parks", symbol: "EMBASSY.NS" },
        { name: "Endurance Technologies", symbol: "ENDURANCE.NS" },
        { name: "Engineers India", symbol: "ENGINERSIN.NS" },
        { name: "Entertainment Network", symbol: "ENIL.NS" },
        { name: "EPL", symbol: "EPL.NS" },
        { name: "Equitas Holdings", symbol: "EQUITASBNK.NS" },
        { name: "Eris Lifesciences", symbol: "ERIS.NS" },
        { name: "Escorts Kubota", symbol: "ESCORTS.NS" },
        { name: "Essar Shipping", symbol: "ESSARSHPNG.NS" },
        { name: "Eveready Industries", symbol: "EVEREADY.NS" },
        { name: "Fertilizers & Chemicals", symbol: "FACT.NS" },
        { name: "Fine Organic Industries", symbol: "FINEORG.NS" },
        { name: "Finolex Industries", symbol: "FINPIPE.NS" },
        { name: "Firstsource Solutions", symbol: "FSL.NS" },
        { name: "FDC", symbol: "FDC.NS" },
        { name: "Future Consumer", symbol: "FCONSUMER.NS" },
        { name: "Future Lifestyle", symbol: "FLFL.NS" },
        { name: "Future Market Networks", symbol: "FMNL.NS" },
        { name: "Future Retail", symbol: "FRETAIL.NS" },
        { name: "Future Supply Chain", symbol: "FSC.NS" },
        { name: "GAIL India", symbol: "GAIL.NS" },
        { name: "Galaxy Surfactants", symbol: "GALAXYSURF.NS" },
        { name: "Garware Technical", symbol: "GARFIBRES.NS" },
        { name: "General Insurance Corp", symbol: "GICRE.NS" },
        { name: "Glenmark Pharmaceuticals", symbol: "GLENMARK.NS" },
        { name: "GMM Pfaudler", symbol: "GMMPFAUDLR.NS" },
        { name: "GNA Axles", symbol: "GNA.NS" },
        { name: "Godfrey Phillips", symbol: "GODFRYPHLP.NS" },
        { name: "Godrej Industries", symbol: "GODREJIND.NS" },
        { name: "Goodyear India", symbol: "GOODYEAR.NS" },
        { name: "Granules India", symbol: "GRANULES.NS" },
        { name: "Graphite India", symbol: "GRAPHITE.NS" },
        { name: "Great Eastern Shipping", symbol: "GESHIP.NS" },
        { name: "Greaves Cotton", symbol: "GREAVESCOT.NS" },
        { name: "Greenpanel Industries", symbol: "GREENPANEL.NS" },
        { name: "Grindwell Norton", symbol: "GRINDWELL.NS" },
        { name: "Gujarat Alkalies", symbol: "GUJALKALI.NS" },
        { name: "Gujarat Gas", symbol: "GUJGASLTD.NS" },
        { name: "Gujarat Narmada Valley", symbol: "GNFC.NS" },
        { name: "Gujarat Pipavav Port", symbol: "GPPL.NS" },
        { name: "Gujarat State Fertilizers", symbol: "GSFC.NS" },
        { name: "Gujarat State Petronet", symbol: "GSPL.NS" },
        { name: "Gulf Oil Lubricants", symbol: "GULFOILLUB.NS" },
        { name: "H.E.G.", symbol: "HEG.NS" },
        { name: "Happiest Minds Tech", symbol: "HAPPSTMNDS.NS" },
        { name: "Hathway Cable", symbol: "HATHWAY.NS" },
        { name: "HCL Technologies", symbol: "HCLTECH.NS" },
        { name: "Heritage Foods", symbol: "HERITGFOOD.NS" },
        { name: "HFCL", symbol: "HFCL.NS" },
        { name: "Hikal", symbol: "HIKAL.NS" },
        { name: "Hindustan Aeronautics", symbol: "HAL.NS" },
        { name: "Hindustan Petroleum", symbol: "HINDPETRO.NS" },
        { name: "Hindustan Unilever", symbol: "HINDUNILVR.NS" },
        { name: "Hindalco Industries", symbol: "HINDALCO.NS" },
        { name: "HLE Glascoat", symbol: "HLEGLAS.NS" },
        { name: "Home First Finance", symbol: "HOMEFIRST.NS" },
        { name: "Honeywell Automation", symbol: "HONAUT.NS" },
        { name: "Housing & Urban Dev", symbol: "HUDCO.NS" },
        { name: "ICICI Securities", symbol: "ISEC.NS" },
        { name: "ICRA", symbol: "ICRA.NS" },
        { name: "IDBI Bank", symbol: "IDBI.NS" },
        { name: "IDFC First Bank", symbol: "IDFCFIRSTB.NS" },
        { name: "IEX", symbol: "IEX.NS" },
        { name: "IFCI", symbol: "IFCI.NS" },
        { name: "IFB Industries", symbol: "IFBIND.NS" },
        { name: "IIFL Finance", symbol: "IIFL.NS" },
        { name: "India Cements", symbol: "INDIACEM.NS" },
        { name: "India Grid Trust", symbol: "INDIGRID.NS" },
        { name: "Indian Bank", symbol: "INDIANB.NS" },
        { name: "Indian Overseas Bank", symbol: "IOB.NS" },
        { name: "Indian Railway Finance", symbol: "IRFC.NS" },
        { name: "Indigo Paints", symbol: "INDIGOPNTS.NS" },
        { name: "Indo Count Industries", symbol: "ICIL.NS" },
        { name: "Indoco Remedies", symbol: "INDOCO.NS" },
        { name: "IndoStar Capital", symbol: "INDOSTAR.NS" },
        { name: "Indraprastha Gas", symbol: "IGL.NS" },
        { name: "IndusInd Bank", symbol: "INDUSINDBK.NS" },
        { name: "Infibeam Avenues", symbol: "INFIBEAM.NS" },
        { name: "Ingersoll Rand", symbol: "INGERRAND.NS" },
        { name: "Intellect Design Arena", symbol: "INTELLECT.NS" },
        { name: "InterGlobe Aviation", symbol: "INDIGO.NS" },
        { name: "Ion Exchange", symbol: "IONEXCHANG.NS" }
    ];

    // Full Nifty Midcap 150 stock list
    const niftyMidcap150Stocks = [
        { name: "Aditya Birla Capital", symbol: "ABCAPITAL.NS" },
        { name: "Aarti Industries", symbol: "AARTIIND.NS" },
        { name: "Abbott India", symbol: "ABBOTINDIA.NS" },
        { name: "Adani Power", symbol: "ADANIPOWER.NS" },
        { name: "Ajanta Pharma", symbol: "AJANTPHARM.NS" },
        { name: "Alkem Laboratories", symbol: "ALKEM.NS" },
        { name: "APL Apollo Tubes", symbol: "APLAPOLLO.NS" },
        { name: "Aether Industries", symbol: "AETHER.NS" },
        { name: "Affle India", symbol: "AFFLE.NS" },
        { name: "Atul Ltd", symbol: "ATUL.NS" },
        { name: "Aurobindo Pharma", symbol: "AUROPHARMA.NS" },
        { name: "Astral Limited", symbol: "ASTRAL.NS" },
        { name: "Balkrishna Industries", symbol: "BALKRISIND.NS" },
        { name: "Bank of India", symbol: "BANKINDIA.NS" },
        { name: "Bharat Dynamics", symbol: "BDL.NS" },
        { name: "Bharat Electronics", symbol: "BEL.NS" },
        { name: "Bharat Heavy Electricals", symbol: "BHEL.NS" },
        { name: "Biocon", symbol: "BIOCON.NS" },
        { name: "Blue Dart Express", symbol: "BLUEDART.NS" },
        { name: "Bosch", symbol: "BOSCHLTD.NS" },
        { name: "Brigade Enterprises", symbol: "BRIGADE.NS" },
        { name: "Bata India", symbol: "BATAINDIA.NS" },
        { name: "Canara Bank", symbol: "CANBK.NS" },
        { name: "Cholamandalam Investment", symbol: "CHOLAFIN.NS" },
        { name: "City Union Bank", symbol: "CUB.NS" },
        { name: "CG Power and Industrial", symbol: "CGPOWER.NS" },
        { name: "Container Corporation", symbol: "CONCOR.NS" },
        { name: "Coforge", symbol: "COFORGE.NS" },
        { name: "Crompton Greaves Consumer", symbol: "CROMPTON.NS" },
        { name: "Cyient", symbol: "CYIENT.NS" },
        { name: "Deepak Nitrite", symbol: "DEEPAKNTR.NS" },
        { name: "Dhani Services", symbol: "DHANI.NS" },
        { name: "Dixon Technologies", symbol: "DIXON.NS" },
        { name: "Dr. Lal PathLabs", symbol: "LALPATHLAB.NS" },
        { name: "Emami", symbol: "EMAMILTD.NS" },
        { name: "Federal Bank", symbol: "FEDERALBNK.NS" },
        { name: "FSN E-Commerce (Nykaa)", symbol: "NYKAA.NS" },
        { name: "Fortis Healthcare", symbol: "FORTIS.NS" },
        { name: "Godrej Properties", symbol: "GODREJPROP.NS" },
        { name: "Gujarat Gas", symbol: "GUJGASLTD.NS" },
        { name: "Hindustan Aeronautics", symbol: "HAL.NS" },
        { name: "Havells India", symbol: "HAVELLS.NS" },
        { name: "HDFC Asset Management", symbol: "HDFCAMC.NS" },
        { name: "IDFC First Bank", symbol: "IDFCFIRSTB.NS" },
        { name: "India Cements", symbol: "INDIACEM.NS" },
        { name: "Indian Hotels Company", symbol: "INDHOTEL.NS" },
        { name: "IndiaMART InterMESH", symbol: "INDIAMART.NS" },
        { name: "Indian Railway Catering", symbol: "IRCTC.NS" },
        { name: "Indus Towers", symbol: "INDUSTOWER.NS" },
        { name: "Ipca Laboratories", symbol: "IPCALAB.NS" },
        { name: "IRCON International", symbol: "IRCON.NS" },
        { name: "JSW Energy", symbol: "JSWENERGY.NS" },
        { name: "Jubilant Foodworks", symbol: "JUBLFOOD.NS" },
        { name: "Kalyan Jewellers", symbol: "KALYANKJIL.NS" },
        { name: "Kansai Nerolac Paints", symbol: "KANSAINER.NS" },
        { name: "L&T Technology Services", symbol: "LTTS.NS" },
        { name: "Laurus Labs", symbol: "LAURUSLABS.NS" },
        { name: "LIC Housing Finance", symbol: "LICHSGFIN.NS" },
        { name: "Lupin", symbol: "LUPIN.NS" },
        { name: "MRF", symbol: "MRF.NS" },
        { name: "Manappuram Finance", symbol: "MANAPPURAM.NS" },
        { name: "Marico", symbol: "MARICO.NS" },
        { name: "Max Financial Services", symbol: "MFSL.NS" },
        { name: "MphasiS", symbol: "MPHASIS.NS" },
        { name: "Muthoot Finance", symbol: "MUTHOOTFIN.NS" },
        { name: "NBCC (India)", symbol: "NBCC.NS" },
        { name: "NHPC", symbol: "NHPC.NS" },
        { name: "NMDC", symbol: "NMDC.NS" },
        { name: "Oil India", symbol: "OIL.NS" },
        { name: "Page Industries", symbol: "PAGEIND.NS" },
        { name: "Petronet LNG", symbol: "PETRONET.NS" },
        { name: "PFC", symbol: "PFC.NS" },
        { name: "Prestige Estates Projects", symbol: "PRESTIGE.NS" },
        { name: "PVR Inox", symbol: "PVRINOX.NS" },
        { name: "REC", symbol: "RECLTD.NS" },
        { name: "Sundaram Finance", symbol: "SUNDARMFIN.NS" },
        { name: "Syngene International", symbol: "SYNGENE.NS" },
        { name: "Tata Chemicals", symbol: "TATACHEM.NS" },
        { name: "Tata Communications", symbol: "TATACOMM.NS" },
        { name: "Tata Elxsi", symbol: "TATAELXSI.NS" },
        { name: "TVS Motor Company", symbol: "TVSMOTOR.NS" },
        { name: "Torrent Power", symbol: "TORNTPOWER.NS" },
        { name: "Triveni Turbine", symbol: "TRITURBINE.NS" },
        { name: "UTI Asset Management", symbol: "UTIAMC.NS" },
        { name: "Vedanta", symbol: "VEDL.NS" },
        { name: "Voltas", symbol: "VOLTAS.NS" },
        { name: "Whirlpool of India", symbol: "WHIRLPOOL.NS" },
        { name: "Zydus Lifesciences", symbol: "ZYDUSLIFE.NS" },
        { name: "Zee Entertainment", symbol: "ZEEL.NS" },
        { name: "Adani Total Gas", symbol: "ATGL.NS" },
        { name: "Aditya Birla Fashion", symbol: "ABFRL.NS" },
        { name: "Apollo Tyres", symbol: "APOLLOTYRE.NS" },
        { name: "Ashok Leyland", symbol: "ASHOKLEY.NS" },
        { name: "AU Small Finance Bank", symbol: "AUBANK.NS" },
        { name: "Bandhan Bank", symbol: "BANDHANBNK.NS" },
        { name: "Berger Paints", symbol: "BERGEPAINT.NS" },
        { name: "Bharti Airtel", symbol: "BHARTIARTL.NS" },
        { name: "Bharat Forge", symbol: "BHARATFORG.NS" },
        { name: "Bombay Burmah Trading", symbol: "BBTC.NS" },
        { name: "Cummins India", symbol: "CUMMINSIND.NS" },
        { name: "Dabur India", symbol: "DABUR.NS" },
        { name: "Dalmia Bharat", symbol: "DALBHARAT.NS" },
        { name: "DLF", symbol: "DLF.NS" },
        { name: "Engineers India", symbol: "ENGINERSIN.NS" },
        { name: "Exide Industries", symbol: "EXIDEIND.NS" },
        { name: "Gujarat Fluorochemicals", symbol: "FLUOROCHEM.NS" },
        { name: "Godrej Agrovet", symbol: "GODREJAGRO.NS" },
        { name: "Godrej Consumer Products", symbol: "GODREJCP.NS" },
        { name: "Godrej Industries", symbol: "GODREJIND.NS" },
        { name: "Granules India", symbol: "GRANULES.NS" },
        { name: "Grindwell Norton", symbol: "GRINDWELL.NS" },
        { name: "ICICI Lombard", symbol: "ICICIGI.NS" },
        { name: "ICICI Prudential Life", symbol: "ICICIPRULI.NS" },
        { name: "Info Edge", symbol: "NAUKRI.NS" },
        { name: "Jindal Steel & Power", symbol: "JINDALSTEL.NS" },
        { name: "Jindal Stainless", symbol: "JSL.NS" },
        { name: "LTIMindtree", symbol: "LTIM.NS" },
        { name: "Mahindra & Mahindra Financial", symbol: "M&MFIN.NS" },
        { name: "Mazagon Dock Shipbuilders", symbol: "MAZDOCK.NS" },
        { name: "Oberoi Realty", symbol: "OBEROIRLTY.NS" },
        { name: "Phoenix Mills", symbol: "PHOENIXLTD.NS" },
        { name: "Pidilite Industries", symbol: "PIDILITIND.NS" },
        { name: "Polycab India", symbol: "POLYCAB.NS" },
        { name: "SBI Cards & Payment Services", symbol: "SBICARD.NS" },
        { name: "Siemens", symbol: "SIEMENS.NS" },
        { name: "SRF", symbol: "SRF.NS" },
        { name: "Tata Power", symbol: "TATAPOWER.NS" },
        { name: "Thermax", symbol: "THERMAX.NS" },
        { name: "Trent", symbol: "TRENT.NS" },
        { name: "United Breweries", symbol: "UBL.NS" },
        { name: "Union Bank of India", symbol: "UNIONBANK.NS" },
        { name: "Vodafone Idea", symbol: "IDEA.NS" },
        { name: "Bharat Petroleum", symbol: "BPCL.NS" },
        { name: "GAIL India", symbol: "GAIL.NS" },
        { name: "Hindustan Petroleum", symbol: "HINDPETRO.NS" },
        { name: "Indian Oil Corporation", symbol: "IOC.NS" },
        { name: "Shriram Finance", symbol: "SHRIRAMFIN.NS" },
        { name: "National Aluminium", symbol: "NATIONALUM.NS" },
        { name: "RBL Bank", symbol: "RBLBANK.NS" },
        { name: "Steel Authority of India", symbol: "SAIL.NS" },
        { name: "Sun TV Network", symbol: "SUNTV.NS" },
        { name: "Tata Teleservices", symbol: "TTML.NS" },
        { name: "Ambuja Cements", symbol: "AMBUJACEM.NS" },
        { name: "ACC Limited", symbol: "ACC.NS" },
        { name: "Alembic Pharmaceuticals", symbol: "APLLTD.NS" },
        { name: "Anand Rathi Wealth", symbol: "ANANDRATHI.NS" },
        { name: "Aster DM Healthcare", symbol: "ASTERDM.NS" },
        { name: "Astra Microwave", symbol: "ASTRAMICRO.NS" },
        { name: "Bajaj Consumer Care", symbol: "BAJAJCON.NS" },
        { name: "Bajaj Electricals", symbol: "BAJAJELEC.NS" },
        { name: "Balrampur Chini Mills", symbol: "BALRAMCHIN.NS" },
        { name: "Bank of Baroda", symbol: "BANKBARODA.NS" },
        { name: "Bank of Maharashtra", symbol: "MAHABANK.NS" },
        { name: "Bayer CropScience", symbol: "BAYERCROP.NS" },
        { name: "Blue Star", symbol: "BLUESTARCO.NS" },
        { name: "Bombay Dyeing", symbol: "BOMDYEING.NS" },
        { name: "Can Fin Homes", symbol: "CANFINHOME.NS" },
        { name: "Carborundum Universal", symbol: "CARBORUNIV.NS" },
        { name: "Castrol India", symbol: "CASTROLIND.NS" },
        { name: "CEAT", symbol: "CEATLTD.NS" },
        { name: "Century Plyboards", symbol: "CENTURYPLY.NS" },
        { name: "Chambal Fertilizers", symbol: "CHAMBLFERT.NS" },
        { name: "Chemplast Sanmar", symbol: "CHEMPLASTS.NS" },
        { name: "Chennai Petroleum", symbol: "CHENNPETRO.NS" },
        { name: "Clean Science Tech", symbol: "CLEAN.NS" },
        { name: "Computer Age Management", symbol: "CAMS.NS" },
        { name: "Coromandel International", symbol: "COROMANDEL.NS" },
        { name: "CSB Bank", symbol: "CSBBANK.NS" },
        { name: "Data Patterns", symbol: "DATAPATTNS.NS" },
        { name: "DCB Bank", symbol: "DCBBANK.NS" },
        { name: "Deepak Fertilizers", symbol: "DEEPAKFERT.NS" },
        { name: "Delta Corp", symbol: "DELTACORP.NS" },
        { name: "Delhivery", symbol: "DELHIVERY.NS" },
        { name: "Devyani International", symbol: "DEVYANI.NS" },
        { name: "Dhanuka Agritech", symbol: "DHANUKA.NS" },
        { name: "Divi's Laboratories", symbol: "DIVISLAB.NS" },
        { name: "eClerx Services", symbol: "ECLERX.NS" },
        { name: "EID Parry", symbol: "EIDPARRY.NS" },
        { name: "EIH Limited", symbol: "EIHOTEL.NS" },
        { name: "Elgi Equipments", symbol: "ELGIEQUIP.NS" },
        { name: "Endurance Technologies", symbol: "ENDURANCE.NS" },
        { name: "Equitas Small Finance", symbol: "EQUITASBNK.NS" },
        { name: "Escorts Kubota", symbol: "ESCORTS.NS" },
        { name: "Fine Organic Industries", symbol: "FINEORG.NS" },
        { name: "Finolex Cables", symbol: "FINCABLES.NS" },
        { name: "Finolex Industries", symbol: "FINPIPE.NS" },
        { name: "Firstsource Solutions", symbol: "FSL.NS" },
        { name: "FDC Limited", symbol: "FDC.NS" },
        { name: "Galaxy Surfactants", symbol: "GALAXYSURF.NS" },
        { name: "Garware Technical Fibres", symbol: "GARFIBRES.NS" },
        { name: "GHCL Limited", symbol: "GHCL.NS" },
        { name: "Gillette India", symbol: "GILLETTE.NS" },
        { name: "GMR Airports", symbol: "GMRAIRPORT.NS" },
        { name: "Go Fashion", symbol: "GOCOLORS.NS" },
        { name: "Godfrey Phillips", symbol: "GODFRYPHLP.NS" },
        { name: "Graphite India", symbol: "GRAPHITE.NS" },
        { name: "Great Eastern Shipping", symbol: "GESHIP.NS" },
        { name: "Greenpanel Industries", symbol: "GREENPANEL.NS" },
        { name: "Gujarat Alkalies", symbol: "GUJALKALI.NS" },
        { name: "Gujarat Pipavav Port", symbol: "GPPL.NS" },
        { name: "Gujarat State Petronet", symbol: "GSPL.NS" },
        { name: "Gulf Oil Lubricants", symbol: "GULFOILLUB.NS" },
        { name: "Happiest Minds", symbol: "HAPPSTMNDS.NS" },
        { name: "HCL Technologies", symbol: "HCLTECH.NS" },
        { name: "Heidelberg Cement", symbol: "HEIDELBERG.NS" },
        { name: "Heritage Foods", symbol: "HERITGFOOD.NS" },
        { name: "Himatsingka Seide", symbol: "HIMATSEIDE.NS" },
        { name: "Hindustan Copper", symbol: "HINDCOPPER.NS" },
        { name: "Hindustan Zinc", symbol: "HINDZINC.NS" },
        { name: "Hitachi Energy", symbol: "POWERINDIA.NS" },
        { name: "Home First Finance", symbol: "HOMEFIRST.NS" },
        { name: "Honeywell Automation", symbol: "HONAUT.NS" },
        { name: "Housing & Urban Dev", symbol: "HUDCO.NS" },
        { name: "IDBI Bank", symbol: "IDBI.NS" },
        { name: "India Grid Trust", symbol: "INDIGRID.NS" },
        { name: "Indian Bank", symbol: "INDIANB.NS" },
        { name: "Indian Energy Exchange", symbol: "IEX.NS" },
        { name: "Indoco Remedies", symbol: "INDOCO.NS" },
        { name: "Indraprastha Gas", symbol: "IGL.NS" },
        { name: "Infibeam Avenues", symbol: "INFIBEAM.NS" },
        { name: "Intellect Design", symbol: "INTELLECT.NS" },
        { name: "Interglobe Aviation", symbol: "INDIGO.NS" },
        { name: "IOL Chemicals", symbol: "IOLCP.NS" },
        { name: "IREDA", symbol: "IREDA.NS" },
        { name: "ITI Limited", symbol: "ITI.NS" },
        { name: "Jammu & Kashmir Bank", symbol: "J&KBANK.NS" },
        { name: "JBM Auto", symbol: "JBMA.NS" },
        { name: "Jindal Saw", symbol: "JINDALSAW.NS" },
        { name: "JK Cement", symbol: "JKCEMENT.NS" },
        { name: "JK Lakshmi Cement", symbol: "JKLAKSHMI.NS" },
        { name: "JK Paper", symbol: "JKPAPER.NS" },
        { name: "JK Tyre", symbol: "JKTYRE.NS" },
        { name: "JM Financial", symbol: "JMFINANCIL.NS" },
        { name: "JSW Infrastructure", symbol: "JSWINFRA.NS" },
        { name: "Jubilant Ingrevia", symbol: "JUBLINGREA.NS" },
        { name: "Justdial", symbol: "JUSTDIAL.NS" },
        { name: "Kajaria Ceramics", symbol: "KAJARIACER.NS" },
        { name: "Kalpataru Projects", symbol: "KPIL.NS" },
        { name: "Karnataka Bank", symbol: "KTKBANK.NS" },
        { name: "Karur Vysya Bank", symbol: "KARURVYSYA.NS" },
        { name: "KEC International", symbol: "KEC.NS" },
        { name: "KEI Industries", symbol: "KEI.NS" },
        { name: "Keystone Realtors", symbol: "RUSTOMJEE.NS" },
        { name: "Kiri Industries", symbol: "KIRIINDUS.NS" },
        { name: "KIOCL", symbol: "KIOCL.NS" },
        { name: "KRBL", symbol: "KRBL.NS" },
        { name: "KSB Limited", symbol: "KSB.NS" },
        { name: "La Opala RG", symbol: "LAOPALA.NS" },
        { name: "Laxmi Organic", symbol: "LXCHEM.NS" },
        { name: "Lemon Tree Hotels", symbol: "LEMONTREE.NS" },
        { name: "LIC India", symbol: "LICI.NS" },
        { name: "Linde India", symbol: "LINDEINDIA.NS" },
        { name: "Lloyds Metals", symbol: "LLOYDSME.NS" },
        { name: "Macrotech Developers", symbol: "LODHA.NS" },
        { name: "Mahanagar Gas", symbol: "MGL.NS" },
        { name: "Maharashtra Seamless", symbol: "MAHSEAMLES.NS" },
        { name: "Mahindra Holidays", symbol: "MHRIL.NS" },
        { name: "Mahindra Lifespace", symbol: "MAHLIFE.NS" },
        { name: "Mahindra Logistics", symbol: "MAHLOG.NS" },
        { name: "Mangalore Refinery", symbol: "MRPL.NS" },
        { name: "Metro Brands", symbol: "METROBRAND.NS" },
        { name: "Metropolis Healthcare", symbol: "METROPOLIS.NS" },
        { name: "Mishra Dhatu Nigam", symbol: "MIDHANI.NS" },
        { name: "MM Forgings", symbol: "MMFL.NS" },
        { name: "Modi Rubber", symbol: "MODIRUBBER.NS" },
        { name: "Mold-Tek Packaging", symbol: "MOLDTKPAC.NS" },
        { name: "Motilal Oswal Financial", symbol: "MOTILALOFS.NS" },
        { name: "Narayana Hrudayalaya", symbol: "NH.NS" },
        { name: "Navin Fluorine", symbol: "NAVINFLUOR.NS" },
        { name: "Nazara Technologies", symbol: "NAZARA.NS" },
        { name: "NCC Limited", symbol: "NCC.NS" },
        { name: "NESCO", symbol: "NESCO.NS" },
        { name: "Network18 Media", symbol: "NETWORK18.NS" },
        { name: "Nippon Life India", symbol: "NAM-INDIA.NS" },
        { name: "NOCIL", symbol: "NOCIL.NS" },
        { name: "Oracle Financial", symbol: "OFSS.NS" },
        { name: "Orient Cement", symbol: "ORIENTCEM.NS" },
        { name: "Orient Electric", symbol: "ORIENTELEC.NS" },
        { name: "Parag Milk Foods", symbol: "PARAGMILK.NS" },
        { name: "Patel Engineering", symbol: "PATELENG.NS" },
        { name: "PB Fintech", symbol: "POLICYBZR.NS" },
        { name: "PDS Limited", symbol: "PDSL.NS" },
        { name: "Pearl Global", symbol: "PGIL.NS" },
        { name: "PNC Infratech", symbol: "PNCINFRA.NS" },
        { name: "Poonawalla Fincorp", symbol: "POONAWALLA.NS" },
        { name: "Power Mech Projects", symbol: "POWERMECH.NS" },
        { name: "Praj Industries", symbol: "PRAJIND.NS" },
        { name: "Prince Pipes", symbol: "PRINCEPIPE.NS" },
        { name: "Prism Johnson", symbol: "PRSMJOHNSN.NS" },
        { name: "PSP Projects", symbol: "PSPPROJECT.NS" },
        { name: "Punjab National Bank", symbol: "PNB.NS" },
        { name: "Quess Corp", symbol: "QUESS.NS" },
        { name: "Radico Khaitan", symbol: "RADICO.NS" },
        { name: "Rain Industries", symbol: "RAIN.NS" },
        { name: "Rajesh Exports", symbol: "RAJESHEXPO.NS" },
        { name: "Rallis India", symbol: "RALLIS.NS" },
        { name: "Ramco Cements", symbol: "RAMCOCEM.NS" },
        { name: "Ramco Systems", symbol: "RAMCOSYS.NS" },
        { name: "Rashtriya Chemicals", symbol: "RCF.NS" },
        { name: "Ratnamani Metals", symbol: "RATNAMANI.NS" },
        { name: "Raymond", symbol: "RAYMOND.NS" },
        { name: "Redington Limited", symbol: "REDINGTON.NS" },
        { name: "Relaxo Footwears", symbol: "RELAXO.NS" },
        { name: "Reliance Power", symbol: "RPOWER.NS" },
        { name: "RITES", symbol: "RITES.NS" },
        { name: "Route Mobile", symbol: "ROUTE.NS" },
        { name: "RPSG Ventures", symbol: "RPSGVENT.NS" },
        { name: "Sanofi India", symbol: "SANOFI.NS" },
        { name: "Sapphire Foods", symbol: "SAPPHIRE.NS" },
        { name: "Saregama India", symbol: "SAREGAMA.NS" },
        { name: "Schaeffler India", symbol: "SCHAEFFLER.NS" },
        { name: "Sharda Cropchem", symbol: "SHARDACROP.NS" },
        { name: "Shilpa Medicare", symbol: "SHILPAMED.NS" },
        { name: "Shipping Corporation", symbol: "SCI.NS" },
        { name: "Shree Renuka Sugars", symbol: "RENUKA.NS" },
        { name: "Shyam Metalics", symbol: "SHYAMMETL.NS" },
        { name: "SJVN", symbol: "SJVN.NS" },
        { name: "SKF India", symbol: "SKFINDIA.NS" },
        { name: "Solar Industries", symbol: "SOLARINDS.NS" },
        { name: "Sona BLW Precision", symbol: "SONACOMS.NS" },
        { name: "South Indian Bank", symbol: "SOUTHBANK.NS" },
        { name: "Spicejet", symbol: "SPICEJET.NS" },
        { name: "Star Health Insurance", symbol: "STARHEALTH.NS" },
        { name: "State Bank of India", symbol: "SBIN.NS" },
        { name: "Sterling & Wilson", symbol: "SWSOLAR.NS" },
        { name: "Sterlite Technologies", symbol: "STLTECH.NS" },
        { name: "Sudarshan Chemical", symbol: "SUDARSCHEM.NS" },
        { name: "Sumitomo Chemical", symbol: "SUMICHEM.NS" },
        { name: "Sundaram-Clayton", symbol: "SUNDARMHLD.NS" },
        { name: "Suprajit Engineering", symbol: "SUPRAJIT.NS" },
        { name: "Supreme Industries", symbol: "SUPREMEIND.NS" },
        { name: "Suven Life Sciences", symbol: "SUVEN.NS" },
        { name: "Swan Energy", symbol: "SWANENERGY.NS" },
        { name: "Symphony", symbol: "SYMPHONY.NS" },
        { name: "Take Solutions", symbol: "TAKE.NS" },
        { name: "Tamil Nadu Newsprint", symbol: "TNPL.NS" },
        { name: "Tanla Platforms", symbol: "TANLA.NS" },
        { name: "Tata Investment", symbol: "TATAINVEST.NS" },
        { name: "Tata Metaliks", symbol: "TATAMETALI.NS" },
        { name: "TeamLease Services", symbol: "TEAMLEASE.NS" },
        { name: "Technocraft Industries", symbol: "TIIL.NS" },
        { name: "Tejas Networks", symbol: "TEJASNET.NS" },
        { name: "Thyrocare Technologies", symbol: "THYROCARE.NS" },
        { name: "Time Technoplast", symbol: "TIMETECHNO.NS" },
        { name: "Timken India", symbol: "TIMKEN.NS" },
        { name: "Tourism Finance", symbol: "TFCILTD.NS" },
        { name: "Transport Corporation", symbol: "TCI.NS" },
        { name: "Trident Limited", symbol: "TRIDENT.NS" },
        { name: "TTK Prestige", symbol: "TTKPRESTIG.NS" },
        { name: "Tube Investments", symbol: "TIINDIA.NS" },
        { name: "TV18 Broadcast", symbol: "TV18BRDCST.NS" },
        { name: "UCO Bank", symbol: "UCOBANK.NS" },
        { name: "Ujjivan Small Finance", symbol: "UJJIVANSFB.NS" },
        { name: "Ultratech Cement", symbol: "ULTRACEMCO.NS" },
        { name: "United Spirits", symbol: "UNITDSPR.NS" },
        { name: "Usha Martin", symbol: "USHAMART.NS" },
        { name: "Uttam Sugar Mills", symbol: "UTTAMSUGAR.NS" },
        { name: "V-Mart Retail", symbol: "VMART.NS" },
        { name: "Vaibhav Global", symbol: "VAIBHAVGBL.NS" },
        { name: "Vardhman Textiles", symbol: "VTL.NS" },
        { name: "Varun Beverages", symbol: "VBL.NS" },
        { name: "Venky's India", symbol: "VENKEYS.NS" },
        { name: "Venus Pipes", symbol: "VENUSPIPES.NS" },
        { name: "Vesuvius India", symbol: "VESUVIUS.NS" },
        { name: "Vijaya Diagnostic", symbol: "VIJAYA.NS" },
        { name: "Vinati Organics", symbol: "VINATIORGA.NS" },
        { name: "VIP Industries", symbol: "VIPIND.NS" },
        { name: "VST Industries", symbol: "VSTIND.NS" },
        { name: "Welspun Corp", symbol: "WELCORP.NS" },
        { name: "West Coast Paper", symbol: "WSTCSTPAPR.NS" },
        { name: "Westlife Foodworld", symbol: "WESTLIFE.NS" },
        { name: "Wonderla Holidays", symbol: "WONDERLA.NS" },
        { name: "Yes Bank", symbol: "YESBANK.NS" },
        { name: "Zee Learn", symbol: "ZEELEARN.NS" },
        { name: "Zee Media Corporation", symbol: "ZEEMEDIA.NS" },
        { name: "Zensar Technologies", symbol: "ZENSARTECH.NS" },
        { name: "Zomato", symbol: "ZOMATO.NS" },
        { name: "Zuari Agro Chemicals", symbol: "ZUARI.NS" },
        { name: "Persistent Systems", symbol: "PERSISTENT.NS" },
        { name: "Sonata Software", symbol: "SONATSOFTW.NS" },
        { name: "Rolta India", symbol: "ROLTA.NS" },
        { name: "Zen Technologies", symbol: "ZENTEC.NS" },
        { name: "KPIT Technologies", symbol: "KPITTECH.NS" },
        { name: "Mastek", symbol: "MASTEK.NS" },
        { name: "Birlasoft", symbol: "BSOFT.NS" },
        { name: "Newgen Software", symbol: "NEWGEN.NS" },
        { name: "Angel One", symbol: "ANGELONE.NS" },
        { name: "5paisa Capital", symbol: "5PAISA.NS" },
        { name: "IIFL Finance", symbol: "IIFL.NS" },
        { name: "Creditaccess Grameen", symbol: "CREDITACC.NS" },
        { name: "Spandana Sphoorty", symbol: "SPANDANA.NS" },
        { name: "Torrent Pharmaceuticals", symbol: "TORNTPHARM.NS" },
        { name: "Glenmark Pharmaceuticals", symbol: "GLENMARK.NS" },
        { name: "Mankind Pharma", symbol: "MANKIND.NS" },
        { name: "JB Chemicals", symbol: "JBCHEPHARM.NS" },
        { name: "Strides Pharma Science", symbol: "STAR.NS" },
        { name: "Natco Pharma", symbol: "NATCOPHARM.NS" },
        { name: "Dishman Carbogen Amcis", symbol: "DCAL.NS" },
        { name: "Neuland Laboratories", symbol: "NEULANDLAB.NS" },
        { name: "Orchid Pharma", symbol: "ORCHPHARMA.NS" },
        { name: "Patanjali Foods", symbol: "PATANJALI.NS" },
        { name: "Jyothy Labs", symbol: "JYOTHYLAB.NS" },
        { name: "Honasa Consumer", symbol: "HONASA.NS" },
        { name: "Prataap Snacks", symbol: "DIAMONDYD.NS" },
        { name: "Bikaji Foods", symbol: "BIKAJI.NS" },
        { name: "V-Guard Industries", symbol: "VGUARD.NS" },
        { name: "Sundram Fasteners", symbol: "SUNDRMFAST.NS" },
        { name: "Gabriel India", symbol: "GABRIEL.NS" },
        { name: "Samvardhana Motherson", symbol: "MOTHERSON.NS" },
        { name: "Uno Minda", symbol: "UNOMINDA.NS" },
        { name: "Varroc Engineering", symbol: "VARROC.NS" },
        { name: "Craftsman Automation", symbol: "CRAFTSMAN.NS" },
        { name: "Sandhar Technologies", symbol: "SANDHAR.NS" },
        { name: "Arvind", symbol: "ARVIND.NS" },
        { name: "KPR Mill", symbol: "KPRMILL.NS" },
        { name: "Sutlej Textiles", symbol: "SUTLEJTEX.NS" },
        { name: "MOIL", symbol: "MOIL.NS" },
        { name: "Sadbhav Engineering", symbol: "SADBHAV.NS" },
        { name: "KNR Constructions", symbol: "KNRCON.NS" },
        { name: "ITD Cementation", symbol: "ITDCEM.NS" },
        { name: "Ashoka Buildcon", symbol: "ASHOKA.NS" },
        { name: "HG Infra Engineering", symbol: "HGINFRA.NS" },
        { name: "Dilip Buildcon", symbol: "DBL.NS" },
        { name: "Capacite Infraprojects", symbol: "CAPACITE.NS" },
        { name: "GPT Infraprojects", symbol: "GPTINFRA.NS" },
        { name: "Welspun Enterprises", symbol: "WELENT.NS" },
        { name: "Rossari Biotech", symbol: "ROSSARI.NS" },
        { name: "Aarti Drugs", symbol: "AARTIDRUGS.NS" },
        { name: "Alkyl Amines Chemicals", symbol: "ALKYLAMINE.NS" },
        { name: "Sobha", symbol: "SOBHA.NS" },
        { name: "Puravankara", symbol: "PURVA.NS" },
        { name: "Kolte Patil", symbol: "KOLTEPATIL.NS" },
        { name: "Anant Raj", symbol: "ANANTRAJ.NS" },
        { name: "Sunteck Realty", symbol: "SUNTECK.NS" },
        { name: "Eldeco Housing", symbol: "ELDEHSG.NS" },
        { name: "Unitech", symbol: "UNITECH.NS" },
        { name: "Omaxe", symbol: "OMAXE.NS" },
        { name: "CESC", symbol: "CESC.NS" },
        { name: "India Power", symbol: "DPSCLTD.NS" },
        { name: "Orient Green Power", symbol: "GREENPOWER.NS" },
        { name: "Inox Wind", symbol: "INOXWIND.NS" },
        { name: "Suzlon Energy", symbol: "SUZLON.NS" },
        { name: "Websol Energy System", symbol: "WEBELSOLAR.NS" },
        { name: "Birla Corporation", symbol: "BIRLACORPN.NS" },
        { name: "Star Cement", symbol: "STARCEMENT.NS" },
        { name: "NCL Industries", symbol: "NCLIND.NS" },
        { name: "Sanghi Industries", symbol: "SANGHIIND.NS" },
        { name: "Chalet Hotels", symbol: "CHALET.NS" },
        { name: "Thomas Cook India", symbol: "THOMASCOOK.NS" },
        { name: "Country Club", symbol: "CCHHL.NS" },
        { name: "Sterling Holiday", symbol: "ORIENTHOT.NS" },
        { name: "Advani Hotels", symbol: "ADVANIHOTR.NS" },
        { name: "Asian Hotels", symbol: "ASIANHOTNR.NS" },
        { name: "Seshasayee Paper", symbol: "SESHAPAPER.NS" },
        { name: "Emami Paper Mills", symbol: "EMAMIPAP.NS" },
        { name: "Kuantum Papers", symbol: "KUANTUM.NS" },
        { name: "NR Agarwal Industries", symbol: "NRAIL.NS" },
        { name: "Andhra Paper", symbol: "ANDHRAPAP.NS" },
        { name: "Dhampur Sugar", symbol: "DHAMPURSUG.NS" },
        { name: "Dwarikesh Sugar", symbol: "DWARKESH.NS" },
        { name: "Triveni Engineering", symbol: "TRIVENI.NS" },
        { name: "Avadh Sugar", symbol: "AVADHSUGAR.NS" },
        { name: "Bajaj Hindusthan Sugar", symbol: "BAJAJHIND.NS" },
        { name: "Bannari Amman Sugars", symbol: "BANARISUG.NS" },
        { name: "DCM Shriram Industries", symbol: "DCMSRIND.NS" },
        { name: "Allcargo Logistics", symbol: "ALLCARGO.NS" },
        { name: "TCI Express", symbol: "TCIEXP.NS" },
        { name: "VRL Logistics", symbol: "VRLLOG.NS" },
        { name: "Snowman Logistics", symbol: "SNOWMAN.NS" },
        { name: "Future Supply Chain", symbol: "FSC.NS" },
        { name: "Dish TV India", symbol: "DISHTV.NS" },
        { name: "Hathway Cable", symbol: "HATHWAY.NS" },
        { name: "Den Networks", symbol: "DEN.NS" },
        { name: "FACT", symbol: "FACT.NS" },
        { name: "GSFC", symbol: "GSFC.NS" },
        { name: "Mangalore Chemicals", symbol: "MANGCHEFER.NS" },
        { name: "Nagarjuna Fertilizers", symbol: "NAGARFERT.NS" },
        { name: "National Fertilizers", symbol: "NFL.NS" },
        { name: "Paradeep Phosphates", symbol: "PARADEEP.NS" },
        { name: "Avenue Supermarts", symbol: "DMART.NS" },
        { name: "Shoppers Stop", symbol: "SHOPERSTOP.NS" },
        { name: "V2 Retail", symbol: "V2RETAIL.NS" },
        { name: "Future Lifestyle", symbol: "FLFL.NS" },
        { name: "Cantabil Retail", symbol: "CANTABIL.NS" },
        { name: "Vishal Fabrics", symbol: "VIPCLOTHNG.NS" },
        { name: "3i Infotech", symbol: "3IINFOLTD.NS" },
        { name: "Aurionpro Solutions", symbol: "AURIONPRO.NS" },
        { name: "Black Box", symbol: "BBOX.NS" },
        { name: "CyberTech Systems", symbol: "CYBERTECH.NS" },
        { name: "Datamatics Global", symbol: "DATAMATICS.NS" },
        { name: "Genesys International", symbol: "GENESYS.NS" },
        { name: "Bajaj Holdings", symbol: "BAJAJHLDNG.NS" },
        { name: "Capital First", symbol: "CAPF.NS" },
        { name: "Capital India Finance", symbol: "CAPLIPOINT.NS" },
        { name: "Centrum Capital", symbol: "CENTRUM.NS" },
        { name: "Choice International", symbol: "CHOICEIN.NS" },
        { name: "Dhanlaxmi Bank", symbol: "DHANBANK.NS" },
        { name: "Edelweiss Financial", symbol: "EDELWEISS.NS" },
        { name: "Automotive Axles", symbol: "AUTOAXLES.NS" },
        { name: "Banco Products", symbol: "BANCOINDIA.NS" },
        { name: "Bharat Gears", symbol: "BHARATGEAR.NS" },
        { name: "Federal-Mogul Goetze", symbol: "FMGOETZE.NS" },
        { name: "Fiem Industries", symbol: "FIEMIND.NS" },
        { name: "Jay Bharat Maruti", symbol: "JAYBARMARU.NS" },
        { name: "Lumax Auto Tech", symbol: "LUMAXTECH.NS" },
        { name: "Ahluwalia Contracts", symbol: "AHLUCONT.NS" },
        { name: "B L Kashyap", symbol: "BLKASHYAP.NS" },
        { name: "BGR Energy Systems", symbol: "BGRENERGY.NS" },
        { name: "Consolidated Construction", symbol: "CCCL.NS" },
        { name: "Era Infra Engineering", symbol: "EROSMEDIA.NS" },
        { name: "Gayatri Projects", symbol: "GAYAPROJ.NS" },
        { name: "IVRCL", symbol: "IVRCLINFRA.NS" },
        { name: "ADF Foods", symbol: "ADFFOODS.NS" },
        { name: "Agro Tech Foods", symbol: "ATFL.NS" },
        { name: "Capital Trust", symbol: "CAPTRUST.NS" },
        { name: "CCL Products", symbol: "CCL.NS" },
        { name: "Future Consumer", symbol: "FCONSUMER.NS" },
        { name: "Hind Rectifiers", symbol: "HIRECT.NS" },
        { name: "Apcotex Industries", symbol: "APCOTEXIND.NS" },
        { name: "Balaji Amines", symbol: "BALAMINES.NS" },
        { name: "Bhageria Industries", symbol: "BHAGERIA.NS" },
        { name: "Bodal Chemicals", symbol: "BODALCHEM.NS" },
        { name: "Camlin Fine Sciences", symbol: "CAMLINFINE.NS" },
        { name: "Fairchem Organics", symbol: "FCSSOFT.NS" },
        { name: "Fineotex Chemical", symbol: "FCL.NS" },
        { name: "Garware Polyester", symbol: "GARWALLROP.NS" },
        { name: "Ajmera Realty", symbol: "AJMERA.NS" },
        { name: "Ansal Properties", symbol: "ANSALAPI.NS" },
        { name: "Ashiana Housing", symbol: "ASHIANA.NS" },
        { name: "DB Realty", symbol: "DBREALTY.NS" },
        { name: "Embassy Office Parks REIT", symbol: "EMBASSY.NS" },
        { name: "Ganesh Housing", symbol: "GANESHHOUC.NS" },
        { name: "Housing Development", symbol: "HDIL.NS" },
        { name: "India Bulls Real Estate", symbol: "IBREALEST.NS" },
        { name: "Ashapura Minechem", symbol: "ASHAPURMIN.NS" },
        { name: "Bhushan Steel", symbol: "BHUSANSTL.NS" },
        { name: "Coal India", symbol: "COALINDIA.NS" }
    ];

    // Full FTSE 250 stock list
    const ftse250Stocks = [
        { name: "3i Infrastructure", symbol: "3IN.L" },
        { name: "Aberforth Smaller Companies Trust", symbol: "ASL.L" },
        { name: "Abrdn", symbol: "ABDN.L" },
        { name: "Abrdn European Logistics Income", symbol: "ASLI.L" },
        { name: "Airtel Africa", symbol: "AAF.L" },
        { name: "Allianz Technology Trust", symbol: "ATT.L" },
        { name: "Apax Global Alpha", symbol: "APAX.L" },
        { name: "Ashmore Group", symbol: "ASHM.L" },
        { name: "Aston Martin Lagonda", symbol: "AML.L" },
        { name: "AVI Global Trust", symbol: "AGT.L" },
        { name: "B&M European Value Retail", symbol: "BME.L" },
        { name: "Babcock International", symbol: "BAB.L" },
        { name: "Baillie Gifford Japan Trust", symbol: "BGFD.L" },
        { name: "Balanced Commercial Property Trust", symbol: "BCPT.L" },
        { name: "Baltic Classifieds Group", symbol: "BCG.L" },
        { name: "Bankers Investment Trust", symbol: "BNKR.L" },
        { name: "Bank of Georgia Group", symbol: "BGEO.L" },
        { name: "Beazley", symbol: "BEZ.L" },
        { name: "Bellway", symbol: "BWY.L" },
        { name: "Bellevue Healthcare Trust", symbol: "BBH.L" },
        { name: "Big Yellow Group", symbol: "BYG.L" },
        { name: "BlackRock Greater Europe Investment Trust", symbol: "BRGE.L" },
        { name: "BlackRock Smaller Companies Trust", symbol: "BRSC.L" },
        { name: "BlackRock Throgmorton Trust", symbol: "THRG.L" },
        { name: "BlackRock World Mining Trust", symbol: "BRWM.L" },
        { name: "Bodycote", symbol: "BOY.L" },
        { name: "Bridgepoint Group", symbol: "BPT.L" },
        { name: "BT Group", symbol: "BT-A.L" },
        { name: "Bytes Technology Group", symbol: "BYIT.L" },
        { name: "C&C Group", symbol: "CCR.L" },
        { name: "Caledonia Investments", symbol: "CLDN.L" },
        { name: "Capita", symbol: "CPI.L" },
        { name: "Capital Gearing Trust", symbol: "CGT.L" },
        { name: "Carnival Corporation & plc", symbol: "CCL.L" },
        { name: "Centrica", symbol: "CNA.L" },
        { name: "Chemring Group", symbol: "CHG.L" },
        { name: "City of London Investment Trust", symbol: "CTY.L" },
        { name: "Civitas Social Housing", symbol: "CSH.L" },
        { name: "Clarkson", symbol: "CKN.L" },
        { name: "Close Brothers Group", symbol: "CBG.L" },
        { name: "Coats Group", symbol: "COA.L" },
        { name: "Computacenter", symbol: "CCC.L" },
        { name: "Cranswick", symbol: "CWK.L" },
        { name: "Crest Nicholson Holdings", symbol: "CRST.L" },
        { name: "CVC Income & Growth", symbol: "CVCE.L" },
        { name: "Currys", symbol: "CURY.L" },
        { name: "Derwent London", symbol: "DLN.L" },
        { name: "Diploma", symbol: "DPLM.L" },
        { name: "Direct Line Insurance Group", symbol: "DLG.L" },
        { name: "Discoverie Group", symbol: "DSCV.L" },
        { name: "Domino's Pizza Group", symbol: "DOM.L" },
        { name: "Dr. Martens", symbol: "DOCS.L" },
        { name: "Drax Group", symbol: "DRX.L" },
        { name: "Dunelm Group", symbol: "DNLM.L" },
        { name: "easyJet", symbol: "EZJ.L" },
        { name: "Edinburgh Investment Trust", symbol: "EDIN.L" },
        { name: "Elementis", symbol: "ELM.L" },
        { name: "Empiric Student Property", symbol: "ESP.L" },
        { name: "Energean", symbol: "ENOG.L" },
        { name: "F&C Investment Trust", symbol: "FCIT.L" },
        { name: "FDM Group", symbol: "FDM.L" },
        { name: "Ferrexpo", symbol: "FXPO.L" },
        { name: "Fidelity China Special Situations", symbol: "FCSS.L" },
        { name: "Fidelity European Trust", symbol: "FEV.L" },
        { name: "Fidelity Special Values", symbol: "FSV.L" },
        { name: "Finsbury Growth & Income Trust", symbol: "FGT.L" },
        { name: "FirstGroup", symbol: "FGP.L" },
        { name: "FRP Advisory Group", symbol: "FRP.L" },
        { name: "Future", symbol: "FUTR.L" },
        { name: "Galliford Try Holdings", symbol: "GFRD.L" },
        { name: "Games Workshop Group", symbol: "GAW.L" },
        { name: "Genus", symbol: "GNS.L" },
        { name: "GCP Infrastructure Investments", symbol: "GCP.L" },
        { name: "Grafton Group", symbol: "GFTU.L" },
        { name: "Grainger", symbol: "GRI.L" },
        { name: "Greencoat UK Wind", symbol: "UKW.L" },
        { name: "Greggs", symbol: "GRG.L" },
        { name: "Gulf Keystone Petroleum", symbol: "GKP.L" },
        { name: "Hammerson", symbol: "HMSO.L" },
        { name: "Harbour Energy", symbol: "HBR.L" },
        { name: "Hays", symbol: "HAS.L" },
        { name: "Helios Towers", symbol: "HTWS.L" },
        { name: "Henderson Far East Income", symbol: "HFEL.L" },
        { name: "Henderson Smaller Companies Investment Trust", symbol: "HSL.L" },
        { name: "Hill & Smith Holdings", symbol: "HILS.L" },
        { name: "HICL Infrastructure", symbol: "HICL.L" },
        { name: "Hochschild Mining", symbol: "HOC.L" },
        { name: "Hollywood Bowl Group", symbol: "BOWL.L" },
        { name: "Howden Joinery Group", symbol: "HWDN.L" },
        { name: "HSS Hire Group", symbol: "HSS.L" },
        { name: "HSBC ETFS", symbol: "HMAF.L" },
        { name: "ICG Enterprise Trust", symbol: "ICGT.L" },
        { name: "IG Group Holdings", symbol: "IGG.L" },
        { name: "IMI", symbol: "IMI.L" },
        { name: "Impax Asset Management Group", symbol: "IPX.L" },
        { name: "Impax Environmental Markets", symbol: "IEM.L" },
        { name: "Imperial Brands", symbol: "IMB.L" },
        { name: "Indivior", symbol: "INDV.L" },
        { name: "Informa", symbol: "INF.L" },
        { name: "IntegraFin Holdings", symbol: "IHP.L" },
        { name: "International Public Partnerships", symbol: "INPP.L" },
        { name: "Investec", symbol: "INVP.L" },
        { name: "IP Group", symbol: "IPO.L" },
        { name: "ITV", symbol: "ITV.L" },
        { name: "IWG", symbol: "IWG.L" },
        { name: "JD Wetherspoon", symbol: "JDW.L" },
        { name: "Johnson Matthey", symbol: "JMAT.L" },
        { name: "JPMorgan American Investment Trust", symbol: "JAM.L" },
        { name: "JPMorgan Emerging Markets Investment Trust", symbol: "JMG.L" },
        { name: "JPMorgan European Discovery Trust", symbol: "JEDT.L" },
        { name: "JPMorgan Global Growth & Income", symbol: "JGGI.L" },
        { name: "JPMorgan Indian Investment Trust", symbol: "JII.L" },
        { name: "JPMorgan Japan Small Cap Growth & Income", symbol: "JSGI.L" },
        { name: "Jupiter Fund Management", symbol: "JUP.L" },
        { name: "Just Group", symbol: "JUST.L" },
        { name: "Kainos Group", symbol: "KNOS.L" },
        { name: "Keller Group", symbol: "KLR.L" },
        { name: "Kingfisher", symbol: "KGF.L" },
        { name: "Lancashire Holdings", symbol: "LRE.L" },
        { name: "Law Debenture Corporation", symbol: "LWDB.L" },
        { name: "LondonMetric Property", symbol: "LMP.L" },
        { name: "Marks & Spencer Group", symbol: "MKS.L" },
        { name: "Marston's", symbol: "MARS.L" },
        { name: "Merchants Trust", symbol: "MRCH.L" },
        { name: "Mercantile Investment Trust", symbol: "MRC.L" },
        { name: "Mitchells & Butlers", symbol: "MAB.L" },
        { name: "Mitie Group", symbol: "MTO.L" },
        { name: "Molten Ventures", symbol: "GROW.L" },
        { name: "Monks Investment Trust", symbol: "MNKS.L" },
        { name: "Morgan Advanced Materials", symbol: "MGAM.L" },
        { name: "Morgan Sindall Group", symbol: "MGNS.L" },
        { name: "Murray Income Trust", symbol: "MUT.L" },
        { name: "Murray International Trust", symbol: "MYI.L" },
        { name: "NB Private Equity Partners", symbol: "NBPE.L" },
        { name: "Ocean Wilsons Holdings", symbol: "OCN.L" },
        { name: "Oxford Instruments", symbol: "OXIG.L" },
        { name: "Pagegroup", symbol: "PAGE.L" },
        { name: "Palace Capital", symbol: "PCA.L" },
        { name: "PayPoint", symbol: "PAY.L" },
        { name: "Pennon Group", symbol: "PNN.L" },
        { name: "Petrofac", symbol: "PFC.L" },
        { name: "Phoenix Group Holdings", symbol: "PHNX.L" },
        { name: "Playtech", symbol: "PTEC.L" },
        { name: "PZ Cussons", symbol: "PZC.L" },
        { name: "QinetiQ Group", symbol: "QQ.L" },
        { name: "Rank Group", symbol: "RNK.L" },
        { name: "Rathbone Brothers", symbol: "RAT.L" },
        { name: "Renewables Infrastructure Group", symbol: "TRIG.L" },
        { name: "Riverstone Energy", symbol: "RSE.L" },
        { name: "Rotork", symbol: "ROR.L" },
        { name: "RWS Holdings", symbol: "RWS.L" },
        { name: "Sabre Insurance Group", symbol: "SBRE.L" },
        { name: "Savills", symbol: "SVS.L" },
        { name: "Schroder AsiaPacific Fund", symbol: "SDP.L" },
        { name: "Schroder Asia Total Return Investment Company", symbol: "ATR.L" },
        { name: "Schroder Income Growth Fund", symbol: "SCF.L" },
        { name: "Schroder Japan Growth Fund", symbol: "SJG.L" },
        { name: "Schroder Oriental Income Fund", symbol: "SOI.L" },
        { name: "Schroder UK Mid Cap Fund", symbol: "SCP.L" },
        { name: "Senior", symbol: "SNR.L" },
        { name: "Sequoia Economic Infrastructure Income Fund", symbol: "SEQI.L" },
        { name: "Serco Group", symbol: "SRP.L" },
        { name: "SIG", symbol: "SHI.L" },
        { name: "Smith & Nephew", symbol: "SN.L" },
        { name: "Smiths Group", symbol: "SMIN.L" },
        { name: "Softcat", symbol: "SCT.L" },
        { name: "Spectris", symbol: "SXS.L" },
        { name: "Spire Healthcare Group", symbol: "SPI.L" },
        { name: "SSP Group", symbol: "SSPG.L" },
        { name: "St. James's Place", symbol: "STJ.L" },
        { name: "Syncona", symbol: "SYNC.L" },
        { name: "Synthomer", symbol: "SYNT.L" },
        { name: "TBC Bank Group", symbol: "TBCG.L" },
        { name: "Telecom Plus", symbol: "TEP.L" },
        { name: "Temple Bar Investment Trust", symbol: "TMPL.L" },
        { name: "TI Fluid Systems", symbol: "TIFS.L" },
        { name: "TP ICAP Group", symbol: "TCAP.L" },
        { name: "TR Property Investment Trust", symbol: "TRY.L" },
        { name: "Trainline", symbol: "TRN.L" },
        { name: "Travis Perkins", symbol: "TPK.L" },
        { name: "Tritax Big Box REIT", symbol: "BBOX.L" },
        { name: "TrustPilot Group", symbol: "TRST.L" },
        { name: "Tullow Oil", symbol: "TLW.L" },
        { name: "Twentyfour Income Fund", symbol: "TFIF.L" },
        { name: "Utilico Emerging Markets Trust", symbol: "UEM.L" },
        { name: "Vesuvius", symbol: "VSVS.L" },
        { name: "Victrex", symbol: "VCT.L" },
        { name: "Vistry Group", symbol: "VTY.L" },
        { name: "Volution Group", symbol: "FAN.L" },
        { name: "W.A.G Payment Solutions", symbol: "WPS.L" },
        { name: "Watkin Jones", symbol: "WJG.L" },
        { name: "WH Smith", symbol: "SMWH.L" },
        { name: "Wizz Air Holdings", symbol: "WIZZ.L" },
        { name: "Wood Group", symbol: "WG.L" },
        { name: "Workspace Group", symbol: "WKP.L" },
        { name: "Worldwide Healthcare Trust", symbol: "WWH.L" },
        { name: "XP Power", symbol: "XPP.L" },
        { name: "Yellow Cake", symbol: "YCA.L" },
        { name: "Young & Co's Brewery", symbol: "YNGA.L" },
        { name: "Zotefoams", symbol: "ZTF.L" },
        { name: "Amigo Holdings", symbol: "AMGO.L" },
        { name: "AO World", symbol: "AO.L" },
        { name: "ASOS", symbol: "ASC.L" },
        { name: "Assura", symbol: "AGR.L" },
        { name: "Auto Trader Group", symbol: "AUTO.L" },
        { name: "Avon Protection", symbol: "AVON.L" },
        { name: "Bakkavor Group", symbol: "BAKK.L" },
        { name: "Balfour Beatty", symbol: "BBY.L" },
        { name: "Barr (A.G.)", symbol: "BAG.L" }
    ];

    const ftse100Stocks = [
        { name: "3i", symbol: "III.L" },
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
        { name: "Berkeley Group Holdings", symbol: "BKG.L" },
        { name: "BP", symbol: "BP.L" },
        { name: "British American Tobacco", symbol: "BATS.L" },
        { name: "British Land Company", symbol: "BLND.L" },
        { name: "BT Group", symbol: "BT-A.L" },
        { name: "Bunzl", symbol: "BNZL.L" },
        { name: "Burberry Group", symbol: "BRBY.L" },
        { name: "Coca-Cola HBC", symbol: "CCH.L" },
        { name: "Compass Group", symbol: "CPG.L" },
        { name: "CRH", symbol: "CRH.L" },
        { name: "Croda International", symbol: "CRDA.L" },
        { name: "DCC", symbol: "DCC.L" },
        { name: "Diageo", symbol: "DGE.L" },
        { name: "Entain", symbol: "ENT.L" },
        { name: "Experian", symbol: "EXPN.L" },
        { name: "Flutter Entertainment", symbol: "FLTR.L" },
        { name: "Frasers Group", symbol: "FRAS.L" },
        { name: "Fresnillo", symbol: "FRES.L" },
        { name: "GlaxoSmithKline", symbol: "GSK.L" },
        { name: "Glencore", symbol: "GLEN.L" },
        { name: "Halma", symbol: "HLMA.L" },
        { name: "HSBC Holdings", symbol: "HSBA.L" },
        { name: "Imperial Brands", symbol: "IMB.L" },
        { name: "Informa", symbol: "INF.L" },
        { name: "InterContinental Hotels Group", symbol: "IHG.L" },
        { name: "International Consolidated Airlines Group", symbol: "IAG.L" },
        { name: "Intertek Group", symbol: "ITRK.L" },
        { name: "JD Sports Fashion", symbol: "JD.L" },
        { name: "Johnson Matthey", symbol: "JMAT.L" },
        { name: "Kingfisher", symbol: "KGF.L" },
        { name: "Land Securities Group", symbol: "LAND.L" },
        { name: "Legal & General Group", symbol: "LGEN.L" },
        { name: "Lloyds Banking Group", symbol: "LLOY.L" },
        { name: "London Stock Exchange Group", symbol: "LSEG.L" },
        { name: "M&G", symbol: "MNG.L" },
        { name: "Melrose Industries", symbol: "MRO.L" },
        { name: "Mondi", symbol: "MNDI.L" },
        { name: "National Grid", symbol: "NG.L" },
        { name: "NatWest Group", symbol: "NWG.L" },
        { name: "Next", symbol: "NXT.L" },
        { name: "Ocado Group", symbol: "OCDO.L" },
        { name: "Pearson", symbol: "PSON.L" },
        { name: "Pershing Square Holdings", symbol: "PSH.L" },
        { name: "Persimmon", symbol: "PSN.L" },
        { name: "Phoenix Group Holdings", symbol: "PHNX.L" },
        { name: "Prudential", symbol: "PRU.L" },
        { name: "Reckitt Benckiser Group", symbol: "RKT.L" },
        { name: "RELX", symbol: "REL.L" },
        { name: "Rentokil Initial", symbol: "RTO.L" },
        { name: "Rio Tinto", symbol: "RIO.L" },
        { name: "Rolls-Royce Holdings", symbol: "RR.L" },
        { name: "RS Group", symbol: "RS1.L" },
        { name: "Sage Group", symbol: "SGE.L" },
        { name: "Sainsbury's", symbol: "SBRY.L" },
        { name: "Schroders", symbol: "SDR.L" },
        { name: "Scottish Mortgage Investment Trust", symbol: "SMT.L" },
        { name: "Segro", symbol: "SGRO.L" },
        { name: "Severn Trent", symbol: "SVT.L" },
        { name: "Shell", symbol: "SHEL.L" },
        { name: "Smith & Nephew", symbol: "SN.L" },
        { name: "Smiths Group", symbol: "SMIN.L" },
        { name: "Smurfit Kappa Group", symbol: "SKG.L" },
        { name: "Spirax-Sarco Engineering", symbol: "SPX.L" },
        { name: "SSE", symbol: "SSE.L" },
        { name: "St. James's Place", symbol: "STJ.L" },
        { name: "Standard Chartered", symbol: "STAN.L" },
        { name: "Taylor Wimpey", symbol: "TW.L" },
        { name: "Tesco", symbol: "TSCO.L" },
        { name: "Unilever", symbol: "ULVR.L" },
        { name: "United Utilities Group", symbol: "UU.L" },
        { name: "Vodafone Group", symbol: "VOD.L" },
        { name: "Weir Group", symbol: "WEIR.L" },
        { name: "Whitbread", symbol: "WTB.L" },
        { name: "WPP", symbol: "WPP.L" },
        { name: "Stellantis", symbol: "STLA" },
        { name: "Deliveroo", symbol: "ROO.L" },
        { name: "Wise", symbol: "WISE.L" },
        { name: "Haleon", symbol: "HLN.L" },
        { name: "THG", symbol: "THG.L" },
        { name: "Moonpig Group", symbol: "MOON.L" },
        { name: "Trustpilot", symbol: "TRST.L" },
        { name: "Dr. Martens", symbol: "DOCS.L" },
        { name: "Bridgepoint Group", symbol: "BPT.L" },
        { name: "Petershill Partners", symbol: "PHLL.L" },
        { name: "Oxford Nanopore", symbol: "ONT.L" },
        { name: "Alphawave IP", symbol: "AWE.L" },
        { name: "Auction Technology", symbol: "ATG.L" },
        { name: "Victorian Plumbing", symbol: "VIC.L" },
        { name: "Bytes Technology", symbol: "BYIT.L" },
        { name: "Kainos Group", symbol: "KNOS.L" },
        { name: "Frontier Developments", symbol: "FDEV.L" },
        { name: "GB Group", symbol: "GBG.L" },
        { name: "Gamma Communications", symbol: "GAMA.L" },
        { name: "FDM Group", symbol: "FDM.L" },
        { name: "Computacenter", symbol: "CCC.L" },
        { name: "Softcat", symbol: "SCT.L" },
        { name: "QinetiQ", symbol: "QQ.L" },
        { name: "Chemring", symbol: "CHG.L" },
        { name: "Senior", symbol: "SNR.L" },
        { name: "Bodycote", symbol: "BOY.L" },
        { name: "Vesuvius", symbol: "VSVS.L" },
        { name: "Morgan Advanced Materials", symbol: "MGAM.L" },
        { name: "Elementis", symbol: "ELM.L" },
        { name: "Victrex", symbol: "VCT.L" },
        { name: "Synthomer", symbol: "SYNT.L" },
        { name: "Ferrexpo", symbol: "FXPO.L" },
        { name: "Evraz", symbol: "EVR.L" },
        { name: "Hochschild Mining", symbol: "HOC.L" },
        { name: "Petrofac", symbol: "PFC.L" },
        { name: "Wood Group", symbol: "WG.L" },
        { name: "Hunting", symbol: "HTG.L" },
        { name: "Cairn Energy", symbol: "CNE.L" },
        { name: "Tullow Oil", symbol: "TLW.L" },
        { name: "EnQuest", symbol: "ENQ.L" },
        { name: "Diversified Energy", symbol: "DEC.L" },
        { name: "Energean", symbol: "ENOG.L" },
        { name: "Harbour Energy", symbol: "HBR.L" },
        { name: "Serica Energy", symbol: "SQZ.L" },
        { name: "Europa Oil & Gas", symbol: "EOG.L" },
        { name: "Sound Energy", symbol: "SOU.L" },
        { name: "88 Energy", symbol: "88E.L" },
        { name: "Everyman Media", symbol: "EMAN.L" },
        { name: "Hollywood Bowl", symbol: "BOWL.L" },
        { name: "The Gym Group", symbol: "GYM.L" },
        { name: "PureGym", symbol: "PGYM.L" },
        { name: "Halfords", symbol: "HFD.L" },
        { name: "Pets at Home", symbol: "PETS.L" },
        { name: "Card Factory", symbol: "CARD.L" },
        { name: "WH Smith", symbol: "SMWH.L" },
        { name: "Poundland", symbol: "PLND.L" },
        { name: "The Works", symbol: "WRKS.L" },
        { name: "Dunelm", symbol: "DNLM.L" },
        { name: "DFS Furniture", symbol: "DFS.L" },
        { name: "AO World", symbol: "AO.L" },
        { name: "Currys", symbol: "CURY.L" },
        { name: "House of Fraser", symbol: "HOF.L" },
        { name: "Matalan", symbol: "MTL.L" },
        { name: "Peacocks", symbol: "PEA.L" },
        { name: "New Look", symbol: "NEW.L" },
        { name: "Coast", symbol: "CST.L" },
        { name: "Whistles", symbol: "WSL.L" },
        { name: "Fat Face", symbol: "FAT.L" },
        { name: "Seasalt", symbol: "SALT.L" },
        { name: "Boden", symbol: "BOD.L" },
        { name: "Toast", symbol: "TST.L" },
        { name: "Phase Eight", symbol: "PHS.L" },
        { name: "Reiss", symbol: "REI.L" },
        { name: "All Saints", symbol: "ALL.L" },
        { name: "Austin Reed", symbol: "AR.L" },
        { name: "Church's", symbol: "CHU.L" },
        { name: "Grenson", symbol: "GRE.L" },
        { name: "Tricker's", symbol: "TRK.L" },
        { name: "Cheaney", symbol: "CHE.L" },
        { name: "Carmina", symbol: "CAR.L" }
    ];
    

const usStocks = [
        { name: "Apple", symbol: "AAPL" },
        { name: "Tesla", symbol: "TSLA" },
        { name: "AMD", symbol: "AMD" },
        { name: "NVIDIA", symbol: "NVDA" },
        { name: "Ford Motor Company", symbol: "F" },
        { name: "Bank of America", symbol: "BAC" },
        { name: "Intel", symbol: "INTC" },
        { name: "Amazon", symbol: "AMZN" },
        { name: "AT&T", symbol: "T" },
        { name: "Microsoft", symbol: "MSFT" },
        { name: "Lucid Group", symbol: "LCID" },
        { name: "Palantir Technologies", symbol: "PLTR" },
        { name: "Meta Platforms", symbol: "META" },
        { name: "Pfizer", symbol: "PFE" },
        { name: "Verizon", symbol: "VZ" },
        { name: "Snap Inc.", symbol: "SNAP" },
        { name: "Coca-Cola", symbol: "KO" },
        { name: "NIO Inc.", symbol: "NIO" },
        { name: "Alibaba Group", symbol: "BABA" },
        { name: "General Electric", symbol: "GE" },
        { name: "Carnival Corporation", symbol: "CCL" },
        { name: "GameStop", symbol: "GME" },
        { name: "Alphabet/Google", symbol: "GOOGL" },
        { name: "SPDR S&P 500 ETF", symbol: "SPY" },
        { name: "Citigroup", symbol: "C" },
        { name: "Norwegian Cruise Line", symbol: "NCLH" },
        { name: "Uber Technologies", symbol: "UBER" },
        { name: "Walt Disney", symbol: "DIS" },
        { name: "SoFi Technologies", symbol: "SOFI" },
        { name: "JPMorgan Chase", symbol: "JPM" },
        { name: "Marathon Digital", symbol: "MARA" },
        { name: "Coinbase", symbol: "COIN" },
        { name: "Wells Fargo", symbol: "WFC" },
        { name: "Exxon Mobil", symbol: "XOM" },
        { name: "Walmart", symbol: "WMT" },
        { name: "Robinhood Markets", symbol: "HOOD" },
        { name: "AMC Entertainment", symbol: "AMC" },
        { name: "Invesco QQQ Trust", symbol: "QQQ" },
        { name: "Micron Technology", symbol: "MU" },
        { name: "Rivian Automotive", symbol: "RIVN" },
        { name: "Johnson & Johnson", symbol: "JNJ" },
        { name: "Annaly Capital Management", symbol: "NLY" },
        { name: "ContextLogic", symbol: "WISH" },
        { name: "Delta Air Lines", symbol: "DAL" },
        { name: "United Airlines", symbol: "UAL" },
        { name: "Chevron Corporation", symbol: "CVX" },
        { name: "Visa", symbol: "V" },
        { name: "Petrobras", symbol: "PBR" },
        { name: "PayPal", symbol: "PYPL" },
        { name: "Boeing", symbol: "BA" },
        { name: "Adobe", symbol: "ADBE" },
        { name: "Salesforce", symbol: "CRM" },
        { name: "Oracle", symbol: "ORCL" },
        { name: "IBM", symbol: "IBM" },
        { name: "Qualcomm", symbol: "QCOM" },
        { name: "Texas Instruments", symbol: "TXN" },
        { name: "Broadcom", symbol: "AVGO" },
        { name: "Cisco Systems", symbol: "CSCO" },
        { name: "ServiceNow", symbol: "NOW" },
        { name: "Intuit", symbol: "INTU" },
        { name: "Accenture", symbol: "ACN" },
        { name: "Netflix", symbol: "NFLX" },
        { name: "Comcast", symbol: "CMCSA" },
        { name: "Charter Communications", symbol: "CHTR" },
        { name: "T-Mobile", symbol: "TMUS" },
        { name: "Electronic Arts", symbol: "EA" },
        { name: "Autodesk", symbol: "ADSK" },
        { name: "Analog Devices", symbol: "ADI" },
        { name: "Microchip Technology", symbol: "MCHP" },
        { name: "KLA Corporation", symbol: "KLAC" },
        { name: "Motorola Solutions", symbol: "MSI" },
        { name: "Synopsys", symbol: "SNPS" },
        { name: "UnitedHealth Group", symbol: "UNH" },
        { name: "Merck", symbol: "MRK" },
        { name: "AbbVie", symbol: "ABBV" },
        { name: "Eli Lilly", symbol: "LLY" },
        { name: "Bristol-Myers Squibb", symbol: "BMY" },
        { name: "Abbott Laboratories", symbol: "ABT" },
        { name: "Amgen", symbol: "AMGN" },
        { name: "Gilead Sciences", symbol: "GILD" },
        { name: "Moderna", symbol: "MRNA" },
        { name: "Thermo Fisher Scientific", symbol: "TMO" },
        { name: "Medtronic", symbol: "MDT" },
        { name: "Zoetis", symbol: "ZTS" },
        { name: "CVS Health", symbol: "CVS" },
        { name: "Cigna", symbol: "CI" },
        { name: "Regeneron Pharmaceuticals", symbol: "REGN" },
        { name: "Vertex Pharmaceuticals", symbol: "VRTX" },
        { name: "Illumina", symbol: "ILMN" },
        { name: "Biogen", symbol: "BIIB" },
        { name: "HCA Healthcare", symbol: "HCA" },
        { name: "Becton Dickinson", symbol: "BDX" },
        { name: "Berkshire Hathaway", symbol: "BRK-B" },
        { name: "Mastercard", symbol: "MA" },
        { name: "American Express", symbol: "AXP" },
        { name: "Morgan Stanley", symbol: "MS" },
        { name: "Goldman Sachs", symbol: "GS" },
        { name: "BlackRock", symbol: "BLK" },
        { name: "Charles Schwab", symbol: "SCHW" },
        { name: "PNC Financial Services", symbol: "PNC" },
        { name: "U.S. Bancorp", symbol: "USB" },
        { name: "Truist Financial", symbol: "TFC" },
        { name: "Bank of New York Mellon", symbol: "BK" },
        { name: "Capital One Financial", symbol: "COF" },
        { name: "State Street", symbol: "STT" },
        { name: "Synchrony Financial", symbol: "SYF" },
        { name: "Ameriprise Financial", symbol: "AMP" },
        { name: "Intercontinental Exchange", symbol: "ICE" },
        { name: "CME Group", symbol: "CME" },
        { name: "Progressive", symbol: "PGR" },
        { name: "Allstate", symbol: "ALL" },
        { name: "MetLife", symbol: "MET" },
        { name: "Chubb", symbol: "CB" },
        { name: "S&P Global", symbol: "SPGI" },
        { name: "Moody's", symbol: "MCO" },
        { name: "Procter & Gamble", symbol: "PG" },
        { name: "PepsiCo", symbol: "PEP" },
        { name: "Costco", symbol: "COST" },
        { name: "Home Depot", symbol: "HD" },
        { name: "Nike", symbol: "NKE" },
        { name: "Starbucks", symbol: "SBUX" },
        { name: "McDonald's", symbol: "MCD" },
        { name: "Target", symbol: "TGT" },
        { name: "Lowe's", symbol: "LOW" },
        { name: "Colgate-Palmolive", symbol: "CL" },
        { name: "Chipotle Mexican Grill", symbol: "CMG" },
        { name: "Estee Lauder", symbol: "EL" },
        { name: "Darden Restaurants", symbol: "DRI" },
        { name: "Dollar General", symbol: "DG" },
        { name: "eBay", symbol: "EBAY" },
        { name: "Expedia Group", symbol: "EXPE" },
        { name: "Hilton Worldwide", symbol: "HLT" },
        { name: "Marriott International", symbol: "MAR" },
        { name: "Mondelez International", symbol: "MDLZ" },
        { name: "Kraft Heinz", symbol: "KHC" },
        { name: "Altria Group", symbol: "MO" },
        { name: "Philip Morris International", symbol: "PM" },
        { name: "Kimberly-Clark", symbol: "KMB" },
        { name: "General Mills", symbol: "GIS" },
        { name: "Kellogg Company", symbol: "K" },
        { name: "ConocoPhillips", symbol: "COP" },
        { name: "Schlumberger", symbol: "SLB" },
        { name: "EOG Resources", symbol: "EOG" },
        { name: "NextEra Energy", symbol: "NEE" },
        { name: "Duke Energy", symbol: "DUK" },
        { name: "Southern Company", symbol: "SO" },
        { name: "Dominion Energy", symbol: "D" },
        { name: "Kinder Morgan", symbol: "KMI" },
        { name: "Phillips 66", symbol: "PSX" },
        { name: "Marathon Petroleum", symbol: "MPC" },
        { name: "Occidental Petroleum", symbol: "OXY" },
        { name: "Williams Companies", symbol: "WMB" },
        { name: "Devon Energy", symbol: "DVN" },
        { name: "Valero Energy", symbol: "VLO" },
        { name: "Exelon", symbol: "EXC" },
        { name: "American Electric Power", symbol: "AEP" },
        { name: "Public Service Enterprise Group", symbol: "PEG" },
        { name: "Sempra Energy", symbol: "SRE" },
        { name: "Union Pacific", symbol: "UNP" },
        { name: "Caterpillar", symbol: "CAT" },
        { name: "Honeywell", symbol: "HON" },
        { name: "Deere & Company", symbol: "DE" },
        { name: "Lockheed Martin", symbol: "LMT" },
        { name: "General Dynamics", symbol: "GD" },
        { name: "3M", symbol: "MMM" },
        { name: "Raytheon Technologies", symbol: "RTX" },
        { name: "FedEx", symbol: "FDX" },
        { name: "United Parcel Service", symbol: "UPS" },
        { name: "Emerson Electric", symbol: "EMR" },
        { name: "CSX", symbol: "CSX" },
        { name: "Norfolk Southern", symbol: "NSC" },
        { name: "Illinois Tool Works", symbol: "ITW" },
        { name: "Northrop Grumman", symbol: "NOC" },
        { name: "L3Harris Technologies", symbol: "LHX" },
        { name: "Eaton", symbol: "ETN" },
        { name: "Parker-Hannifin", symbol: "PH" },
        { name: "Cummins", symbol: "CMI" },
        { name: "Stanley Black & Decker", symbol: "SWK" },
        { name: "Otis Worldwide", symbol: "OTIS" },
        { name: "Carrier Global", symbol: "CARR" },
        { name: "Paccar", symbol: "PCAR" },
        { name: "Palo Alto Networks", symbol: "PANW" },
        { name: "Cloudflare", symbol: "NET" },
        { name: "Crowdstrike", symbol: "CRWD" },
        { name: "Datadog", symbol: "DDOG" },
        { name: "Zscaler", symbol: "ZS" },
        { name: "Fortinet", symbol: "FTNT" },
        { name: "Zoom Video", symbol: "ZM" },
        { name: "DocuSign", symbol: "DOCU" },
        { name: "MongoDB", symbol: "MDB" },
        { name: "Snowflake", symbol: "SNOW" },
        { name: "Workday", symbol: "WDAY" },
        { name: "Okta", symbol: "OKTA" },
        { name: "HubSpot", symbol: "HUBS" },
        { name: "Atlassian", symbol: "TEAM" },
        { name: "Twilio", symbol: "TWLO" },
        { name: "Pinterest", symbol: "PINS" },
        { name: "Shopify", symbol: "SHOP" },
        { name: "Trade Desk", symbol: "TTD" },
        { name: "Spotify", symbol: "SPOT" },
        { name: "Arista Networks", symbol: "ANET" },
        { name: "Cognizant Technology", symbol: "CTSH" },
        { name: "CDW", symbol: "CDW" },
        { name: "Akamai Technologies", symbol: "AKAM" },
        { name: "Juniper Networks", symbol: "JNPR" },
        { name: "GoDaddy", symbol: "GDDY" },
        { name: "Match Group", symbol: "MTCH" },
        { name: "Zillow Group", symbol: "Z" },
        { name: "Dropbox", symbol: "DBX" },
        { name: "Box", symbol: "BOX" },
        { name: "IQVIA Holdings", symbol: "IQV" },
        { name: "IDEXX Laboratories", symbol: "IDXX" },
        { name: "DexCom", symbol: "DXCM" },
        { name: "Exact Sciences", symbol: "EXAS" },
        { name: "Alnylam Pharmaceuticals", symbol: "ALNY" },
        { name: "Bio-Rad Laboratories", symbol: "BIO" },
        { name: "Insulet", symbol: "PODD" },
        { name: "Agilent Technologies", symbol: "A" },
        { name: "ResMed", symbol: "RMD" },
        { name: "Waters Corporation", symbol: "WAT" },
        { name: "Align Technology", symbol: "ALGN" },
        { name: "Mettler-Toledo", symbol: "MTD" },
        { name: "Incyte", symbol: "INCY" },
        { name: "Jazz Pharmaceuticals", symbol: "JAZZ" },
        { name: "STERIS", symbol: "STE" },
        { name: "Veeva Systems", symbol: "VEEV" },
        { name: "West Pharmaceutical", symbol: "WST" },
        { name: "Universal Health Services", symbol: "UHS" },
        { name: "Laboratory Corp of America", symbol: "LH" },
        { name: "Quest Diagnostics", symbol: "DGX" },
        { name: "Cooper Companies", symbol: "COO" },
        { name: "Bio-Techne", symbol: "TECH" },
        { name: "MarketAxess Holdings", symbol: "MKTX" },
        { name: "FactSet Research Systems", symbol: "FDS" },
        { name: "Cboe Global Markets", symbol: "CBOE" },
        { name: "Nasdaq", symbol: "NDAQ" },
        { name: "M&T Bank", symbol: "MTB" },
        { name: "Cincinnati Financial", symbol: "CINF" },
        { name: "Huntington Bancshares", symbol: "HBAN" },
        { name: "Citizens Financial Group", symbol: "CFG" },
        { name: "KeyCorp", symbol: "KEY" },
        { name: "Fifth Third Bancorp", symbol: "FITB" },
        { name: "Regions Financial", symbol: "RF" },
        { name: "Raymond James Financial", symbol: "RJF" },
        { name: "Comerica", symbol: "CMA" },
        { name: "Northern Trust", symbol: "NTRS" },
        { name: "T. Rowe Price", symbol: "TROW" },
        { name: "Franklin Resources", symbol: "BEN" },
        { name: "Invesco", symbol: "IVZ" },
        { name: "Hartford Financial", symbol: "HIG" },
        { name: "Lincoln National", symbol: "LNC" },
        { name: "Unum Group", symbol: "UNM" },
        { name: "Prudential Financial", symbol: "PRU" },
        { name: "Etsy", symbol: "ETSY" },
        { name: "Wayfair", symbol: "W" },
        { name: "Under Armour", symbol: "UAA" },
        { name: "Lululemon Athletica", symbol: "LULU" },
        { name: "Williams-Sonoma", symbol: "WSM" },
        { name: "Chewy", symbol: "CHWY" },
        { name: "Peloton", symbol: "PTON" },
        { name: "Ulta Beauty", symbol: "ULTA" },
        { name: "Bath & Body Works", symbol: "BBWI" },
        { name: "Dollar Tree", symbol: "DLTR" },
        { name: "Tractor Supply", symbol: "TSCO" },
        { name: "Domino's Pizza", symbol: "DPZ" },
        { name: "Yum! Brands", symbol: "YUM" },
        { name: "Yum China", symbol: "YUMC" },
        { name: "Wynn Resorts", symbol: "WYNN" },
        { name: "Las Vegas Sands", symbol: "LVS" },
        { name: "MGM Resorts", symbol: "MGM" },
        { name: "VF Corporation", symbol: "VFC" },
        { name: "Ralph Lauren", symbol: "RL" },
        { name: "Tapestry", symbol: "TPR" },
        { name: "Hasbro", symbol: "HAS" },
        { name: "Mattel", symbol: "MAT" },
        { name: "Harley-Davidson", symbol: "HOG" },
        { name: "BorgWarner", symbol: "BWA" },
        { name: "CarMax", symbol: "KMX" },
        { name: "Advance Auto Parts", symbol: "AAP" },
        { name: "O'Reilly Automotive", symbol: "ORLY" },
        { name: "AutoZone", symbol: "AZO" },
        { name: "Upstart Holdings", symbol: "UPST" },
        { name: "Carvana", symbol: "CVNA" },
        { name: "Affirm Holdings", symbol: "AFRM" },
        { name: "Fastly", symbol: "FSLY" },
        { name: "Unity Software", symbol: "U" },
        { name: "Intellia Therapeutics", symbol: "NTLA" },
        { name: "BigCommerce", symbol: "BIGC" },
        { name: "C3.ai", symbol: "AI" },
        { name: "SentinelOne", symbol: "S" },
        { name: "UiPath", symbol: "PATH" },
        { name: "Toast", symbol: "TOST" },
        { name: "GitLab", symbol: "GTLB" },
        { name: "SolarWinds", symbol: "SWI" },
        { name: "Bumble", symbol: "BMBL" },
        { name: "AppLovin", symbol: "APP" },
        { name: "PagerDuty", symbol: "PD" },
        { name: "Asana", symbol: "ASAN" },
        { name: "Monday.com", symbol: "MNDY" },
        { name: "Confluent", symbol: "CFLT" },
        { name: "Amplitude", symbol: "AMPL" },
        { name: "DigitalOcean", symbol: "DOCN" },
        { name: "Nutanix", symbol: "NTNX" },
        { name: "Procore Technologies", symbol: "PCOR" },
        { name: "Coupang", symbol: "CPNG" },
        { name: "Lyft", symbol: "LYFT" },
        { name: "TripAdvisor", symbol: "TRIP" },
        { name: "Yelp", symbol: "YELP" },
        { name: "Guardant Health", symbol: "GH" },
        { name: "Veracyte", symbol: "VCYT" },
        { name: "NanoString Technologies", symbol: "NSTG" },
        { name: "Iovance Biotherapeutics", symbol: "IOVA" },
        { name: "Twist Bioscience", symbol: "TWST" },
        { name: "Sage Therapeutics", symbol: "SAGE" },
        { name: "Denali Therapeutics", symbol: "DNLI" },
        { name: "Adaptive Biotechnologies", symbol: "ADPT" },
        { name: "Kura Oncology", symbol: "KURA" },
        { name: "Editas Medicine", symbol: "EDIT" },
        { name: "CRISPR Therapeutics", symbol: "CRSP" },
        { name: "Beam Therapeutics", symbol: "BEAM" },
        { name: "10x Genomics", symbol: "TXG" },
        { name: "Schrodinger", symbol: "SDGR" },
        { name: "BioNTech", symbol: "BNTX" },
        { name: "CureVac", symbol: "CVAC" },
        { name: "Exelixis", symbol: "EXEL" },
        { name: "Halozyme Therapeutics", symbol: "HALO" },
        { name: "Natera", symbol: "NTRA" },
        { name: "Ultragenyx Pharmaceutical", symbol: "RARE" },
        { name: "Pacira BioSciences", symbol: "PCRX" },
        { name: "Acadia Healthcare", symbol: "ACHC" },
        { name: "Inspire Medical Systems", symbol: "INSP" },
        { name: "Tandem Diabetes Care", symbol: "TNDM" },
        { name: "Beyond Meat", symbol: "BYND" },
        { name: "Stitch Fix", symbol: "SFIX" },
        { name: "Groupon", symbol: "GRPN" },
        { name: "Fiverr", symbol: "FVRR" },
        { name: "Upwork", symbol: "UPWK" },
        { name: "Funko", symbol: "FNKO" },
        { name: "Roku", symbol: "ROKU" },
        { name: "iRobot", symbol: "IRBT" },
        { name: "Lovesac", symbol: "LOVE" },
        { name: "Purple Innovation", symbol: "PRPL" },
        { name: "1-800-FLOWERS.COM", symbol: "FLWS" },
        { name: "Zumiez", symbol: "ZUMZ" },
        { name: "Revolve Group", symbol: "RVLV" },
        { name: "Crocs", symbol: "CROX" },
        { name: "Ollie's Bargain Outlet", symbol: "OLLI" },
        { name: "Sonos", symbol: "SONO" },
        { name: "Central Garden & Pet", symbol: "CENT" },
        { name: "Shake Shack", symbol: "SHAK" },
        { name: "Planet Fitness", symbol: "PLNT" },
        { name: "Dave & Buster's", symbol: "PLAY" },
        { name: "El Pollo Loco", symbol: "LOCO" },
        { name: "Fossil Group", symbol: "FOSL" },
        { name: "Dine Brands Global", symbol: "DIN" },
        { name: "Potbelly", symbol: "PBPB" },
        { name: "American Tower", symbol: "AMT" },
        { name: "Prologis", symbol: "PLD" },
        { name: "Crown Castle", symbol: "CCI" },
        { name: "Equinix", symbol: "EQIX" },
        { name: "Digital Realty Trust", symbol: "DLR" },
        { name: "Public Storage", symbol: "PSA" },
        { name: "Welltower", symbol: "WELL" },
        { name: "Simon Property Group", symbol: "SPG" },
        { name: "AvalonBay Communities", symbol: "AVB" },
        { name: "Boston Properties", symbol: "BXP" },
        { name: "Ventas", symbol: "VTR" },
        { name: "Alexandria Real Estate", symbol: "ARE" },
        { name: "Realty Income", symbol: "O" },
        { name: "Essex Property Trust", symbol: "ESS" },
        { name: "Equity Residential", symbol: "EQR" },
        { name: "SBA Communications", symbol: "SBAC" },
        { name: "Vornado Realty Trust", symbol: "VNO" },
        { name: "Host Hotels & Resorts", symbol: "HST" },
        { name: "Kimco Realty", symbol: "KIM" },
        { name: "Federal Realty", symbol: "FRT" },
        { name: "Freeport-McMoRan", symbol: "FCX" },
        { name: "Newmont", symbol: "NEM" },
        { name: "Air Products and Chemicals", symbol: "APD" },
        { name: "Ecolab", symbol: "ECL" },
        { name: "Sherwin-Williams", symbol: "SHW" },
        { name: "Nucor", symbol: "NUE" },
        { name: "Dow", symbol: "DOW" },
        { name: "International Paper", symbol: "IP" },
        { name: "Ball Corporation", symbol: "BALL" },
        { name: "CF Industries", symbol: "CF" },
        { name: "Albemarle", symbol: "ALB" },
        { name: "Mosaic", symbol: "MOS" },
        { name: "FMC", symbol: "FMC" },
        { name: "Eastman Chemical", symbol: "EMN" },
        { name: "Celanese", symbol: "CE" },
        { name: "International Flavors & Fragrances", symbol: "IFF" },
        { name: "Vulcan Materials", symbol: "VMC" },
        { name: "Martin Marietta Materials", symbol: "MLM" },
        { name: "Alcoa", symbol: "AA" },
        { name: "Steel Dynamics", symbol: "STLD" },
        { name: "iShares Russell 2000 ETF", symbol: "IWM" },
        { name: "Vanguard Total Stock Market ETF", symbol: "VTI" },
        { name: "iShares Core S&P 500 ETF", symbol: "IVV" },
        { name: "Vanguard S&P 500 ETF", symbol: "VOO" },
        { name: "Vanguard Information Technology ETF", symbol: "VGT" },
        { name: "Financial Select Sector SPDR Fund", symbol: "XLF" },
        { name: "Health Care Select Sector SPDR Fund", symbol: "XLV" },
        { name: "iShares Russell 1000 Growth ETF", symbol: "IWF" },
        { name: "iShares Russell 3000 ETF", symbol: "IWV" },
        { name: "Technology Select Sector SPDR Fund", symbol: "XLK" },
        { name: "Consumer Discretionary Select Sector SPDR Fund", symbol: "XLY" },
        { name: "Energy Select Sector SPDR Fund", symbol: "XLE" },
        { name: "Industrial Select Sector SPDR Fund", symbol: "XLI" },
        { name: "Utilities Select Sector SPDR Fund", symbol: "XLU" },
        { name: "Consumer Staples Select Sector SPDR Fund", symbol: "XLP" },
        { name: "ARK Innovation ETF", symbol: "ARKK" },
        { name: "ARK Genomic Revolution ETF", symbol: "ARKG" },
        { name: "VanEck Semiconductor ETF", symbol: "SMH" },
        { name: "iShares MSCI Emerging Markets ETF", symbol: "EEM" },
        { name: "Vanguard FTSE Emerging Markets ETF", symbol: "VWO" },
        { name: "RingCentral", symbol: "RNG" },
        { name: "Dynatrace", symbol: "DT" },
        { name: "Elastic", symbol: "ESTC" },
        { name: "Paycom Software", symbol: "PAYC" },
        { name: "Paylocity", symbol: "PCTY" },
        { name: "Paychex", symbol: "PAYX" },
        { name: "Five9", symbol: "FIVN" },
        { name: "Guidewire Software", symbol: "GWRE" },
        { name: "Manhattan Associates", symbol: "MANH" },
        { name: "Pegasystems", symbol: "PEGA" },
        { name: "Qualys", symbol: "QLYS" },
        { name: "SPS Commerce", symbol: "SPSC" },
        { name: "Tyler Technologies", symbol: "TYL" },
        { name: "Zoominfo", symbol: "ZI" },
        { name: "CommVault Systems", symbol: "CVLT" },
        { name: "Progress Software", symbol: "PRGS" },
        { name: "Enfusion", symbol: "ENFN" },
        { name: "Doximity", symbol: "DOCS" },
        { name: "Pure Storage", symbol: "PSTG" },
        { name: "Jabil", symbol: "JBL" },
        { name: "Western Digital", symbol: "WDC" },
        { name: "Seagate Technology", symbol: "STX" },
        { name: "HP Inc.", symbol: "HPQ" },
        { name: "Hewlett Packard Enterprise", symbol: "HPE" },
        { name: "Xerox Holdings", symbol: "XRX" },
        { name: "Diebold Nixdorf", symbol: "DBD" },
        { name: "NetApp", symbol: "NTAP" },
        { name: "Teradata", symbol: "TDC" },
        { name: "Lumentum Holdings", symbol: "LITE" },
        { name: "Ciena", symbol: "CIEN" },
        { name: "Coherent", symbol: "COHR" },
        { name: "CommScope", symbol: "COMM" },
        { name: "F5 Networks", symbol: "FFIV" },
        { name: "NetScout Systems", symbol: "NTCT" },
        { name: "Calix", symbol: "CALX" },
        { name: "Viavi Solutions", symbol: "VIAV" },
        { name: "Harmonic", symbol: "HLIT" },
        { name: "A10 Networks", symbol: "ATEN" },
        { name: "Super Micro Computer", symbol: "SMCI" },
        { name: "ON Semiconductor", symbol: "ON" },
        { name: "Skyworks Solutions", symbol: "SWKS" },
        { name: "Qorvo", symbol: "QRVO" },
        { name: "Marvell Technology", symbol: "MRVL" },
        { name: "Monolithic Power Systems", symbol: "MPWR" },
        { name: "Silicon Laboratories", symbol: "SLAB" },
        { name: "Cirrus Logic", symbol: "CRUS" },
        { name: "Lattice Semiconductor", symbol: "LSCC" },
        { name: "Cree (Wolfspeed)", symbol: "WOLF" },
        { name: "Semtech", symbol: "SMTC" },
        { name: "Diodes", symbol: "DIOD" },
        { name: "Vishay Intertechnology", symbol: "VSH" },
        { name: "Power Integrations", symbol: "POWI" },
        { name: "Rambus", symbol: "RMBS" },
        { name: "Axcelis Technologies", symbol: "ACLS" },
        { name: "Kulicke and Soffa", symbol: "KLIC" },
        { name: "FormFactor", symbol: "FORM" },
        { name: "Photronics", symbol: "PLAB" },
        { name: "MACOM Technology Solutions", symbol: "MTSI" },
        { name: "MaxLinear", symbol: "MXL" },
        { name: "Ambarella", symbol: "AMBA" },
        { name: "Universal Display", symbol: "OLED" },
        { name: "SiTime", symbol: "SITM" },
        { name: "Fate Therapeutics", symbol: "FATE" },
        { name: "Sana Biotechnology", symbol: "SANA" },
        { name: "Repligen", symbol: "RGEN" },
        { name: "Sarepta Therapeutics", symbol: "SRPT" },
        { name: "Ionis Pharmaceuticals", symbol: "IONS" },
        { name: "Neurocrine Biosciences", symbol: "NBIX" },
        { name: "Alkermes", symbol: "ALKS" },
        { name: "Ironwood Pharmaceuticals", symbol: "IRWD" },
        { name: "Blueprint Medicines", symbol: "BPMC" },
        { name: "Agios Pharmaceuticals", symbol: "AGIO" },
        { name: "Allogene Therapeutics", symbol: "ALLO" },
        { name: "Apellis Pharmaceuticals", symbol: "APLS" },
        { name: "Arcus Biosciences", symbol: "RCUS" },
        { name: "Arvinas", symbol: "ARVN" },
        { name: "Atara Biotherapeutics", symbol: "ATRA" },
        { name: "Immunovant", symbol: "IMVT" },
        { name: "Insmed", symbol: "INSM" },
        { name: "Kodiak Sciences", symbol: "KOD" },
        { name: "Krystal Biotech", symbol: "KRYS" },
        { name: "Relay Therapeutics", symbol: "RLAY" },
        { name: "Seres Therapeutics", symbol: "MCRB" },
        { name: "TG Therapeutics", symbol: "TGTX" },
        { name: "United Therapeutics", symbol: "UTHR" },
        { name: "Vir Biotechnology", symbol: "VIR" },
        { name: "Amarin", symbol: "AMRN" },
        { name: "Amneal Pharmaceuticals", symbol: "AMRX" },
        { name: "Amphastar Pharmaceuticals", symbol: "AMPH" },
        { name: "ANI Pharmaceuticals", symbol: "ANIP" },
        { name: "Assertio Holdings", symbol: "ASRT" },
        { name: "Collegium Pharmaceutical", symbol: "COLL" },
        { name: "Corcept Therapeutics", symbol: "CORT" },
        { name: "Organon", symbol: "OGN" },
        { name: "Prestige Consumer Healthcare", symbol: "PBH" },
        { name: "Supernus Pharmaceuticals", symbol: "SUPN" },
        { name: "Teva Pharmaceutical Industries", symbol: "TEVA" },
        { name: "Viatris", symbol: "VTRS" },
        { name: "Integra LifeSciences", symbol: "IART" },
        { name: "Nevro", symbol: "NVRO" },
        { name: "Penumbra", symbol: "PEN" },
        { name: "Quidel", symbol: "QDEL" },
        { name: "Globus Medical", symbol: "GMED" },
        { name: "Haemonetics", symbol: "HAE" },
        { name: "Hologic", symbol: "HOLX" },
        { name: "Integer Holdings", symbol: "ITGR" },
        { name: "iRhythm Technologies", symbol: "IRTC" },
        { name: "Masimo", symbol: "MASI" },
        { name: "Outset Medical", symbol: "OM" },
        { name: "Teleflex", symbol: "TFX" },
        { name: "Zimmer Biomet Holdings", symbol: "ZBH" },
        { name: "Glaukos", symbol: "GKOS" },
        { name: "Amedisys", symbol: "AMED" },
        { name: "Alignment Healthcare", symbol: "ALHC" },
        { name: "Addus HomeCare", symbol: "ADUS" },
        { name: "Brookdale Senior Living", symbol: "BKD" },
        { name: "Chemed", symbol: "CHE" },
        { name: "Cross Country Healthcare", symbol: "CCRN" },
        { name: "Encompass Health", symbol: "EHC" },
        { name: "Ensign Group", symbol: "ENSG" },
        { name: "HealthEquity", symbol: "HQY" },
        { name: "Molina Healthcare", symbol: "MOH" },
        { name: "Select Medical Holdings", symbol: "SEM" },
        { name: "Tenet Healthcare", symbol: "THC" },
        { name: "Ally Financial", symbol: "ALLY" },
        { name: "Associated Banc-Corp", symbol: "ASB" },
        { name: "Bank OZK", symbol: "OZK" },
        { name: "BOK Financial", symbol: "BOKF" },
        { name: "Cathay General Bancorp", symbol: "CATY" },
        { name: "Columbia Banking System", symbol: "COLB" },
        { name: "Cullen/Frost Bankers", symbol: "CFR" },
        { name: "East West Bancorp", symbol: "EWBC" },
        { name: "F.N.B. Corporation", symbol: "FNB" },
        { name: "First Financial Bankshares", symbol: "FFIN" },
        { name: "First Hawaiian", symbol: "FHB" },
        { name: "First Horizon", symbol: "FHN" },
        { name: "Fulton Financial", symbol: "FULT" },
        { name: "Glacier Bancorp", symbol: "GBCI" },
        { name: "Old National Bancorp", symbol: "ONB" },
        { name: "Pinnacle Financial Partners", symbol: "PNFP" },
        { name: "Prosperity Bancshares", symbol: "PB" },
        { name: "Simmons First National", symbol: "SFNC" },
        { name: "Synovus Financial", symbol: "SNV" },
        { name: "Trustmark", symbol: "TRMK" },
        { name: "United Bankshares", symbol: "UBSI" },
        { name: "Valley National Bancorp", symbol: "VLY" },
        { name: "Webster Financial", symbol: "WBS" },
        { name: "Western Alliance Bancorp", symbol: "WAL" },
        { name: "Wintrust Financial", symbol: "WTFC" },
        { name: "Ares Management", symbol: "ARES" },
        { name: "Cohen & Steers", symbol: "CNS" },
        { name: "Diamond Hill Investment Group", symbol: "DHIL" },
        { name: "Evercore", symbol: "EVR" },
        { name: "Hamilton Lane", symbol: "HLNE" },
        { name: "Interactive Brokers Group", symbol: "IBKR" },
        { name: "Janus Henderson Group", symbol: "JHG" },
        { name: "KKR & Co", symbol: "KKR" },
        { name: "LPL Financial Holdings", symbol: "LPLA" },
        { name: "Moelis & Company", symbol: "MC" },
        { name: "Morningstar", symbol: "MORN" },
        { name: "MSCI", symbol: "MSCI" },
        { name: "PJT Partners", symbol: "PJT" },
        { name: "SEI Investments", symbol: "SEIC" },
        { name: "Stifel Financial", symbol: "SF" },
        { name: "Virtu Financial", symbol: "VIRT" },
        { name: "Ambac Financial Group", symbol: "AMBC" },
        { name: "American Financial Group", symbol: "AFG" },
        { name: "Assurant", symbol: "AIZ" },
        { name: "Brighthouse Financial", symbol: "BHF" },
        { name: "Brown & Brown", symbol: "BRO" },
        { name: "Citizens", symbol: "CIA" },
        { name: "CNO Financial Group", symbol: "CNO" },
        { name: "eHealth", symbol: "EHTH" },
        { name: "Enstar Group", symbol: "ESGR" },
        { name: "First American Financial", symbol: "FAF" },
        { name: "Genworth Financial", symbol: "GNW" },
        { name: "Globe Life", symbol: "GL" },
        { name: "Goosehead Insurance", symbol: "GSHD" },
        { name: "Hanover Insurance Group", symbol: "THG" },
        { name: "James River Group Holdings", symbol: "JRVR" },
        { name: "Kemper", symbol: "KMPR" },
        { name: "Kinsale Capital Group", symbol: "KNSL" },
        { name: "Mercury General", symbol: "MCY" },
        { name: "NMI Holdings", symbol: "NMIH" },
        { name: "Old Republic International", symbol: "ORI" },
        { name: "Palomar Holdings", symbol: "PLMR" },
        { name: "ProAssurance", symbol: "PRA" },
        { name: "Radian Group", symbol: "RDN" },
        { name: "Reinsurance Group of America", symbol: "RGA" },
        { name: "RLI Corp", symbol: "RLI" },
        { name: "Selective Insurance Group", symbol: "SIGI" },
        { name: "Stewart Information Services", symbol: "STC" },
        { name: "Trupanion", symbol: "TRUP" },
        { name: "United Fire Group", symbol: "UFCS" },
        { name: "Universal Insurance Holdings", symbol: "UVE" },
        { name: "Abercrombie & Fitch", symbol: "ANF" },
        { name: "Academy Sports and Outdoors", symbol: "ASO" },
        { name: "American Eagle Outfitters", symbol: "AEO" },
        { name: "Best Buy", symbol: "BBY" },
        { name: "Boot Barn Holdings", symbol: "BOOT" },
        { name: "Burlington Stores", symbol: "BURL" },
        { name: "Caleres", symbol: "CAL" },
        { name: "Cato", symbol: "CATO" },
        { name: "Children's Place", symbol: "PLCE" },
        { name: "Designer Brands", symbol: "DBI" },
        { name: "Dick's Sporting Goods", symbol: "DKS" },
        { name: "Dillard's", symbol: "DDS" },
        { name: "Five Below", symbol: "FIVE" },
        { name: "Foot Locker", symbol: "FL" },
        { name: "Genesco", symbol: "GCO" },
        { name: "Group 1 Automotive", symbol: "GPI" },
        { name: "Kohl's", symbol: "KSS" },
        { name: "L Brands", symbol: "LB" },
        { name: "Macy's", symbol: "M" },
        { name: "Murphy USA", symbol: "MUSA" },
        { name: "National Vision Holdings", symbol: "EYE" },
        { name: "Nordstrom", symbol: "JWN" },
        { name: "Penske Automotive Group", symbol: "PAG" },
        { name: "Ross Stores", symbol: "ROST" },
        { name: "RH", symbol: "RH" },
        { name: "Sally Beauty Holdings", symbol: "SBH" },
        { name: "Signet Jewelers", symbol: "SIG" },
        { name: "Sonic Automotive", symbol: "SAH" },
        { name: "The Buckle", symbol: "BKE" },
        { name: "TJX Companies", symbol: "TJX" },
        { name: "Urban Outfitters", symbol: "URBN" },
        { name: "Victoria's Secret", symbol: "VSCO" },
        { name: "Adient", symbol: "ADNT" },
        { name: "American Axle & Manufacturing", symbol: "AXL" },
        { name: "Aptiv", symbol: "APTV" },
        { name: "AutoNation", symbol: "AN" },
        { name: "Autoliv", symbol: "ALV" },
        { name: "Cooper-Standard Holdings", symbol: "CPS" },
        { name: "Dana", symbol: "DAN" },
        { name: "Dorman Products", symbol: "DORM" },
        { name: "Ferrari", symbol: "RACE" },
        { name: "Gentex", symbol: "GNTX" },
        { name: "Gentherm", symbol: "THRM" },
        { name: "Goodyear Tire & Rubber", symbol: "GT" },
        { name: "LCI Industries", symbol: "LCII" },
        { name: "Lear", symbol: "LEA" },
        { name: "LKQ", symbol: "LKQ" },
        { name: "Modine Manufacturing", symbol: "MOD" },
        { name: "Motorcar Parts of America", symbol: "MPAA" },
        { name: "Standard Motor Products", symbol: "SMP" },
        { name: "Tenneco", symbol: "TEN" },
        { name: "Thor Industries", symbol: "THO" },
        { name: "Visteon", symbol: "VC" },
        { name: "Winnebago Industries", symbol: "WGO" },
        { name: "B&G Foods", symbol: "BGS" },
        { name: "Boston Beer Company", symbol: "SAM" },
        { name: "BJ's Wholesale Club", symbol: "BJ" },
        { name: "Campbell Soup", symbol: "CPB" },
        { name: "Clorox", symbol: "CLX" },
        { name: "Conagra Brands", symbol: "CAG" },
        { name: "Constellation Brands", symbol: "STZ" },
        { name: "Darling Ingredients", symbol: "DAR" },
        { name: "Flowers Foods", symbol: "FLO" },
        { name: "Fresh Del Monte Produce", symbol: "FDP" },
        { name: "Grocery Outlet", symbol: "GO" },
        { name: "Hain Celestial Group", symbol: "HAIN" },
        { name: "Herbalife Nutrition", symbol: "HLF" },
        { name: "Hershey", symbol: "HSY" },
        { name: "Hormel Foods", symbol: "HRL" },
        { name: "J.M. Smucker", symbol: "SJM" },
        { name: "Keurig Dr Pepper", symbol: "KDP" },
        { name: "Kroger", symbol: "KR" },
        { name: "Lancaster Colony", symbol: "LANC" },
        { name: "McCormick & Company", symbol: "MKC" },
        { name: "Medifast", symbol: "MED" },
        { name: "Molson Coors Beverage", symbol: "TAP" },
        { name: "Monster Beverage", symbol: "MNST" },
        { name: "Nu Skin Enterprises", symbol: "NUS" },
        { name: "Pilgrim's Pride", symbol: "PPC" },
        { name: "Post Holdings", symbol: "POST" },
        { name: "Sprouts Farmers Market", symbol: "SFM" },
        { name: "TreeHouse Foods", symbol: "THS" },
        { name: "Tyson Foods", symbol: "TSN" },
        { name: "United Natural Foods", symbol: "UNFI" },
        { name: "Walgreens Boots Alliance", symbol: "WBA" },
        { name: "WD-40 Company", symbol: "WDFC" },
        { name: "Antero Resources", symbol: "AR" },
        { name: "Apache Corporation", symbol: "APA" },
        { name: "Baker Hughes", symbol: "BKR" },
        { name: "Cheniere Energy", symbol: "LNG" },
        { name: "Clean Energy Fuels", symbol: "CLNE" },
        { name: "CNX Resources", symbol: "CNX" },
        { name: "Core Laboratories", symbol: "CLB" },
        { name: "EQT Corporation", symbol: "EQT" },
        { name: "FuelCell Energy", symbol: "FCEL" },
        { name: "Halliburton", symbol: "HAL" },
        { name: "Helmerich & Payne", symbol: "HP" },
        { name: "Hess Corporation", symbol: "HES" },
        { name: "Murphy Oil", symbol: "MUR" },
        { name: "National Oilwell Varco", symbol: "NOV" },
        { name: "ONEOK", symbol: "OKE" },
        { name: "Ovintiv", symbol: "OVV" },
        { name: "Range Resources", symbol: "RRC" },
        { name: "SM Energy", symbol: "SM" },
        { name: "Sunrun", symbol: "RUN" },
        { name: "Sunnova Energy", symbol: "NOVA" },
        { name: "TechnipFMC", symbol: "FTI" },
        { name: "Transocean", symbol: "RIG" },
        { name: "Valaris", symbol: "VAL" },
        { name: "AeroVironment", symbol: "AVAV" },
        { name: "AerSale", symbol: "ASLE" },
        { name: "Axon Enterprise", symbol: "AXON" },
        { name: "Cubic", symbol: "CUB" },
        { name: "Curtiss-Wright", symbol: "CW" },
        { name: "Ducommun", symbol: "DCO" },
        { name: "Hexcel", symbol: "HXL" },
        { name: "Howmet Aerospace", symbol: "HWM" },
        { name: "Huntington Ingalls Industries", symbol: "HII" },
        { name: "Joby Aviation", symbol: "JOBY" },
        { name: "Kratos Defense & Security", symbol: "KTOS" },
        { name: "Leidos Holdings", symbol: "LDOS" },
        { name: "Mercury Systems", symbol: "MRCY" },
        { name: "Spirit AeroSystems", symbol: "SPR" },
        { name: "SAIC", symbol: "SAIC" },
        { name: "Textron", symbol: "TXT" },
        { name: "TransDigm Group", symbol: "TDG" },
        { name: "Triumph Group", symbol: "TGI" },
        { name: "Virgin Galactic", symbol: "SPCE" },
        { name: "Woodward", symbol: "WWD" },
        { name: "AGCO", symbol: "AGCO" },
        { name: "Albany International", symbol: "AIN" },
        { name: "Chart Industries", symbol: "GTLS" },
        { name: "Columbus McKinnon", symbol: "CMCO" },
        { name: "Crane Co.", symbol: "CR" },
        { name: "Donaldson Company", symbol: "DCI" },
        { name: "Dover", symbol: "DOV" },
        { name: "Enerpac Tool Group", symbol: "EPAC" },
        { name: "EnPro Industries", symbol: "NPO" },
        { name: "ESCO Technologies", symbol: "ESE" },
        { name: "Federal Signal", symbol: "FSS" },
        { name: "Flowserve", symbol: "FLS" },
        { name: "Fortive", symbol: "FTV" },
        { name: "Gencor Industries", symbol: "GENC" },
        { name: "Graco", symbol: "GGG" },
        { name: "Granite Construction", symbol: "GVA" },
        { name: "Hillenbrand", symbol: "HI" },
        { name: "Hubbell", symbol: "HUBB" },
        { name: "Hyster-Yale Materials Handling", symbol: "HY" },
        { name: "IDEX Corporation", symbol: "IEX" },
        { name: "Ingersoll Rand", symbol: "IR" },
        { name: "ITT Inc.", symbol: "ITT" },
        { name: "Lincoln Electric Holdings", symbol: "LECO" },
        { name: "Manitowoc Company", symbol: "MTW" },
        { name: "Mueller Industries", symbol: "MLI" },
        { name: "Mueller Water Products", symbol: "MWA" },
        { name: "Nordson", symbol: "NDSN" },
        { name: "Pentair", symbol: "PNR" },
        { name: "RBC Bearings", symbol: "RBC" },
        { name: "Snap-on", symbol: "SNA" },
        { name: "Terex", symbol: "TEX" },
        { name: "Timken", symbol: "TKR" },
        { name: "Trex Company", symbol: "TREX" },
        { name: "Toro Company", symbol: "TTC" },
        { name: "Watts Water Technologies", symbol: "WTS" },
        { name: "Xylem", symbol: "XYL" },
        { name: "ArcBest", symbol: "ARCB" },
        { name: "C.H. Robinson Worldwide", symbol: "CHRW" },
        { name: "Covenant Logistics Group", symbol: "CVLG" },
        { name: "Expeditors International", symbol: "EXPD" },
        { name: "Forward Air", symbol: "FWRD" },
        { name: "Heartland Express", symbol: "HTLD" },
        { name: "Hub Group", symbol: "HUBG" },
        { name: "J.B. Hunt Transport Services", symbol: "JBHT" },
        { name: "Kirby", symbol: "KEX" },
        { name: "Knight-Swift Transportation", symbol: "KNX" },
        { name: "Landstar System", symbol: "LSTR" },
        { name: "Matson", symbol: "MATX" },
        { name: "Old Dominion Freight Line", symbol: "ODFL" },
        { name: "Ryder System", symbol: "R" },
        { name: "Saia", symbol: "SAIA" },
        { name: "SkyWest", symbol: "SKYW" },
        { name: "Southwest Airlines", symbol: "LUV" },
        { name: "Trinity Industries", symbol: "TRN" },
        { name: "Werner Enterprises", symbol: "WERN" },
        { name: "XPO Logistics", symbol: "XPO" },
        { name: "ABM Industries", symbol: "ABM" },
        { name: "ACCO Brands", symbol: "ACCO" },
        { name: "ADT Inc.", symbol: "ADT" },
        { name: "ADP", symbol: "ADP" },
        { name: "Brink's Company", symbol: "BCO" },
        { name: "Bright Horizons Family Solutions", symbol: "BFAM" },
        { name: "CBIZ", symbol: "CBZ" },
        { name: "Cintas", symbol: "CTAS" },
        { name: "Clean Harbors", symbol: "CLH" },
        { name: "Copart", symbol: "CPRT" },
        { name: "CorVel", symbol: "CRVL" },
        { name: "Deluxe", symbol: "DLX" },
        { name: "Equifax", symbol: "EFX" },
        { name: "Exponent", symbol: "EXPO" },
        { name: "FTI Consulting", symbol: "FCN" },
        { name: "H&R Block", symbol: "HRB" },
        { name: "Healthcare Services Group", symbol: "HCSG" },
        { name: "Heidrick & Struggles", symbol: "HSII" },
        { name: "ICF International", symbol: "ICFI" },
        { name: "IHS Markit", symbol: "INFO" },
        { name: "Iron Mountain", symbol: "IRM" },
        { name: "Kelly Services", symbol: "KELYA" },
        { name: "Kforce", symbol: "KFRC" },
        { name: "Korn Ferry", symbol: "KFY" },
        { name: "ManpowerGroup", symbol: "MAN" },
        { name: "Pitney Bowes", symbol: "PBI" },
        { name: "Republic Services", symbol: "RSG" },
        { name: "Resources Connection", symbol: "RGP" },
        { name: "Robert Half International", symbol: "RHI" },
        { name: "ServiceMaster Global Holdings", symbol: "SERV" },
        { name: "Stericycle", symbol: "SRCL" },
        { name: "Thomson Reuters", symbol: "TRI" },
        { name: "TransUnion", symbol: "TRU" },
        { name: "TriNet Group", symbol: "TNET" },
        { name: "UniFirst", symbol: "UNF" },
        { name: "United Rentals", symbol: "URI" },
        { name: "Verisk Analytics", symbol: "VRSK" },
        { name: "Waste Connections", symbol: "WCN" },
        { name: "Waste Management", symbol: "WM" },
        { name: "WEX Inc.", symbol: "WEX" },
        { name: "AdvanSix", symbol: "ASIX" },
        { name: "Avery Dennison", symbol: "AVY" },
        { name: "Axalta Coating Systems", symbol: "AXTA" },
        { name: "AZZ Inc.", symbol: "AZZ" },
        { name: "Berry Global Group", symbol: "BERY" },
        { name: "Cabot Corporation", symbol: "CBT" },
        { name: "Century Aluminum", symbol: "CENX" },
        { name: "Clearwater Paper", symbol: "CLW" },
        { name: "Cleveland-Cliffs", symbol: "CLF" },
        { name: "Commercial Metals", symbol: "CMC" },
        { name: "Compass Minerals International", symbol: "CMP" },
        { name: "Crown Holdings", symbol: "CCK" },
        { name: "DuPont de Nemours", symbol: "DD" },
        { name: "FutureFuel", symbol: "FF" },
        { name: "Graphic Packaging Holding", symbol: "GPK" },
        { name: "Greif", symbol: "GEF" },
        { name: "H.B. Fuller", symbol: "FUL" },
        { name: "Ingevity", symbol: "NGVT" },
        { name: "Innospec", symbol: "IOSP" },
        { name: "Kaiser Aluminum", symbol: "KALU" },
        { name: "Koppers Holdings", symbol: "KOP" },
        { name: "Kronos Worldwide", symbol: "KRO" },
        { name: "LSB Industries", symbol: "LXU" },
        { name: "Minerals Technologies", symbol: "MTX" },
        { name: "MP Materials", symbol: "MP" },
        { name: "Myers Industries", symbol: "MYE" },
        { name: "NewMarket", symbol: "NEU" },
        { name: "Olin", symbol: "OLN" },
        { name: "O-I Glass", symbol: "OI" },
        { name: "Packaging Corporation of America", symbol: "PKG" },
        { name: "PPG Industries", symbol: "PPG" },
        { name: "Quaker Chemical", symbol: "KWR" },
        { name: "Reliance Steel & Aluminum", symbol: "RS" },
        { name: "RPM International", symbol: "RPM" },
        { name: "Sealed Air", symbol: "SEE" },
        { name: "Sensient Technologies", symbol: "SXT" },
        { name: "Silgan Holdings", symbol: "SLGN" },
        { name: "Sonoco Products", symbol: "SON" },
        { name: "Stepan", symbol: "SCL" },
        { name: "Tredegar", symbol: "TG" },
        { name: "United States Steel", symbol: "X" },
        { name: "Valhi", symbol: "VHI" },
        { name: "Worthington Industries", symbol: "WOR" },
        { name: "Algonquin Power & Utilities", symbol: "AQN" },
        { name: "ALLETE", symbol: "ALE" },
        { name: "American States Water", symbol: "AWR" },
        { name: "American Water Works", symbol: "AWK" },
        { name: "Avista", symbol: "AVA" },
        { name: "Black Hills", symbol: "BKH" },
        { name: "Brookfield Infrastructure Partners", symbol: "BIP" },
        { name: "Brookfield Renewable Partners", symbol: "BEP" },
        { name: "California Water Service Group", symbol: "CWT" },
        { name: "CenterPoint Energy", symbol: "CNP" },
        { name: "Consolidated Edison", symbol: "ED" },
        { name: "DTE Energy", symbol: "DTE" },
        { name: "Edison International", symbol: "EIX" },
        { name: "Entergy", symbol: "ETR" },
        { name: "Essential Utilities", symbol: "WTRG" },
        { name: "Evergy", symbol: "EVRG" },
        { name: "FirstEnergy", symbol: "FE" },
        { name: "Hawaiian Electric Industries", symbol: "HE" },
        { name: "IdaCorp", symbol: "IDA" },
        { name: "MDU Resources Group", symbol: "MDU" },
        { name: "National Fuel Gas", symbol: "NFG" },
        { name: "New Jersey Resources", symbol: "NJR" },
        { name: "NiSource", symbol: "NI" },
        { name: "Northwest Natural Holding", symbol: "NWN" },
        { name: "NRG Energy", symbol: "NRG" },
        { name: "OGE Energy", symbol: "OGE" },
        { name: "Ormat Technologies", symbol: "ORA" },
        { name: "PG&E", symbol: "PCG" },
        { name: "Pinnacle West Capital", symbol: "PNW" },
        { name: "Portland General Electric", symbol: "POR" },
        { name: "PPL Corporation", symbol: "PPL" },
        { name: "Southwest Gas Holdings", symbol: "SWX" },
        { name: "Spire", symbol: "SR" },
        { name: "UGI Corporation", symbol: "UGI" },
        { name: "Vistra", symbol: "VST" },
        { name: "WEC Energy Group", symbol: "WEC" },
        { name: "Xcel Energy", symbol: "XEL" },
        { name: "Agree Realty", symbol: "ADC" },
        { name: "Alexander & Baldwin", symbol: "ALEX" },
        { name: "American Homes 4 Rent", symbol: "AMH" },
        { name: "Apartment Investment and Management", symbol: "AIV" },
        { name: "Armada Hoffler Properties", symbol: "AHH" },
        { name: "Brixmor Property Group", symbol: "BRX" },
        { name: "Camden Property Trust", symbol: "CPT" },
        { name: "CareTrust REIT", symbol: "CTRE" },
        { name: "CBL & Associates Properties", symbol: "CBL" },
        { name: "CoreCivic", symbol: "CXW" },
        { name: "Cousins Properties", symbol: "CUZ" },
        { name: "CubeSmart", symbol: "CUBE" },
        { name: "DiamondRock Hospitality", symbol: "DRH" },
        { name: "Douglas Emmett", symbol: "DEI" },
        { name: "EastGroup Properties", symbol: "EGP" },
        { name: "EPR Properties", symbol: "EPR" },
        { name: "Equity Commonwealth", symbol: "EQC" },
        { name: "Equity LifeStyle Properties", symbol: "ELS" },
        { name: "Extra Space Storage", symbol: "EXR" },
        { name: "First Industrial Realty Trust", symbol: "FR" },
        { name: "Four Corners Property Trust", symbol: "FCPT" },
        { name: "Gaming and Leisure Properties", symbol: "GLPI" },
        { name: "Getty Realty", symbol: "GTY" },
        { name: "Global Net Lease", symbol: "GNL" },
        { name: "Healthcare Realty Trust", symbol: "HR" },
        { name: "Highwoods Properties", symbol: "HIW" },
        { name: "Hudson Pacific Properties", symbol: "HPP" },
        { name: "Independence Realty Trust", symbol: "IRT" },
        { name: "Invitation Homes", symbol: "INVH" },
        { name: "JBG SMITH Properties", symbol: "JBGS" },
        { name: "Kilroy Realty", symbol: "KRC" },
        { name: "Kite Realty Group Trust", symbol: "KRG" },
        { name: "Lamar Advertising", symbol: "LAMR" },
        { name: "LTC Properties", symbol: "LTC" },
        { name: "Macerich", symbol: "MAC" },
        { name: "Medical Properties Trust", symbol: "MPW" },
        { name: "Mid-America Apartment Communities", symbol: "MAA" },
        { name: "National Health Investors", symbol: "NHI" },
        { name: "National Retail Properties", symbol: "NNN" },
        { name: "National Storage Affiliates Trust", symbol: "NSA" },
        { name: "Omega Healthcare Investors", symbol: "OHI" },
        { name: "Outfront Media", symbol: "OUT" },
        { name: "Paramount Group", symbol: "PGRE" },
        { name: "Park Hotels & Resorts", symbol: "PK" },
        { name: "Pebblebrook Hotel Trust", symbol: "PEB" },
        { name: "Physicians Realty Trust", symbol: "DOC" },
        { name: "Piedmont Office Realty Trust", symbol: "PDM" },
        { name: "PotlatchDeltic", symbol: "PCH" },
        { name: "Rayonier", symbol: "RYN" },
        { name: "Regency Centers", symbol: "REG" },
        { name: "Rexford Industrial Realty", symbol: "REXR" },
        { name: "Ryman Hospitality Properties", symbol: "RHP" },
        { name: "Sabra Health Care REIT", symbol: "SBRA" },
        { name: "Safehold", symbol: "SAFE" },
        { name: "SL Green Realty", symbol: "SLG" },
        { name: "STAG Industrial", symbol: "STAG" },
        { name: "Summit Hotel Properties", symbol: "INN" },
        { name: "Sun Communities", symbol: "SUI" },
        { name: "Sunstone Hotel Investors", symbol: "SHO" },
        { name: "Tanger Factory Outlet Centers", symbol: "SKT" },
        { name: "UDR", symbol: "UDR" },
        { name: "Urban Edge Properties", symbol: "UE" },
        { name: "WP Carey", symbol: "WPC" },
        { name: "Xenia Hotels & Resorts", symbol: "XHR" },
        { name: "ACI Worldwide", symbol: "ACIW" },
        { name: "Adtran", symbol: "ADTN" },
        { name: "Agilysys", symbol: "AGYS" },
        { name: "Airgain", symbol: "AIRG" },
        { name: "Alpha and Omega Semiconductor", symbol: "AOSL" },
        { name: "Applied Optoelectronics", symbol: "AAOI" },
        { name: "Appfolio", symbol: "APPF" },
        { name: "AudioCodes", symbol: "AUDC" },
        { name: "Bandwidth", symbol: "BAND" },
        { name: "Calamp", symbol: "CAMP" },
        { name: "Cantaloupe", symbol: "CTLP" },
        { name: "Cerence", symbol: "CRNC" },
        { name: "Clearfield", symbol: "CLFD" },
        { name: "Comtech Telecommunications", symbol: "CMTL" },
        { name: "Credo Technology Group", symbol: "CRDO" },
        { name: "CTS Corporation", symbol: "CTS" },
        { name: "Daktronics", symbol: "DAKT" },
        { name: "Digimarc", symbol: "DMRC" },
        { name: "Digital Turbine", symbol: "APPS" },
        { name: "Domo", symbol: "DOMO" },
        { name: "Everspin Technologies", symbol: "MRAM" },
        { name: "Evolving Systems", symbol: "EVOL" },
        { name: "Extreme Networks", symbol: "EXTR" },
        { name: "FARO Technologies", symbol: "FARO" },
        { name: "Immersion", symbol: "IMMR" },
        { name: "Inseego", symbol: "INSG" },
        { name: "Intrusion", symbol: "INTZ" },
        { name: "Intevac", symbol: "IVAC" },
        { name: "Kopin", symbol: "KOPN" },
        { name: "Lantronix", symbol: "LTRX" },
        { name: "Liveramp Holdings", symbol: "RAMP" },
        { name: "LivePerson", symbol: "LPSN" },
        { name: "Materialise NV", symbol: "MTLS" },
        { name: "NETGEAR", symbol: "NTGR" },
        { name: "Ondas Holdings", symbol: "ONDS" },
        { name: "OneSpan", symbol: "OSPN" },
        { name: "PAR Technology", symbol: "PAR" },
        { name: "Phunware", symbol: "PHUN" },
        { name: "Plexus", symbol: "PLXS" },
        { name: "PROS Holdings", symbol: "PRO" },
        { name: "Q2 Holdings", symbol: "QTWO" },
        { name: "Quantum", symbol: "QMCO" },
        { name: "QuickLogic", symbol: "QUIK" },
        { name: "Ribbon Communications", symbol: "RBBN" },
        { name: "Smith Micro Software", symbol: "SMSI" },
        { name: "Socket Mobile", symbol: "SCKT" },
        { name: "Spok Holdings", symbol: "SPOK" },
        { name: "Stride", symbol: "LRN" },
        { name: "Synchronoss Technologies", symbol: "SNCR" },
        { name: "TrueCar", symbol: "TRUE" },
        { name: "Tucows", symbol: "TCX" },
        { name: "Unisys", symbol: "UIS" },
        { name: "Veritone", symbol: "VERI" },
        { name: "Vuzix", symbol: "VUZI" },
        { name: "DoorDash", symbol: "DASH" },
        { name: "Airbnb", symbol: "ABNB" },
        { name: "Roblox", symbol: "RBLX" },
        { name: "Freshworks", symbol: "FRSH" },
        { name: "Samsara", symbol: "IOT" },
        { name: "Braze", symbol: "BRZE" },
        { name: "Marqeta", symbol: "MQ" },
        { name: "Duolingo", symbol: "DUOL" },
        { name: "Warby Parker", symbol: "WRBY" },
        { name: "Dutch Bros", symbol: "BROS" },
        { name: "Sweetgreen", symbol: "SG" },
        { name: "Allbirds", symbol: "BIRD" },
        { name: "Olaplex", symbol: "OLPX" },
        { name: "On Holding", symbol: "ONON" },
        { name: "Rent the Runway", symbol: "RENT" },
        { name: "ThredUp", symbol: "TDUP" },
        { name: "Vroom", symbol: "VRM" },
        { name: "Oscar Health", symbol: "OSCR" },
        { name: "Clover Health", symbol: "CLOV" },
        { name: "23andMe", symbol: "ME" },
        { name: "Hims & Hers", symbol: "HIMS" },
        { name: "GoodRx", symbol: "GDRX" },
        { name: "Teladoc", symbol: "TDOC" },
        { name: "American Well", symbol: "AMWL" },
        { name: "Check Point", symbol: "CHKP" },
        { name: "CyberArk", symbol: "CYBR" },
        { name: "Rapid7", symbol: "RPD" },
        { name: "Tenable", symbol: "TENB" },
        { name: "Varonis", symbol: "VRNS" },
        { name: "SailPoint", symbol: "SAIL" },
        { name: "Auth0", symbol: "AUTH" },
        { name: "LastPass", symbol: "LAST" },
        { name: "NordVPN", symbol: "NORD" },
        { name: "Private Internet Access", symbol: "PIA" },
        { name: "ProtonVPN", symbol: "PROT" },
        { name: "Mullvad", symbol: "MULL" },
        { name: "Hotspot Shield", symbol: "HSS" },
        { name: "Windscribe", symbol: "WIND" },
        { name: "TorGuard", symbol: "TOR" },
        { name: "StrongVPN", symbol: "STRG" },
        { name: "PureVPN", symbol: "PURE" },
        { name: "Hide.me", symbol: "HIDE" },
        { name: "Trust.Zone", symbol: "TRST" },
        { name: "AirVPN", symbol: "AIR" },
        { name: "Perfect Privacy", symbol: "PP" },
        { name: "Cryptostorm", symbol: "CRYP" },
        { name: "Goose VPN", symbol: "GOOS" },
        { name: "TigerVPN", symbol: "TIGR" },
        { name: "ActiVPN", symbol: "ACTI" },
        { name: "FastestVPN", symbol: "FAST" },
        { name: "LiquidVPN", symbol: "LQID" },
        { name: "Seed4.Me", symbol: "SEED" },
        { name: "Betternet", symbol: "BTTR" },
        { name: "Turbo VPN", symbol: "TRBO" },
        { name: "VPN Robot", symbol: "ROBT" },
        { name: "Secure VPN", symbol: "SECR" },
        { name: "VPN Master", symbol: "MSTR" },
        { name: "Super VPN", symbol: "SUPR" },
        { name: "VPN Pro", symbol: "VPRO" },
        { name: "UFO VPN", symbol: "UFO" },
        { name: "Bear VPN", symbol: "BEAR" },
        { name: "Eagle VPN", symbol: "EAGL" },
        { name: "Lion VPN", symbol: "LION" },
        { name: "Dragon VPN", symbol: "DRGN" },
        { name: "Unicorn VPN", symbol: "UNIC" },
        { name: "Octopus VPN", symbol: "OCTO" },
        { name: "Shark VPN", symbol: "SHRK" }
    ];

    // New market indices list
    const marketIndices = [
        { name: "Nifty 50 Index", symbol: "^NSEI" },
        { name: "S&P 500 Index", symbol: "^GSPC" },
        { name: "FTSE 100 Index", symbol: "^FTSE" },
        { name: "Bank Nifty Index", symbol: "^NSEBANK" }
    ];
    
    // Data caching
    const dataCache = new Map();
    
    // Constants
    const MAX_RETRIES = 1;
    const CONCURRENT_REQUESTS_LIMIT = 1000; // Very high limit to effectively disable batching
    
    /**
     * Get the current stock list based on selection
     * @returns {Array} List of stock objects
     */
    function getCurrentStockList() {
        switch (DTIBacktester.currentStockIndex) {
            case 'nifty50':
                return nifty50Stocks;
            case 'niftyNext50':
                return niftyNext50Stocks;
            case 'niftyMidcap150':
                return niftyMidcap150Stocks;
            case 'ftse100':
                return ftse100Stocks;
            case 'ftse250':
                return ftse250Stocks;
            case 'usStocks':
                return usStocks;
            case 'indices':
                return marketIndices;
            default:
                return nifty50Stocks;
        }
    }
    
    /**
     * Get stock lists for multi-index scan
     * @param {string} scanType - Type of scan to perform
     * @returns {Array} Combined list of stock objects
     */
    function getStocksForScanType(scanType) {
        if (typeof DTIUI !== 'undefined' && DTIUI.getStocksForSelectedScanType) {
            return DTIUI.getStocksForSelectedScanType();
        }
        
        switch(scanType) {
            case 'all':
                return [
                    ...nifty50Stocks,
                    ...niftyNext50Stocks,
                    ...niftyMidcap150Stocks,
                    ...ftse100Stocks,
                    ...ftse250Stocks,
                    ...usStocks
                ];
            case 'indian':
                return [
                    ...nifty50Stocks,
                    ...niftyNext50Stocks,
                    ...niftyMidcap150Stocks
                ];
            case 'uk':
                return [
                    ...ftse100Stocks,
                    ...ftse250Stocks
                ];
            case 'us':
                return usStocks;
            default:
                return getCurrentStockList();
        }
    }
    
    /**
     * Helper function to deduplicate stocks in combined lists
     * @param {Array} stockList - Combined list of stock objects
     * @returns {Array} Deduplicated list of stock objects
     */
    function deduplicateStocks(stockList) {
        const symbolSet = new Set();
        const uniqueStocks = [];
        
        for (const stock of stockList) {
            if (!symbolSet.has(stock.symbol)) {
                symbolSet.add(stock.symbol);
                uniqueStocks.push(stock);
            }
        }
        
        return uniqueStocks;
    }
    
/**
 * Fetch historical data from Yahoo Finance API through our proxy server
 * @param {string} symbol - Stock symbol
 * @param {string} period - Time period (e.g. '5y')
 * @param {string} interval - Data interval (e.g. '1d')
 * @param {number} retryCount - Current retry attempt
 * @returns {Promise<Array>} - Array of price data
 */
async function fetchStockData(symbol, period = '5y', interval = '1d', retryCount = 0) {
    // Check cache first
    const cacheKey = `${symbol}_${period}_${interval}`;
    if (dataCache.has(cacheKey)) {
        return dataCache.get(cacheKey);
    }
    
    try {
        // Use our local proxy server instead of cors-anywhere
        // Calculate Unix timestamps for period if needed
        const endDate = Math.floor(Date.now() / 1000);
        let startDate;
        
// In dti-data.js, find the fetchStockData function and update this section:
// Convert period to Unix timestamp
if (period === '5y') {
    startDate = endDate - (5 * 365 * 24 * 60 * 60); // 5 years in seconds
} else if (period === '2y') {
    startDate = endDate - (2 * 365 * 24 * 60 * 60); // 2 years in seconds
} else if (period === '1y') {
    startDate = endDate - (365 * 24 * 60 * 60); // 1 year in seconds
} else if (period === '6mo') {
    startDate = endDate - (182 * 24 * 60 * 60); // 6 months in seconds
} else if (period === '3mo') {
    startDate = endDate - (91 * 24 * 60 * 60); // 3 months in seconds
} else if (period === '1mo') {
    startDate = endDate - (30 * 24 * 60 * 60); // 1 month in seconds
} else if (period === 'max') {
    startDate = 0; // Far in the past for maximum available data
} else {
    // Default to 5 years if period format is not recognized
    startDate = endDate - (5 * 365 * 24 * 60 * 60);
}
        
        // Local proxy URL for historical data
        const proxyUrl = `/yahoo/history?symbol=${symbol}&period1=${startDate}&period2=${endDate}&interval=${interval}`;
        
        // Update status element
        const statusElement = document.getElementById('data-fetch-status');
        if (statusElement) {
            statusElement.innerHTML = `
                <div class="data-fetch-loading">
                    <svg class="spinner" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="2" x2="12" y2="6"></line>
                        <line x1="12" y1="18" x2="12" y2="22"></line>
                        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                        <line x1="2" y1="12" x2="6" y2="12"></line>
                        <line x1="18" y1="12" x2="22" y2="12"></line>
                        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                    </svg>
                    Fetching data for ${symbol}...
                </div>
            `;
            statusElement.style.display = 'block';
        }

        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        // Our proxy now returns CSV data directly
        const csvText = await response.text();
        
        // Process the CSV text into the format we need
        const rows = csvText.trim().split('\n');
        const headers = rows[0].toLowerCase().split(',');
        
        // Create a 2D array similar to what we'd get from Papa.parse
        const csvData = [headers];
        
        for (let i = 1; i < rows.length; i++) {
            if (rows[i].trim()) {
                csvData.push(rows[i].split(','));
            }
        }
        
        // Update status on success
        if (statusElement) {
            statusElement.innerHTML = `
                <div class="data-fetch-success">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Data fetched successfully for ${symbol}
                </div>
            `;
            
            // Hide after 3 seconds
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 3000);
        }
        
        // Store in cache
        dataCache.set(cacheKey, csvData);
        
        return csvData;
    } catch (error) {
        console.error('Error fetching stock data:', error);
        
        // Update status on error
        const statusElement = document.getElementById('data-fetch-status');
        if (statusElement) {
            statusElement.innerHTML = `
                <div class="data-fetch-error">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                    Error fetching data for ${symbol}: ${error.message}
                </div>
            `;
        }
        
        // Implement retry logic
        if (retryCount < MAX_RETRIES) {
            console.log(`Retrying fetch for ${symbol} (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
            
            // Update status to show retry
            if (statusElement) {
                statusElement.innerHTML = `
                    <div class="data-fetch-warning">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        Retrying data fetch for ${symbol} (${retryCount + 1}/${MAX_RETRIES})...
                    </div>
                `;
            }
            
            // Exponential backoff
            const delay = Math.pow(2, retryCount) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchStockData(symbol, period, interval, retryCount + 1);
        }
        
        DTIBacktester.utils.showNotification(`Failed to fetch data for ${symbol}: ${error.message}`, 'error');
        return null;
    }
}
    
/**
 * Fetch current stock quote data
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Current stock data
 */
async function fetchCurrentQuote(symbol) {
    try {
        const proxyUrl = `/yahoo/quote?symbol=${symbol}`;
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching current quote:', error);
        DTIBacktester.utils.showNotification(`Failed to fetch quote for ${symbol}: ${error.message}`, 'error');
        return null;
    }
}


    /**
     * Process Yahoo Finance data into CSV format
     * @param {Object} yahooData - Yahoo Finance API response
     * @returns {Array} - Array of price data
     */
    function processYahooFinanceData(yahooData) {
        const result = yahooData.chart.result[0];
        const quotes = result.indicators.quote[0];
        const timestamps = result.timestamp;
        
        // Create CSV data
        let csvData = [
            ['date', 'open', 'high', 'low', 'close', 'volume']
        ];
        
        for (let i = 0; i < timestamps.length; i++) {
            const date = new Date(timestamps[i] * 1000);
            const dateString = date.toISOString().split('T')[0];
            
            // Skip points with null/undefined values
            if (quotes.open[i] === null || quotes.high[i] === null || 
                quotes.low[i] === null || quotes.close[i] === null) {
                continue;
            }
            
            csvData.push([
                dateString,
                quotes.open[i],
                quotes.high[i],
                quotes.low[i],
                quotes.close[i],
                quotes.volume[i]
            ]);
        }
        
        return csvData;
    }
    
    /**
     * Convert array data to CSV string
     * @param {Array} data - Array of data
     * @returns {string} - CSV string
     */
    function arrayToCSV(data) {
        return data.map(row => row.join(',')).join('\n');
    }
    
    /**
     * Process CSV data for a single stock
     * @param {Array} data - CSV data
     * @param {Object} stock - Stock object
     * @returns {Object|null} - Processed stock data or null if error
     */
    function processStockCSV(data, stock) {
        try {
            if (!data || data.length < 2) {
                return null;
            }
            
            // Extract columns
            const headers = data[0];
            const dateIndex = headers.indexOf('date');
            const openIndex = headers.indexOf('open');
            const highIndex = headers.indexOf('high');
            const lowIndex = headers.indexOf('low');
            const closeIndex = headers.indexOf('close');
            
            if (dateIndex === -1 || openIndex === -1 || highIndex === -1 || 
                lowIndex === -1 || closeIndex === -1) {
                console.error('Missing required columns in data');
                return null;
            }
            
            // Process data rows
            let parsedData = [];
            
            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                
                if (!row || row.length <= Math.max(dateIndex, openIndex, highIndex, lowIndex, closeIndex)) {
                    continue;
                }
                
                const dateStr = row[dateIndex];
                if (!dateStr) continue;
                
                const dateObj = new Date(dateStr);
                const openVal = parseFloat(row[openIndex]);
                const highVal = parseFloat(row[highIndex]);
                const lowVal = parseFloat(row[lowIndex]);
                const closeVal = parseFloat(row[closeIndex]);
                
                if (isNaN(openVal) || isNaN(highVal) || isNaN(lowVal) || isNaN(closeVal)) {
                    continue;
                }
                
                parsedData.push({
                    date: dateObj,
                    dateStr: dateStr,
                    open: openVal,
                    high: highVal,
                    low: lowVal,
                    close: closeVal
                });
            }
            
            // Sort data chronologically
            parsedData.sort((a, b) => a.date - b.date);
            
            // Extract sorted arrays
            const dates = parsedData.map(item => item.dateStr);
            const open = parsedData.map(item => item.open);
            const high = parsedData.map(item => item.high);
            const low = parsedData.map(item => item.low);
            const close = parsedData.map(item => item.close);
            
            // Get DTI parameters (fixed values)
            const r = 14;
            const s = 10;
            const u = 5;
            
            // Calculate daily DTI - calling function from DTI indicators module
            const dti = DTIIndicators.calculateDTI(high, low, r, s, u);
            const sevenDayDTIData = DTIIndicators.calculate7DayDTI(dates, high, low, r, s, u);
            
            // Run backtest with active trade detection - calling from backtest module
            const { completedTrades, activeTrade } = DTIBacktest.backtestWithActiveDetection(dates, close, dti, sevenDayDTIData);
            
            return {
                stock: stock,
                dates: dates,
                close: close,
                dti: dti,
                sevenDayDTIData: sevenDayDTIData,
                trades: completedTrades,
                activeTrade: activeTrade
            };
        } catch (error) {
            console.error('Error processing stock data:', error);
            return null;
        }
    }
    
    /**
     * Process stocks in batches with a throttled approach
     * @param {Array} stockList - List of stocks to process
     * @param {function} progressCallback - Callback to update progress
     * @param {string} period - Time period
     * @returns {Promise<Array>} - Array of processed stock data
     */
    async function processStocksBatch(stockList, progressCallback, period = '5y') {
        const processedData = [];
        let successCount = 0;
        let errorCount = 0;
        let totalProcessed = 0;
        
        // Process stocks in batches to avoid overwhelming the API
        const batchSize = CONCURRENT_REQUESTS_LIMIT;
        const batches = [];
        
        // Split the stock list into batches
        for (let i = 0; i < stockList.length; i += batchSize) {
            batches.push(stockList.slice(i, i + batchSize));
        }
        
        // Process each batch sequentially
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            const batchPromises = batch.map(stock => 
                fetchStockData(stock.symbol, period)
                .then(data => {
                    if (!data || data.length <= 1) {
                        errorCount++;
                        return null;
                    }
                    
                    const parsed = processStockCSV(data, stock);
                    if (parsed) {
                        successCount++;
                        return parsed;
                    } else {
                        errorCount++;
                        return null;
                    }
                })
                .catch(error => {
                    console.error(`Error processing ${stock.name}:`, error);
                    errorCount++;
                    return null;
                })
                .finally(() => {
                    totalProcessed++;
                    if (progressCallback) {
                        progressCallback(totalProcessed, stockList.length, successCount, errorCount);
                    }
                })
            );
            
            // Wait for all promises in the batch to resolve
            const batchResults = await Promise.all(batchPromises);
            
            // Add valid results to the processed data array
            batchResults.forEach(result => {
                if (result) {
                    processedData.push(result);
                }
            });
            
            // Add a small delay between batches to avoid overwhelming the API
            if (batchIndex < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        return processedData;
    }
    
    /**
     * Fetch data for all stocks in the current index or selected scan type
     * @returns {Promise} Promise that resolves when all data is fetched
     */
    async function fetchAllStocksData() {
        // Prevent multiple runs
        if (DTIBacktester.isProcessing) {
            DTIBacktester.utils.showNotification('Scan already in progress, please wait', 'info');
            return Promise.reject(new Error('Process already running'));
        }
        
        DTIBacktester.isProcessing = true;
        
        // Get the selected period from the dropdown
        const periodSelector = document.getElementById('period-selector');
        const period = periodSelector ? periodSelector.value : '5y';
        
        // Check for scan type selector (for multi-index scans)
        const scanTypeSelector = document.getElementById('scan-type-selector');
        const scanType = scanTypeSelector ? scanTypeSelector.value : 'current';
        
        // Get stock list based on scan type
        let stockList;
        if (scanType === 'current') {
            stockList = getCurrentStockList();
        } else {
            stockList = getStocksForScanType(scanType);
            // Deduplicate in case there are overlapping stocks
            stockList = deduplicateStocks(stockList);
        }
        
        // Get display name for the current scan
        let scanDisplayName;
        if (scanType === 'current') {
            scanDisplayName = 
                DTIBacktester.currentStockIndex === 'nifty50' ? 'Nifty 50' : 
                DTIBacktester.currentStockIndex === 'niftyNext50' ? 'Nifty Next 50' : 
                DTIBacktester.currentStockIndex === 'niftyMidcap150' ? 'Nifty Midcap 150' : 
                DTIBacktester.currentStockIndex === 'ftse100' ? 'FTSE 100' :
                DTIBacktester.currentStockIndex === 'ftse250' ? 'FTSE 250' :
                DTIBacktester.currentStockIndex === 'usStocks' ? 'US Stocks' :
                DTIBacktester.currentStockIndex === 'indices' ? 'Market Indices' : 'Selected Stocks';
        } else {
            scanDisplayName = scanTypeSelector.options[scanTypeSelector.selectedIndex].text;
        }
        
        // Show batch processing status
        const statusDiv = document.getElementById('batch-status');
        if (statusDiv) {
            statusDiv.innerHTML = `
                <div>Processing ${scanDisplayName} (${stockList.length} stocks): 0/${stockList.length}</div>
                <div class="progress-bar"><div class="progress" style="width: 0%"></div></div>
            `;
            statusDiv.style.display = 'block';
        }
        
        // Clear previous active trade opportunities
        DTIBacktester.activeTradeOpportunities = [];
        DTIBacktester.allStocksData = [];
        
        // Process stocks with progress updates
        return new Promise(async (resolve, reject) => {
            try {
                // Create a progress callback function
                const updateProgress = (processed, total, successes, errors) => {
                    if (statusDiv) {
                        const percentComplete = Math.round((processed / total) * 100);
                        statusDiv.innerHTML = `
                            <div>Processing ${scanDisplayName} (${stockList.length} stocks): ${processed}/${total}</div>
                            <div class="progress-bar"><div class="progress" style="width: ${percentComplete}%"></div></div>
                            <div style="margin-top: 8px; font-size: 12px;">
                                ${successes} succeeded, ${errors} failed, ${processed} processed
                            </div>
                        `;
                    }
                };
                
                // Process stocks in batches
                const processedData = await processStocksBatch(stockList, updateProgress, period);
                
                // Store the stock data
                DTIBacktester.allStocksData = processedData;
                
                // Extract active trade opportunities
                processedData.forEach(data => {
                    if (data.activeTrade) {
                        DTIBacktester.activeTradeOpportunities.push({
                            stock: data.stock,
                            trade: data.activeTrade,
                            data: data
                        });
                    }
                });
                
                // Update status when complete
                if (statusDiv) {
                    statusDiv.innerHTML = `
                        <div class="batch-complete">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            Completed processing ${processedData.length} of ${stockList.length} stocks
                        </div>
                        <div class="progress-bar"><div class="progress" style="width: 100%"></div></div>
                        <div style="margin-top: 8px; font-size: 12px; display: flex; justify-content: space-between;">
                            <span>${processedData.length} stocks processed successfully</span>
                            <span>${DTIBacktester.activeTradeOpportunities.length} active trading opportunities found</span>
                        </div>
                    `;
                }
                
                // Display active trade opportunities
                if (typeof DTIUI !== 'undefined' && DTIUI.displayBuyingOpportunities) {
                    DTIUI.displayBuyingOpportunities();
                }
                
                // Reset processing flag
                DTIBacktester.isProcessing = false;
                
                // Show notification
                DTIBacktester.utils.showNotification(
                    `Scan complete: Found ${DTIBacktester.activeTradeOpportunities.length} opportunities in ${processedData.length} stocks`, 
                    'success'
                );
                
                resolve(DTIBacktester.allStocksData);
            } catch (error) {
                if (statusDiv) {
                    statusDiv.innerHTML = `
                        <div class="batch-error">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="15" y1="9" x2="9" y2="15"></line>
                                <line x1="9" y1="9" x2="15" y2="15"></line>
                            </svg>
                            Error in batch processing: ${error.message}
                        </div>
                    `;
                }
                
                // Reset processing flag
                DTIBacktester.isProcessing = false;
                
                // Show notification
                DTIBacktester.utils.showNotification(`Scan failed: ${error.message}`, 'error');
                
                reject(error);
            }
        });
    }
    
    /**
     * Process CSV data from a file upload
     * @param {Object} results - Papa Parse results
     */
    function processCSV(results) {
        // Prevent multiple processing
        if (DTIBacktester.isProcessing) {
            DTIBacktester.utils.showNotification('Processing in progress, please wait', 'info');
            return;
        }
        
        DTIBacktester.isProcessing = true;
        
        // Show loading indicator for process button
        const processBtn = document.getElementById('process-btn');
        const originalBtnText = processBtn.innerHTML;
        
        processBtn.disabled = true;
        processBtn.innerHTML = `
            <svg class="spinner" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="2" x2="12" y2="6"></line>
                <line x1="12" y1="18" x2="12" y2="22"></line>
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                <line x1="2" y1="12" x2="6" y2="12"></line>
                <line x1="18" y1="12" x2="22" y2="12"></line>
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
            </svg>
            Processing...
        `;
        
        try {
            const data = results.data;
            
            // Check if data is empty
            if (!data || data.length < 2) {
                throw new Error('CSV file appears to be empty or invalid');
            }
            
            // Detect CSV format
            const formatInfo = detectCSVFormat(data);
            
            // Display CSV format info
            const csvInfoElement = document.getElementById('csv-info');
            csvInfoElement.style.display = 'block';
            csvInfoElement.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                    <div>
                        <strong>CSV Format:</strong> ${formatInfo.format === 'new' ? 'New Format' : 'Original Format'}<br>
                        <strong>Columns:</strong> ${formatInfo.headers.join(', ')}
                    </div>
                </div>
            `;
            
            // Extract columns
            let parsedData = [];
            
            // Skip header row and process data
            for (let i = 1; i < data.length; i++) {
                if (!data[i] || !Array.isArray(data[i])) {
                    continue; // Skip invalid rows
                }
                
                if (data[i].length <= Math.max(formatInfo.dateIndex, formatInfo.openIndex, formatInfo.highIndex, formatInfo.lowIndex, formatInfo.closeIndex)) {
                    continue; // Skip rows with insufficient columns
                }
                
                // Convert strings to numbers, handling possible invalid data
                const dateStr = data[i][formatInfo.dateIndex];
                
                if (!dateStr) continue; // Skip rows without a date
                
                // Special handling for date format like "22-Apr-25"
                let dateObj;
                if (typeof dateStr === 'string' && dateStr.includes('-')) {
                    // Handle format like "22-Apr-25"
                    const dateParts = dateStr.split('-');
                    if (dateParts.length === 3) {
                        const day = parseInt(dateParts[0], 10);
                        const month = DTIBacktester.utils.parseMonth(dateParts[1]);
                        // Handle 2-digit year, assume 20xx
                        let year = parseInt(dateParts[2], 10);
                        if (year < 100) {
                            year += 2000;
                        }
                        
                        // Create date object
                        dateObj = new Date(year, month, day);
                    } else {
                        dateObj = new Date(dateStr);
                    }
                } else {
                    dateObj = new Date(dateStr);
                }
                
                // Try to parse numeric values, handling strings that might have commas
                const openVal = DTIBacktester.utils.parseFloatSafe(data[i][formatInfo.openIndex]);
                const highVal = DTIBacktester.utils.parseFloatSafe(data[i][formatInfo.highIndex]);
                const lowVal = DTIBacktester.utils.parseFloatSafe(data[i][formatInfo.lowIndex]);
                const closeVal = DTIBacktester.utils.parseFloatSafe(data[i][formatInfo.closeIndex]);
                
                if (isNaN(openVal) || isNaN(highVal) || isNaN(lowVal) || isNaN(closeVal)) {
                    console.log(`Skipping row ${i} due to invalid numeric data:`, {
                        open: data[i][formatInfo.openIndex],
                        high: data[i][formatInfo.highIndex],
                        low: data[i][formatInfo.lowIndex],
                        close: data[i][formatInfo.closeIndex]
                    });
                    continue; // Skip rows with invalid numeric data
                }
                
                parsedData.push({
                    date: dateObj,
                    dateStr: dateStr,
                    open: openVal,
                    high: highVal,
                    low: lowVal,
                    close: closeVal
                });
            }
            
            // Sort data chronologically
            parsedData.sort((a, b) => a.date - b.date);
            
            // Extract sorted arrays
            const dates = parsedData.map(item => item.dateStr);
            const open = parsedData.map(item => item.open);
            const high = parsedData.map(item => item.high);
            const low = parsedData.map(item => item.low);
            const close = parsedData.map(item => item.close);
            
            // Check if we have enough data points
            if (dates.length < 30) {
                throw new Error('Not enough valid data points found in CSV. Please ensure you have at least 30 valid rows.');
            }
            
            // Get parameters for DTI calculation (fixed values)
            const r = 14;
            const s = 10;
            const u = 5;
            
            // Calculate daily DTI - using DTIIndicators module
            const dti = DTIIndicators.calculateDTI(high, low, r, s, u);
            
            // Calculate 7-day DTI - using DTIIndicators module
            const sevenDayDTIData = DTIIndicators.calculate7DayDTI(dates, high, low, r, s, u);
            
            // Run backtest - using DTIBacktest module
            const { completedTrades, activeTrade } = DTIBacktest.backtestWithActiveDetection(dates, close, dti, sevenDayDTIData);
            const allTrades = [...completedTrades];
            if (activeTrade) allTrades.push(activeTrade);
            
            // Store OHLC data globally for chart access
            DTIBacktester.ohlcData = {
                dates: dates,
                open: open,
                high: high,
                low: low,
                close: close
            };
            
            // Display results with animation using DTIUI module
            setTimeout(() => {
                if (typeof DTIUI !== 'undefined') {
                    // Pass OHLC data structure instead of just close prices
                    DTIUI.createCharts(dates, close, dti, sevenDayDTIData, { open, high, low });
                    DTIUI.displayStatistics(allTrades);
                    DTIUI.displayTrades(allTrades);
                }
                
                // Show success notification
                DTIBacktester.utils.showNotification(`Backtest completed with ${completedTrades.length} trades`, 'success');
            }, 200);
        } catch (error) {
            console.error('Error processing CSV:', error);
            DTIBacktester.utils.showNotification('Error processing CSV file: ' + error.message, 'error');
        } finally {
            // Reset button state
            setTimeout(() => {
                processBtn.disabled = false;
                processBtn.innerHTML = originalBtnText;
                DTIBacktester.isProcessing = false;
            }, 500);
        }
    }
    
    /**
     * Detect CSV format and extract data
     * @param {Array} data - CSV data
     * @returns {Object} - Format information
     */
    function detectCSVFormat(data) {
        if (!data || data.length < 2) {
            throw new Error('CSV file appears to be empty or invalid');
        }
        
        const headers = data[0].map(h => (h || '').toString().trim().toLowerCase());
        const formatInfo = { headers: headers };
        
        console.log("Detected headers:", headers);
        
        // For the new format with named columns
        if (headers.includes('open') || headers.includes('high') || headers.includes('low') || 
            headers.includes('close') || headers.includes('ltp')) {
            formatInfo.format = 'new';
            
            // Find indices with fallbacks for different possible names
            formatInfo.dateIndex = headers.indexOf('date');
            formatInfo.openIndex = headers.indexOf('open');
            formatInfo.highIndex = headers.indexOf('high');
            formatInfo.lowIndex = headers.indexOf('low');
            
            // Try both 'close' and 'ltp' for closing price
            if (headers.indexOf('close') !== -1) {
                formatInfo.closeIndex = headers.indexOf('close');
            } else if (headers.indexOf('ltp') !== -1) {
                formatInfo.closeIndex = headers.indexOf('ltp');
            } else {
                // Default to the 7th column (index 6) if 'close' is not found
                formatInfo.closeIndex = 6;
            }
        } 
        // Original format with fixed positions
        else if (headers.length >= 6) {
            formatInfo.format = 'original';
            formatInfo.dateIndex = 1;  // Date in second column
            formatInfo.openIndex = 2;  // Open in third column
            formatInfo.highIndex = 3;  // High in fourth column
            formatInfo.lowIndex = 4;   // Low in fifth column
            formatInfo.closeIndex = 5; // Close in sixth column
        } 
        else {
            throw new Error('Unrecognized CSV format. Please ensure your data includes date, open, high, low, close columns.');
        }
        
        console.log("Format detection results:", {
            format: formatInfo.format,
            dateIndex: formatInfo.dateIndex,
            openIndex: formatInfo.openIndex,
            highIndex: formatInfo.highIndex,
            lowIndex: formatInfo.lowIndex,
            closeIndex: formatInfo.closeIndex
        });
        
        return formatInfo;
    }
    
    /**
     * Clear data cache
     * Useful for freeing memory after large scans
     */
    function clearDataCache() {
        dataCache.clear();
        console.log("Data cache cleared");
        DTIBacktester.utils.showNotification("Data cache cleared", "info");
    }
    
    // Return public API
    return {
        getCurrentStockList,
        fetchStockData,
	fetchCurrentQuote,
        arrayToCSV,
        processStockCSV,
        fetchAllStocksData,
        processCSV,
        detectCSVFormat,
        clearDataCache,
        
        // Stock lists exposed for access by other modules
        getStockLists() {
            return {
                nifty50: nifty50Stocks,
                niftyNext50: niftyNext50Stocks,
                niftyMidcap150: niftyMidcap150Stocks,
                ftse100: ftse100Stocks,
                ftse250: ftse250Stocks,
                usStocks: usStocks,
                indices: marketIndices
            };
        }
    };
})();

// Make DTIData available globally
window.DTIData = DTIData;