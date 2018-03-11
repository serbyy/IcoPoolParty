/* global artifacts */

const utils = require("../test/utils.js");

const IcoPoolPartyFactory = artifacts.require("./IcoPoolPartyFactory.sol");
const UrlBuilder = artifacts.require("./libraries/OraclizeQueryBuilder.sol");
const OraclizeTest = artifacts.require("./OracalizeTest.sol");

module.exports = function (deployer, network, accounts) {
    deployer.deploy(UrlBuilder);

    deployer.link(UrlBuilder, IcoPoolPartyFactory);
    deployer.link(UrlBuilder, OraclizeTest);

    deployer.deploy(OraclizeTest);
    deployer.deploy(IcoPoolPartyFactory, accounts[6]).then(async () => {
        utils.addKeyToDappConfig("IcoPoolPartyFactoryAddress", IcoPoolPartyFactory.address);
        const factory = await IcoPoolPartyFactory.deployed();
        return factory.setDueDiligenceDuration(3, {from: accounts[0]});
    });
};

