function dailyFetchDefiBalances() {
  const {networkList, walletAddressList, zapperFiAPIKey } = getConstants();
  const rawStakedTokenBalances = fetchWalletBalances(networkList, walletAddressList, zapperFiAPIKey, "apps");
  const rawWalletBalances = fetchWalletBalances(networkList, walletAddressList, zapperFiAPIKey, "tokens");

  const finalStakedTokenFormattedJson = formatStakedTokenResponses(rawStakedTokenBalances);
  const finalCombinedFormattedJson = formatRawWalletResponses(finalStakedTokenFormattedJson, rawWalletBalances);

  const finalFormattedData = constructSpreadsheetData(finalCombinedFormattedJson);
  updateDefiSpreadsheet(finalFormattedData);
  this.arrayThis("DeFi Summary!L1:L");
};


const fetchWalletBalances = (networkList, walletAddressList, zapperFiAPIKey, tokenType) => {
  const url = "https://api.zapper.fi/v2/balances/" + tokenType;

  const headers = {
    "Authorization" : "Basic " + Utilities.base64Encode(zapperFiAPIKey + ':' + "")
  };

  const params = {
    'method' : 'GET',
    "headers":headers,
    'json': true, 
    'gzip': true
  };

  const addressesSplitArray = walletAddressList.split(",");
  const networksSplitArray = networkList.split(",");

  let encParams = `?bundled=false`;
  // wallets
  addressesSplitArray.map(address => {
    encParams += `&addresses%5B%5D=${address}`;
  });
  // networks
  networksSplitArray.map(network => {
    encParams += `&networks%5B%5D=${network}`;
  });

  // --- REQUEST --- //  
  const result = UrlFetchApp.fetch(url + encParams, params);
  const responseText = result.getContentText();
  // console.log("fetchWalletBalances resp:", responseText);
  return responseText;
};


formatStakedTokenResponses = (rawWalletBalances) => {
  let finalProtocolStats = [];

  const balancesArray = JSON.parse(rawWalletBalances);

  // for each individual protocol:network pair:
  for (const i in balancesArray) {
    // Logger.log("item:")
    // Logger.log(balancesArray[i])

    const payload = balancesArray[i];

    // iterate app sub-element and fetch each individual holding out of it:
    if (payload) {
      const protocol = payload.appId;
      const walletAddress = payload.address;

      // Blacklisted Networks/Protocols:
      if (protocol.toLowerCase() === "geist") {
        continue;
      }

      const assetResp = extractAssets(payload);

      // If we already have an element in the final array for this Protocol:
      if (finalProtocolStats[protocol]) {
        // if assetResp wallet address is the same, take the object value out existing finalProtocolStats matching 
        // the wallet address, combine the existing with old one, then form full new final object.
        if (finalProtocolStats[protocol][walletAddress]) {
          const newElement = assetResp[walletAddress];
          for (const element in newElement) {
            finalProtocolStats[protocol][walletAddress].push(newElement[element]);
          }
        }
        // else if there is already a value for this Protocol, but there isn't a matching sub-element for this wallet yet, then combine existing sub-elements with this:
        else if (finalProtocolStats[protocol]) {
          Object.assign(finalProtocolStats[protocol], assetResp)
        }
      } 
      else {
        finalProtocolStats[protocol] = assetResp;
      }
    }
    // Else if there was a value inside payload > errors we skip this protocol entry:
    else {
      continue;
    }
  }
  // console.log("FINAL formatStakedTokenResponses", finalProtocolStats);
  return finalProtocolStats;
};


// Take in the existing nicely formatted formatedStakedTokenJson, and combine it with the newly formatted rawWalletBalances:
formatRawWalletResponses = (formatedStakedTokenJson, rawWalletBalances) => {
  let finalProtocolStats = formatedStakedTokenJson;

  const walletsArray = JSON.parse(rawWalletBalances);

  // for each wallet address found:
  for (const walletAddress in walletsArray) {
    // Logger.log("WALLET item:")
    // Logger.log(JSON.stringify(walletsArray[walletAddress]))

    const tokenArray = walletsArray[walletAddress];

    if (tokenArray) {
      const protocol = "WALLET"; // there is no protocol since it is just a token sitting in our wallet, therefore hardcode it.
      const type = "WALLET";

      let assetResp = {};

      tokenArray.map((token) => {
          const assetResponse = extractWalletTokenData(token, protocol, null, walletAddress, null, type, null);
          // console.log(JSON.stringify(assetResponse))
          if (assetResp[walletAddress]) {
          assetResp[walletAddress].push(assetResponse);
          } else {
          assetResp[walletAddress] = [assetResponse];
          }
      });

      // If we already have an element in the final array for this Protocol:
      if (finalProtocolStats[protocol]) {
        // if assetResp wallet address is the same, take the object value out existing finalProtocolStats matching 
        // the wallet address, combine the existing with old one, then form full new final object.
        if (finalProtocolStats[protocol][walletAddress]) {
          const newElement = assetResp[walletAddress];
          for (const element in newElement) {
            finalProtocolStats[protocol][walletAddress].push(newElement[element]);
          }
        }
        // else if there is already a value for this Protocol, but there isn't a matching sub-element for this wallet yet, then combine existing sub-elements with this:
        else if (finalProtocolStats[protocol]) {
          Object.assign(finalProtocolStats[protocol], assetResp)
        }
      } 
      else {
        finalProtocolStats[protocol] = assetResp;
      }
    }
    // Else if there was a value inside payload > errors we skip this protocol entry:
    else {
      continue;
    }
  }
  // console.log("FINAL formatStakedTokenResponses", finalProtocolStats);
  return finalProtocolStats;
};


extractAssets = (assetPayload) => {
  // Logger.log("extractAssets payload:");
  // Logger.log(assetPayload);
  let finalAssetStats = {};

  function isEmpty(obj) {
    return Object.keys(obj).length === 0;
  }

  const protocol = assetPayload.appName;
  // Logger.log("PROTOCOL: -------------------------------------------------------------------");
  // Logger.log(protocol);
  // Logger.log("-------------------------------------------------------------------");

  const network = assetPayload.network;
  const walletAddress = assetPayload.address;
  finalAssetStats[walletAddress] = [];


  // FIRST WE EXTRACT ANY DATA OUT OF THESE HARDCODED TOP FIELDS INSIDE "Balance" OF EACH PROTOCOL's JSON RESPONSE:

  // deposits
  // if (!isEmpty(assetPayload.balance['deposits'])) {
  //   console.log("bing! deposits field is not empty.")
  //   // const depositsResp = extractDeposits(assetPayload);
  //   // finalAssetStats[walletAddress].push(depositsResp);
  // } 
  // debt
  // if (!isEmpty(assetPayload.balance['debt'])) {
  //   console.log("bing! debt field is not empty.")
  //   // const debtResp = extractDebt(assetPayload);
  //   // finalAssetStats[walletAddress].push(debtResp);
  // }
  // vesting
  // if (!isEmpty(assetPayload.balance['vesting'])) {
  //   console.log("bing! vesting field is not empty.")
  //   // const vestingResp = extractVesting(assetPayload);
  //   // finalAssetStats[walletAddress].push(vestingResp);
  // }
  // // // // wallet
  // // // if (!isEmpty(assetPayload.balance['wallet'])) {
  // // //   const walletResp = extractWallet(assetPayload);
  // // //   walletResp.map(token => {
  // // //     finalAssetStats[walletAddress].push(token);
  // // //   });
  // // // }
  // // // // claimable
  // // // if (!isEmpty(assetPayload.balance['claimable'])) {
  // // //   const claimableResp = extractClaimable(assetPayload);
  // // //   claimableResp.map(token => {
  // // //     finalAssetStats[walletAddress].push(token);
  // // //   });
  // // // }
  // locked
  // if (!isEmpty(assetPayload.balance['locked'])) {
  //   console.log("bing! locked field is not empty.")
  //   // const lockedResp = extractLocked(assetPayload);
  //   // finalAssetStats[walletAddress].push(lockedResp);
  // }
  // nft
  // if (!isEmpty(assetPayload.balance['nft'])) {
  //   console.log("bing! nft field is not empty.")
  //   // const nftResp = extractNft(assetPayload);
  //   // finalAssetStats[walletAddress].push(nftResp);
  // }

  // Protocol, Ticker, Full Name, Asset Type, Quantity, Balance (NZD), Supply APY, Borrow APY, IsLoan, Network, Wallet Address, Percentage of Portfolio

  // THEN WE ITERATE THE "data" OBJECT FROM RESPONSE TO FETCH OUT EACH INDIVIDUAL TOKEN:
  //   Logger.log("assetPayload.products:");
  // Logger.log(assetPayload.products);
    

  if (assetPayload.products) {
    assetPayload.products.map((asset) => {
      // Logger.log("curr asset");
      // Logger.log(asset);

      if (!asset.assets) {
        return;
      }

      asset.assets.map(tokens => {
        // Logger.log("RAW TOKEN:");
        // Logger.log(JSON.stringify(tokens));

        const fullName = tokens.displayProps.label;
        let type = "STAKING";

        let ticker = tokens.symbol;
        if (tokens.tokens) {
          // Logger.log(JSON.stringify(tokens.tokens));
          tokens = tokens.tokens;
        }

        tokens.map((token) => {
          const assetResponse = extractTokenData(token, protocol, network, walletAddress, fullName, type, ticker);
          finalAssetStats[walletAddress].push(assetResponse);
        })
      });
    })
  }

  // console.log("finalAssetStats: ", finalAssetStats)
  return finalAssetStats;
};


extractTokenData = (token, protocol, network, walletAddress, fullName, type, ticker) => {
  // Logger.log("init extractTokenData TOKEN:");
  // Logger.log(JSON.stringify(token));

  ticker = token.symbol ?? ticker;
  network = token.network ?? network;
  fullName = token.name ?? fullName;

  let quantity = token.balance;
  const balanceUSD = token.balanceUSD;
  type = (token.metaType === 'claimable') ? token.metaType.toUpperCase() : type;
  protocol = (token.metaType === 'claimable') ? `CLAIMABLE (${protocol})` : protocol;

  // Fetching APY:
  let supplyAPY = 0;
  let borrowAPY = 0;
  let isLoan = "-"

  const APY = (token.displayProps && token.displayProps.tertiaryLabel) ? token.displayProps.tertiaryLabel : 0;
  // If our balance is negative it means the current token is part of a loan, therefore the corresponding APY given will be the BORROW APY. Otherwise if the balance is positive we are simply given the SUPPLY APY for that token:
  if (balanceUSD > 0) {
    supplyAPY = APY;
  }
  else {
    borrowAPY = APY;
    isLoan = "YES"
    type = "BORROW"
  }

  const assetResponse = {
    protocol,
    ticker,
    fullName,
    type,
    quantity,
    balanceUSD,
    supplyAPY,
    borrowAPY,
    isLoan,
    network,
    walletAddress
  };
  return assetResponse;
}


extractWalletTokenData = (token, protocol, network, walletAddress, fullName, type, ticker) => {
  // Logger.log("init extractWalletTokenData TOKEN:");
  // Logger.log(JSON.stringify(token));
  
  const subtoken = token.token;

  ticker = subtoken.symbol;
  network = token.network;
  fullName = subtoken.name;

  let quantity = subtoken.balance;
  const balanceUSD = subtoken.balanceUSD;
  const supplyAPY = 0;
  const borrowAPY = 0;
  const isLoan = "-"


  const assetResponse = {
    protocol,
    ticker,
    fullName,
    type,
    quantity,
    balanceUSD,
    supplyAPY,
    borrowAPY,
    isLoan,
    network,
    walletAddress
  };
  return assetResponse;
}


// extractWallet = (assetPayload) => {
//   let walletTokens = [];
//   const network = assetPayload.network;
//   const walletAddress = assetPayload.addresses[0];

//   const payloadWalletKeys = Object.keys(assetPayload.balance.wallet);
//   payloadWalletKeys.map(key => {
//     const token = assetPayload.balance.wallet[key];
//     const balanceUSD = token.balanceUSD;
//     const ticker = token.context.symbol;
//     const quantity = token.context.balance;

//     const assetResponse = {
//       protocol: "WALLET",
//       ticker,
//       fullName: ticker,
//       type: "WALLET",
//       quantity,
//       balanceUSD,
//       supplyAPY: 0,
//       borrowAPY: 0,
//       isLoan: "-",
//       network,
//       walletAddress
//     };
//     walletTokens.push(assetResponse);
//   });
//   return walletTokens;
// };


// extractClaimable = (assetPayload) => {
//   let claimableTokens = [];
//   const network = assetPayload.network;
//   const walletAddress = assetPayload.addresses[0];

//   const payloadWalletKeys = Object.keys(assetPayload.balance.claimable);
//   payloadWalletKeys.map(key => {
//     const token = assetPayload.balance.claimable[key];
//     const protocol = `CLAIMABLE (${token.appId})`;
//     const balanceUSD = token.balanceUSD;
//     const ticker = token.breakdown[0].context.symbol;
//     const quantity = token.breakdown[0].context.balance;

//     const assetResponse = {
//       protocol,
//       ticker,
//       fullName: ticker,
//       type: "CLAIMABLE",
//       quantity,
//       balanceUSD,
//       supplyAPY: 0,
//       borrowAPY: 0,
//       isLoan: "-",
//       network,
//       walletAddress
//     };
//     claimableTokens.push(assetResponse);
//   });
//   return claimableTokens;
// };


constructSpreadsheetData = (protocolStatsArray) => {

//  Ticker | Name | Protocol | Asset Type | Quantity | Balance (NZD) | Supply APY |	Borrow APY | Is Loan? |	Network	| Wallet

const exchangeRate = fetchNZDtoUSDExchangeRate();
let spreadsheetProtocolRows = [];
let spreadsheetWalletRows = [];
let spreadsheetClaimableRows = [];

// for each protocol:
  for (const protocolBalance in protocolStatsArray) {
    const protocol = protocolStatsArray[protocolBalance]

    // for each list of assets:
    for (const assetArray in protocol) {
      const assets = protocol[assetArray]

      // for each asset:
      for (const asset in assets) {
        // console.log("current asset: ", assets[asset]);
        const a = assets[asset]
        const balanceNZD = a.balanceUSD * exchangeRate;

        const spreadsheetRow = [[a.protocol], [a.ticker], [a.fullName], [a.type], [a.quantity], [balanceNZD], [a.supplyAPY], [a.borrowAPY], [a.isLoan], [a.network], [a.walletAddress]];

        // Splitting out tokens sitting in wallet doing nothing + ones marked as claimable to filter them at bottom of spreadsheet when writing to it at the end:
        if (a.type === 'WALLET') {
          spreadsheetWalletRows.push(spreadsheetRow);
        } 
        else if (a.type === 'CLAIMABLE') {
          spreadsheetClaimableRows.push(spreadsheetRow);
        } 
        else {
          spreadsheetProtocolRows.push(spreadsheetRow);
        }
      }
    }
  }

  // Sorting Algorithm to use (index 5 here is BalanceUSD field):
  sortBy = (a, b) => {
    return Math.abs(b[5]) - Math.abs(a[5]);
  }

  // Sort our main array of balances INSIDE DeFi Protocols [By abs(BALANCE) Descending]:
  const sortedProtocols = spreadsheetProtocolRows.sort(sortBy);
  // Sort our sub arrays of WALLET / CLAIMABLE balances [By abs(BALANCE) Descending]:
  const sortedWallets = spreadsheetWalletRows.sort(sortBy);
  const sortedClaimables = spreadsheetClaimableRows.sort(sortBy);

  return sortedProtocols.concat(sortedWallets).concat(sortedClaimables);
};


fetchNZDtoUSDExchangeRate = () => {
  const fullJson = JSON.parse(getCoinInfo('DAI'));
  const exchangeRate = fullJson.data.DAI.quote.NZD.price
  return exchangeRate
};


updateDefiSpreadsheet = (finalFormattedData) => {

  const sourceSS = SpreadsheetApp.getActiveSpreadsheet();
  const defiSummarySpreadsheet = sourceSS.getSheetByName("DeFi Summary");
  const rowCount = finalFormattedData.length;
  // console.log("row count", rowCount);

  const range = defiSummarySpreadsheet.getRange(`A2:K${rowCount + 1}`)
  range.setValues(finalFormattedData);

  // Set new last successful modified date cell:
  const currentDateTime = Utilities.formatDate(new Date(), "GMT+12", "dd/MM/yyyy HH:mm:ss a '(GMT+12)'")
  defiSummarySpreadsheet.getRange('N7').setValues([[currentDateTime]]);

  // set the last x rows of cells to blank so that we can overwrite any overflowing protocols from previous run:
  const cellsToClear = 20;
  const clearRange = defiSummarySpreadsheet.getRange(`A${rowCount + 2}:K${rowCount + (cellsToClear+2)}`)
  clearRange.clearContent();

  console.log("✔️ Successfully updated spreadsheet! ✔️")
}