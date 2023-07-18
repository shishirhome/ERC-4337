const testData =  require('../testData.json');
const entryPoint =  require('../EntryPoint.json');
var C2 = artifacts.require ("./samples/VerifyingPaymaster.sol");
var C3 = artifacts.require ("./samples/DepositPaymaster.sol");
const fs = require('fs');
module.exports = function(deployer) {
      deployer.then(async () => {

            await deployer.deploy(C2,entryPoint.address,testData.coordinatorPublicKey);
            await deployer.deploy(C3,entryPoint.address);
            
            var json = JSON.stringify({
            verifyingPaymasterAddress: C2.address,
            depositPaymasterAddress: C3.address });

            fs.writeFileSync('deployData.json', json);
            console.log(`Deployment Done !!`)
        });
}