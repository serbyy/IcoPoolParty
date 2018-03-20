import expectThrow from './../helpers/expectThrow';

const poolPartyFactoryArtifact = artifacts.require('./IcoPoolPartyFactory');
const poolPartyArtifact = artifacts.require('./IcoPoolParty');
const genericTokenArtifact = artifacts.require('./test-contracts/GenericToken');
const customSaleArtifact = artifacts.require('./test-contracts/CustomSale');

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
    const [_deployer, _investor1, _investor2, _saleAddress, _investor3, _nonInvestor, _saleOwner, _investor4, _tokenAddress] = accounts;

    beforeEach(async () => {
        genericToken = await genericTokenArtifact.new({from: _deployer});
        customSale = await customSaleArtifact.new(web3.toWei("0.05"), genericToken.address, {from: _deployer});
        await genericToken.transferOwnership(customSale.address, {from: _deployer});

        icoPoolPartyFactory = await poolPartyFactoryArtifact.new(_deployer, {from: _deployer});
        await icoPoolPartyFactory.setDueDiligenceDuration(DUE_DILIGENCE_DURATION/1000);
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

    describe('Function: releaseFundsToSale() - Generic Sale: Subsidized with buy and claim function. ', () => {
        beforeEach(async () => {
            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buy()", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});
        });

        it('should release funds to subsidized sale', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            const ownerSnapshotBalance = web3.eth.getBalance(_deployer);
            const subsidy = await calculateSubsidy();
            const fee = await calculateFee();

            await icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(web3.eth.getBalance(customSale.address), (parseInt(await icoPoolParty.totalPoolInvestments()) + parseInt(subsidy)), "Incorrect sale balance after transfer");
            assert.equal(await icoPoolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
            assert.equal(web3.eth.getBalance(_deployer), parseInt(ownerSnapshotBalance) + parseInt(fee), "Correct fee not transferred");
        });

        it('should attempt to release funds using unauthorized account', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            const subsidy = await calculateSubsidy();
            const fee = await calculateFee();

            await expectThrow(icoPoolParty.releaseFundsToSale({from: _investor3, gas: 300000, value: (subsidy + fee)}));
            assert.equal(web3.eth.getBalance(customSale.address), 0, "Sale balance should be 0");
            assert.equal(await icoPoolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
        });

        it('should attempt to release funds before due diligence has passed', async () => {
            const subsidy = await calculateSubsidy();
            const fee = await calculateFee();

            await expectThrow(icoPoolParty.releaseFundsToSale({from: _investor3, gas: 300000, value: (subsidy + fee)}));
            assert.equal(web3.eth.getBalance(customSale.address), 0, "Sale balance should be 0");
            assert.equal(await icoPoolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
        });

        it('should attempt to release funds without sending any ether', async () => {
            await sleep(DUE_DILIGENCE_DURATION);

            await expectThrow(icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 300000}));
            assert.equal(web3.eth.getBalance(customSale.address), 0, "Sale balance should be 0");
            assert.equal(await icoPoolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
        });

        it('should attempt to release funds only sending subsidy', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            const subsidy = await calculateSubsidy();

            await expectThrow(icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: subsidy}));
            assert.equal(web3.eth.getBalance(customSale.address), 0, "Sale balance should be 0");
            assert.equal(await icoPoolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
        });

        it('should attempt to release funds only sending fee', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            const fee = await calculateFee();

            await expectThrow(icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: fee}));
            assert.equal(web3.eth.getBalance(customSale.address), 0, "Sale balance should be 0");
            assert.equal(await icoPoolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
        });

        it('should attempt to leave pool when funds already released', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            const subsidy = await calculateSubsidy();
            const fee = await calculateFee();
            await icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (fee + subsidy)});

            await expectThrow(icoPoolParty.leavePool({from: _investor4}));
            assert.notEqual(await icoPoolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
        });

    });

    describe('Function: releaseFundsToSale() - Generic Sale: Subsidized with automatic claim. ', () => {
        beforeEach(async () => {
            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});
        });

        it('should release funds to subsidized sale', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            const ownerSnapshotBalance = web3.eth.getBalance(_deployer);
            const subsidy = await calculateSubsidy();
            const fee = await calculateFee();

            await icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(web3.eth.getBalance(customSale.address), (parseInt(await icoPoolParty.totalPoolInvestments()) + parseInt(subsidy)), "Incorrect sale balance after transfer");
            assert.equal(await icoPoolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
            assert.isAbove(await icoPoolParty.totalTokensReceived(), 0, "Should have received tokens");
            assert.equal(web3.eth.getBalance(_deployer), parseInt(ownerSnapshotBalance) + parseInt(fee), "Correct fee not transferred");
        });

        it('should attempt to release funds in review state when the total pool size is 0', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            await icoPoolParty.leavePool({from: _investor4});
            assert.equal(await icoPoolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
            await icoPoolParty.leavePool({from: _investor2});
            assert.equal(await icoPoolParty.totalPoolInvestments(), 0, "Pool should have nothing in it");

            const subsidy = await calculateSubsidy();
            assert.equal(subsidy, 0, "Subsidy should be 0");
            const fee = await calculateFee();
            assert.equal(fee, 0, "Fee should be 0");

            await icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (fee + subsidy)});
            assert.equal(web3.eth.getBalance(customSale.address), 0, "Sale balance should be 0");
            assert.notEqual(await icoPoolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
        });
    });

    describe('Function: releaseFundsToSale() - Generic Sale: Non Subsidized with buy and claim function.', () => {
        beforeEach(async () => {
            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buy()", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), false, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});
        });

        it('should release funds to non-subsidized sale', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            const fee = await calculateFee();

            await icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: fee});
            assert.equal(web3.eth.getBalance(customSale.address).toNumber(), (await icoPoolParty.totalPoolInvestments()).toNumber(), "Incorrect sale balance after transfer");
        });

        it('should attempt to release funds to non-subsidized sale with incorrect fee', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            const fee = await calculateFee();

            await expectThrow(icoPoolParty.releaseFundsToSale({
                from: _saleOwner,
                gas: 300000,
                value: parseInt(fee) - parseInt(web3.toWei("0.001"))
            }));
            assert.equal(web3.eth.getBalance(customSale.address).toNumber(), 0, "Incorrect sale balance after transfer");
        });

    });

    describe('Function: releaseFundsToSale() - Generic Sale: Subsidized Automatic Token Allocation', () => {
        beforeEach(async () => {
            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buy()", "N/A", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});
        });

        it('should release funds to subsidized sale and get tokens', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            const subsidy = await calculateSubsidy();
            const fee = await calculateFee();

            await icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(await icoPoolParty.poolStatus(), Status.Claim, "Pool in incorrect status");
            assert.isAbove(await icoPoolParty.totalTokensReceived(), 0, "Should have received tokens");
        });
    });

    describe('Function: releaseFundsToSale() - Generic Sale: 0% fee. ', () => {
        beforeEach(async () => {
            await icoPoolPartyFactory.setFeePercentage(0);
            await icoPoolPartyFactory.createNewPoolParty("zero.fee.test", {from: _investor1});

            icoPoolParty = poolPartyArtifact.at(await icoPoolPartyFactory.partyList(1));
            await icoPoolParty.addFundsToPool({from: _investor4, value: web3.toWei("0.6")});
            await icoPoolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.4")});
            await icoPoolParty.setAuthorizedConfigurationAddressTest(_saleOwner, false, {
                from: _investor1,
                value: web3.toWei("0.005")
            });

            await icoPoolParty.configurePool(customSale.address, genericToken.address, "buy()", "claim()", "refund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});
        });

        it('should release funds to sale with 0% fee', async () => {
            await sleep(DUE_DILIGENCE_DURATION);
            const ownerSnapshotBalance = web3.eth.getBalance(_deployer);
            const subsidy = await calculateSubsidy();
            const fee = await calculateFee();
            assert.equal(fee, 0, "Fee should be 0%");

            await icoPoolParty.releaseFundsToSale({from: _saleOwner, gas: 300000, value: (subsidy + fee)});
            assert.equal(web3.eth.getBalance(customSale.address), (parseInt(await icoPoolParty.totalPoolInvestments()) + parseInt(subsidy)), "Incorrect sale balance after transfer");
            assert.equal(await icoPoolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
            assert.equal(web3.eth.getBalance(_deployer), parseInt(ownerSnapshotBalance), "There should be no fee");
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

