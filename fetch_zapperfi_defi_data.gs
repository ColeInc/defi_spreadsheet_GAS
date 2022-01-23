// Should only be ran once a day. Goes out and queries all wallets on all protocols on all networks for any balances > 0. Pulls them back and puts the [protocol name + network pair] into a staging spreadsheet.
function daily_worldwide_crawl() {
  const {wallet_address_list, zapperfi_api_key} = getConstants();
  const protocol_list = zapperfi_get_protocol_list(zapperfi_api_key);
  const formatted_protocol_list = format_protocol_list(protocol_list);
  const protocol_balances_array = zapperfi_get_balances_list(zapperfi_api_key, formatted_protocol_list, wallet_address_list);
  update_daily_staging_hub(protocol_balances_array);
};


// Can be triggered on any edit/refresh of the DeFi Spreadsheet. Takes the list of protocol/network pairs from the staging spreadsheet and iterates through them fetching live values of balances in each protocol.
function main_fetch_defi_balances() {
  const {wallet_address_list, zapperfi_api_key} = getConstants();
  const protocol_network_pairs = fetch_daily_staging_hub();
  const zapperfi_json_responses = zapperfi_get_balances_list(zapperfi_api_key, protocol_network_pairs, wallet_address_list);
  const final_formatted_json = format_zapperfi_json_responses(zapperfi_json_responses);
  const final_formatted_data = construct_spreadsheet_data(final_formatted_json);
  update_defi_spreadsheet(final_formatted_data);
};


zapperfi_get_protocol_list = (zapperfi_api_key) => {

  // ------------------------------------------------------------------------------------
  const url = 'https://api.zapper.fi/v1/apps'; 
  // ------------------------------------------------------------------------------------

  // GET Request Template Styled Parameters:
  const apiParams = {
    'api_key': zapperfi_api_key,
  };

  // For GET, Encode params object as a URI escaped query string
  const encParams = toHtmlQuery_(apiParams);

  // GET Request Headers:
  const params = {
    'method' : 'GET',
    'json': true, 
    'gzip': true
  };

  const result = UrlFetchApp.fetch(url+encParams, params); 
  const response_txt = result.getContentText();
  
  // console.log(response_txt);
  return response_txt
};


format_protocol_list = (json_response) => {
  const json_resp = JSON.parse(json_response);
  // const protocol_list = json_resp.map((item) => { return item.id }).join(",");

  const protocol_keypair_object = {};

  const protocol_list = json_resp.map((item) => { 
    const network_list = item.supportedNetworks.map((supportedNetwork) => {
      // console.log("supportedNetwork: ", supportedNetwork);
      // console.log("supportedNetwork.network: ", supportedNetwork.network);
      return supportedNetwork.network;
    }).join(",");

    if (network_list.length > 0) {
      protocol_keypair_object[item.id] = network_list;
    }
    });

  // console.log("final keypair list: ", protocol_keypair_object);
  return protocol_keypair_object;
  // console.log(protocol_list);
  // return protocol_list;
};


zapperfi_get_balances_list = (zapperfi_api_key, protocol_list, wallet_address_list) => {

  // protocol_list = { 
  //   aave: 'ethereum',
  //   'aave-v2': 'avalanche',
  //   geist: 'fantom',
  //   aavegotchi: 'polygon',
  //   abracadabra: 'arbitrum,avalanche,ethereum,fantom',
  //   curve: 'avalanche,fantom',
  //   traderjoe: 'avalanche'
  // };

  let protocol_responses = [];
  let valid_protocol_network_pairs = [];

  for (let protocol in protocol_list) {
    const networks_array = protocol_list[protocol].split(",");

    // FOR EACH PROTOCOL, FOR EACH VALID NETWORK IN THIS PROTOCOL:
    networks_array.map((network) => {

      // console.log(`current protocol/network: ${protocol} ${network}`);

      const url = "https://api.zapper.fi/v1/protocols/" + protocol + "/balances";
      const addresses_split_array = wallet_address_list.split(",");

      let encParams = `?newBalances=true&network=${network}&api_key=${zapperfi_api_key}`;
      addresses_split_array.map(address => {
        encParams += `&addresses%5B%5D=${address}`;
      });

      // GET Request Headers:
      const params = {
        'method' : 'GET',
        'json': true, 
        'gzip': true
      };

      const result = UrlFetchApp.fetch(url+encParams, params);
      const response_json = JSON.parse(result);
      // console.log(response_json)

      for (const wallet in response_json) {
        // console.log("resp", response_json[wallet]);

        // If we find any kind of useful data coming back for this protocol + network pair then:
        if (response_json[wallet].products[0] !== undefined) {
          // console.log("Balances found! protocol, network --> ", protocol, network)
          const protocol_response_string = JSON.stringify(response_json[wallet].products[0]);
          // console.log(protocol_response_string)
          
          if (!valid_protocol_network_pairs[protocol]) {
            valid_protocol_network_pairs[protocol] = [network];
          } else {
            valid_protocol_network_pairs[protocol].push(network);
          }
          protocol_responses.push({[wallet]: protocol_response_string});
        } else {
          // Finds an empty response for this protocol + network pair when querying the API.
        }
      }
    });
  }

  // console.log(protocol_responses)
  return [protocol_responses, valid_protocol_network_pairs]
};


update_daily_staging_hub = (valid_protocols_array) => {
  let source_ss = SpreadsheetApp.getActiveSpreadsheet();
  let daily_staging_sheet = source_ss.getSheetByName("daily_staging_hub");
  let counter = 0;

  for (const protocol in valid_protocols_array[1]) {
    // filters any duplicate networks:
    const unique_networks = valid_protocols_array[1][protocol].filter(onlyUnique)

    // set protocol:
    daily_staging_sheet.getRange(counter+2, 1, 1).setValues([[protocol]]);
    // set network list:
    daily_staging_sheet.getRange(counter+2, 2, 1).setValues([[unique_networks.join(',')]]);
    counter++;
  }
};


function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}


fetch_daily_staging_hub = () => {

  let source_ss = SpreadsheetApp.getActiveSpreadsheet();
  let daily_staging_sheet = source_ss.getSheetByName("daily_staging_hub");

  let protocol_network_pairs = []
  let protocolList = daily_staging_sheet.getRange("A2:A").getValues();
  let networkList = daily_staging_sheet.getRange("B2:B").getValues();
  let numberOfValues = protocolList.filter(String).length;
  let numberOfNetworks = networkList.filter(String).length;

  let protocolRangeVals = daily_staging_sheet.getRange(2,1,numberOfValues).getValues();
  let networkRangeVals = daily_staging_sheet.getRange(2,2,numberOfNetworks).getValues();

  for (const i in protocolRangeVals) {
    protocol_network_pairs[protocolRangeVals[i][0]] = networkRangeVals[i][0];
  }

  // console.log("final: ", protocol_network_pairs);
  return protocol_network_pairs;

}


format_zapperfi_json_responses = (raw_zapperfi_json_responses) => {
  let final_protocol_stats = [];

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

      final_protocol_stats[label] ? Object.assign(final_protocol_stats[label], asset_resp) : final_protocol_stats[label] = asset_resp;
    }
    // console.log("final_protocol_stats", final_protocol_stats);
    return final_protocol_stats;
  }
};


extract_assets = (asset_array, wallet_address) => {
  let final_asset_stats = {};
  final_asset_stats[wallet_address] = [];

  for (const val in asset_array) {
    const asset = asset_array[val];

    //lend
    if (asset.type === 'lend') {
      const lend_resp = extract_lend(asset);
      final_asset_stats[wallet_address].push(lend_resp);
    } 
    //borrow
    else if (asset.type === 'borrow') {
      const borrow_resp = extract_borrow(asset);
      final_asset_stats[wallet_address].push(borrow_resp);
    }
    //claimable
    else if (asset.type === 'claimable') {
      const claimable_resp = extract_claimable(asset);
      final_asset_stats[wallet_address].push(claimable_resp);
    }
    //farm
    else if (asset.type === 'farm') {
      const farm_resp = extract_farm(asset);
      final_asset_stats[wallet_address].push(farm_resp);
    }
    //vault
    else if (asset.type === 'vault') {
      const vault_resp = extract_vault(asset);
      final_asset_stats[wallet_address].push(vault_resp);
    }
    //wallet
    else if (asset.type === 'wallet') {
      const wallet_resp = extract_wallet(asset);
      final_asset_stats[wallet_address].push(wallet_resp);
    }
    else {
      console.log("Unsupported type found. Currently not catering for this --> ", asset.type);
    }
  }
  // console.log("final_asset_stats: ", final_asset_stats)
  return final_asset_stats;
};


////// things to fetch out:
// protocol name
// network
// current asset price? (AVAX price in USD)
// current wallet address - matching this value
// borrowAPY
// supplyAPY
// my token balance - quantity (tokens/balance)
// my token balance - USD (tokens/balanceUSD)
// APY - not sure what APY this actually is? but will be useful
// liquidation threshold!
// claimable rewards balance - token type of reward
// claimable rewards balance - balance (quantity)
// claimable rewards balance - balanceUSD

extract_lend = (asset_json) => {
  const balanceUSD = asset_json.balanceUSD;
  const appName = asset_json.appName;
  const token_resp = extract_token(asset_json.tokens);

  const asset_response = {
    type: "lend",
    balanceUSD: balanceUSD,
    appName: appName,
    tokens: token_resp
  };
  // console.log("LEND asset_response: ", asset_response);
  return asset_response;
};


extract_borrow = (asset_json) => {
  const balanceUSD = asset_json.balanceUSD;
  const appName = asset_json.appName;
  const token_resp = extract_token(asset_json.tokens);

  const asset_response = {
    type: "borrow",
    balanceUSD: balanceUSD,
    isLoan: true,
    appName: appName,
    tokens: token_resp
  };
  // console.log("BORROW asset_response: ", asset_response);
  return asset_response;
};


extract_claimable = (asset_json) => {
  const balanceUSD = asset_json.balanceUSD;
  const appName = asset_json.appName;
  const token_resp = extract_token(asset_json.tokens);

  const asset_response = {
    type: "claimable",
    balanceUSD: balanceUSD,
    appName: appName,
    tokens: token_resp
  };
  // console.log("CLAIMABLE asset_response: ", asset_response);
  return asset_response;
};


extract_farm = (asset_json) => {
  const balanceUSD = asset_json.balanceUSD;
  const appName = asset_json.appName;
  const token_resp = extract_token(asset_json.tokens);

  const asset_response = {
    type: "farm",
    balanceUSD: balanceUSD,
    appName: appName,
    tokens: token_resp
  };
  // console.log("FARM asset_response: ", asset_response);
  return asset_response;
};


extract_vault = (asset_json) => {
  const balanceUSD = asset_json.balanceUSD;
  const appName = asset_json.appName;
  const token_resp = extract_token(asset_json.tokens);

  const asset_response = {
    type: "vault",
    balanceUSD: balanceUSD,
    appName: appName,
    tokens: token_resp
  };
  // console.log("VAULT asset_response: ", asset_response);
  return asset_response;
};

extract_wallet = (asset_json) => {
  const balanceUSD = asset_json.balanceUSD;
  const appName = asset_json.appName;
  const token_resp = extract_token(asset_json.tokens);

  const asset_response = {
    type: "wallet",
    balanceUSD: balanceUSD,
    appName: appName,
    tokens: token_resp
  };
  // console.log("WALLET asset_response: ", asset_response);
  return asset_response;
};


extract_token = (token_array) => {
  let final_token_stats = [];

  for (const val in token_array) {
    const token_json = token_array[val];

    if (token_json.type === "interest-bearing" || token_json.type === "base" || token_json.type === "pool" || token_json.type === "vault") {
      const token_response = {
        network: token_json.network,
        address: token_json.address,
        symbol: token_json.symbol,
        label: token_json.label ? token_json.label : '',
        quantity: token_json.balance,
        balanceUSD: token_json.balanceUSD,
        priceUSD: token_json.price,
        borrowApy: token_json.borrowApy ? token_json.borrowApy : 0,
        supplyApy: token_json.supplyApy ? token_json.supplyApy : 0,
      };

      final_token_stats.push(token_response);
    }
    else if (token_json.type === "claimable") {
      // ehh skip claimable tokens for now, not interested in capturing.
    }
    else {
      console.log("Other token type identified! Not getting captured --> ", token_json.type, token_json);
    }
  }
  // console.log("final token: ", final_token_stats)
  return final_token_stats;
};


construct_spreadsheet_data = (protocol_stats_array) => {

  //  Ticker | Name | Protocol | Asset Type | Quantity | Balance (NZD) | Supply APY |	Borrow APY | Is Loan? |	Network	| Wallet

let spreadsheet_rows = [];

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
        const a = assets[asset]
        const type = a.type.toUpperCase();
        const balanceUSD = a.balanceUSD;
        const appName = a.appName;
        const tokens = a.tokens;
        const isLoan = a.isLoan ? 'YES' : '-'
        console.log("current asset: ", assets[asset]);

        // for each token found in this asset
        for (const token in tokens) {
          const t = tokens[token];
          const sAPY = (t.supplyApy === 0) ? '0' : (t.supplyApy * 100).toString() + '%';
          const bAPY = (t.borrowApy === 0) ? '0' : (t.borrowApy * 100).toString() + '%';
          
          spreadsheet_rows.push([[appName], [t.symbol], [t.label], [type], [t.quantity], [balanceUSD], [sAPY], [bAPY], [isLoan], [t.network], [current_wallet]]);
        }
      }
    }
  }
  console.log("final spreadsheet_rows: ", spreadsheet_rows)
  return spreadsheet_rows;
};


update_defi_spreadsheet = (final_formatted_data) => {

  const source_ss = SpreadsheetApp.getActiveSpreadsheet();
  const defi_summary_spreadsheet = source_ss.getSheetByName("DeFi Summary");
  const row_count = final_formatted_data.length;

  const range = defi_summary_spreadsheet.getRange(`A2:K${row_count + 1}`)
  range.setValues(final_formatted_data);
}
