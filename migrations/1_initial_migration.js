var Migrations = artifacts.require("./Migrations.sol");
const utils = require("../test/utils.js");

module.exports = function (deployer, network) {
    utils.addKeyToDappConfig("Network", network);
    deployer.deploy(Migrations);
};
