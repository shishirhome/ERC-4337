const { ethers } = require('ethers');
const ethereumjs = require ('ethereumjs-util');
const { ecsign, toRpcSig } = require('ethereumjs-util');
const deployData =  require('./deployData.json');
const { arrayify, keccak256, defaultAbiCoder, hexConcat } = require('ethers/lib/utils');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:8545');
const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545", 1);
const salt = 0 ;
const testData =  require('./testData.json') ;

const entryPoint =  require('./EntryPoint.json');
const entryPointAddress =  entryPoint.address ;
const entryPointABI =  entryPoint.abi ;
const entryPointContract = new web3.eth.Contract(entryPointABI, entryPointAddress);

const wethAbi = require('./weth.json');
const WETH = testData.WETH ;
const wethContract = new web3.eth.Contract(wethAbi, WETH);

const simpleAccountABI =  require('./SimpleAccount.json');

const payMasterAddress =  deployData.verifyingPaymasterAddress ;
const payMasterAbi = require('./build/contracts/VerifyingPaymaster.json') ;
const payMasterContract = new web3.eth.Contract(payMasterAbi.abi, payMasterAddress);
const MOCK_VALID_UNTIL = '0x00000000deadbeef' ;
const MOCK_VALID_AFTER = '0x0000000000001234' ;

const simpleAccountFactory =  require('./SimpleAccountFactory.json');
const simpleAccountFactoryAddress =  simpleAccountFactory.address ;
const simpleAccountFactoryABI =  simpleAccountFactory.abi ;
const simpleAccountFactoryContract = new web3.eth.Contract(simpleAccountFactoryABI,simpleAccountFactoryAddress);

var walletOwner = '0x' ;

var coordinatorPublicKey = testData.coordinatorPublicKey ;
var alicePublicKey = bobPublicKey = '0x' ;
var alicePrivateKey = bobPrivateKey = '0x' ;

var callData = paymasterAndData = '0x' ;
const DAI = testData.DAI ;
const EXPAND_API_KEY = testData.EXPAND_API_KEY ;
const EXPAND_BASE_URL = testData.EXPAND_BASE_URL ;
const axios = require('axios');

const daiAbi = require('./weth.json');
const daiContract = new web3.eth.Contract(wethAbi, DAI);

async function getBalance(){

    console.log(`Alice ETH Balance ${web3.utils.fromWei(await web3.eth.getBalance(alicePublicKey))}`) ;
    console.log(`Alice sender wallet ${walletOwner} ETH Balance ${web3.utils.fromWei(await web3.eth.getBalance(walletOwner))}`) ;
    console.log(`Paymaster ETH Balance ${web3.utils.fromWei(await payMasterContract.methods.getDeposit().call())}`) ;

    console.log(`Alice WETH Balance ${web3.utils.fromWei(await wethContract.methods.balanceOf(alicePublicKey).call())}`) ;
    console.log(`Alice sender wallet ${walletOwner}  WETH Balance ${web3.utils.fromWei(await wethContract.methods.balanceOf(walletOwner).call())}`) ;
    
    console.log(`Bob WETH Balance ${web3.utils.fromWei(await wethContract.methods.balanceOf(bobPublicKey).call())}`) ;
    console.log(`Bob DAI Balance ${web3.utils.fromWei(await daiContract.methods.balanceOf(bobPublicKey).call())}`) ;

}

async function initAddresses() {

    coordinatorPublicKey = testData.coordinatorPublicKey ;
    coordinatorPrivateKey = testData.coordinatorPrivateKey ;

    alicePublicKey = testData.alicePublicKey ;
    alicePrivateKey = testData.alicePrivateKey ;

    bobPublicKey = testData.bobPublicKey ;
    bobPrivateKey = testData.bobPrivateKey ;

    walletOwner = await simpleAccountFactoryContract.methods.getAddress(alicePublicKey,salt).call()  ;

}

async function executeOnChainTransaction(ethervalue, callData , to, signPrivateKey){
    
    const value = web3.utils.toWei(ethervalue, 'ether');
    const rawTxn = {to , gas: 396296, maxFeePerGas: 44363475285, value, data: callData} ;
    const signedTx = await web3.eth.accounts.signTransaction(rawTxn, signPrivateKey);
    await web3.eth.sendSignedTransaction(signedTx.rawTransaction, function (error, hash) {
        if (!error) { console.log(`Transaction Success 🎉: ${hash} `) }
        else { console.log(`Transaction Fail ❗❗: ${error}`) }
    });

}

async function composeInitCode() {

    const walletCreateABI =  simpleAccountFactoryContract.methods.createAccount(alicePublicKey,salt).encodeABI();
    initCode =  hexConcat([simpleAccountFactoryAddress,walletCreateABI]) ;

}

async function composePaymasterAndData(ops){

    ops.paymasterAndData = hexConcat([payMasterAddress, defaultAbiCoder.encode(['uint48', 'uint48'], [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]), '0x' + '00'.repeat(65)])
    ops.signature = '0x' ;
    const hash = await payMasterContract.methods.getHash(ops, MOCK_VALID_UNTIL, MOCK_VALID_AFTER).call() ;
    const signer = new ethers.Wallet(coordinatorPrivateKey, provider);
    const sign = await signer.signMessage(arrayify(hash));
    const paymasterAndData = hexConcat([payMasterAddress, defaultAbiCoder.encode(['uint48', 'uint48'], [MOCK_VALID_UNTIL,MOCK_VALID_AFTER]), sign])
    return paymasterAndData ;

}

async function fundContractsAndAddresses(){

    walletOwner = await simpleAccountFactoryContract.methods.getAddress(alicePublicKey,salt).call()  ;

    // Transfer 10 ETH to Alice from coordinator
    await executeOnChainTransaction('1000','0x', alicePublicKey, coordinatorPrivateKey) ;

    // Convert 0.5 ETH to WETH for Alice
    let rawData = wethContract.methods.deposit().encodeABI();
    await executeOnChainTransaction('0.5',rawData, WETH, alicePrivateKey) ;

    // Transfer 2 ETH to aliceSenderWallet
    await executeOnChainTransaction('2','0x', walletOwner, alicePrivateKey) ;

    // Transfer 0.25 WETH from alice address to aliceSenderWallet
    let wethValue = web3.utils.toWei('0.25', 'ether');
    rawData = wethContract.methods.transfer(walletOwner,wethValue).encodeABI();
    await executeOnChainTransaction('0',rawData,WETH,alicePrivateKey) ;

    // Transfer 2 ETH to paymaster
    rawData = await entryPointContract.methods.depositTo(payMasterAddress).encodeABI();
    await executeOnChainTransaction('2', rawData, entryPointAddress, alicePrivateKey) ;

}

async function composeWETHTransferCallData(){

    wethValue = web3.utils.toWei('0.01', 'ether');
    callData = wethContract.methods.transfer(bobPublicKey,wethValue).encodeABI();
    
}

async function executeHandleOps(initCode, callData, viaPaymaster) {

    let paymasterAndData = '0x'
    walletOwner = await simpleAccountFactoryContract.methods.getAddress(alicePublicKey,salt).call()  ;
    const nonce = await entryPointContract.methods.getNonce(walletOwner,0).call();

    const walletContract = new web3.eth.Contract(simpleAccountABI.abi,walletOwner);
    if (callData != '0x')
        callData = await walletContract.methods.execute(WETH, 0, callData).encodeABI() ;
    
    var ops = {
        sender: walletOwner , 
        nonce,
        initCode,
        callData,           
        callGasLimit: 260611,
        gasLimit: 362451,
        verificationGasLimit: 362451,
        preVerificationGas: 53576,
        maxFeePerGas: 29964445250,
        maxPriorityFeePerGas: 100000000,
        paymasterAndData
    };

    if (viaPaymaster)
        ops.paymasterAndData = await composePaymasterAndData(ops) ;

    const packUserOp = defaultAbiCoder.encode(
        ['address', 'uint256', 'bytes32', 'bytes32','uint256', 'uint256', 'uint256', 'uint256', 'uint256','bytes32'],
        [ops.sender, ops.nonce, keccak256(ops.initCode), keccak256(ops.callData),
            ops.callGasLimit, ops.verificationGasLimit, ops.preVerificationGas, ops.maxFeePerGas, ops.maxPriorityFeePerGas,
            keccak256(ops.paymasterAndData)])
    const userOpHash = keccak256(packUserOp) ;
    const enc = defaultAbiCoder.encode(['bytes32', 'address', 'uint256'],[userOpHash, entryPointAddress, 1]) ;
    const encKecak = keccak256(enc) ;
    const message = arrayify(encKecak) ;
    const msg1 = Buffer.concat([Buffer.from('\x19Ethereum Signed Message:\n32', 'ascii'),Buffer.from(message)]) ;
    const sig = ecsign(ethereumjs.keccak256(msg1), Buffer.from(arrayify(alicePrivateKey))) ;
    ops.signature = toRpcSig(sig.v, sig.r, sig.s) ;

    const handleOpsRawData = entryPointContract.methods.handleOps([ops],coordinatorPublicKey).encodeABI();
    const handleOpsops = {
        to: entryPointAddress,
        maxFeePerGas: 210000000000,
        gasLimit: 1e7,
        data: handleOpsRawData
    }
    const signedTx = await web3.eth.accounts.signTransaction(handleOpsops, coordinatorPrivateKey);
    await web3.eth.sendSignedTransaction(signedTx.rawTransaction, function (error, hash) {
        if (!error) { console.log("Handleops Success --> ", hash); }
        else { console.log("Handleops Error --> ", error) }
    });
}

async function composeV3SwapCallData(){
    const config = {
        dexId: '1300',
        amountIn: web3.utils.toWei('0.04','ether'),
        amountOutMin: '0',
        path: [ WETH, DAI ],
        to: bobPublicKey,
        deadline: Date.now() + 60*60*20,
        from: alicePublicKey,
        gas: '229880'
    };

    const axiosInstance = new axios.create({
        baseURL: EXPAND_BASE_URL,
        timeout: 5000,
        headers: {'X-API-KEY': EXPAND_API_KEY},
      });
    
    const response = await axiosInstance.post('/dex/swap/', config);
    callData = response.data.data.data ;

}

async function init() {

    await initAddresses() ;

    // await executeOnChainTransaction('100','0x', alicePublicKey, coordinatorPrivateKey) ;
    // await executeOnChainTransaction('0.2','0x', coordinatorPublicKey, alicePrivateKey) ;
    
    await composeInitCode();

    // await fundContractsAndAddresses() ;
    
    // await composeWETHTransferCallData();

    // await composeV3SwapCallData();

    // await executeHandleOps(initCode,'0x', false) ;

    // await getBalance() ;

    // await executeHandleOps(initCode,'0x', true) ;
    
    await executeHandleOps('0x',callData, false) ;

    // await composeWETHTransferCallData();
    
    // await getBalance() ;

    // await executeHandleOps('0x',callData, true) ;

    await getBalance() ;

}

init () ;