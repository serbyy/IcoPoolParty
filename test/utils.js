const fs = require("fs");
const poolPartyFactoryConfig = JSON.parse(fs.readFileSync("../build/contracts/IcoPoolPartyFactory.json"));
const poolPartyConfig = JSON.parse(fs.readFileSync("../build/contracts/IcoPoolParty.json"));

let configArray = {"PoolPartyFactoryAbi": poolPartyFactoryConfig.abi, "PoolPartyAbi": poolPartyConfig.abi};

const utils = {
    addKeyToDappConfig: async (_key, _value) => {
        configArray[_key] = _value;
        fs.writeFileSync("./build/contract-config.json", JSON.stringify(configArray));
    }
};

module.exports = utils;