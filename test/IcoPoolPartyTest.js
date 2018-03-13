import expectThrow from './helpers/expectThrow';

let icoPoolPartyFactory = artifacts.require('./IcoPoolPartyFactory');
let icoPoolParty = artifacts.require('./IcoPoolParty');
let foregroundTokenSale = artifacts.require('./ForegroundTokenSale');
let dealToken = artifacts.require('./DealToken');

let icoPoolPartyFactoryContract;
let icoPoolPartyContract;
let tokenSaleContract;
let dealTokenContract;

const Status = {Open: 0, WaterMarkReached: 1, DueDiligence: 2, InReview: 3, Claim: 4, Refunding: 5};

contract('Pool Party ICO', function (accounts) {

    describe('Run through happy path sale', function () {
        this.slow(5000);

        before(async () => {
            icoPoolPartyFactoryContract = await icoPoolPartyFactory.deployed();
            smartLog("Pool Party Factory Address [" + await icoPoolPartyFactoryContract.address + "]");

            await icoPoolPartyFactoryContract.setDueDiligenceDuration(3);
            await icoPoolPartyFactoryContract.setWaterMark(web3.toWei("10", "ether"), {from: accounts[0]});
            smartLog("New watermark [" + await icoPoolPartyFactoryContract.waterMark() + "]");

//            tokenSaleContract = await foregroundTokenSale.new(400, 100, web3.toWei(0.05, "ether"), accounts[1]);
            tokenSaleContract = await foregroundTokenSale.new(400, 1, web3.toWei(0.05, "ether"), accounts[1]);
            let tokenSaleStartBlockNumber = web3.eth.blockNumber + 1;
            let tokenSaleEndBlockNumber = tokenSaleStartBlockNumber + 500;
            await tokenSaleContract.configureSale(tokenSaleStartBlockNumber, tokenSaleEndBlockNumber, accounts[9], 50, accounts[9], accounts[9], accounts[9], accounts[9], {from: accounts[0]});
            dealTokenContract = dealToken.at(await tokenSaleContract.dealToken());
        });

        it("should create new Pool Party", async () => {
            const tx = await icoPoolPartyFactoryContract.createNewPoolParty("api.test.foreground.io", {from:accounts[1]});
            smartLog(tx);
            const poolAddress = await icoPoolPartyFactoryContract.partyList(0);
            icoPoolPartyContract = icoPoolParty.at(poolAddress);
            smartLog("Foreground Pool Party Address [" + icoPoolPartyContract.address + "]");

            /* Try create another pool with a name that already exists */
            await expectThrow(icoPoolPartyFactoryContract.createNewPoolParty("api.test.foreground.io"));

            await icoPoolPartyFactoryContract.createNewPoolParty("themktplace.io");
            let poolAddress2 = await icoPoolPartyFactoryContract.partyList(1);
            const icoPoolPartyContract2 = icoPoolParty.at(poolAddress2);

            smartLog("MKT.place Party Address [" + icoPoolPartyContract2.address + "]");
        });

        it("should get pool details", async () => {
            smartLog("Address of Foreground pool [" + await icoPoolPartyFactoryContract.getContractAddressByName("api.test.foreground.io") + "]");
            const poolDetails = await icoPoolPartyContract.getPoolDetails();
            smartLog("Foreground pool details [" + poolDetails + "]");
        });

        it("should add funds to pool", async () => {
            await icoPoolPartyContract.addFundsToPool({from: accounts[0], value: web3.toWei("6", "ether")});
            let investmentAmount = (await icoPoolPartyContract.investors(accounts[0]))[0];
            let totalInvested = await icoPoolPartyContract.totalPoolInvestments();
            smartLog("Investment amount for user [" + investmentAmount + "]");
            smartLog("Total investment amount [" + totalInvested + "]");
            assert.equal(investmentAmount, web3.toWei("6", "ether"), "Incorrect balance");
            assert.equal(totalInvested, web3.toWei("6", "ether"), "Incorrect total");
        });

        it("should withdraw funds from pool", async () => {
            await icoPoolPartyContract.leavePool({from: accounts[0]});
            let investmentAmount = (await icoPoolPartyContract.investors(accounts[0]))[0];
            smartLog("Investment amount for user [" + investmentAmount + "]");
            assert.equal(investmentAmount, 0, "Incorrect balance");

            let totalInvested = await icoPoolPartyContract.totalPoolInvestments();
            smartLog("Total pool investment amount [" + totalInvested + "]");
            assert.equal(totalInvested, web3.toWei("0", "ether"), "Incorrect total");
        });

        it("Should buy more", async () => {
            await icoPoolPartyContract.addFundsToPool({from: accounts[0], value: web3.toWei("6.03123123", "ether")});
            let investmentAmount = (await icoPoolPartyContract.investors(accounts[0]))[0];
            let totalInvested = await icoPoolPartyContract.totalPoolInvestments();
            smartLog("Investment amount for user [" + investmentAmount + "]");
            smartLog("Total investment amount [" + totalInvested + "]");
            assert.equal(investmentAmount, web3.toWei("6.03123123", "ether"), "Incorrect balance");
            //assert.equal(totalInvested, web3.toWei("6", "ether"), "Incorrect total");

            await icoPoolPartyContract.addFundsToPool({from: accounts[1], value: web3.toWei("5", "ether")});
            let investmentAmount2 = (await icoPoolPartyContract.investors(accounts[1]))[0];
            totalInvested = await icoPoolPartyContract.totalPoolInvestments();
            smartLog("Investment amount for user [" + investmentAmount2 + "]");
            smartLog("Total investment amount [" + totalInvested + "]");
            assert.equal(investmentAmount2, web3.toWei("5", "ether"), "Incorrect balance");
            assert.equal(totalInvested, web3.toWei("11.03123123", "ether"), "Incorrect total");
        });

        //LEGIT SKIP
        it.skip("should configure pool using actual oraclize call", async () => {
            await icoPoolPartyContract.addFundsToPool({from: accounts[2], value: web3.toWei("1", "ether")});
            const poolState = await icoPoolPartyContract.poolStatus();
            smartLog("Pool State is [" + poolState + "]");
            assert.equal(poolState, Status.WaterMarkReached, "Pool in incorrect status");
            await icoPoolPartyContract.configurePool({from: accounts[0], value: web3.toWei("0.5")});

            await sleep(100000);
            const poolDetails = await icoPoolPartyContract.getPoolDetails();
            smartLog("Foreground pool details [" + poolDetails + "]");
        });

        it("should configure sale address quickly", async () => {
            await icoPoolPartyContract.addFundsToPool({from: accounts[2], value: web3.toWei("1", "ether")});
            const poolState = await icoPoolPartyContract.poolStatus();
            smartLog("Pool State is [" + poolState + "]");
            assert.equal(poolState, Status.WaterMarkReached, "Pool in incorrect status");
            await icoPoolPartyContract.setAuthorizedConfigurationAddressTest(accounts[7], false, {from: accounts[0], value: web3.toWei("0.005")});
            const poolDetails = await icoPoolPartyContract.getPoolDetails();
            smartLog("Foreground pool details [" + poolDetails + "]");
            const configDetails = await icoPoolPartyContract.getConfigDetails();
            smartLog("Foreground config details [" + configDetails + "]");
        });

        it("should configure pool details", async () => {
            await icoPoolPartyContract.configurePool(tokenSaleContract.address, dealTokenContract.address, "N/A", "claimToken()", "claimRefund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: accounts[7]});
            assert.equal(await icoPoolPartyContract.buyFunctionName(), "N/A", "Wrong buyFunctionName");
        });

        it("should complete configuration", async () => {
            await icoPoolPartyContract.completeConfiguration({from: accounts[7]});
            const poolState = await icoPoolPartyContract.poolStatus();
            assert.equal(poolState, Status.DueDiligence, "Pool in incorrect status");
        });

        it("Should kick user", async () => {
            //Expect throw because of wrong state
            await expectThrow(icoPoolPartyContract.kickUser(accounts[2], "Kick user reason", {from: accounts[7]}));
            await sleep(3000);
            await icoPoolPartyContract.kickUser(accounts[2], "Kick user reason", {from: accounts[7]});
            smartLog("Account 2 eth after being kicked [" + web3.fromWei((await icoPoolPartyContract.investors(accounts[2]))[0]) + "]");
            assert.equal((await icoPoolPartyContract.investors(accounts[2]))[0], 0, "User account should be 0");
            smartLog("Total investment amount [" + web3.fromWei(await icoPoolPartyContract.totalPoolInvestments()) + "]");
            assert.equal(await icoPoolPartyContract.totalPoolInvestments(), web3.toWei("11.03123123", "ether"), "Total investments should be 11 eth");
        });

        it("Should manually purchase token", async () => {
            web3.eth.sendTransaction({
                from: accounts[2],
                to: tokenSaleContract.address,
                value: web3.toWei("1.7", "ether"),
                gas: 300000
            });
            smartLog("Sale Contract Balance after manual purchase [" + web3.fromWei(web3.eth.getBalance(tokenSaleContract.address)) + "]");
        });

        it("Should release funds to ICO", async () => {
            smartLog("Sale Contract Balance BEFORE [" + web3.fromWei(web3.eth.getBalance(tokenSaleContract.address)) + "]");
            smartLog("Pool Contract Balance BEFORE [" + web3.fromWei(web3.eth.getBalance(icoPoolPartyContract.address)) + "]");

            await tokenSaleContract.updateLatestSaleState({from: accounts[6]});
            smartLog("Sale State is [" + await tokenSaleContract.state() + "]");

            const subsidy = await calculateSubsidy();
            smartLog("Subsidy is [" + web3.fromWei(subsidy) + "]");

            const feePercent = await icoPoolPartyContract.feePercentage();
            const total = await icoPoolPartyContract.totalPoolInvestments();
            const fee = total * feePercent / 100;
            smartLog("Fee [" + web3.fromWei(fee) + "]");

            //Send too little as the subsidy - should fail
            await expectThrow(icoPoolPartyContract.releaseFundsToSale({
                from: accounts[7],
                value: subsidy - 1*10**16,
                gas: 300000
            }));

            await icoPoolPartyContract.releaseFundsToSale({
                from: accounts[7],
                value: subsidy + fee,
                gas: 300000
            });

            smartLog("Sale Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(tokenSaleContract.address)) + "]");
            smartLog("Pool Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(icoPoolPartyContract.address)) + "]");
            smartLog("Token Balance [" + await tokenSaleContract.purchases(icoPoolPartyContract.address) + "]");
        });

        it("Should get 0 tokens due balance - tokens haven't been claimed yet", async () => {
            var tokensDue0 = (await icoPoolPartyContract.getContributionsDue(accounts[0]))[2];
            smartLog("Account 0 has [" + tokensDue0 + "] tokens due");
            assert.equal(tokensDue0, 0, "Account 0 should 0 tokens");
            var tokensDue1 = (await icoPoolPartyContract.getContributionsDue(accounts[1]))[2];
            smartLog("Account 1 has [" + tokensDue1 + "] tokens due");
            assert.equal(tokensDue0, 0, "Account 1 should 0 tokens");
        });

        it("Should complete sale", async () => {
            web3.eth.sendTransaction({
                from: accounts[2],
                to: tokenSaleContract.address,
                value: web3.toWei("20", "ether"),
                gas: 300000
            });
            smartLog("Sale Contract Balance after manual purchase [" + web3.fromWei(web3.eth.getBalance(tokenSaleContract.address)) + "]");
        });

        it("Should claim tokens from ICO", async () => {
            await tokenSaleContract.updateLatestSaleState({from: accounts[6]});
            smartLog("Sale State is (should be 5) [" + await tokenSaleContract.state() + "]");
            smartLog("Tokens received [" + await icoPoolPartyContract.totalTokensReceived() + "]");

            await icoPoolPartyContract.claimTokensFromIco({from: accounts[7]});
            smartLog("Tokens Received [" + await icoPoolPartyContract.totalTokensReceived() + "]");
            smartLog("Pool Party token balance [" + await dealTokenContract.balanceOf(icoPoolPartyContract.address) + "]");
        });

        it("Should get correct tokens due balance", async () => {
            var tokensDue0 = (await icoPoolPartyContract.getContributionsDue(accounts[0]))[2];
            smartLog("Account 0 has [" + tokensDue0 + "] tokens due");
            assert.isAbove(tokensDue0, 0, "Account 0 should have more than 0 tokens");
            var tokensDue1 = (await icoPoolPartyContract.getContributionsDue(accounts[1]))[2];
            smartLog("Account 1 has [" + tokensDue1 + "] tokens due");
            assert.isAbove(tokensDue0, 0, "Account 1 should have more than 0 tokens");
        });

        it("Should claim tokens", async () => {
            smartLog("Total tokens received from sale [" + await icoPoolPartyContract.totalTokensReceived() + "]");
            smartLog("Account 0 eth investment [" + web3.fromWei((await icoPoolPartyContract.investors(accounts[0]))[0]) + "]");

            await icoPoolPartyContract.claimTokens({from: accounts[0]});
            smartLog("Account 0 token balance [" + await dealTokenContract.balanceOf(accounts[0]) + "]");
            assert.isAbove(await dealTokenContract.balanceOf(accounts[0]), 0, "Token balance must be greater than 0");

            await icoPoolPartyContract.claimTokens({from: accounts[1]});
            smartLog("Account 1 token balance [" + await dealTokenContract.balanceOf(accounts[1]) + "]");
            assert.isAbove(await dealTokenContract.balanceOf(accounts[1]), 0, "Token balance must be greater than 0");

            smartLog("Pool Party token balance after everyone claims [" + await dealTokenContract.balanceOf(icoPoolPartyContract.address) + "]");

            smartLog("Account 0 has [" + (await icoPoolPartyContract.getContributionsDue(accounts[0]))[2] + "] tokens due after claim");
            smartLog("Account 1 has [" + (await icoPoolPartyContract.getContributionsDue(accounts[1]))[2] + "] tokens due after claim");

            smartLog("Account 0 Contribution percentage [" + (await icoPoolPartyContract.investors(accounts[0]))[2] + "]");
            smartLog("Account 1 Contribution percentage [" + (await icoPoolPartyContract.investors(accounts[1]))[2] + "]");

            smartLog("Balance remaining Snapshot [" + web3.fromWei(await icoPoolPartyContract.balanceRemainingSnapshot()) + "]");

            smartLog("Account 0 amount back [" + web3.fromWei((await icoPoolPartyContract.investors(accounts[0]))[6]) + "]");
            smartLog("Account 1 amount back [" + web3.fromWei((await icoPoolPartyContract.investors(accounts[1]))[6]) + "]");
        });

        it("should claim refund after successful sale", async () => {
            smartLog("Account 0 Contribution percentage [" + web3.fromWei((await icoPoolPartyContract.investors(accounts[0]))[2]) + "]");
            smartLog("Account 0 Refund Amount [" + web3.fromWei((await icoPoolPartyContract.investors(accounts[0]))[6]) + "]");
            smartLog("Account 0 Balance [" + web3.fromWei(web3.eth.getBalance(accounts[0])) + "]");

            await icoPoolPartyContract.claimRefund({from: accounts[0]});

            smartLog("Account 0 Contribution percentage [" + web3.fromWei((await icoPoolPartyContract.investors(accounts[0]))[2]) + "]");
            smartLog("Account 0 Refund Amount [" + web3.fromWei((await icoPoolPartyContract.investors(accounts[0]))[6]) + "]");
            smartLog("Account 0 Balance [" + web3.fromWei(web3.eth.getBalance(accounts[0])) + "]");

            //Can't claim again
            await expectThrow(icoPoolPartyContract.claimRefund({from: accounts[0]}));
            //smartLog("Account 1 Contribution percentage [" + (await icoPoolPartyContract.investors(accounts[1]))[2] + "]");

        });
    });

    /***********************************************************/
    /*                    HELPER FUNCTIONS                     */

    /***********************************************************/

    function smartLog(message, override) {
        let verbose = false;
        if (verbose || override)
            console.log(message);
    }

    async function calculateSubsidy() {
        let _expectedGroupDiscountPercent = await icoPoolPartyContract.expectedGroupDiscountPercent();
        smartLog("expectedGroupDiscountPercent [" + _expectedGroupDiscountPercent + "%]");
        let _actualGroupDiscountPercent = await icoPoolPartyContract.actualGroupDiscountPercent();
        smartLog("actualGroupDiscountPercent [" + _actualGroupDiscountPercent + "%]");
        let _expectedGroupTokenPrice = await icoPoolPartyContract.expectedGroupTokenPrice();
        smartLog("expectedGroupTokenPrice [" + web3.fromWei(_expectedGroupTokenPrice) + "]");
        let _totalPoolInvestments = await icoPoolPartyContract.totalPoolInvestments();
        smartLog("totalPoolInvestments [" + web3.fromWei(_totalPoolInvestments) + "]");

        let _groupContPercent = 100 - _actualGroupDiscountPercent;
        let _amountToRelease = _totalPoolInvestments * 100 / _groupContPercent;

        smartLog("amountToRelease [" + web3.fromWei(_amountToRelease) + "]");

        return _amountToRelease - _totalPoolInvestments;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
});
