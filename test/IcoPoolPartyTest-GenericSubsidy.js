import expectThrow from './helpers/expectThrow';

let icoPoolPartyFactory = artifacts.require('./IcoPoolPartyFactory');
let icoPoolParty = artifacts.require('./IcoPoolParty');
let CustomSale = artifacts.require('./test-contracts/CustomSale');
let genericToken = artifacts.require('./test-contracts/GenericToken');

let icoPoolPartyFactoryContract;
let icoPoolPartyContract;
let customSaleContract;
let genericTokenContract;

const Status = {Open: 0, WaterMarkReached: 1, DueDiligence: 2, InReview: 3, Claim: 4, Refunding: 5};

contract('Generic Pool Party ICO', function (accounts) {

    describe('Generic Sale', function () {
        this.slow(5000);

        const [deployer, investor1, investor2, investor3] = accounts;

        before(async () => {
            icoPoolPartyFactoryContract = await icoPoolPartyFactory.deployed();
            smartLog("Pool Party Factory Address [" + await icoPoolPartyFactoryContract.address + "]");
            await icoPoolPartyFactoryContract.setDueDiligenceDuration(3);
            genericTokenContract = await genericToken.deployed();
            customSaleContract = await CustomSale.deployed();
        });

        it("should create new Pool Party", async () => {
            await icoPoolPartyFactoryContract.createNewPoolParty("api.test.foreground.io", {from: deployer});
            const poolAddress = await icoPoolPartyFactoryContract.partyList(0);
            icoPoolPartyContract = icoPoolParty.at(poolAddress);

            /* Try create another pool with a name that already exists */
            await expectThrow(icoPoolPartyFactoryContract.createNewPoolParty("api.test.foreground.io"));
        });

        it("should add funds to pool", async () => {
            await icoPoolPartyContract.addFundsToPool({from: investor1, value: web3.toWei("6", "ether")});

            let investmentAmount = (await icoPoolPartyContract.investors(investor1))[0];
            let totalInvested = await icoPoolPartyContract.totalPoolInvestments();
            assert.equal(investmentAmount, web3.toWei("6", "ether"), "Incorrect balance");
            assert.equal(totalInvested, web3.toWei("6", "ether"), "Incorrect total");
        });

        it("should withdraw funds from pool", async () => {
            await icoPoolPartyContract.leavePool({from: investor1});
            let investmentAmount = (await icoPoolPartyContract.investors(investor1))[0];
            assert.equal(investmentAmount, 0, "Incorrect balance");

            let totalInvested = await icoPoolPartyContract.totalPoolInvestments();
            assert.equal(totalInvested, web3.toWei("0", "ether"), "Incorrect total");
        });

        it("Should add more funds to pool", async () => {
            await icoPoolPartyContract.addFundsToPool({from: investor1, value: web3.toWei("6.03123123", "ether")});
            let investmentAmount = (await icoPoolPartyContract.investors(investor1))[0];
            let totalInvested = await icoPoolPartyContract.totalPoolInvestments();

            assert.equal(investmentAmount, web3.toWei("6.03123123", "ether"), "Incorrect balance");
            assert.equal(totalInvested, web3.toWei("6.03123123", "ether"), "Incorrect total");

            await icoPoolPartyContract.addFundsToPool({from: investor2, value: web3.toWei("9", "ether")});
            let investmentAmount2 = (await icoPoolPartyContract.investors(investor2))[0];
            totalInvested = await icoPoolPartyContract.totalPoolInvestments();

            assert.equal(investmentAmount2, web3.toWei("9", "ether"), "Incorrect balance");
            assert.equal(totalInvested, web3.toWei("15.03123123", "ether"), "Incorrect total");
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

        it("should configure pool quickly", async () => {
            const poolState = await icoPoolPartyContract.poolStatus();
            assert.equal(poolState, Status.WaterMarkReached, "Pool in incorrect status");
            await icoPoolPartyContract.setAuthorizedConfigurationAddressTest(accounts[7], false, {from: accounts[0], value: web3.toWei("0.005")});
            const poolDetails = await icoPoolPartyContract.getPoolDetails();
            smartLog("Pool details [" + poolDetails + "]");
            const configDetails = await icoPoolPartyContract.getConfigDetails();
            smartLog("Config details [" + configDetails + "]");
        });

        it("should configure pool details", async () => {
            await icoPoolPartyContract.configurePool(customSaleContract.address, genericTokenContract.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"),true, {from: accounts[7]});
            assert.equal(await icoPoolPartyContract.buyFunctionName(), "buy()", "Wrong buyFunctionName");
            //await icoPoolPartyContract.addFundsToPool({from: investor3, value: web3.toWei("1")});
        });

        it("should complete configuration", async () => {
            await icoPoolPartyContract.completeConfiguration({from: accounts[7]});
            const poolState = await icoPoolPartyContract.poolStatus();
            assert.equal(poolState, Status.DueDiligence, "Pool in incorrect status");
        });

        /*it.skip("Should kick user", async () => {
            //Expect throw because of wrong state
            await expectThrow(icoPoolPartyContract.kickUser(investor3, "Kick user reason", {from: accounts[7]}));
            await sleep(3000);
            await icoPoolPartyContract.kickUser(investor3, "Kick user reason", {from: accounts[7]});
            smartLog("Account 3 eth after being kicked [" + web3.fromWei((await icoPoolPartyContract.investors(investor3))[0]) + "]");
            assert.equal((await icoPoolPartyContract.investors(investor3))[0], 0, "User account should be 0");
            smartLog("Total investment amount [" + web3.fromWei(await icoPoolPartyContract.totalPoolInvestments()) + "]");
            //assert.equal(await icoPoolPartyContract.totalPoolInvestments(), web3.toWei("11.03123123", "ether"), "Total investments should be 11 eth");
        });*/

        it("Should release funds to ICO", async () => {
            await sleep(3500);

            smartLog("Sale Contract Balance BEFORE [" + web3.fromWei(web3.eth.getBalance(customSaleContract.address)) + "]");
            smartLog("Pool Contract Balance BEFORE [" + web3.fromWei(web3.eth.getBalance(icoPoolPartyContract.address)) + "]");
            const poolState = await icoPoolPartyContract.poolStatus();
            smartLog("Pool State should be 3 [" + poolState + "]");
            smartLog("Total pool investments [" + web3.fromWei(await icoPoolPartyContract.totalPoolInvestments()) + "]");
            //smartLog("Hashed Buy FN Name [" + await icoPoolPartyContract.hashedBuyFunctionName() + "]");

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

            smartLog("Sale Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(customSaleContract.address)) + "]");
            smartLog("Pool Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(icoPoolPartyContract.address)) + "]");

            const tokensDue0 = (await icoPoolPartyContract.getContributionsDue(investor1))[2];
            smartLog("Account 0 has [" + tokensDue0 + "] tokens due");

        });

        it("Should claim tokens from ICO", async () => {
            smartLog("Tokens Received [" + await icoPoolPartyContract.totalTokensReceived() + "]");
            smartLog("Pool Party token balance [" + await genericTokenContract.balanceOf(icoPoolPartyContract.address) + "]");
        });

        it("Should get correct tokens due balance", async () => {
            const tokensDue0 = (await icoPoolPartyContract.getContributionsDue(investor1))[2];
            smartLog("Account 0 has [" + tokensDue0 + "] tokens due");
            assert.isAbove(tokensDue0, 0, "Account 0 should have more than 0 tokens");

            const tokensDue1 = (await icoPoolPartyContract.getContributionsDue(investor2))[2];
            smartLog("Account 1 has [" + tokensDue1 + "] tokens due");
            assert.isAbove(tokensDue0, 0, "Account 1 should have more than 0 tokens");
        });

        it("Should claim tokens", async () => {
            smartLog("Token Decimals [" + await genericTokenContract.decimals() + "]");
            smartLog("Total tokens received from sale [" + await icoPoolPartyContract.totalTokensReceived() + "]");
            smartLog("Account 0 eth investment [" + web3.fromWei((await icoPoolPartyContract.investors(investor1))[0]) + "]");

            await icoPoolPartyContract.claimTokens({from: investor1});
            smartLog("Account 0 token balance [" + await genericTokenContract.balanceOf(investor1) + "]");
            assert.isAbove(await genericTokenContract.balanceOf(investor1), 0, "Token balance must be greater than 0");

            await icoPoolPartyContract.claimTokens({from: investor2});
            smartLog("Account 1 token balance [" + await genericTokenContract.balanceOf(investor2) + "]");
            assert.isAbove(await genericTokenContract.balanceOf(investor2), 0, "Token balance must be greater than 0");

            smartLog("Pool Party token balance after everyone claims [" + await genericTokenContract.balanceOf(icoPoolPartyContract.address) + "]");

            smartLog("Account 0 has [" + (await icoPoolPartyContract.getContributionsDue(investor1))[2] + "] tokens due after claim");
            smartLog("Account 1 has [" + (await icoPoolPartyContract.getContributionsDue(investor2))[2] + "] tokens due after claim");

            smartLog("Account 0 Contribution percentage [" + (await icoPoolPartyContract.investors(investor1))[2] + "]");
            smartLog("Account 1 Contribution percentage [" + (await icoPoolPartyContract.investors(investor2))[2] + "]");

            smartLog("Balance remaining Snapshot [" + web3.fromWei(await icoPoolPartyContract.balanceRemainingSnapshot()) + "]");

            smartLog("Account 0 amount back [" + web3.fromWei((await icoPoolPartyContract.investors(investor1))[6]) + "]");
            smartLog("Account 1 amount back [" + web3.fromWei((await icoPoolPartyContract.investors(investor2))[6]) + "]");
        });

        it("should claim refund after successful sale", async () => {
            smartLog("Account 0 Contribution percentage [" + web3.fromWei((await icoPoolPartyContract.investors(investor1))[2]) + "]");
            smartLog("Account 0 Refund Amount [" + web3.fromWei((await icoPoolPartyContract.investors(investor1))[6]) + "]");
            smartLog("Account 0 Balance [" + web3.fromWei(web3.eth.getBalance(investor1)) + "]");

            await icoPoolPartyContract.claimRefund({from:investor1});

            smartLog("Account 0 Contribution percentage [" + web3.fromWei((await icoPoolPartyContract.investors(investor1))[2]) + "]");
            smartLog("Account 0 Refund Amount [" + web3.fromWei((await icoPoolPartyContract.investors(investor1))[6]) + "]");
            smartLog("Account 0 Balance [" + web3.fromWei(web3.eth.getBalance(investor1)) + "]");

            //Can't claim again
            await expectThrow(icoPoolPartyContract.claimRefund({from: investor1}));
            //smartLog("Account 1 Contribution percentage [" + (await icoPoolPartyContract.investors(investor2))[2] + "]");

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

    function power(a, b) {
        return a**b;
    }
});
