import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from "@angular/router";
import { ApolloEnabled } from '../apollo';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';
import { isUndefined } from 'util';
import Chart from 'chart.js';

import { Inject } from '@angular/core';
import { WEB3 } from '../web3';
import Web3 from 'web3';
import bnc from 'bnc-assist';
import { isNull } from 'util';

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

  apiKey: String;
  assistInstance: any;
  state: any;
  CHECK_RECEIPT_INTERVAL: number; // in milliseconds

  constructor(private route: ActivatedRoute, private apollo: Apollo, @Inject(WEB3) private web3: Web3) {
    super();

    this.apiKey = "239ccd50-62da-4e2f-aaf4-b33d39a3a0a6";
    this.CHECK_RECEIPT_INTERVAL = 3e3;
  }

  ngOnInit() {
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

    this.createQuery();
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
  }

  withdrawInterest() {
    let self = this;
    this.connect((state) => {
      // initialize contract instance
      const abi = require('../../assets/abi/MetadataPooledCDAIFactory.json');
      const pcDAI = self.assistInstance.Contract(new self.web3.eth.Contract(abi, self.getPoolID()));

      // submit transaction
      self.sendTx(pcDAI.methods.withdrawInterestInDAI(), console.log, console.log, console.log);
    }, console.log);
  }

  deposit() {

  }

  withdraw() {
    
  }

  // web3 utilities
  async connect(onConnected, onError) {
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

  async sendTxWithToken(func, token, to, amount, _onTxHash, _onReceipt, _onError) {
    let state = this.state;
    return this.sendTx(token.methods.approve(to, 0), () => {
      this.sendTx(token.methods.approve(to, amount), () => {
        func.send({
          from: this.state.accountAddress,
          gas: "3000000",
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
  };

  doNothing() { }
}
