/* global artifacts */

const oraclize = artifacts.require('./OracalizeTest');
let oraclizeContract;

contract('Oraclize Test', function (accounts) {

    describe.skip('Contribute to new pool', function () {
        this.slow(5000);

        before(async () => {
            oraclizeContract = await oraclize.deployed();
            smartLog("Contract Address [" + await oraclizeContract.address + "]");
        });

        it("should get pool config from Oraclize", async () => {
            smartLog("Start balance for Account0 [" + web3.fromWei(web3.eth.getBalance(accounts[3])) + "]", true);
            await oraclizeContract.update({from:accounts[3], value:web3.toWei("0.5", "ether")});

            let loopCounter = 0;
            while (loopCounter < 10) {
                loopCounter++;
                smartLog("Timer [" + loopCounter + "]", true);
                await sleep(1000);
            }

            const authorizedConfigurationAddress = await oraclizeContract.authorizedConfigurationAddress();
            smartLog("Sale Owner address is [" + authorizedConfigurationAddress + "]", true);
            smartLog("Sale Owner address proof is [" + await oraclizeContract.oraclizeProof() + "]", true);

            smartLog("Start balance for Account0 [" + web3.fromWei(web3.eth.getBalance(accounts[3])) + "]", true);
        });

    });

    function smartLog(message, override) {
        let verbose = false;
        if (verbose || override)
            console.log(message);
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
});
