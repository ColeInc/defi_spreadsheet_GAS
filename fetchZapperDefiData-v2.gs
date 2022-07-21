function dailyFetchDefiBalances() {
  const {networkList, walletAddressList, ZapperFiAPIKey } = getConstants();
  const rawWalletBalances = fetchWalletBalances(networkList, walletAddressList, ZapperFiAPIKey);
  const finalFormattedData = formatZapperResponses(rawWalletBalances);
  // const protocol_network_pairs = fetch_daily_staging_hub();
  // const anchor_balance = fetch_terra_protocols(terra_luna_address);
  // let anchor_balance;
  // const anchor_balances_array = !anchor_balance ? false : format_terra_data(anchor_balance, terra_luna_address);
  // const zapperfi_json_responses = zapperfi_get_balances_list(ZapperFiAPIKey, protocol_network_pairs, walletAddressList);
  // const final_formatted_data = construct_spreadsheet_data(final_formatted_json, anchor_balances_array);
  // update_defi_spreadsheet(final_formatted_data);

  // this.arrayThis("DeFi Summary!L1:L");
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
  console.log("fetchWalletBalances resp:", responseText);
  return responseText;
};


formatZapperResponses = (rawWalletBalances) => {
  let final_protocol_stats = [];

  const balancesArray = rawWalletBalances.split("event: balance");

  for (const i in balancesArray) {
    console.log(balancesArray[i]);
  }
  return;

  // each value being iterated here is an array filled with strings, each string being a stringified json object.
  for (const i in raw_zapperfi_json_responses) {
    const array_of_responses = raw_zapperfi_json_responses[i];

    // for each string inside the array of strings:
    for (const record in array_of_responses) {

      const keys = Object.keys(array_of_responses[record]);
      const wallet_address = keys[0];
      const current_record = JSON.parse(array_of_responses[record][wallet_address]);
      const label = current_record.label;

      const asset_resp = extract_assets(current_record.assets, wallet_address);
      const current_asset_wallet = Object.keys(asset_resp)[0];
      // console.log("current asset_resp: ", asset_resp);

      // If we already have an element in the final array for this Protocol:
      if (final_protocol_stats[label]) {
        // if asset_resp wallet address is the same, take the object value out existing final_protocol_stats matching 
        // the wallet address, combine the existing with old one, then form full new final object.
        if (final_protocol_stats[label][current_asset_wallet]) {
          const new_element = asset_resp[current_asset_wallet];
          for (const element in new_element) {
            final_protocol_stats[label][current_asset_wallet].push(new_element[element]);
          }
        }
        // else if there is already a value for this Protocol, but there isn't a matching sub-element for this wallet yet, then combine existing sub-elements with this:
        else if (final_protocol_stats[label]) {
          Object.assign(final_protocol_stats[label], asset_resp)
        }
      } 
      else {
        final_protocol_stats[label] = asset_resp;
      }
    }
    // console.log("final_protocol_stats", final_protocol_stats);
    return final_protocol_stats;
  }
};


construct_spreadsheet_data = (protocol_stats_array, anchor_balances_array) => {

  //  Ticker | Name | Protocol | Asset Type | Quantity | Balance (NZD) | Supply APY |	Borrow APY | Is Loan? |	Network	| Wallet

let spreadsheet_protocol_rows = [];
let spreadsheet_wallet_rows = [];
const exchange_rate = fetch_NZD_USD_exchange_rate();

// for each protocol:
  for (const protocol_balance in protocol_stats_array) {
    const protocol = protocol_stats_array[protocol_balance]
    // console.log("protocol: ", protocol_stats_array[protocol_balance])

    // for each list of assets
    for (const asset_array in protocol) {
      const assets = protocol[asset_array]
      const current_wallet = asset_array;

      // for each asset
      for (const asset in assets) {
        // console.log("current asset: ", assets[asset]);
        const a = assets[asset]
        const type = a.type.toUpperCase();
        const balanceNZD = a.balanceUSD * exchange_rate;
        const appName = a.appName;
        const tokens = a.tokens;
        const isLoan = a.isLoan ? 'YES' : '-'

        // for each token found in this asset
        for (const token in tokens) {
          const t = tokens[token];
          const sAPY = (t.supplyApy === 0) ? '0' : (t.supplyApy * 100).toString() + '%';
          const bAPY = (t.borrowApy === 0) ? '0' : (t.borrowApy * 100).toString() + '%';
          const label = (t.label.length > 0) ? t.label : t.symbol;
          
          if (type === 'WALLET' || type === 'CLAIMABLE') {
            const real_name = (type === 'WALLET') ? 'WALLET' : 'CLAIMABLE';
            spreadsheet_wallet_rows.push([[real_name], [t.symbol], [label], [type], [t.quantity], [balanceNZD], [sAPY], [bAPY], [isLoan], [t.network], [current_wallet]]);
          } else {
            spreadsheet_protocol_rows.push([[appName], [t.symbol], [label], [type], [t.quantity], [balanceNZD], [sAPY], [bAPY], [isLoan], [t.network], [current_wallet]]);
          }
        }
      }
    }
  }

  // if any terra luna balances found, append them to the spreadsheet rows before they're sorted:
  if (anchor_balances_array) spreadsheet_protocol_rows.push(anchor_balances_array);

  // sort final spreadsheet_rows array:
  const sorted_protocols = spreadsheet_protocol_rows.sort(function(a, b) {
    return Math.abs(b[5]) - Math.abs(a[5]);
  });

  return sorted_protocols.concat(spreadsheet_wallet_rows);
};


update_defi_spreadsheet = (final_formatted_data) => {

  const source_ss = SpreadsheetApp.getActiveSpreadsheet();
  const defi_summary_spreadsheet = source_ss.getSheetByName("DeFi Summary");
  const row_count = final_formatted_data.length;

  const range = defi_summary_spreadsheet.getRange(`A2:K${row_count + 1}`)
  range.setValues(final_formatted_data);

  // Set new last successful modified date cell:
  const currentDateTime = Utilities.formatDate(new Date(), "GMT+12", "dd/MM/yyyy HH:mm:ss a '(GMT+12)'")
  defi_summary_spreadsheet.getRange('N7').setValues([[currentDateTime]]);

  // set the last x rows of cells to blank so that we can overwrite any overflowing protocols from previous run:
  const cells_to_clear = 20;
  const clear_range = defi_summary_spreadsheet.getRange(`A${row_count + 2}:K${row_count + (cells_to_clear+2)}`)
  clear_range.clearContent();
}