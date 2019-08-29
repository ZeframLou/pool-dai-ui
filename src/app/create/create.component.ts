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

  beneficiaryName: String;
  beneficiaryEthereumAccount: String;
  tokenSymbol: String;

  FACTORY_ADDRESS: String;

  constructor(@Inject(WEB3) web3: Web3) {
    super(web3);

    this.beneficiaryName = "";
    this.beneficiaryEthereumAccount = "";
    this.tokenSymbol = "";

    this.FACTORY_ADDRESS = "0x64bF69F73F450EF644bC1C8E0F7B3960EeBc5bF8";
  }

  ngOnInit() {
  }

  async createPool() {
    let self = this;
    this.connect((state) => {
      // initialize contract instance
      const abi = require('../../assets/abi/MetadataPooledCDAIFactory.json');
      const factory = self.assistInstance.Contract(new self.web3.eth.Contract(abi, self.FACTORY_ADDRESS));

      // submit transaction
      self.sendTx(factory.methods.createPCDAI(self.beneficiaryName, self.tokenSymbol, self.beneficiaryEthereumAccount, true), console.log, console.log, console.log);
    }, console.log);
  }
}
