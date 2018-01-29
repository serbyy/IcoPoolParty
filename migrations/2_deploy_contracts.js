var GroupPurchaseIco = artifacts.require("./GroupPurchaseIco.sol");

module.exports = function (deployer, network, accounts) {
	let waterMark = web3.toWei("1000", "ether");
	let groupTokenPrice = web3.toWei("0.05", "ether");
	let icoSaleAddress = "";
	let icoTokenAddress = "";

	deployer.deploy(GroupPurchaseIco, waterMark, groupTokenPrice, icoSaleAddress, icoTokenAddress);
};
