import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from "@angular/router";
import { ApolloEnabled } from '../apollo';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';
import { isUndefined, isNullOrUndefined } from 'util';
import Chart from 'chart.js';

import { Inject } from '@angular/core';
import { WEB3 } from '../web3';
import Web3 from 'web3';
import bnc from 'bnc-assist';
import { isNull } from 'util';
import BigNumber from 'bignumber.js';
const fetch = require('node-fetch');

@Component({
  selector: 'app-pool',
  templateUrl: './pool.component.html',
  styleUrls: ['./pool.component.css']
})
// Damn Typescript for not supporting extending multiple classes
export class PoolComponent extends ApolloEnabled implements OnInit {

  isLoading: Boolean;
  poolData: any;
  totalSupplyHistoryChart: any;
  totalInterestWithdrawnHistoryChart: any;

  apiKey: string;
  assistInstance: any;
  state: any;
  CHECK_RECEIPT_INTERVAL: number; // in milliseconds

  KYBER_EXT_ADDRESS: string;
  DAI_ADDRESS: string;

  tokenData: any;

  depositAmount: number;
  depositTokenSymbol: string;
  withdrawAmount: number;
  withdrawTokenSymbol: string;

  currencyBalance: BigNumber;
  pDAIBalance: BigNumber;
  interestAccrued: BigNumber;

  constructor(private route: ActivatedRoute, private apollo: Apollo, @Inject(WEB3) public web3: Web3) {
    super();

    this.apiKey = "239ccd50-62da-4e2f-aaf4-b33d39a3a0a6";
    this.CHECK_RECEIPT_INTERVAL = 3e3;

    this.KYBER_EXT_ADDRESS = "0x04deb44ac536ed288ab3ddb7d69920e7002965f1";
    this.DAI_ADDRESS = "0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359";

    this.depositAmount = 0;
    this.depositTokenSymbol = 'ETH';
    this.withdrawAmount = 0;
    this.withdrawTokenSymbol = 'ETH';

    this.interestAccrued = new BigNumber(0);
  }

  async ngOnInit() {
    this.totalSupplyHistoryChart = new Chart('totalSupplyHistoryChart', {
      type: 'line',
      options: {
        scales: {
          xAxes: [{
            type: 'time',
            gridLines: {
              display: false
            }
          }],
          yAxes: [{
            gridLines: {
              display: false
            },
            scaleLabel: {
              display: true,
              labelString: "Pool size (DAI)"
            }
          }]
        },
        legend: {
          display: false
        }
      }
    });
    this.totalInterestWithdrawnHistoryChart = new Chart('totalInterestWithdrawnHistoryChart', {
      type: 'line',
      options: {
        scales: {
          xAxes: [{
            type: 'time',
            gridLines: {
              display: false
            }
          }],
          yAxes: [{
            gridLines: {
              display: false
            },
            scaleLabel: {
              display: true,
              labelString: "Total interest donated (DAI)"
            }
          }]
        },
        legend: {
          display: false
        }
      }
    });

    this.tokenData = await this.getKyberTokens();

    this.createQuery();
    this.displayInterestAccrued();
  }

  getPoolID() {
    return this.route.snapshot.paramMap.get("poolID");
  }

  createQuery() {
    let poolID = this.getPoolID();

    this.query = this.apollo.watchQuery({
      fetchPolicy: 'cache-and-network',
      query: gql`
        {
          pool(id: "${poolID}") {
            totalSupply
            totalInterestWithdrawn
            name
            symbol
            creator
            creationTimestamp
            owner
            beneficiary
            totalSupplyHistory {
              timestamp
              value
            }
            totalInterestWithdrawnHistory {
              timestamp
              value
            }
          }
        }
                `
    });
    this.querySubscription = this.query.valueChanges.subscribe((result) => this.handleQuery(result));
  }

  handleQuery({ data, loading }) {
    this.isLoading = isUndefined(loading) || loading;
    if (!this.isLoading) {
      this.poolData = data.pool;

      var gradientFill = this.totalSupplyHistoryChart.ctx.createLinearGradient(0, 0, 0, 200);
      gradientFill.addColorStop(0, 'rgba(0, 217, 126, 0.5)');
      gradientFill.addColorStop(0.5, 'rgba(0, 217, 126, 0.25)');
      gradientFill.addColorStop(1, 'rgba(0, 217, 126, 0)');

      this.totalSupplyHistoryChart.data = {
        labels: this.poolData.totalSupplyHistory.map((dp) => this.toDateObject(dp.timestamp)),
        datasets: [{
          data: this.poolData.totalSupplyHistory.map((dp) => dp.value),
          backgroundColor: gradientFill,
          borderColor: '#22c88a'
        }]
      };
      this.totalSupplyHistoryChart.update();

      this.totalInterestWithdrawnHistoryChart.data = {
        labels: this.poolData.totalInterestWithdrawnHistory.map((dp) => this.toDateObject(dp.timestamp)),
        datasets: [{
          data: this.poolData.totalInterestWithdrawnHistory.map((dp) => dp.value),
          backgroundColor: gradientFill,
          borderColor: '#22c88a'
        }]
      };
      this.totalInterestWithdrawnHistoryChart.update();
    }
  }

  refresh() {
    this.isLoading = true;

    this.query.refetch().then((result) => this.handleQuery(result));
    this.displayInterestAccrued();
  }

  withdrawInterest() {
    let self = this;
    this.connect((state) => {
      // initialize contract instance
      const pcDAI = self.pcDAI();

      // submit transaction
      self.sendTx(pcDAI.methods.withdrawInterestInDAI(), console.log, console.log, console.log);
    }, console.log);
  }

  deposit(amount, tokenSymbol) {
    let self = this;
    let amountWithPrecision;
    this.connect((state) => {
      // submit transaction
      switch (tokenSymbol) {
        case 'ETH':
          amountWithPrecision = new BigNumber(amount).times(1e18).integerValue().toFixed();
          self.sendTxWithValue(self.kyberExtension().methods.mintWithETH(self.getPoolID(), state.accountAddress), amountWithPrecision, console.log, console.log, console.log);
          break;
        case 'SAI':
          amountWithPrecision = new BigNumber(amount).times(1e18).integerValue().toFixed();
          self.sendTxWithToken(self.pcDAI().methods.mint(state.accountAddress, amountWithPrecision), self.ERC20(self.DAI_ADDRESS), self.getPoolID(), amountWithPrecision, 5e5, console.log, console.log, console.log);
          break;
        default:
          let data = this.tokenSymbolToData(tokenSymbol);
          if (isUndefined(data)) {
            console.error(`Invalid token symbol: ${tokenSymbol}`);
            break;
          }
          let tokenAddress = data.address;
          let tokenDecimals = data.decimals;
          amountWithPrecision = new BigNumber(amount).times(new BigNumber(10).pow(tokenDecimals)).integerValue().toFixed();
          let token = this.ERC20(tokenAddress);
          self.sendTxWithToken(self.kyberExtension().methods.mintWithToken(self.getPoolID(), tokenAddress, state.accountAddress, amountWithPrecision), token, self.KYBER_EXT_ADDRESS, amountWithPrecision, 2.5e6, console.log, console.log, console.log);
          break;
      }
    }, console.log);
  }

  withdraw(amount, tokenSymbol) {
    let self = this;
    let amountWithPrecision = new BigNumber(amount).times(1e18).integerValue().toFixed();
    this.connect((state) => {
      // submit transaction
      let pcDAI = this.ERC20(this.getPoolID());
      switch (tokenSymbol) {
        case 'ETH':
          self.sendTxWithToken(self.kyberExtension().methods.burnToETH(self.getPoolID(), state.accountAddress, amountWithPrecision), pcDAI, self.KYBER_EXT_ADDRESS, amountWithPrecision, 1e6, console.log, console.log, console.log);
          break;
        case 'SAI':
          self.sendTx(self.pcDAI().methods.burn(state.accountAddress, amountWithPrecision), console.log, console.log, console.log);
          break;
        default:
          let data = this.tokenSymbolToData(tokenSymbol);
          if (isUndefined(data)) {
            console.error(`Invalid token symbol: ${tokenSymbol}`);
            break;
          }
          let tokenAddress = data.address;
          self.sendTxWithToken(self.kyberExtension().methods.burnToToken(self.getPoolID(), tokenAddress, state.accountAddress, amountWithPrecision), pcDAI, self.KYBER_EXT_ADDRESS, amountWithPrecision, 2e6, console.log, console.log, console.log);
          break;
      }
    }, console.log);
  }

  migrate() {
    let self = this;
    this.connect(async (state) => {
      // initialize contract instance
      const abi = require('../../assets/abi/Sai2Dai.json');
      const sai2daiAddress = '0x02c9e4174E9D23BB7619c83Ef5f771fCB1E6FDB8';
      const contract = new self.web3.eth.Contract(abi, sai2daiAddress);

      // get user pDAI balance
      const token = self.pcDAI();
      const pDAIBalance = new BigNumber(await token.methods.balanceOf(state.accountAddress).call()).integerValue().toFixed();

      // submit transaction
      self.sendTxWithToken(contract.methods.migrate(self.getPoolID(), pDAIBalance), token, sai2daiAddress, pDAIBalance, 2e6,  console.log, console.log, console.log);
    }, console.log);
  }

  displayCurrencyBalance() {
    let self = this;
    this.connect(async (state) => {
      if (self.depositTokenSymbol === 'ETH') {
        self.currencyBalance = new BigNumber(await self.web3.eth.getBalance(state.accountAddress)).div(1e18);
      } else {
        let data = self.tokenSymbolToData(self.depositTokenSymbol);
        if (!isUndefined(data)) {
          let token = self.ERC20(data.address);
          self.currencyBalance = new BigNumber(await token.methods.balanceOf(this.state.address).call()).div(new BigNumber(10).pow(data.decimals));
        }
      }
    }, console.log);
  }

  displayPDAIBalance() {
    let self = this;
    this.connect(async (state) => {
      let token = self.pcDAI();
      self.pDAIBalance = new BigNumber(await token.methods.balanceOf(state.accountAddress).call()).div(1e18);
    }, console.log);
  }

  async displayInterestAccrued() {
    let web3Instance = new Web3('wss://mainnet.infura.io/ws/v3/1f24e70482f84d1e8d55183921fe2c3f');
    let token = this.pcDAI(web3Instance);
    this.interestAccrued = new BigNumber(await token.methods.accruedInterestCurrent().call()).div(1e18);
  }

  // Kyber utilities
  async httpsGet(apiStr) {
    const request = await fetch(apiStr, {headers: {'Origin': 'https://zeframlou.github.io/pool-dai/'}});
    return await request.json();
  };

  async getKyberTokens() {
    // fetch token data from Kyber API
    let rawData = (await this.httpsGet('https://api.kyber.network/currencies') as any).data;
    let tokenData = rawData.map((x) => {
      return {
        name: x.name,
        symbol: x.symbol,
        address: this.web3.utils.toChecksumAddress(x.address),
        decimals: x.decimals
      }
    });
    return tokenData;
  }

  tokenSymbolToData(symbol) {
    return this.tokenData.find((x) => x.symbol === symbol);
  }

  // web3 utilities
  ERC20(_tokenAddr) {
    // add new token contract
    var erc20ABI = require("../../assets/abi/ERC20.json");
    return this.assistInstance.Contract(new this.web3.eth.Contract(erc20ABI, _tokenAddr));
  };

  pcDAI(web3Instance?) {
    const abi = require('../../assets/abi/PooledCDAI.json');
    if (isNullOrUndefined(web3Instance)) {
      // use default
      return this.assistInstance.Contract(new this.web3.eth.Contract(abi, this.getPoolID()));
    } else {
      // use given web3 instance
      return new web3Instance.eth.Contract(abi, this.getPoolID());
    }
  }

  kyberExtension() {
    let abi = require('../../assets/abi/PooledCDAIKyberExtension.json');
    let contract = this.assistInstance.Contract(new this.web3.eth.Contract(abi, this.KYBER_EXT_ADDRESS));
    return contract;
  }

  async connect(onConnected, onError) {
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
        self.state = state;
        onConnected(state);
      })
      .catch(function (state) {
        // The user exited onboarding before completion
        onError(state);
      });
  }

  async estimateGas(func, val, _onError) {
    return Math.floor((await func.estimateGas({
      from: this.state.accountAddress,
      value: val
    }).catch(_onError)) * 1.2);
  };

  async sendTx(func, _onTxHash, _onReceipt, _onError) {
    var gasLimit = await this.estimateGas(func, 0, _onError);
    if (!isNaN(gasLimit)) {
      return func.send({
        from: this.state.accountAddress,
        gas: gasLimit,
      }).on("transactionHash", (hash) => {
        _onTxHash(hash);
        let listener = setInterval(async () => {
          let receipt = await this.web3.eth.getTransaction(hash);
          if (!isNull(receipt)) {
            _onReceipt(receipt);
            clearInterval(listener);
          }
        }, this.CHECK_RECEIPT_INTERVAL);
      }).on("error", (e) => {
        if (!e.toString().contains('newBlockHeaders')) {
          _onError(e);
        }
      });
    }
  };

  async sendTxWithValue(func, val, _onTxHash, _onReceipt, _onError) {
    var gasLimit = await this.estimateGas(func, val, _onError);
    if (!isNaN(gasLimit)) {
      return func.send({
        from: this.state.accountAddress,
        gas: gasLimit,
        value: val
      }).on("transactionHash", (hash) => {
        _onTxHash(hash);
        let listener = setInterval(async () => {
          let receipt = await this.web3.eth.getTransaction(hash);
          if (!isNull(receipt)) {
            _onReceipt(receipt);
            clearInterval(listener);
          }
        }, this.CHECK_RECEIPT_INTERVAL);
      }).on("error", (e) => {
        if (!e.toString().contains('newBlockHeaders')) {
          _onError(e);
        }
      });
    }
  };

  async sendTxWithToken(func, token, to, amount, gasLimit, _onTxHash, _onReceipt, _onError) {
    let state = this.state;
    let allowance = new BigNumber(await token.methods.allowance(state.accountAddress, to).call());
    if (allowance.gt(0)) {
      if (allowance.gte(amount)) {
        return this.sendTx(func, _onTxHash, _onReceipt, _onError);
      }

      return this.sendTx(token.methods.approve(to, 0), () => {
        this.sendTx(token.methods.approve(to, amount), () => {
          func.send({
            from: this.state.accountAddress,
            gas: gasLimit,
          }).on("transactionHash", (hash) => {
            _onTxHash(hash);
            let listener = setInterval(async () => {
              let receipt = await this.web3.eth.getTransaction(hash);
              if (!isNull(receipt)) {
                _onReceipt(receipt);
                clearInterval(listener);
              }
            }, this.CHECK_RECEIPT_INTERVAL);
          }).on("error", (e) => {
            if (!e.toString().contains('newBlockHeaders')) {
              _onError(e);
            }
          });
        }, this.doNothing, _onError);
      }, this.doNothing, _onError);
    } else {
      return this.sendTx(token.methods.approve(to, amount), () => {
        func.send({
          from: this.state.accountAddress,
          gas: gasLimit,
        }).on("transactionHash", (hash) => {
          _onTxHash(hash);
          let listener = setInterval(async () => {
            let receipt = await this.web3.eth.getTransaction(hash);
            if (!isNull(receipt)) {
              _onReceipt(receipt);
              clearInterval(listener);
            }
          }, this.CHECK_RECEIPT_INTERVAL);
        }).on("error", (e) => {
          if (!e.toString().contains('newBlockHeaders')) {
            _onError(e);
          }
        });
      }, this.doNothing, _onError);
    }
  };

  doNothing() { }
}
