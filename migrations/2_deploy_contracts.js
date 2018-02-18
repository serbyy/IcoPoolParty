const IcoPoolPartyFactory = artifacts.require('./IcoPoolPartyFactory.sol');


module.exports = function (deployer, network, accounts) {
    deployer.deploy(IcoPoolPartyFactory, accounts[6]);
};
