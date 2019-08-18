import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import * as IPFS from 'ipfs';
import { WEB3 } from '../web3';
import Web3 from 'web3';
import bnc from 'bnc-assist';
import * as bs58 from 'bs58';

@Component({
  selector: 'app-create',
  templateUrl: './create.component.html',
  styleUrls: ['./create.component.css']
})
export class CreateComponent implements OnInit, OnDestroy {

  beneficiaryName: String;
  beneficiaryDescription: String;
  beneficiaryEthereumAccount: String;
  accountProof: String;
  tokenSymbol: String;
  logoLink: String;

  ipfsNode: any;

  apiKey: String;
  assistInstance: any;
  state: any;
  FACTORY_ADDRESS: String;

  constructor(@Inject(WEB3) private web3: Web3) {
    this.beneficiaryName = "";
    this.beneficiaryDescription = "";
    this.beneficiaryEthereumAccount = "";
    this.accountProof = "";
    this.tokenSymbol = "";
    this.logoLink = "";

    this.apiKey = "239ccd50-62da-4e2f-aaf4-b33d39a3a0a6";
    this.FACTORY_ADDRESS = "0x64bF69F73F450EF644bC1C8E0F7B3960EeBc5bF8";
  }

  ngOnInit() {
    this.initIPFS();

    const bytes = IPFS.Buffer.from('12207a64558c21f292bb5fb50b48f52d5bea0f9931ec6739a10342d785ddb4e1ef5c', 'hex')
    const address = bs58.encode(bytes)
    console.log(address)
  }

  ngOnDestroy() {
    this.ipfsNode.stop();
  }

  async initIPFS() {
    this.ipfsNode = await IPFS.create({ silent: true });
  }

  async submitMetadataToIPFS() {
    const meta = {
      description: this.beneficiaryDescription,
      ownershipProof: this.accountProof,
      logoUrl: this.logoLink
    }
    const buf = IPFS.Buffer.from(JSON.stringify(meta));
    const results = await this.ipfsNode.add(buf);
    const hash = results[0].hash;
    return hash;
  }

  async createPool() {
    if ('enable' in this.web3.currentProvider) {
      await this.web3.currentProvider.enable();
    }

    var bncAssistConfig = {
      dappId: this.apiKey,
      networkId: 1,
      web3: this.web3
    };
    this.assistInstance = bnc.init(bncAssistConfig);

    let self = this;
    this.assistInstance
      .onboard()
      .then(async function (state) {
        // User has been successfully onboarded and is ready to transact
        console.log(state);
        self.state = state;

        // initialize contract instance
        const abi = require('../../assets/abi/MetadataPooledCDAIFactory.json');
        const factory = self.assistInstance.Contract(new self.web3.eth.Contract(abi, self.FACTORY_ADDRESS));

        // submit metadata to IPFS
        let ipfsHash = await self.submitMetadataToIPFS();
        ipfsHash = '0x' + bs58.decode(ipfsHash).toString('hex');
        ipfsHash = self.web3.utils.hexToBytes(ipfsHash);

        // submit transaction
        self.sendTx(factory.methods.createPCDAIWithMetadata(self.beneficiaryName, self.tokenSymbol, self.beneficiaryEthereumAccount, true, ipfsHash), console.log, console.log, console.log);
      })
      .catch(function (state) {
        // The user exited onboarding before completion
      });
  }

  estimateGas = async (func, val, _onError) => {
    return Math.floor((await func.estimateGas({
      from: this.state.accountAddress,
      value: val
    }).catch(_onError)) * 1.2);
  };

  sendTx = async (func, _onTxHash, _onReceipt, _onError) => {
    var gasLimit = await this.estimateGas(func, 0, _onError);
    if (!isNaN(gasLimit)) {
      return func.send({
        from: this.state.accountAddress,
        gas: gasLimit
      }).on("transactionHash", _onTxHash).on("receipt", _onReceipt).on("error", _onError);
    }
  };

  sendTxWithValue = async (func, val, _onTxHash, _onReceipt, _onError) => {
    var gasLimit = await this.estimateGas(func, val, _onError);
    if (!isNaN(gasLimit)) {
      return func.send({
        from: this.state.accountAddress,
        gas: gasLimit,
        value: val
      }).on("transactionHash", _onTxHash).on("receipt", _onReceipt).on("error", _onError);
    }
  };

  sendTxWithToken = async (func, token, to, amount, _onTxHash, _onReceipt, _onError) => {
    let state = this.state;
    return this.sendTx(token.methods.approve(to, 0), () => {
      this.sendTx(token.methods.approve(to, amount), () => {
        func.send({
          from: state.accountAddress,
          gasLimit: "3000000"
        }).on("transactionHash", _onTxHash).on("receipt", _onReceipt).on("error", _onError);
      }, this.doNothing, _onError);
    }, this.doNothing, _onError);
  };

  doNothing = () => { }
}
