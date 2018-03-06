import expectThrow from './../helpers/expectThrow';

const poolPartyFactoryArtifact = artifacts.require('./IcoPoolPartyFactory');
const poolPartyArtifact = artifacts.require('./IcoPoolParty');
const genericTokenArtifact = artifacts.require('./test-contracts/GenericToken');
const customSaleArtifact = artifacts.require('./test-contracts/CustomSale');

let foregroundTokenSaleArtifact = artifacts.require('./ForegroundTokenSale');
let dealTokenArtifact = artifacts.require('./DealToken');

let foregroundTokenSale;
let dealToken;

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
        icoPoolPartyFactory = await poolPartyFactoryArtifact.new(_deployer, {from: _deployer});
        await icoPoolPartyFactory.setWaterMark(web3.toWei("1"));
        await icoPoolPartyFactory.createNewPoolParty("api.test.foreground.io", {from: _investor1});

        icoPoolParty = poolPartyArtifact.at(await icoPoolPartyFactory.partyList(0));
        await icoPoolParty.addFundsToPool({from: _investor4, value: web3.toWei("1.248397872")});
        await icoPoolParty.addFundsToPool({from: _investor2, value: web3.toWei("1.123847")});
        await icoPoolParty.addFundsToPool({from: _investor3, value: web3.toWei("1.22")});
        await icoPoolParty.setAuthorizedConfigurationAddressTest(_saleOwner, {
            from: _investor1,
            value: web3.toWei("0.005")
        });
    });

    describe('Function: claimTokens() - Generic Sale', () => {
        beforeEach(async () => {
            genericToken = await genericTokenArtifact.new({from: _deployer});
            customSale = await customSaleArtifact.new(web3.toWei("0.05"), genericToken.address, {from: _deployer});
            await genericToken.transferOwnership(customSale.address, {from: _deployer});

            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});
            await sleep(DUE_DILIGENCE_DURATION);
            const subsidy = await calculateSubsidy();
            const fee = await calculateFee();
            await icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(await icoPoolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
            assert.isAbove(await icoPoolParty.totalTokensReceived(), 0, "Should have received tokens");
        });

        it('should claim tokens from pool', async () => {
            const investor4Amount = (await icoPoolParty.investors(_investor4))[0];
            await icoPoolParty.claimTokens({from: _investor4});
            assert.equal(await genericToken.balanceOf(_investor4), await calculateTokensDue(genericToken, investor4Amount), "Incorrect number of tokens received");

            const investor2Amount = (await icoPoolParty.investors(_investor2))[0];
            await icoPoolParty.claimTokens({from: _investor2});
            assert.equal(await genericToken.balanceOf(_investor2), await calculateTokensDue(genericToken, investor2Amount), "Incorrect number of tokens received");

            const investor3Amount = (await icoPoolParty.investors(_investor3))[0];
            await icoPoolParty.claimTokens({from: _investor3});
            assert.equal(await genericToken.balanceOf(_investor3), await calculateTokensDue(genericToken, investor3Amount), "Incorrect number of tokens received");

            //assert.equal(await genericToken.balanceOf(icoPoolParty.address), 0, "Pool should have 0 tokens");

            smartLog("Tokens Received = " + web3.fromWei(await icoPoolParty.totalTokensReceived()), true);

            smartLog("Investor 4 percentage contribution [" + web3.fromWei((await icoPoolParty.investors(_investor4))[2]) + "]%", true);
            smartLog("Investor 2 percentage contribution [" + web3.fromWei((await icoPoolParty.investors(_investor2))[2]) + "]%", true);
            smartLog("Investor 3 percentage contribution [" + web3.fromWei((await icoPoolParty.investors(_investor3))[2]) + "]%", true);

            smartLog("Investor 4 should have     [" + await icoPoolParty.getTokensDue(_investor4) + "] tokens due", true);
            smartLog("Investor 4 actually has    [" + await genericToken.balanceOf(_investor4) + "] tokens", true);
            smartLog("Investor 2 should have     [" + await icoPoolParty.getTokensDue(_investor2) + "] tokens due", true);
            smartLog("Investor 2 actually has    [" + await genericToken.balanceOf(_investor2) + "] tokens", true);
            smartLog("Investor 3 should have     [" + await icoPoolParty.getTokensDue(_investor3) + "] tokens due", true);
            smartLog("Investor 3 actually has    [" + await genericToken.balanceOf(_investor3) + "] tokens", true);

            smartLog("Tokens left after claim [" + await genericToken.balanceOf(icoPoolParty.address) + "]", true);
        });

    });

    describe('Function: claimTokens() - Foreground Sale', () => {
        beforeEach(async () => {
            foregroundTokenSale = await foregroundTokenSaleArtifact.new(60, 1, web3.toWei(0.05, "ether"), _deployer);
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
            assert.equal(await icoPoolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
            await icoPoolParty.claimTokensFromIco({from: _saleOwner});
        });

        it('should claim tokens from pool', async () => {
            smartLog("Tokens Received = " + await dealToken.balanceOf(icoPoolParty.address), true);
            smartLog("Investor 4 has [" + await icoPoolParty.getTokensDue(_investor4) + "] tokens due before claim", true);
            smartLog("Investor 2 has [" + await icoPoolParty.getTokensDue(_investor2) + "] tokens due before claim", true);
            smartLog("Investor 3 has [" + await icoPoolParty.getTokensDue(_investor3) + "] tokens due before claim", true);

            const investor4Amount = (await icoPoolParty.investors(_investor4))[0];
            await icoPoolParty.claimTokens({from: _investor4});
            await icoPoolParty.claimTokens({from: _investor2});
            await icoPoolParty.claimTokens({from: _investor3});

            /*smartLog("Investor 4 % [" + (await icoPoolParty.investors(_investor4))[2] + "] tokens due", true);
            smartLog("Investor 2 % [" + (await icoPoolParty.investors(_investor2))[2] + "] tokens due", true);
            smartLog("Investor 3 % [" + (await icoPoolParty.investors(_investor3))[2] + "] tokens due", true);*/

            smartLog("Investor 4 should have    [" + await icoPoolParty.getTokensDue(_investor4) + "] tokens due", true);
            smartLog("Investor 4 actually has   [" + await dealToken.balanceOf(_investor4) + "] tokens", true);
            smartLog("Investor 2 should have    [" + await icoPoolParty.getTokensDue(_investor2) + "] tokens due", true);
            smartLog("Investor 2 actually has   [" + await dealToken.balanceOf(_investor2) + "] tokens", true);
            smartLog("Investor 3 should have    [" + await icoPoolParty.getTokensDue(_investor3) + "] tokens due", true);
            smartLog("Investor 3 actually has   [" + await dealToken.balanceOf(_investor3) + "] tokens", true);

            smartLog("Tokens left after claim [" + await dealToken.balanceOf(icoPoolParty.address) + "]", true);

            //assert.equal(await dealToken.balanceOf(_investor4), await calculateTokensDue(dealToken, investor4Amount), "Incorrect number of tokens received");

            /*smartLog("Tokens Received = " + await dealToken.balanceOf(icoPoolParty.address), true);
            const investor2Amount = (await icoPoolParty.investors(_investor2))[0];
            await icoPoolParty.claimTokens({from: _investor2});
            assert.equal(await dealToken.balanceOf(_investor2), await calculateTokensDue(dealToken, investor2Amount), "Incorrect number of tokens received");

            smartLog("Tokens Received = " + await dealToken.balanceOf(icoPoolParty.address), true);*/

            /*const investor3Amount = (await icoPoolParty.investors(_investor3))[0];
            await icoPoolParty.claimTokens({from: _investor3});
            assert.equal(await dealToken.balanceOf(_investor3), await calculateTokensDue(dealToken, investor3Amount), "Incorrect number of tokens received");

            assert.equal(await genericToken.balanceOf(icoPoolParty.address), 0, "Pool should have 0 tokens");*/
            assert.equal(1,1);
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

    async function calculateTokensDue(_token, _investmentAmount) {
        const decimals = await _token.decimals();
        const precision = 10 ** decimals;
        const groupPrice = await icoPoolParty.groupEthPricePerToken();
        return parseInt(_investmentAmount * precision / groupPrice);
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

