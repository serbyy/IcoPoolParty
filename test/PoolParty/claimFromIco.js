import expectThrow from './../helpers/expectThrow';

const poolPartyFactoryArtifact = artifacts.require('./IcoPoolPartyFactory');
const poolPartyArtifact = artifacts.require('./IcoPoolParty');
const genericTokenArtifact = artifacts.require('./test-contracts/GenericToken');
const customSaleArtifact = artifacts.require('./test-contracts/CustomSale');

const foregroundTokenSaleArtifact = artifacts.require('./ForegroundTokenSale');
const dealTokenArtifact = artifacts.require('./DealToken');

let foregroundTokenSale;
let dealToken;

const MIN_CONT_AMOUNT = web3.toWei("0.01");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DUE_DILIGENCE_DURATION = 3000;

let icoPoolPartyFactory;
let icoPoolParty;
let genericToken;
let customSale;

const Status = {
    Open: 0,
    WaterMarkReached: 1,
    DueDiligence: 2,
    InReview: 3,
    Claim: 4,
    Refunding: 5
};

contract('IcoPoolParty', (accounts) => {
    const [_deployer, _investor1, _investor2, _saleAddress, _investor3, _nonInvestor, _saleOwner, _investor4, _foregroundSaleAddresses] = accounts;

    beforeEach(async () => {
        genericToken = await genericTokenArtifact.new({from: _deployer});
        customSale = await customSaleArtifact.new(web3.toWei("0.05"), genericToken.address, {from: _deployer});
        await genericToken.transferOwnership(customSale.address, {from: _deployer});

        icoPoolPartyFactory = await poolPartyFactoryArtifact.new(_deployer, {from: _deployer});
        await icoPoolPartyFactory.setDueDiligenceDuration(DUE_DILIGENCE_DURATION / 1000);
        await icoPoolPartyFactory.setWaterMark(web3.toWei("1"));
        await icoPoolPartyFactory.createNewPoolParty("api.test.foreground.io", {from: _investor1});

        icoPoolParty = poolPartyArtifact.at(await icoPoolPartyFactory.partyList(0));
        await icoPoolParty.addFundsToPool({from: _investor4, value: web3.toWei("0.6")});
        await icoPoolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.4")});
        await icoPoolParty.setAuthorizedConfigurationAddressTest(_saleOwner, false, {
            from: _investor1,
            value: web3.toWei("0.005")
        });
    });

    describe('Function: claimTokensFromIco(): Generic Sale', () => {
        beforeEach(async () => {
            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buy()", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});
            await sleep(DUE_DILIGENCE_DURATION);
            const subsidy = await calculateSubsidy();
            const fee = await calculateFee();
            await icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(await icoPoolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
        });

        it('should claim tokens from ICO', async () => {
            let contractTokenReceived = await icoPoolParty.totalTokensReceived();
            assert.equal(contractTokenReceived, 0, "Tokens received should be 0");

            await icoPoolParty.claimTokensFromIco({from: _saleOwner});
            contractTokenReceived = await icoPoolParty.totalTokensReceived();
            assert.isAbove(contractTokenReceived, 0, "Should have received tokens");
            assert.equal(await icoPoolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
        });

        it('should attempt to claim tokens once tokens are already claimed', async () => {
            await icoPoolParty.claimTokensFromIco({from: _saleOwner});
            const contractTokenReceived = await icoPoolParty.totalTokensReceived();
            assert.isAbove(contractTokenReceived, 0, "Should have received tokens");
            assert.equal(await icoPoolParty.poolStatus(), Status.Claim, "Pool in incorrect status");

            await expectThrow(icoPoolParty.claimTokensFromIco({from: _saleOwner}));
            assert.equal(await icoPoolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
        });

        it('should attempt to claim tokens with an unauthorized account', async () => {
            await expectThrow(icoPoolParty.claimTokensFromIco({from: _investor4}));
            const contractTokenReceived = await icoPoolParty.totalTokensReceived();
            assert.equal(contractTokenReceived, 0, "Should have 0 tokens");
            assert.equal(await icoPoolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
        });
    });

    describe('Function: claimTokensFromIco(): Generic Sale (automatically call claimTokensFromIco)', () => {
        it('should claim tokens from ICO', async () => {
            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});
            await sleep(DUE_DILIGENCE_DURATION);
            const subsidy = await calculateSubsidy();
            const fee = await calculateFee();
            await icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(await icoPoolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
            let contractTokenReceived = await icoPoolParty.totalTokensReceived();
            assert.isAbove(contractTokenReceived, 0, "Should have received tokens");
        });
    });

    describe('Function: claimTokensFromIco(): Generic Sale', () => {
        beforeEach(async () => {
            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buyWithIntentToRefund()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});
            await sleep(DUE_DILIGENCE_DURATION);
        });

        it('should attempt to claim tokens from ICO but get none', async () => {
            const subsidy = await calculateSubsidy();
            const fee = await calculateFee();
            await icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(await icoPoolParty.poolStatus(), Status.InReview, "Pool in incorrect status");

            let contractTokenReceived = await icoPoolParty.totalTokensReceived();
            assert.equal(contractTokenReceived, 0, "Tokens received should be 0");

            await icoPoolParty.claimTokensFromIco({from: _saleOwner});
            contractTokenReceived = await icoPoolParty.totalTokensReceived();
            assert.equal(contractTokenReceived, 0, "Should have received 0 tokens");
            assert.equal(await icoPoolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
        });

        it('should attempt to claim tokens in incorrect state', async () => {
            await expectThrow(icoPoolParty.claimTokensFromIco({from: _saleOwner}));
            const contractTokenReceived = await icoPoolParty.totalTokensReceived();
            assert.equal(contractTokenReceived, 0, "Should have received 0 tokens");
            assert.notEqual(await icoPoolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
        });
    });

    describe('Function: claimTokensFromIco(): Foreground Sale', () => {
        const TOKEN_PRICE = web3.toWei("0.05");
        beforeEach(async () => {
            await icoPoolParty.addFundsToPool({from: _investor1, value: web3.toWei("1")});
            await icoPoolParty.addFundsToPool({from: _investor3, value: web3.toWei("2.2387946")});
            foregroundTokenSale = await foregroundTokenSaleArtifact.new(60, 1, TOKEN_PRICE, _deployer);
            const tokenSaleStartBlockNumber = web3.eth.blockNumber + 1;
            const tokenSaleEndBlockNumber = tokenSaleStartBlockNumber + 500;
            await foregroundTokenSale.configureSale(tokenSaleStartBlockNumber, tokenSaleEndBlockNumber, _foregroundSaleAddresses, 50, _foregroundSaleAddresses, _foregroundSaleAddresses, _foregroundSaleAddresses, _foregroundSaleAddresses, {from: _deployer});
            dealToken = dealTokenArtifact.at(await foregroundTokenSale.dealToken());

            await icoPoolParty.configurePool(foregroundTokenSale.address, dealToken.address, "N/A", "claimToken()", "claimRefund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});
            await sleep(DUE_DILIGENCE_DURATION);
            const subsidy = await calculateSubsidy();
            const fee = await calculateFee();
            await icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 400000, value: (subsidy + fee)});
            assert.equal(await icoPoolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
        });

        it('should claim tokens from ICO', async () => {
            await icoPoolParty.claimTokensFromIco({from: _saleOwner});
            const tokensAllocated = await dealToken.balanceOf(icoPoolParty.address);
            assert.isAbove(tokensAllocated, 0, "Should have received tokens");
        });

        it('should attempt to claim tokens once tokens are already claimed', async () => {
            await icoPoolParty.claimTokensFromIco({from: _saleOwner});
            const tokensAllocated = await dealToken.balanceOf(icoPoolParty.address);
            assert.isAbove(tokensAllocated, 0, "Should have received tokens");
            await expectThrow(icoPoolParty.claimTokensFromIco({from: _saleOwner}));
            assert.equal((await dealToken.balanceOf(icoPoolParty.address)).toNumber(), tokensAllocated.toNumber(), "Should have received tokens");

        });

        it('should attempt to claim tokens with an unauthorized account', async () => {
            await expectThrow(icoPoolParty.claimTokensFromIco({from: _investor3}));
            const tokensAllocated = await dealToken.balanceOf(icoPoolParty.address);
            assert.equal(tokensAllocated, 0, "Should have received tokens");
        });
    });

    describe('Function: claimRefundFromIco()', () => {
        beforeEach(async () => {
            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buyWithIntentToRefund()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});
        });

        it('should claim refund from failed sale', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            const subsidy = await calculateSubsidy();
            const fee = await calculateFee();

            await icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(web3.eth.getBalance(customSale.address), (parseInt(await icoPoolParty.totalPoolInvestments()) + parseInt(subsidy)), "Incorrect sale balance after transfer");
            assert.equal(await icoPoolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
            assert.equal(await icoPoolParty.totalTokensReceived(), 0, "Should have received tokens");
            smartLog("Pool Party Balance [" + web3.fromWei(web3.eth.getBalance(icoPoolParty.address)) + "], total investment balance [" + web3.fromWei(await icoPoolParty.totalPoolInvestments()) + "]");
            assert.isBelow((web3.eth.getBalance(icoPoolParty.address)).toNumber(), await icoPoolParty.totalPoolInvestments(), "Contract balance too high after release funds");
            await icoPoolParty.claimRefundFromIco({from: _saleOwner});
            assert.isAbove((web3.eth.getBalance(icoPoolParty.address)).toNumber(), await icoPoolParty.totalPoolInvestments(), "Refund not transferred");
            smartLog("Pool Party Balance [" + web3.fromWei(web3.eth.getBalance(icoPoolParty.address)) + "], total investment balance [" + web3.fromWei(await icoPoolParty.totalPoolInvestments()) + "], Balance remaining snapshot [" + web3.fromWei(await icoPoolParty.balanceRemainingSnapshot()) + "]");
        });

        it('should attempt to double claim refund from failed sale', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            const subsidy = await calculateSubsidy();
            const fee = await calculateFee();

            await icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(web3.eth.getBalance(customSale.address), (parseInt(await icoPoolParty.totalPoolInvestments()) + parseInt(subsidy)), "Incorrect sale balance after transfer");
            assert.equal(await icoPoolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
            assert.equal(await icoPoolParty.totalTokensReceived(), 0, "Should have received tokens");
            smartLog("Pool Party Balance [" + web3.fromWei(web3.eth.getBalance(icoPoolParty.address)) + "], total investment balance [" + web3.fromWei(await icoPoolParty.totalPoolInvestments()) + "]");
            assert.isBelow((web3.eth.getBalance(icoPoolParty.address)).toNumber(), await icoPoolParty.totalPoolInvestments(), "Contract balance too high after release funds");
            await icoPoolParty.claimRefundFromIco({from: _saleOwner});
            assert.isAbove((web3.eth.getBalance(icoPoolParty.address)).toNumber(), await icoPoolParty.totalPoolInvestments(), "Refund not transferred");
            smartLog("Pool Party Balance [" + web3.fromWei(web3.eth.getBalance(icoPoolParty.address)) + "], total investment balance [" + web3.fromWei(await icoPoolParty.totalPoolInvestments()) + "], Balance remaining snapshot [" + web3.fromWei(await icoPoolParty.balanceRemainingSnapshot()) + "]");
            await expectThrow(icoPoolParty.claimRefundFromIco({from: _saleOwner}));
        });
    });

    async function calculateSubsidy() {
        let _expectedGroupDiscountPercent = await icoPoolParty.expectedGroupDiscountPercent();
        smartLog("expectedGroupDiscountPercent [" + _expectedGroupDiscountPercent + "%]");
        let _actualGroupDiscountPercent = await icoPoolParty.actualGroupDiscountPercent();
        smartLog("actualGroupDiscountPercent [" + _actualGroupDiscountPercent + "%]");
        let _expectedGroupTokenPrice = await icoPoolParty.expectedGroupTokenPrice();
        smartLog("expectedGroupTokenPrice [" + web3.fromWei(_expectedGroupTokenPrice) + "]");
        let _totalPoolInvestments = await icoPoolParty.totalPoolInvestments();
        smartLog("totalPoolInvestments [" + web3.fromWei(_totalPoolInvestments) + "]");

        let _groupContPercent = 100 - _actualGroupDiscountPercent;
        let _amountToRelease = _totalPoolInvestments * 100 / _groupContPercent;

        smartLog("amountToRelease [" + web3.fromWei(_amountToRelease) + "]");

        return _amountToRelease - _totalPoolInvestments;
    }

    async function calculateFee() {
        const feePercent = await icoPoolParty.feePercentage();
        const totalPoolInvestment = await icoPoolParty.totalPoolInvestments();
        return totalPoolInvestment * feePercent / 100;
    }

    function sleep(_ms) {
        return new Promise(resolve => setTimeout(resolve, _ms));
    }

    function smartLog(message, override) {
        let verbose = false;
        if (verbose || override)
            console.log(message);
    }

});

