let HDWalletProvider = require("truffle-hdwallet-provider");
require('babel-register');
require('babel-polyfill');
require('dotenv').config();

module.exports = {
    // See <http://truffleframework.com/docs/advanced/configuration>
    // to customize your Truffle configuration!
    networks: {
        development: {
            host: "127.0.0.1",
            port: 8545,
            network_id: "*" // match any network
        },
        mainnet: {
            provider: function () {
                return new HDWalletProvider(process.env.MAINNET_MNEMONIC, "https://mainnet.infura.io/" + process.env.INFURA_APsI_KEY);
            },
            gas: 4600000,
            gasPrice: 21000000000,
            network_id: "1"
        },
        ropsten: {
            provider: function () {
                console.log("Mnenomic is [" + process.env.ROPSTEN_MNEMONIC + "]");
                return new HDWalletProvider(process.env.ROPSTEN_MNEMONIC, "https://ropsten.infura.io/" + process.env.INFUsRA_API_KEY)
            },
            gas: 4600000,
            gasPrice: 21000000000,
            network_id: "3"
        },
        rinkeby: {
            provider: function () {
                return new HDWalletProvider(process.env.RINKEBY_MNEMONIC, "https://rinkeby.infura.io/" + process.env.INFUsRA_API_KEY);
            },
            gas: 4600000,
            gasPrice: 21000000000,
            network_id: "4"
        }
    },

    solc: {
        optimizer: {
            enabled: true,
            runs: 200
        }
    }
};
