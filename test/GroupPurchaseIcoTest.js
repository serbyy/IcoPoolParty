import expectThrow from './helpers/expectThrow';

let groupPurchase = artifacts.require("./GroupPurchaseIco.sol");
let groupPurchaseContract;

let Status = {Open: 0, InReview: 1, Approved: 2, Refunding: 3, ClaimTokens: 4};

contract('Group Purchase ICO', function (accounts) {

	describe('Contribute to pool', function () {
		this.slow(5000);

		before(async () => {
			let waterMark = web3.toWei("10", "ether");
			let groupTokenPrice = web3.toWei("0.05", "ether");
			let icoSaleAddress = "0x2755f888047Db8E3d169C6A427470C44b19a7270";
			let icoTokenAddress = "0x2755f888047Db8E3d169C6A427470C44b19a7270";
			groupPurchaseContract = await groupPurchase.new(waterMark, groupTokenPrice, icoSaleAddress, icoTokenAddress);
			smartLog("Group Purchase Address [" + await groupPurchaseContract.address + "]");
		});

		it("should add funds to pool", async () => {
			await groupPurchaseContract.addFundsToPool({from: accounts[0], value: web3.toWei("6", "ether")});
			let investmentAmount = await groupPurchaseContract.investments(accounts[0]);
			let totalInvested = await groupPurchaseContract.totalCurrentInvestments();
			smartLog("Investment amount for user [" + investmentAmount + "]");
			smartLog("Total investment amount [" + totalInvested + "]");
			assert.equal(investmentAmount, web3.toWei("6", "ether"), "Incorrect balance");
			assert.equal(totalInvested, web3.toWei("6", "ether"), "Incorrect total");

			await groupPurchaseContract.addFundsToPool({from: accounts[1], value: web3.toWei("5", "ether")});
			let investmentAmount2 = await groupPurchaseContract.investments(accounts[1]);
			totalInvested = await groupPurchaseContract.totalCurrentInvestments();
			smartLog("Investment amount for user [" + investmentAmount2 + "]");
			smartLog("Total investment amount [" + totalInvested + "]");
			assert.equal(investmentAmount2, web3.toWei("5", "ether"), "Incorrect balance");
			assert.equal(totalInvested, web3.toWei("11", "ether"), "Incorrect total");
		});

		it("Should add funds in incorrect state", async () => {
			let totalInvestment = await groupPurchaseContract.totalCurrentInvestments();
			let watermark = await groupPurchaseContract.waterMark();
			assert.equal(totalInvestment, web3.toWei("11", "ether"), "Incorrect contract balance");
			assert.isAbove(totalInvestment, watermark, "Total is less than watermark");
			let state = await groupPurchaseContract.contractStatus();
			assert.equal(state, Status.Open, "Contract should be 'Open' state, but is " + state);

			await expectThrow(groupPurchaseContract.addFundsToPool({from: accounts[2], value: web3.toWei("1", "ether")}));
			state = await groupPurchaseContract.contractStatus();
			smartLog("State after throw is " + state, true);
			/*assert.equal(state, Status.InReview, "Contract should be 'InReview' atate, but is " + state);*/
		});

		it("should withdraw funds from pool", async () => {
			await groupPurchaseContract.withdrawFundsFromPool({from: accounts[0]});
			let investmentAmount = await groupPurchaseContract.investments(accounts[0]);
			smartLog("Investment amount for user [" + investmentAmount + "]");
			assert.equal(investmentAmount, 0, "Incorrect balance");
			let totalInvested = await groupPurchaseContract.totalCurrentInvestments();
			smartLog("Total investment amount [" + totalInvested + "]");
			assert.equal(totalInvested, web3.toWei("5", "ether"), "Incorrect total");
		});
	});

	/***********************************************************/
	/*                    HELPER FUNCTIONS                     */

	/***********************************************************/

	async function assertState(expectedStatus) {
		let state = await groupPurchaseContract.state();
		smartLog("Current state [" + state + "]");
		assert.equal(state.toNumber(), expectedStatus, "Token sale should still be in state " + expectedStatus);
	}

	async function fastForwardBlocks(_numBlocks) {
		smartLog("Fast forwarding " + _numBlocks + " blocks...");
		for (let i = 0; i < _numBlocks; i++) {
			web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", id: Date.now()});
			smartLog("Block number - " + web3.eth.blockNumber);
		}
	}

	function smartLog(message, override) {
		let verbose = false;
		if (verbose || override)
			console.log(message);
	}
});
