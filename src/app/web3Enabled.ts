import Web3 from 'web3';
import bnc from 'bnc-assist';
import { isNull } from 'util';

export class Web3Enabled {
  apiKey: String;
  assistInstance: any;
  state: any;
  CHECK_RECEIPT_INTERVAL: number; // in milliseconds

  constructor(public web3: Web3) {
    this.apiKey = "239ccd50-62da-4e2f-aaf4-b33d39a3a0a6";
    this.CHECK_RECEIPT_INTERVAL = 3e3;
  }

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