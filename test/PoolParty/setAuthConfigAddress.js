import expectThrow from './../helpers/expectThrow';

const poolPartyFactoryArtifact = artifacts.require('./IcoPoolPartyFactory');
const poolPartyArtifact = artifacts.require('./IcoPoolParty');

let icoPoolPartyFactory;
let icoPoolParty;

const Status = {
    Open: 0,
    WaterMarkReached: 1,
    DueDiligence: 2,
    InReview: 3,
    Claim: 4,
    Refunding: 5
};

contract('IcoPoolParty', (accounts) => {
    const [_deployer, _investor1, _saleOwner] = accounts;

    beforeEach(async () => {
        icoPoolPartyFactory = await poolPartyFactoryArtifact.new(_deployer, {from: _deployer});
        await icoPoolPartyFactory.setDueDiligenceDuration(3);
        await icoPoolPartyFactory.setWaterMark(web3.toWei("1"));
        await icoPoolPartyFactory.createNewPoolParty("api.test.foreground.io", {from: _investor1});
        icoPoolParty = poolPartyArtifact.at(await icoPoolPartyFactory.partyList(0));
        await icoPoolParty.addFundsToPool({from: _investor1, value: web3.toWei("1")});

        assert.equal(await icoPoolParty.poolStatus(), Status.WaterMarkReached, "Pool in incorrect status");
    });

    afterEach(async () => {
        await icoPoolParty.leavePool({from: _investor1});
    });

    describe('Function: setAuthorizedConfigurationAddressTest() - BYPASS ORACLIZE', () => {
        it('should set authorized configuration address', async () => {
            await icoPoolParty.setAuthorizedConfigurationAddressTest(_saleOwner, false, {
                from: _investor1,
                value: web3.toWei("0.005")
            });
            assert.equal(await icoPoolParty.authorizedConfigurationAddress(), _saleOwner, "Incorrect Sale Owner Configured");
        });
    });

    describe('Function: setAuthorizedConfigurationAddress()', () => {
        it.skip('should set authorized configuration address using oraclize', async () => {
            await icoPoolParty.setAuthorizedConfigurationAddress(false, {from: _investor1, value: web3.toWei("0.005")});
            await sleep(15000); //Wait for callback to be called
            assert.equal(await icoPoolParty.authorizedConfigurationAddress(), 0x2E05A304d3040f1399c8C20D2a9F659AE7521058, "Incorrect Sale Owner Configured");
        });

        it('should attempt to set authorized configuration address with insufficient Oraclize fee', async () => {
            await expectThrow(icoPoolParty.setAuthorizedConfigurationAddress(false, {
                from: _investor1,
                value: web3.toWei("0.001")
            }));
            assert.notEqual(await icoPoolParty.authorizedConfigurationAddress(), 0x2E05A304d3040f1399c8C20D2a9F659AE7521058, "Incorrect Sale Owner Configured");
        });

        it('should attempt to set authorized configuration address in wrong state', async () => {
            await icoPoolParty.leavePool({from: _investor1});
            await icoPoolParty.addFundsToPool({from: _investor1, value: web3.toWei("0.1")});
            assert.notEqual(await icoPoolParty.poolStatus(), Status.WaterMarkReached, "Pool in incorrect status");

            await expectThrow(icoPoolParty.setAuthorizedConfigurationAddress(false, {
                from: _investor1,
                value: web3.toWei("0.005")
            }));
            assert.notEqual(await icoPoolParty.authorizedConfigurationAddress(), _saleOwner, "Incorrect Sale Owner Configured");
        });

        it('should attempt to set authorized configuration address with incorrect Oraclize fee', async () => {
            await expectThrow(icoPoolParty.setAuthorizedConfigurationAddress(false, {
                from: _investor1,
                value: web3.toWei("0.004")
            }));
            assert.notEqual(await icoPoolParty.authorizedConfigurationAddress(), _saleOwner, "Incorrect Sale Owner Configured");
        });

    });

    function sleep(_ms) {
        return new Promise(resolve => setTimeout(resolve, _ms));
    }
});

