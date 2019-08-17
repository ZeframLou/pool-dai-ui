import { Component, OnInit, OnDestroy } from '@angular/core';
import * as IPFS from 'ipfs';

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

  constructor() {
    this.beneficiaryName = "";
    this.beneficiaryDescription = "";
    this.beneficiaryEthereumAccount = "";
    this.accountProof = "";
    this.tokenSymbol = "";
    this.logoLink = "";
  }

  ngOnInit() {
    this.initIPFS();
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
    console.log(hash);
  }
}
