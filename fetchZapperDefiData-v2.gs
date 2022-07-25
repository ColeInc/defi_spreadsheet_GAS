function dailyFetchDefiBalances() {
    const { networkList, walletAddressList, ZapperFiAPIKey } = getConstants();
    const rawWalletBalances = fetchWalletBalances(networkList, walletAddressList, ZapperFiAPIKey);
    const finalFormattedJson = formatZapperResponses(rawWalletBalances);
    // const protocol_network_pairs = fetch_daily_staging_hub();
    // const anchor_balance = fetch_terra_protocols(terra_luna_address);
    // let anchor_balance;
    // const anchor_balances_array = !anchor_balance ? false : format_terra_data(anchor_balance, terra_luna_address);
    // const zapperfi_json_responses = zapperfi_get_balances_list(ZapperFiAPIKey, protocol_network_pairs, walletAddressList);
    const finalFormattedData = constructSpreadsheetData(finalFormattedJson);
    updateDefiSpreadsheet(finalFormattedData);
    this.arrayThis("DeFi Summary!L1:L");
}

fetchWalletBalances = (networkList, walletAddressList, ZapperFiAPIKey) => {
    const url = "https://api.zapper.fi/v2/balances";

    const headers = {
        Authorization: "Basic " + Utilities.base64Encode(ZapperFiAPIKey + ":" + ""),
    };

    const params = {
        method: "GET",
        headers: headers,
        json: true,
        gzip: true,
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

formatZapperResponses = rawWalletBalances => {
    let finalProtocolStats = [];

    // stripping some random text from around the pure json data we want:
    const balancesArray = rawWalletBalances.slice(14, -21).split("event: balance");

    // for each individual protocol:network pair:
    for (const i in balancesArray) {
        // console.log("raw payload:", balancesArray[i]);
        // const payload = JSON.parse(balancesArray[i].replace('event: balance',''));
        const payload = JSON.parse(balancesArray[i].replace("data:", ""));
        // const payload = JSON.parse(`{${balancesArray[i]}}`);
        // console.log("json payload:", payload);

        // iterate app sub-element and fetch each individual holding out of it:
        if (payload.app && payload.app.data.length > 0) {
            const assetResp = extractAssets(payload);
            console.log("current asset_resp: ", assetResp);
            // const protocol = payload.appId;
            const protocol = payload.app.displayProps.appName;
            const walletAddress = payload.addresses[0];

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
                    Object.assign(finalProtocolStats[protocol], assetResp);
                }
            } else {
                finalProtocolStats[protocol] = assetResp;
            }
        }
        // Else if nothing was found inside payload > app > data then it's an empty protocol so skip it completely:
        else {
            continue;
        }
    }
    console.log("FINAL formatZapperResponses", finalProtocolStats);
    return finalProtocolStats;
};

extractAssets = assetPayload => {
    let finalAssetStats = {};

    function isEmpty(obj) {
        return Object.keys(obj).length === 0;
    }

    // FIRST WE EXTRACT ANY DATA OUT OF THESE HARDCODED TOP FIELDS INSIDE "Balance" OF EACH PROTOCOL's JSON RESPONSE:

    // deposits
    if (!isEmpty(assetPayload.balance["deposits"])) {
        console.log("bing! deposits field is not empty.");
        // const deposits_resp = extract_deposits(asset);
        // finalAssetStats[wallet_address].push(deposits_resp);
    }
    // debt
    if (!isEmpty(assetPayload.balance["debt"])) {
        console.log("bing! debt field is not empty.");
        // const debt_resp = extract_debt(asset);
        // finalAssetStats[wallet_address].push(debt_resp);
    }
    // vesting
    if (!isEmpty(assetPayload.balance["vesting"])) {
        console.log("bing! vesting field is not empty.");
        // const vesting_resp = extract_vesting(asset);
        // finalAssetStats[wallet_address].push(vesting_resp);
    }
    // wallet
    if (!isEmpty(assetPayload.balance["wallet"])) {
        console.log("bing! wallet field is not empty.");
        // const wallet_resp = extract_wallet(asset);
        // finalAssetStats[wallet_address].push(wallet_resp);
    }
    // claimable
    if (!isEmpty(assetPayload.balance["claimable"])) {
        console.log("bing! claimable field is not empty.");
        // const claimable_resp = extract_claimable(asset);
        // finalAssetStats[wallet_address].push(claimable_resp);
    }
    // locked
    if (!isEmpty(assetPayload.balance["locked"])) {
        console.log("bing! locked field is not empty.");
        // const locked_resp = extract_locked(asset);
        // finalAssetStats[wallet_address].push(locked_resp);
    }
    // nft
    if (!isEmpty(assetPayload.balance["nft"])) {
        console.log("bing! nft field is not empty.");
        // const nft_resp = extract_nft(asset);
        // finalAssetStats[wallet_address].push(nft_resp);
    }

    // Protocol, Ticker, Full Name, Asset Type, Quantity, Balance (NZD), Supply APY, Borrow APY, IsLoan, Network, Wallet Address, Percentage of Portfolio
    const protocol = assetPayload.app.displayProps.appName;
    // const protocol = assetPayload.appId;
    const network = assetPayload.network;
    const walletAddress = assetPayload.addresses[0];
    finalAssetStats[walletAddress] = [];

    // THEN WE ITERATE THE "data" OBJECT FROM RESPONSE TO FETCH OUT EACH INDIVIDUAL TOKEN:
    assetPayload.app.data.map(token => {
        // console.log("token:\n", token);
        const fullName = token.displayProps.label;

        // Fetching ticker & balance:
        let ticker = fullName;
        let quantity = 0;
        if (token.context && token.context.symbol) {
            ticker = token.context.symbol;
            quantity = token.context.balance;
        } else if (token.breakdown) {
            token.breakdown.map(breakdownItem => {
                if (breakdownItem.context.symbol && breakdownItem.metaType === "supplied") {
                    ticker = breakdownItem.context.symbol;
                    quantity = breakdownItem.context.balance;
                }
            });
        }

        const balanceUSD = token.balanceUSD;

        // Fetching APY:
        let supplyAPY = 0;
        let borrowAPY = 0;
        let isLoan = "-";
        const APY = token.displayProps.tertiaryLabel ? token.displayProps.tertiaryLabel.value : 0;
        // If our balance is negative it means the current token is part of a loan, therefore the corresponding APY given will be the BORROW APY. Otherwise if the balance is positive we are simply given the SUPPLY APY for that token:
        if (balanceUSD > 0) {
            supplyAPY = APY;
        } else {
            borrowAPY = APY;
            isLoan = "YES";
        }

        const assetResponse = {
            protocol,
            ticker,
            fullName,
            type: "none",
            quantity,
            balanceUSD,
            supplyAPY,
            borrowAPY,
            isLoan,
            network,
            walletAddress,
        };
        console.log("created assetResponse: ", assetResponse);
        finalAssetStats[walletAddress].push(assetResponse);
    });

    console.log("finalAssetStats: ", finalAssetStats);
    return finalAssetStats;
};

////// things to fetch out:
// protocol name
// network
// current asset price (USD)
// current wallet address - matching this value
// borrowAPY
// supplyAPY
// my token balance - quantity (tokens/balance)
// my token balance - USD (tokens/balanceUSD)
// APY - not sure what APY this actually is? but will be useful - it doesn't include rewards APY
// liquidation threshold!
// claimable rewards balance - token type of reward
// claimable rewards balance - balance (quantity)
// claimable rewards balance - balanceUSD

extract_debt = assetJson => {
    // const balanceUSD = assetJson.balanceUSD;
    // const appName = assetJson.appName;
    // const token_resp = extract_token(assetJson.tokens);
    // const asset_response = {
    //   type: "lend",
    //   balanceUSD: balanceUSD,
    //   appName: appName,
    //   tokens: token_resp
    // };
    // // console.log("LEND asset_response: ", asset_response);
    // return asset_response;
};

extract_claimable = assetJson => {
    // const balanceUSD = assetJson.balanceUSD;
    // const appName = assetJson.appName;
    // const token_resp = extract_token(assetJson.tokens);
    // const asset_response = {
    //   type: "claimable",
    //   balanceUSD: balanceUSD,
    //   appName: appName,
    //   tokens: token_resp
    // };
    // // console.log("CLAIMABLE asset_response: ", asset_response);
    // return asset_response;
};

// extract_token = (token_array) => {
//   let final_token_stats = [];

//   for (const val in token_array) {
//     const token_json = token_array[val];

//     if (token_json.type === "interest-bearing" || token_json.type === "base" || token_json.type === "pool" || token_json.type === "vault") {
//       // console.log("current token: ", token_response);
//       if (token_json.metaType !== 'claimable') {
//           const token_response = {
//           network: token_json.network,
//           address: token_json.address,
//           symbol: token_json.symbol,
//           label: token_json.label ? token_json.label : '',
//           quantity: token_json.balance,
//           balanceUSD: token_json.balanceUSD,
//           priceUSD: token_json.price,
//           borrowApy: token_json.borrowApy ? token_json.borrowApy : 0,
//           supplyApy: token_json.supplyApy ? token_json.supplyApy : 0,
//         };
//         final_token_stats.push(token_response);
//       }
//     }
//     else if (token_json.type === "claimable") {
//       // ehh skip claimable tokens for now, not interested in capturing.
//     }
//     else {
//       console.log("Other token type identified! Not getting captured --> ", token_json.type, token_json);
//     }
//   }
//   // console.log("final token: ", final_token_stats)
//   return final_token_stats;
// };

constructSpreadsheetData = protocol_stats_array => {
    //  Ticker | Name | Protocol | Asset Type | Quantity | Balance (NZD) | Supply APY |	Borrow APY | Is Loan? |	Network	| Wallet

    let spreadsheet_protocol_rows = [];
    let spreadsheet_wallet_rows = [];
    const exchange_rate = fetchNZDtoUSDExchangeRate();

    // for each protocol:
    for (const protocol_balance in protocol_stats_array) {
        const protocol = protocol_stats_array[protocol_balance];
        console.log("protocol: ", protocol_stats_array[protocol_balance]);

        // for each list of assets
        for (const asset_array in protocol) {
            const assets = protocol[asset_array];
            // const current_wallet = asset_array;
            console.log("asset_array: ", asset_array);

            // for each asset
            for (const asset in assets) {
                console.log("current asset: ", assets[asset]);
                const a = assets[asset];
                // const type = a.type.toUpperCase();
                const balanceNZD = a.balanceUSD * exchange_rate;
                // const appName = a.fullName;
                // const isLoan = a.isLoan ? 'YES' : '-'
                // const isLoan = a.isLoan;
                // const tokens = a.tokens;
                // const sAPY = (t.supplyApy === 0) ? '0' : (t.supplyApy * 100).toString() + '%';
                // const bAPY = (t.borrowApy === 0) ? '0' : (t.borrowApy * 100).toString() + '%';
                // const sAPY = a.supplyAPY;
                // const bAPY = a.borrowAPY;
                // const label = (t.label.length > 0) ? t.label : t.symbol;

                // spreadsheet_protocol_rows.push([[appName], [t.symbol], [label], [type], [t.quantity], [balanceNZD], [sAPY], [bAPY], [isLoan], [t.network], [current_wallet]]);
                spreadsheet_protocol_rows.push([
                    [a.protocol],
                    [a.ticker],
                    [a.fullName],
                    [a.type],
                    [a.quantity],
                    [balanceNZD],
                    [a.supplyAPY],
                    [a.borrowAPY],
                    [a.isLoan],
                    [a.network],
                    [a.walletAddress],
                ]);

                //   protocol,
                // ticker,
                // fullName,
                // type: "none",
                // quantity,
                // balanceUSD,
                // supplyAPY,
                // borrowAPY,
                // isLoan,
                // network,
                // walletAddress

                // for each token found in this asset
                //   for (const token in tokens) {
                //     const t = tokens[token];
                //     const sAPY = (t.supplyApy === 0) ? '0' : (t.supplyApy * 100).toString() + '%';
                //     const bAPY = (t.borrowApy === 0) ? '0' : (t.borrowApy * 100).toString() + '%';
                //     const label = (t.label.length > 0) ? t.label : t.symbol;

                //     // if (type === 'WALLET' || type === 'CLAIMABLE') {
                //     //   const real_name = (type === 'WALLET') ? 'WALLET' : 'CLAIMABLE';
                //     //   spreadsheet_wallet_rows.push([[real_name], [t.symbol], [label], [type], [t.quantity], [balanceNZD], [sAPY], [bAPY], [isLoan], [t.network], [current_wallet]]);
                //     // } else {
                //     //   spreadsheet_protocol_rows.push([[appName], [t.symbol], [label], [type], [t.quantity], [balanceNZD], [sAPY], [bAPY], [isLoan], [t.network], [current_wallet]]);
                //     // }
                //   }
            }
        }
    }

    // sort final spreadsheet_rows array:
    const sorted_protocols = spreadsheet_protocol_rows.sort(function (a, b) {
        return Math.abs(b[5]) - Math.abs(a[5]);
    });

    return sorted_protocols.concat(spreadsheet_wallet_rows);
};

updateDefiSpreadsheet = finalFormattedData => {
    const source_ss = SpreadsheetApp.getActiveSpreadsheet();
    const defi_summary_spreadsheet = source_ss.getSheetByName("DeFi Summary");
    const row_count = finalFormattedData.length;
    console.log("row count", row_count);

    const range = defi_summary_spreadsheet.getRange(`A2:K${row_count + 1}`);
    range.setValues(finalFormattedData);

    // Set new last successful modified date cell:
    const currentDateTime = Utilities.formatDate(new Date(), "GMT+12", "dd/MM/yyyy HH:mm:ss a '(GMT+12)'");
    defi_summary_spreadsheet.getRange("N7").setValues([[currentDateTime]]);

    // set the last x rows of cells to blank so that we can overwrite any overflowing protocols from previous run:
    const cells_to_clear = 20;
    const clear_range = defi_summary_spreadsheet.getRange(`A${row_count + 2}:K${row_count + (cells_to_clear + 2)}`);
    clear_range.clearContent();
};

fetchNZDtoUSDExchangeRate = () => {
    const full_json = JSON.parse(get_coin_info("DAI"));
    const exchange_rate = full_json.data.DAI.quote.NZD.price;
    return exchange_rate;
};
