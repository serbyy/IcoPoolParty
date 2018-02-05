import expectThrow from './helpers/expectThrow';

let foregroundPoolParty = artifacts.require('./ForegroundPoolParty');
let tokenMarketPoolParty = artifacts.require('./TokenMarketPoolParty');
let icoPoolPartyFactory = artifacts.require('./IcoPoolPartyFactory');
let foregroundTokenSale = artifacts.require('./ForegroundTokenSale');
let icoPoolParty = artifacts.require('./IcoPoolParty');
let dealToken = artifacts.require('./DealToken');

let icoPoolPartyFactoryContract;
let foregroundPoolPartyContract;
let tokenMarketPoolPartyContract;
let icoPoolPartyContract;
let tokenSaleContract;
let dealTokenContract;

let Status = {Open: 0, InReview: 1, Approved: 2, Refunding: 3, ClaimTokens: 4};
let PoolPartyType = {None: 0, Foreground: 1, TokenMarket: 2, OpenZeppelin: 3};

contract('Group Purchase ICO', function (accounts) {

    describe.skip('Contribute to Foreground pool', function () {
        this.slow(5000);

        before(async () => {
            tokenSaleContract = await foregroundTokenSale.new(400, 100, web3.toWei(0.05, "ether"), "0x2755f888047Db8E3d169C6A427470C44b19a7270");
            smartLog("DealToken Address [" + await tokenSaleContract.dealToken() + "]");

            icoPoolPartyFactoryContract = await icoPoolPartyFactory.new();
            smartLog("Pool Party Factory Address [" + await icoPoolPartyFactoryContract.address + "]");

            let waterMark = web3.toWei("10", "ether");
            let groupTokenPrice = web3.toWei("0.03", "ether");
            let icoSaleAddress = await tokenSaleContract.address;
            let icoTokenAddress = await tokenSaleContract.dealToken();
            await icoPoolPartyFactoryContract.createNewPoolParty(PoolPartyType.Foreground, waterMark, groupTokenPrice, icoSaleAddress, icoTokenAddress);

            let fgAddress = await icoPoolPartyFactoryContract.partyList(0);
            assert.equal(await icoPoolPartyFactoryContract.poolParties(fgAddress), PoolPartyType.Foreground, "Incorrect party type - should be 'Foreground'");
            foregroundPoolPartyContract = foregroundPoolParty.at(fgAddress);

            smartLog("Foreground Pool Party Address [" + foregroundPoolPartyContract.address  + "]");

            let tokenSaleStartBlockNumber = web3.eth.blockNumber + 1;
            let tokenSaleEndBlockNumber = tokenSaleStartBlockNumber + 500;
            await tokenSaleContract.configureSale(tokenSaleStartBlockNumber, tokenSaleEndBlockNumber, accounts[9], 50, accounts[9], accounts[9], accounts[9], accounts[9], {from: accounts[0]});
            dealTokenContract = dealToken.at(await tokenSaleContract.dealToken());

        });

        it("should add funds to pool", async () => {
            await foregroundPoolPartyContract.addFundsToPool({from: accounts[0], value: web3.toWei("6", "ether")});
            let investmentAmount = await foregroundPoolPartyContract.investments(accounts[0]);
            let totalInvested = await foregroundPoolPartyContract.totalCurrentInvestments();
            smartLog("Investment amount for user [" + investmentAmount + "]");
            smartLog("Total investment amount [" + totalInvested + "]");
            assert.equal(investmentAmount, web3.toWei("6", "ether"), "Incorrect balance");
            assert.equal(totalInvested, web3.toWei("6", "ether"), "Incorrect total");
        });

        it("should withdraw funds from pool", async () => {
            await foregroundPoolPartyContract.withdrawFundsFromPool({from: accounts[0]});
            let investmentAmount = await foregroundPoolPartyContract.investments(accounts[0]);
            smartLog("Investment amount for user [" + investmentAmount + "]");
            assert.equal(investmentAmount, 0, "Incorrect balance");
            let totalInvested = await foregroundPoolPartyContract.totalCurrentInvestments();
            smartLog("Total investment amount [" + totalInvested + "]");
            assert.equal(totalInvested, web3.toWei("0", "ether"), "Incorrect total");
        });

        it("Should buy more", async () => {
            await foregroundPoolPartyContract.addFundsToPool({from: accounts[0], value: web3.toWei("6", "ether")});
            let investmentAmount = await foregroundPoolPartyContract.investments(accounts[0]);
            let totalInvested = await foregroundPoolPartyContract.totalCurrentInvestments();
            smartLog("Investment amount for user [" + investmentAmount + "]");
            smartLog("Total investment amount [" + totalInvested + "]");
            assert.equal(investmentAmount, web3.toWei("6", "ether"), "Incorrect balance");
            assert.equal(totalInvested, web3.toWei("6", "ether"), "Incorrect total");

            await foregroundPoolPartyContract.addFundsToPool({from: accounts[1], value: web3.toWei("5", "ether")});
            let investmentAmount2 = await foregroundPoolPartyContract.investments(accounts[1]);
            totalInvested = await foregroundPoolPartyContract.totalCurrentInvestments();
            smartLog("Investment amount for user [" + investmentAmount2 + "]");
            smartLog("Total investment amount [" + totalInvested + "]");
            assert.equal(investmentAmount2, web3.toWei("5", "ether"), "Incorrect balance");
            assert.equal(totalInvested, web3.toWei("11", "ether"), "Incorrect total");

        });

        it("Should kick user", async () => {
            await foregroundPoolPartyContract.ejectInvestor(accounts[0], {from: accounts[0]});
            smartLog("Account 0 eth after being ejected [" + web3.fromWei(await foregroundPoolPartyContract.investments(accounts[0])) + "]");
            assert.equal(await foregroundPoolPartyContract.investments(accounts[0]), 0, "User account should be 0");
            smartLog("Total investment amount [" + web3.fromWei(await foregroundPoolPartyContract.totalCurrentInvestments()) + "]");
            assert.equal(await foregroundPoolPartyContract.totalCurrentInvestments(), web3.toWei("5", "ether"), "Total investments should be 5 eth");

            //Add funds back to continue with tests
            await foregroundPoolPartyContract.addFundsToPool({from: accounts[0], value: web3.toWei("6", "ether")});
        });

        it("Should manually purchase token", async () => {
            web3.eth.sendTransaction({
                from: accounts[2],
                to: tokenSaleContract.address,
                value: web3.toWei("1.7", "ether"),
                gas: 300000
            });
            smartLog("Sale Contract Balance after 1st purchase [" + web3.fromWei(web3.eth.getBalance(tokenSaleContract.address)) + "]");
        });

        it("Should release funds to ICO", async () => {
            smartLog("BEFORE Account 0 balance [" + web3.fromWei(web3.eth.getBalance(accounts[0])) + "]");

            await tokenSaleContract.updateLatestSaleState({from: accounts[6]});
            smartLog("Sale State is [" + await tokenSaleContract.state() + "]");
            await foregroundPoolPartyContract.updateState(Status.Approved, {from: accounts[0]});
            smartLog("GP State is [" + await foregroundPoolPartyContract.contractStatus() + "]");

            smartLog("Total investments [" + await foregroundPoolPartyContract.totalCurrentInvestments() + "]");

            //11 eth * 5/100 = 0.55 eth fee
            //await expectThrow(foregroundPoolPartyContract.releaseFundsToSale({from: accounts[4], value: web3.toWei("7.85", "ether"), gas: 300000 }));
            await foregroundPoolPartyContract.releaseFundsToSale({
                from: accounts[4],
                value: web3.toWei("7.85", "ether"),
                gas: 300000
            });

            smartLog("Sale Contract Balance [" + web3.fromWei(web3.eth.getBalance(tokenSaleContract.address)) + "]");
            smartLog("GP Contract Balance [" + web3.fromWei(web3.eth.getBalance(foregroundPoolPartyContract.address)) + "]");

            smartLog("Actual Token Balance [" + await tokenSaleContract.purchases(foregroundPoolPartyContract.address) + "]");
            smartLog("AFTER Account 0 balance [" + web3.fromWei(web3.eth.getBalance(accounts[0])) + "]");
        });

        it("Should add funds in incorrect state", async () => {
            let totalInvestment = await foregroundPoolPartyContract.totalCurrentInvestments();
            let watermark = await foregroundPoolPartyContract.waterMark();
            assert.equal(totalInvestment, web3.toWei("11", "ether"), "Incorrect contract balance");
            assert.isAbove(totalInvestment, watermark, "Total is less than watermark");
            let state = await foregroundPoolPartyContract.contractStatus();
            assert.equal(state, Status.ClaimTokens, "Contract should be 'ClaimTokens' state, but is " + state);

            await expectThrow(foregroundPoolPartyContract.addFundsToPool({
                from: accounts[2],
                value: web3.toWei("1", "ether")
            }));
        });

        it("Should get 0 tokens due balance", async () => {
            var tokensDue0 = await foregroundPoolPartyContract.getTotalTokensDue(accounts[0]);
            smartLog("Account 0 has [" + tokensDue0 + "] tokens due");
            assert.equal(tokensDue0, 0, "Account 0 should 0 tokens");
            var tokensDue1 = await foregroundPoolPartyContract.getTotalTokensDue(accounts[1]);
            smartLog("Account 1 has [" + tokensDue1 + "] tokens due");
            assert.equal(tokensDue0, 0, "Account 1 should 0 tokens");
        });

        it("Should claim tokens from ICO", async () => {
            await foregroundPoolPartyContract.claimTokensFromIco({from: accounts[7]});
            smartLog("Group Purchase token balance [" + await dealTokenContract.balanceOf(foregroundPoolPartyContract.address) + "]");
        });

        it("Should get correct tokens due balance", async () => {
            var tokensDue0 = await foregroundPoolPartyContract.getTotalTokensDue(accounts[0]);
            smartLog("Account 0 has [" + tokensDue0 + "] tokens due");
            assert.isAbove(tokensDue0, 0, "Account 0 should have more than 0 tokens");
            var tokensDue1 = await foregroundPoolPartyContract.getTotalTokensDue(accounts[1]);
            smartLog("Account 1 has [" + tokensDue1 + "] tokens due");
            assert.isAbove(tokensDue0, 0, "Account 1 should have more than 0 tokens");
        });

        it("Should claim tokens", async () => {
            smartLog("Account 0 eth investment [" + web3.fromWei(await foregroundPoolPartyContract.investments(accounts[0])) + "]");

            await foregroundPoolPartyContract.claimTokens({from: accounts[0]});
            smartLog("Account 0 token balance [" + await dealTokenContract.balanceOf(accounts[0]) + "]");
            assert.isAbove(await dealTokenContract.balanceOf(accounts[0]), 0, "Token balance must be greater than 0");

            await foregroundPoolPartyContract.claimTokens({from: accounts[1]});
            smartLog("Account 1 token balance [" + await dealTokenContract.balanceOf(accounts[1]) + "]");
            assert.isAbove(await dealTokenContract.balanceOf(accounts[1]), 0, "Token balance must be greater than 0");

            smartLog("Pool Party token balance [" + await dealTokenContract.balanceOf(foregroundPoolPartyContract.address) + "]");

            smartLog("Account 0 has [" + await foregroundPoolPartyContract.getTotalTokensDue(accounts[0]) + "] tokens due");
            smartLog("Account 1 has [" + await foregroundPoolPartyContract.getTotalTokensDue(accounts[1]) + "] tokens due");
        });
    });

    describe('Contribute to new pool', function () {
        this.slow(5000);

        before(async () => {
            icoPoolPartyFactoryContract = await icoPoolPartyFactory.new(accounts[0], accounts[0]);
            smartLog("Pool Party Factory Address [" + await icoPoolPartyFactoryContract.address + "]");

            await icoPoolPartyFactoryContract.createNewPoolParty("https://www.foreground.io");
            let poolAddress = await icoPoolPartyFactoryContract.partyList(0);
            icoPoolPartyContract = icoPoolParty.at(poolAddress);

            smartLog("New Pool Party Address [" + icoPoolPartyContract.address + "]", true);
            smartLog("Service Account [" + await icoPoolPartyFactoryContract.serviceAccountAddress() + "]");
        });

        it("should add funds to pool and other sandbox tests", async () => {
            await icoPoolPartyContract.addFundsToPool({from: accounts[0], value: web3.toWei("6", "ether")});
            let investmentAmount = await icoPoolPartyContract.investments(accounts[0]);
            let totalInvested = await icoPoolPartyContract.totalPoolInvestments();
            smartLog("Investment amount for user [" + investmentAmount + "]");
            smartLog("Total investment amount [" + totalInvested + "]");
            assert.equal(investmentAmount, web3.toWei("6", "ether"), "Incorrect balance");
            assert.equal(totalInvested, web3.toWei("6", "ether"), "Incorrect total");

            smartLog("Address of Foreground pool [" + await icoPoolPartyFactoryContract.getContractAddressByName("https://www.foreground.io") + "]", true);

            var poolDetails = await icoPoolPartyContract.getPoolDetails();
            smartLog("Foreground pool details [" + poolDetails + "]");
            smartLog("Foreground pool URL [" + web3.toAscii(poolDetails[0]) + "]");
        });

        it("should set sale detail", async () => {
            await icoPoolPartyContract.setSaleDetails(accounts[9], accounts[9], accounts[0], "", "claimRefund()", "claimToken()", {from: accounts[0]});
        });
    });

    /***********************************************************/
    /*                    HELPER FUNCTIONS                     */
    /***********************************************************/

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
