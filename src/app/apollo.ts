import { Subscription } from 'apollo-client/util/Observable';
import { OnDestroy } from '@angular/core';
import { BigNumber } from 'bignumber.js';
import { isUrl } from 'is-url';
import { isUndefined } from 'util';
import * as sanitizeHtml from 'sanitize-html';

export class ApolloEnabled implements OnDestroy {
  querySubscription: Subscription;
  query: any;
  defaultPollInterval: Number;
  defaultLogoUrl: String;

  constructor() {
    this.defaultPollInterval = 60000;
    this.defaultLogoUrl = 'assets/img/no-logo-asset.svg';
  }

  ngOnDestroy() {
    this.querySubscription.unsubscribe();
  }

  toBigNumber(n) {
    return new BigNumber(n);
  }

  toDateTimeString(unixTimestamp) {
    return new Date(+unixTimestamp * 1e3).toLocaleString();
  }

  toDateString(unixTimestamp) {
    return new Date(+unixTimestamp * 1e3).toLocaleDateString();
  }

  toDateObject(unixTimestamp) {
    return new Date(+unixTimestamp * 1e3);
  }

  normalize(n) {
    return new BigNumber(n).div(1e18);
  }
}