function dailyFetchDefiBalances() {
  const {networkList, walletAddressList, ZapperFiAPIKey } = getConstants();
  const rawWalletBalances = fetchWalletBalances(networkList, walletAddressList, ZapperFiAPIKey);
  const finalFormattedJson = formatZapperResponses(rawWalletBalances);
  const finalFormattedData = constructSpreadsheetData(finalFormattedJson);
  updateDefiSpreadsheet(finalFormattedData);
  this.arrayThis("DeFi Summary!L1:L");
};


fetchWalletBalances = (networkList, walletAddressList, ZapperFiAPIKey) => {
  const url = "https://api.zapper.fi/v2/balances";

  const headers = {
    "Authorization" : "Basic " + Utilities.base64Encode(ZapperFiAPIKey + ':' + "")
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


formatZapperResponses = (rawWalletBalances) => {
  let finalProtocolStats = [];

  // Stripping some unnecessary text from around the pure json data we want:
  const balancesArray = rawWalletBalances.slice(14, -21).split("event: balance");

  // for each individual protocol:network pair:
  for (const i in balancesArray) {
    const payload = JSON.parse(balancesArray[i].replace('data:',''));

    // iterate app sub-element and fetch each individual holding out of it:
    if (payload.errors.length < 1) {
      const protocol = (payload.app) ? payload.app.displayProps.appName : payload.appId;
      const walletAddress = payload.addresses[0];

      // Blacklisted Networks/Protocols:
      if (protocol.toLowerCase() === "geist") {
        continue;
      }

      const assetResp = extractAssets(payload);

      // If we already have an element in the final array for this Protocol:
      if (finalProtocolStats[protocol]) {
        // if asset_resp wallet address is the same, take the object value out existing final_protocol_stats matching 
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
  // console.log("FINAL formatZapperResponses", finalProtocolStats);
  return finalProtocolStats;
};


extractAssets = (assetPayload) => {
  let finalAssetStats = {};

  function isEmpty(obj) {
    return Object.keys(obj).length === 0;
  }

  const protocol = (assetPayload.app) ? assetPayload.app.displayProps.appName : assetPayload.appId;
  const network = assetPayload.network;
  const walletAddress = assetPayload.addresses[0];
  finalAssetStats[walletAddress] = [];

  // FIRST WE EXTRACT ANY DATA OUT OF THESE HARDCODED TOP FIELDS INSIDE "Balance" OF EACH PROTOCOL's JSON RESPONSE:

  // deposits
  // if (!isEmpty(assetPayload.balance['deposits'])) {
  //   console.log("bing! deposits field is not empty.")
  //   // const deposits_resp = extract_deposits(assetPayload);
  //   // finalAssetStats[wallet_address].push(deposits_resp);
  // } 
  // debt
  // if (!isEmpty(assetPayload.balance['debt'])) {
  //   console.log("bing! debt field is not empty.")
  //   // const debt_resp = extract_debt(assetPayload);
  //   // finalAssetStats[wallet_address].push(debt_resp);
  // }
  // vesting
  // if (!isEmpty(assetPayload.balance['vesting'])) {
  //   console.log("bing! vesting field is not empty.")
  //   // const vesting_resp = extract_vesting(assetPayload);
  //   // finalAssetStats[wallet_address].push(vesting_resp);
  // }
  // wallet
  if (!isEmpty(assetPayload.balance['wallet'])) {
    const walletResp = extractWallet(assetPayload);
    walletResp.map(token => {
      finalAssetStats[walletAddress].push(token);
    });
  }
  // claimable
  if (!isEmpty(assetPayload.balance['claimable'])) {
    const claimableResp = extractClaimable(assetPayload);
    claimableResp.map(token => {
      finalAssetStats[walletAddress].push(token);
    });
  }
  // locked
  // if (!isEmpty(assetPayload.balance['locked'])) {
  //   console.log("bing! locked field is not empty.")
  //   // const locked_resp = extract_locked(assetPayload);
  //   // finalAssetStats[wallet_address].push(locked_resp);
  // }
  // nft
  // if (!isEmpty(assetPayload.balance['nft'])) {
  //   console.log("bing! nft field is not empty.")
  //   // const nft_resp = extract_nft(assetPayload);
  //   // finalAssetStats[wallet_address].push(nft_resp);
  // }

  // Protocol, Ticker, Full Name, Asset Type, Quantity, Balance (NZD), Supply APY, Borrow APY, IsLoan, Network, Wallet Address, Percentage of Portfolio

  // THEN WE ITERATE THE "data" OBJECT FROM RESPONSE TO FETCH OUT EACH INDIVIDUAL TOKEN:
  if (assetPayload.app) {
    assetPayload.app.data.map(token => {
      // console.log("token:\n", token);
      const fullName = token.displayProps.label;
      let type = "STAKING";

      // Fetching ticker & balance:
      let ticker = fullName;
      let quantity = 0;
      if (token.context && token.context.symbol) {
        ticker = token.context.symbol;
        quantity = token.context.balance;
      } else if (token.breakdown) {
        token.breakdown.map((breakdownItem) => {
          if (breakdownItem.context.symbol && breakdownItem.metaType === "supplied") {
            ticker = breakdownItem.context.symbol;
            quantity = breakdownItem.context.balance;
          }
        })
      }

      const balanceUSD = token.balanceUSD;

      // Fetching APY:
      let supplyAPY = 0;
      let borrowAPY = 0;
      let isLoan = "-"
      const APY = (token.displayProps.tertiaryLabel) ? token.displayProps.tertiaryLabel.value : 0;
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

      finalAssetStats[walletAddress].push(assetResponse);
    });
  }

  // console.log("finalAssetStats: ", finalAssetStats)
  return finalAssetStats;
};


extractWallet = (assetPayload) => {
  let walletTokens = [];
  const network = assetPayload.network;
  const walletAddress = assetPayload.addresses[0];

  const payloadWalletKeys = Object.keys(assetPayload.balance.wallet);
  payloadWalletKeys.map(key => {
    const token = assetPayload.balance.wallet[key];
    const balanceUSD = token.balanceUSD;
    const ticker = token.context.symbol;
    const quantity = token.context.balance;

    const assetResponse = {
      protocol: "WALLET",
      ticker,
      fullName: ticker,
      type: "WALLET",
      quantity,
      balanceUSD,
      supplyAPY: 0,
      borrowAPY: 0,
      isLoan: "-",
      network,
      walletAddress
    };
    walletTokens.push(assetResponse);
  });
  return walletTokens;
};


extractClaimable = (assetPayload) => {
  let claimableTokens = [];
  const network = assetPayload.network;
  const walletAddress = assetPayload.addresses[0];

  const payloadWalletKeys = Object.keys(assetPayload.balance.claimable);
  payloadWalletKeys.map(key => {
    const token = assetPayload.balance.claimable[key];
    const protocol = `CLAIMABLE (${token.appId})`;
    const balanceUSD = token.balanceUSD;
    const ticker = token.breakdown[0].context.symbol;
    const quantity = token.breakdown[0].context.balance;

    const assetResponse = {
      protocol,
      ticker,
      fullName: ticker,
      type: "CLAIMABLE",
      quantity,
      balanceUSD,
      supplyAPY: 0,
      borrowAPY: 0,
      isLoan: "-",
      network,
      walletAddress
    };
    claimableTokens.push(assetResponse);
  });
  return claimableTokens;
};


constructSpreadsheetData = (protocol_stats_array) => {

//  Ticker | Name | Protocol | Asset Type | Quantity | Balance (NZD) | Supply APY |	Borrow APY | Is Loan? |	Network	| Wallet

const exchange_rate = fetchNZDtoUSDExchangeRate();
let spreadsheetProtocolRows = [];
let spreadsheetWalletRows = [];
let spreadsheetClaimableRows = [];

// for each protocol:
  for (const protocol_balance in protocol_stats_array) {
    const protocol = protocol_stats_array[protocol_balance]

    // for each list of assets:
    for (const asset_array in protocol) {
      const assets = protocol[asset_array]

      // for each asset:
      for (const asset in assets) {
        // console.log("current asset: ", assets[asset]);
        const a = assets[asset]
        const balanceNZD = a.balanceUSD * exchange_rate;

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
  const full_json = JSON.parse(get_coin_info('DAI'));
  const exchange_rate = full_json.data.DAI.quote.NZD.price
  return exchange_rate
};


updateDefiSpreadsheet = (finalFormattedData) => {

  const source_ss = SpreadsheetApp.getActiveSpreadsheet();
  const defi_summary_spreadsheet = source_ss.getSheetByName("DeFi Summary");
  const row_count = finalFormattedData.length;
  // console.log("row count", row_count);

  const range = defi_summary_spreadsheet.getRange(`A2:K${row_count + 1}`)
  range.setValues(finalFormattedData);

  // Set new last successful modified date cell:
  const currentDateTime = Utilities.formatDate(new Date(), "GMT+12", "dd/MM/yyyy HH:mm:ss a '(GMT+12)'")
  defi_summary_spreadsheet.getRange('N7').setValues([[currentDateTime]]);

  // set the last x rows of cells to blank so that we can overwrite any overflowing protocols from previous run:
  const cells_to_clear = 20;
  const clear_range = defi_summary_spreadsheet.getRange(`A${row_count + 2}:K${row_count + (cells_to_clear+2)}`)
  clear_range.clearContent();

  console.log("✔️ Successfully updated spreadsheet! ✔️")
}