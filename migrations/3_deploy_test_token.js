/* global artifacts */
const utils = require("../test/utils.js");

const CustomSale = artifacts.require("./test-contracts/CustomSale.sol");
const GenericToken = artifacts.require("./test-contracts/GenericToken.sol");

module.exports = function (deployer, network, accounts) {
    if (network == "test" || network == "develop" || network == "development") {
        deployer.deploy(GenericToken).then(function () {
            return deployer.deploy(CustomSale, web3.toWei("0.05"), GenericToken.address).then(async () => {
                const _token = await GenericToken.deployed();
                const _sale = await CustomSale.deployed();
                utils.addKeyToDappConfig("GenericTokenAddress", _token.address);
                utils.addKeyToDappConfig("CustomSaleAddress", _sale.address);
                return _token.transferOwnership(_sale.address, {from: accounts[0]});
            });

        });
    }
};
