/* global artifacts */

const CustomSaleArtifact  = artifacts.require("./test-contracts/CustomSale.sol");
const GenericToken  = artifacts.require("./test-contracts/GenericToken.sol");

module.exports = function (deployer, network, accounts) {
    deployer.deploy(CustomSaleArtifact, web3.toWei("0.05"));
    deployer.deploy(GenericToken);
};
