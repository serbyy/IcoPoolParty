/* global artifacts */

const CustomSaleArtifact = artifacts.require("./test-contracts/CustomSale.sol");
const GenericToken = artifacts.require("./test-contracts/GenericToken.sol");

module.exports = function (deployer, network) {
    if (network == "develop" || network == "development") {
        deployer.deploy(GenericToken).then(function () {
            return deployer.deploy(CustomSaleArtifact, web3.toWei("0.05"), GenericToken.address);
        });
    }
};
