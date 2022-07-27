function fetchSymbols(spreadsheetName) {
  // var sourceSS = SpreadsheetApp.openById("1cSUkD6webjHIIFevVGc534bRvjqO1iqdRDxcpLneMdI");
  var sourceSS = SpreadsheetApp.getActiveSpreadsheet();
  var cryptoSheet = sourceSS.getSheetByName(spreadsheetName);
  var Avals = cryptoSheet.getRange("B2:B").getValues();

  var numberOfValues = Avals.filter(String).length;
  var RangeVals = cryptoSheet.getRange(2,2,numberOfValues).getValues();
  // console.log(RangeVals)

  let commaSeparatedSymbols = "";
  RangeVals.map((currentValue) => {
    // console.log(currentValue)
    commaSeparatedSymbols = commaSeparatedSymbols + ',' + currentValue
  })

  console.log("final: " + commaSeparatedSymbols.substring(1))
  return commaSeparatedSymbols.substring(1)
}


 // Generate HTML query string from given object. Adapted from http://stackoverflow.com/a/18116302/1677912
function toHtmlQuery_(obj) { return "?" + Object.keys(obj).reduce(function (a, k) { a.push(k + '=' + encodeURIComponent(obj[k])); return a }, []).join('&') };


function getCoinInfo(symbolList) {

  // ------------------------------------------------------------------------------------
  const { coinMarketCapApiKey } = getConstants();
  // ------------------------------------------------------------------------------------

  // GET Request Template Styled Parameters:
  var apiParams = {
    'symbol': symbolList,
    'convert': 'NZD',
    'aux': 'circulating_supply'
  };

  // For GET, Encode params object as a URI escaped query string
  var encParams = toHtmlQuery_(apiParams);

  // GET Request Headers:
  var params = {
    'method' : 'GET',
    'headers' : {'X-CMC_PRO_API_KEY': coinMarketCapApiKey}, 
    'json': true, 
    'gzip': true
  };

  var url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest'; 
  var result = UrlFetchApp.fetch(url+encParams, params); 
  var txt = result.getContentText();
  // console.log(txt);
  return txt
}


formatAndReplaceCoinData = (rawText, spreadsheetName) => {

  const rawJson = JSON.parse(rawText);

  // let sourceSS = SpreadsheetApp.openById("1cSUkD6webjHIIFevVGc534bRvjqO1iqdRDxcpLneMdI");
  let sourceSS = SpreadsheetApp.getActiveSpreadsheet();
  let cryptoSheet = sourceSS.getSheetByName(spreadsheetName);
  let counter = 0;

  for (const coin in rawJson.data) {

    // console.log(rawJson.data[coin]);
    const currentCoin = rawJson.data[coin];

    // Set values in spreadsheet (by column):

    // console.log([[currentCoin.quote.NZD.percent_change_24h]])
    // console.log([[currentCoin.quote.NZD.price]])
    // console.log(currentCoin.name);
    // console.log(currentCoin.quote.NZD.volume_24h/100);
    // console.log(currentCoin.quote.NZD.percent_change_1h/100);
    // console.log(currentCoin.quote.NZD.percent_change_24h/100);
    // console.log(currentCoin.quote.NZD.percent_change_7d/100);
    // console.log(currentCoin.quote.NZD.percent_change_30d/100);
    // console.log(currentCoin.quote.NZD.price/100);

    cryptoSheet.getRange(counter+2, 6, 1).setValues([[currentCoin.quote.NZD.volume_24h / 100]]);
    // cryptoSheet.getRange(counter+2, 6, 1).setNumberFormat("0.#0%");
    cryptoSheet.getRange(counter+2, 7, 1).setValues([[currentCoin.quote.NZD.percent_change_1h / 100]]);
    cryptoSheet.getRange(counter+2, 7, 1).setNumberFormat("0.#0%");
    cryptoSheet.getRange(counter+2, 4, 1).setValues([[currentCoin.quote.NZD.percent_change_24h / 100]]);
    cryptoSheet.getRange(counter+2, 4, 1).setNumberFormat("0.#0%");
    cryptoSheet.getRange(counter+2, 9, 1).setValues([[currentCoin.quote.NZD.percent_change_7d / 100]]);
    cryptoSheet.getRange(counter+2, 9, 1).setNumberFormat("0.#0%");
    cryptoSheet.getRange(counter+2, 10, 1).setValues([[currentCoin.quote.NZD.percent_change_30d / 100]]);
    cryptoSheet.getRange(counter+2, 10, 1).setNumberFormat("0.#0%");
    // console.log(currentCoin.name.concat(currentCoin.quote.NZD.price.toString()));
    // cryptoSheet.getRange(counter+2, 13, 1).setValues([[currentCoin.name.concat(currentCoin.quote.NZD.price.toString())]]);
    cryptoSheet.getRange(counter+2, 13, 1).setValues([[currentCoin.quote.NZD.price.toString()]]);

    counter++;
  }


  // Example CoinMarketCap Quotes Latest API response:

  // { id: 52,
  // name: 'XRP',
  // symbol: 'XRP',
  // slug: 'xrp',
  // circulating_supply: 46542338341,
  // last_updated: '2021-09-07T03:13:12.000Z',
  // quote: 
  //  { NZD: 
  //     { price: 1.9345709036977519,
  //       volume_24h: 10029877468.89659,
  //       percent_change_1h: 0.08672644,
  //       percent_change_24h: 3.49445796,
  //       percent_change_7d: 18.79914411,
  //       percent_change_30d: 70.92602015,
  //       percent_change_60d: 125.09003218,
  //       percent_change_90d: 63.10795774,
  //       market_cap: 90039453544.5549,
  //       market_cap_dominance: 2.706,
  //       fully_diluted_market_cap: 193457090369.77936,
  //       last_updated: '2021-09-07T03:15:07.000Z' } } }


  // console.log("final lists:")
  // console.log(dayGainPercentage)
  // console.log(realtimePrice)

  // Set values in spreadsheet (by column):

  

  // const columnLength = realtimePrice.length;
  // cryptoSheet.getRange(2, 4, 1, columnLength).setValues(dayGainPercentage);
  // cryptoSheet.getRange(2, 8, 1, columnLength).setValues(realtimePrice);

  // need to extract the 4 fields for each coin - x times
  // need to calculate the other fields for each coin based off the info we get - x times
  // need to update the spreadsheet rows - x times OR we store them in arrays for their respective column and update each column at once? 
  // 

};


// triggered when spreadsheet opens:
function portfolioTrigger() {
  symbolList = fetchSymbols('Crypto Portfolio');
  coinmarketcapResponse = getCoinInfo(symbolList);
  formatAndReplaceCoinData(coinmarketcapResponse, 'Crypto Portfolio');

  // this.arrayThis("Crypto Portfolio!B1:B"); //COLUMN WHERE YOU WANT TO HAVE THE RESULT
  this.arrayThis("Crypto Portfolio!C1:C");
  // // this.arrayThis("Crypto Portfolio!D1:D"); C E H K L N O P Q
  this.arrayThis("Crypto Portfolio!E1:E");
  // this.arrayThis("Crypto Portfolio!F1:F");
  // this.arrayThis("Crypto Portfolio!G1:G");
  this.arrayThis("Crypto Portfolio!H1:H");
  // this.arrayThis("Crypto Portfolio!I1:I");
  // this.arrayThis("Crypto Portfolio!J1:J");
  this.arrayThis("Crypto Portfolio!K1:K");
  this.arrayThis("Crypto Portfolio!L1:L");
  // this.arrayThis("Crypto Portfolio!M1:M");
  this.arrayThis("Crypto Portfolio!N1:N");
  this.arrayThis("Crypto Portfolio!O1:O");
  this.arrayThis("Crypto Portfolio!P1:P");
  this.arrayThis("Crypto Portfolio!Q1:Q");
}


function arrayThis(range) {
    SpreadsheetApp.getActiveSpreadsheet().getRange(range).setValue(SpreadsheetApp.getActiveSpreadsheet().getRange(range).getCell(1,1).getFormula());
}


function defiTotalsTrigger() {
  symbolList = fetchSymbols('DeFi TOTALS');
  coinmarketcapResponse = getCoinInfo(symbolList);
  formatAndReplaceDefiTotals(coinmarketcapResponse, symbolList, 'DeFi TOTALS');

  this.arrayThis("DeFi TOTALS!C1:C");
}


// OG one before adding correct ordering
formatAndReplaceWatchlist = (rawText, symbolList, spreadsheetName) => {

  const rawJson = JSON.parse(rawText);

  let sourceSS = SpreadsheetApp.getActiveSpreadsheet();
  let cryptoSheet = sourceSS.getSheetByName(spreadsheetName);
  let counter = 0;

  for (const coin in rawJson.data) {

    // console.log(rawJson.data[coin]);
    const currentCoin = rawJson.data[coin];

    // Set values in spreadsheet (by column):

    cryptoSheet.getRange(counter+2, 2, 1).setValues([[currentCoin.name]]);
    cryptoSheet.getRange(counter+2, 6, 1).setValues([[currentCoin.quote.NZD.percent_change_1h / 100]]);
    cryptoSheet.getRange(counter+2, 6, 1).setNumberFormat("0.#0%");
    cryptoSheet.getRange(counter+2, 7, 1).setValues([[currentCoin.quote.NZD.percent_change_24h / 100]]);
    cryptoSheet.getRange(counter+2, 7, 1).setNumberFormat("0.#0%");
    cryptoSheet.getRange(counter+2, 8, 1).setValues([[currentCoin.quote.NZD.percent_change_7d / 100]]);
    cryptoSheet.getRange(counter+2, 8, 1).setNumberFormat("0.#0%");
    cryptoSheet.getRange(counter+2, 9, 1).setValues([[currentCoin.quote.NZD.percent_change_30d / 100]]);
    cryptoSheet.getRange(counter+2, 9, 1).setNumberFormat("0.#0%");
    // Full Realtime Price:
    cryptoSheet.getRange(counter+2, 5, 1).setValues([[currentCoin.quote.NZD.price.toString()]]);
    // Volume:
    cryptoSheet.getRange(counter+2, 10, 1).setValues([[currentCoin.quote.NZD.volume_24h / 100]]);

    counter++;
  }
};


formatAndReplaceDefiTotals = (rawText, symbols, spreadsheetName) => {

  const rawJson = JSON.parse(rawText);

  let sourceSS = SpreadsheetApp.getActiveSpreadsheet();
  let cryptoSheet = sourceSS.getSheetByName(spreadsheetName);

  const symbolList = symbols.split(',');
  // const keyList = Object.keys(rawJson.data);

  for (let i = 0; i < symbolList.length; i++) {
    const symbol = symbolList[i].toUpperCase()
    // console.log("symbol: " + symbol)

    // iterate the coinmarketcap API response and find the matching ticker from my watchlist's ticker symbols list:
    // const matchedTicker = keyList.filter(sym => {
    //   return keyList[i] == sym
    // });
    // console.log(matchedTicker)
    // const tickerData = rawJson.data[matchedTicker]
    const tickerData = rawJson.data[symbol]

    // Set values in spreadsheet (by column):

    // cryptoSheet.getRange(i+2, 1, 1).setValues([[symbol]]);
    // cryptoSheet.getRange(i+2, 2, 1).setValues([[tickerData.name]]);
    // cryptoSheet.getRange(i+2, 6, 1).setValues([[tickerData.quote.NZD.percent_change_1h / 100]]);
    // cryptoSheet.getRange(i+2, 6, 1).setNumberFormat("0.#0%");
    // cryptoSheet.getRange(i+2, 7, 1).setValues([[tickerData.quote.NZD.percent_change_24h / 100]]);
    // cryptoSheet.getRange(i+2, 7, 1).setNumberFormat("0.#0%");
    // cryptoSheet.getRange(i+2, 8, 1).setValues([[tickerData.quote.NZD.percent_change_7d / 100]]);
    // cryptoSheet.getRange(i+2, 8, 1).setNumberFormat("0.#0%");
    // cryptoSheet.getRange(i+2, 9, 1).setValues([[tickerData.quote.NZD.percent_change_30d / 100]]);
    // cryptoSheet.getRange(i+2, 9, 1).setNumberFormat("0.#0%");

    //get current quantities:
    const quantity = cryptoSheet.getRange(i+2, 3, 1).getValues();
    console.log("quan fetched:", quantity[0][0])
    // Full Realtime Price:
    cryptoSheet.getRange(i+2, 4, 1).setValues([[(quantity[0][0] * tickerData.quote.NZD.price).toString()]]);
    // Volume:
    // cryptoSheet.getRange(i+2, 10, 1).setValues([[tickerData.quote.NZD.volume_24h / 100]]);
  }
};


function onEditTrigger() {
  // trigger a refresh on main portfolio + watchlist values:
  // portfolioTrigger();
  // watchlistTrigger();
  defiTotalsTrigger();
}