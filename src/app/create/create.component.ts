import { Component, OnInit, Inject } from '@angular/core';
import { Web3Enabled } from '../web3Enabled';
import { WEB3 } from '../web3';
import Web3 from 'web3';
@Component({
  selector: 'app-create',
  templateUrl: './create.component.html',
  styleUrls: ['./create.component.css']
})
export class CreateComponent extends Web3Enabled implements OnInit {

  beneficiaryName: string;
  beneficiaryEthereumAccount: string;
  tokenSymbol: string;
  renounceOwnershipCheck: Boolean;

  FACTORY_ADDRESS: string;

  createdPoolAddress: string;
  baseUrl: string;
  hasCreatedPool: Boolean;
  txHash: string;

  constructor(@Inject(WEB3) web3: Web3) {
    super(web3);

    this.beneficiaryName = "";
    this.beneficiaryEthereumAccount = "";
    this.tokenSymbol = "";
    this.renounceOwnershipCheck = false;

    this.FACTORY_ADDRESS = "0xd91d45e8f0de4ac5edefe4dc9425a808eb13a324";

    this.hasCreatedPool = false;
    this.createdPoolAddress = "";
    this.txHash = "";
  }

  ngOnInit() {
    this.baseUrl = window.location.origin;
  }

  async createPool() {
    let self = this;
    this.connect(async (state) => {
      // initialize contract instance
      const abi = require('../../assets/abi/MetadataPooledCDAIFactory.json');
      const factory = self.assistInstance.Contract(new self.web3.eth.Contract(abi, self.FACTORY_ADDRESS));

      // submit transaction
      this.createdPoolAddress = await factory.methods.createPCDAI(self.beneficiaryName, self.tokenSymbol, self.beneficiaryEthereumAccount, self.renounceOwnershipCheck).call();
      self.sendTx(factory.methods.createPCDAI(self.beneficiaryName, self.tokenSymbol, self.beneficiaryEthereumAccount, self.renounceOwnershipCheck), (hash) => {
        this.txHash = hash;
        this.hasCreatedPool = true;
      }, console.log, console.log);
    }, console.log);
  }
}
