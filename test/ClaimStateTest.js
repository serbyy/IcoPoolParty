import expectThrow from './helpers/expectThrow';

let icoPoolPartyFactory = artifacts.require('./IcoPoolPartyFactory');
let icoPoolParty = artifacts.require('./IcoPoolParty');
let customSale = artifacts.require('./test-contracts/CustomSale');
let genericToken = artifacts.require('./test-contracts/GenericToken');

let icoPoolPartyFactoryContract;
let icoPoolPartyContract;
let customSaleContract;
let genericTokenContract;

const Status = {Open: 0, WaterMarkReached: 1, DueDiligence: 2, InReview: 3, Claim: 4, Refunding: 5};



contract('ICO Pool Party', function (accounts) {

    const [deployer, investor1, investor2, investor3, investor4, investor5, investor6, investor7] = accounts;

    var domainIndex = 0;
    beforeEach(async () => {
        icoPoolPartyFactoryContract = await icoPoolPartyFactory.deployed();
        smartLog("Pool Party Factory Address [" + await icoPoolPartyFactoryContract.address + "]");


        genericTokenContract = await genericToken.new({from: deployer});
        customSaleContract = await customSale.new(web3.toWei("0.05"), genericTokenContract.address, {from: deployer});
        await genericTokenContract.transferOwnership(customSaleContract.address, {from: deployer});

        //genericTokenContract = await genericToken.deployed();
        //customSaleContract = await CustomSale.deployed();

        //CREATE A NEW POOL
        smartLog("Creating new pool...", true);
        await icoPoolPartyFactoryContract.setDueDiligenceDuration(3);
        await icoPoolPartyFactoryContract.setWaterMark(web3.toWei("10"));
        await icoPoolPartyFactoryContract.createNewPoolParty("testDomain" + domainIndex + ".io", {from: deployer});
        const poolAddress = await icoPoolPartyFactoryContract.partyList(domainIndex);
        domainIndex++;        
        icoPoolPartyContract = icoPoolParty.at(poolAddress);
        
        //ADD FUNDS TO POOL (for each of the 5 participants)
        smartLog("Adding Funds to pool...", true);
        await icoPoolPartyContract.addFundsToPool({from: investor1, value: web3.toWei("4", "ether")});
        await icoPoolPartyContract.addFundsToPool({from: investor2, value: web3.toWei("3", "ether")});            
        await icoPoolPartyContract.addFundsToPool({from: investor3, value: web3.toWei("2", "ether")});            
        await icoPoolPartyContract.addFundsToPool({from: investor4, value: web3.toWei("1", "ether")});            
        await icoPoolPartyContract.addFundsToPool({from: investor5, value: web3.toWei("3", "ether")});            
        await icoPoolPartyContract.addFundsToPool({from: investor6, value: web3.toWei("2", "ether")});            
        await icoPoolPartyContract.addFundsToPool({from: investor7, value: web3.toWei("1", "ether")});  
        
        smartLog("Confirming investment amounts...", true);
        let totalInvested = await icoPoolPartyContract.totalPoolInvestments();
        assert.equal(totalInvested, web3.toWei("16", "ether"), "Incorrect total");
        
        let investmentAmount = (await icoPoolPartyContract.investors(investor1))[0];
        assert.equal(investmentAmount, web3.toWei("4", "ether"), "Incorrect balance");
        
        let investmentAmount2 = (await icoPoolPartyContract.investors(investor2))[0];
        assert.equal(investmentAmount2, web3.toWei("3", "ether"), "Incorrect balance");
        
        let investmentAmount3 = (await icoPoolPartyContract.investors(investor3))[0];
        assert.equal(investmentAmount3, web3.toWei("2", "ether"), "Incorrect balance");

        let investmentAmount7 = (await icoPoolPartyContract.investors(investor7))[0];
        assert.equal(investmentAmount7, web3.toWei("1", "ether"), "Incorrect balance");

        //Have investor 3 leave the pool
        smartLog("Having Investor 3 leave the pool...", true);
        await icoPoolPartyContract.leavePool({from: investor3});
        totalInvested = await icoPoolPartyContract.totalPoolInvestments();
        assert.equal(totalInvested, web3.toWei("14", "ether"), "Incorrect total");
        
        //Set the Authorized Configuration Address
        let poolState = await icoPoolPartyContract.poolStatus();
        await icoPoolPartyContract.setAuthorizedConfigurationAddressTest(accounts[7], false, {from: accounts[0], value: web3.toWei("0.005")});
        let poolDetails = await icoPoolPartyContract.getPoolDetails();
        smartLog("Pool details [" + poolDetails + "]");
        let configDetails = await icoPoolPartyContract.getConfigDetails();
        smartLog("Config details [" + configDetails + "]");
    });

    describe('Generic Sale - Claim Tests', function () {
        this.slow(5000);

        before(async () => {            
            smartLog("Starting tests...");
        });

        it("should check the pool's balance", async () => {
            smartLog("Checking pool balance...", true);
            let totalInvested = await icoPoolPartyContract.totalPoolInvestments();
            assert.equal(totalInvested, web3.toWei("14", "ether"), "Incorrect total");
        });


        async function ConfigurePoolDetails(){
            //Configure Pool Details
            await icoPoolPartyContract.configurePool(customSaleContract.address, genericTokenContract.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"),true, {from: accounts[7]});
            assert.equal(await icoPoolPartyContract.buyFunctionName(), "buy()", "Wrong buyFunctionName");
        }
        
        async function CompleteConfiguration() {
            //Complete Configuration
            await icoPoolPartyContract.completeConfiguration({from: accounts[7]});
            let poolState = await icoPoolPartyContract.poolStatus();
            assert.equal(poolState, Status.DueDiligence, "Pool in incorrect status");
        }

        async function ReleaseFundsToSale(){
            await sleep(3500);
            
            smartLog("Sale Contract Balance BEFORE [" + web3.fromWei(web3.eth.getBalance(customSaleContract.address)) + "]");
            smartLog("Pool Contract Balance BEFORE [" + web3.fromWei(web3.eth.getBalance(icoPoolPartyContract.address)) + "]");
            let theState = await icoPoolPartyContract.poolStatus();
            smartLog("Pool State should be 3 [" + theState + "]");
            smartLog("Total pool investments [" + web3.fromWei(await icoPoolPartyContract.totalPoolInvestments()) + "]");            

            let subsidy = await calculateSubsidy();
            smartLog("Subsidy is [" + web3.fromWei(subsidy) + "]");

            let feePercent = await icoPoolPartyContract.feePercentage();
            let total = await icoPoolPartyContract.totalPoolInvestments();
            let fee = total * feePercent / 100;
            smartLog("Fee [" + web3.fromWei(fee) + "]");

            await icoPoolPartyContract.releaseFundsToSale({
                from: accounts[7],
                value: subsidy + fee,
                gas: 300000
            });  

            smartLog("Sale Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(customSaleContract.address)) + "]");
            smartLog("Pool Contract Balance AFTER [" + web3.fromWei(web3.eth.getBalance(icoPoolPartyContract.address)) + "]");
        }



        it("should not be able to claim refund twice", async () => {            
            //Configure Pool Details
            await icoPoolPartyContract.configurePool(customSaleContract.address, genericTokenContract.address, "buyWithIntentToRefund()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"),true, {from: accounts[7]});
            assert.equal(await icoPoolPartyContract.buyFunctionName(), "buyWithIntentToRefund()", "Wrong buyFunctionName");

            await CompleteConfiguration();
            await ReleaseFundsToSale();

            smartLog("Getting snapshot...");

            //Get snapshot value
            let firstSnapshot = await icoPoolPartyContract.balanceRemainingSnapshot();
            smartLog("firstSnapshot: " + firstSnapshot);

            let accountBalanceBefore = await web3.eth.getBalance(investor1);
            let contributionBefore = web3.toWei("4", "ether");

            smartLog("accountBalanceBefore: " + accountBalanceBefore);
            smartLog("contributionBefore: " + contributionBefore);


            await icoPoolPartyContract.claimRefundFromIco({
                from: accounts[7],
                gas: 300000
            });

            smartLog("claimRefundFromIco() called...");

            //Have someone claim
            await icoPoolPartyContract.claimRefund({
                from: investor1,
                gas: 300000
            });

            smartLog("claimRefund() called...");

            //Investor who claimed tokens due? Ether due?
            await expectThrow(
                icoPoolPartyContract.claimRefund({
                    from: investor1,
                    gas: 300000
                })
            );
        });


        it("should not allow leaving pool while in claim state...", async () => {            
            
            await ConfigurePoolDetails();
            await CompleteConfiguration();
            await ReleaseFundsToSale();

            smartLog("leaving pool...");

            //Now in Claim state
            //Have investor1 try to leave the pool
            //Should only be able to claim tokens or refund
            await expectThrow(
                icoPoolPartyContract.leavePool({
                    from: investor1,
                    gas: 300000
                })
            );
            smartLog("leavePool() called...");
        });


        it("should be able to empty pool of tokens...", async () => {            
            
            await ConfigurePoolDetails();
            await CompleteConfiguration();
            await ReleaseFundsToSale();
            
            let startingBalance = await genericTokenContract.balanceOf(icoPoolPartyContract.address);
            
            smartLog("startingBalance: " + startingBalance);

            smartLog("claiming tokens...");
            await icoPoolPartyContract.claimTokens({
                    from: investor1,
                    gas: 300000
            });
            
            smartLog("claiming tokens 2...");
            await icoPoolPartyContract.claimTokens({
                from: investor2,
                gas: 300000
            });            

            smartLog("claiming tokens 4...");
            await icoPoolPartyContract.claimTokens({
                from: investor4,
                gas: 300000
            });

            smartLog("claiming tokens 5...");
            await icoPoolPartyContract.claimTokens({
                from: investor5,
                gas: 300000
            });

            smartLog("claiming tokens 6...");
            await icoPoolPartyContract.claimTokens({
                from: investor6,
                gas: 300000
            });

            smartLog("claiming tokens 7...");
            await icoPoolPartyContract.claimTokens({
                from: investor7,
                gas: 300000
            });

            smartLog("all tokens claimed...");

            let finalBalance = await genericTokenContract.balanceOf(icoPoolPartyContract.address);

            smartLog("finalBalance: " + finalBalance);

            //NOTE: this test only covers the balance being very, very close to correct -- not counting rounding wei values
            //for each of the pool participants (1/10th of 1%)
            assert.isAbove(startingBalance * .001,finalBalance, "tokens still remaining after withdrawal...");

        });


    });

    /***********************************************************/
    /*                    HELPER FUNCTIONS                     */

    /***********************************************************/

    function smartLog(message, override) {
        let verbose = true;
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
