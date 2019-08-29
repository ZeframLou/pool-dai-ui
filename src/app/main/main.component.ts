import { Component, OnInit } from '@angular/core';
import { ApolloEnabled } from '../apollo';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';
import { isUndefined } from 'util';
import $ from 'jquery';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css']
})
export class MainComponent extends ApolloEnabled implements OnInit {

  isLoading: Boolean;
  poolList: Array<any>;

  constructor(private apollo: Apollo) {
    super();

    this.isLoading = true;
    this.poolList = new Array<any>();
  }

  ngOnInit() {
    this.createQuery();
  }

  createQuery() {
    this.query = this.apollo.watchQuery({
      fetchPolicy: 'cache-and-network',
      query: gql`
        {
          pools(orderBy: totalSupply, orderDirection: desc) {
            id
            totalSupply
            totalInterestWithdrawn
            name
          }
        }
                `
    });
    this.querySubscription = this.query.valueChanges.subscribe((result) => this.handleQuery(result));
  }

  handleQuery({ data, loading }) {
    this.isLoading = isUndefined(loading) || loading;
    if (!this.isLoading) {
      this.poolList = data.pools;
    }
  }

  refresh() {
    this.isLoading = true;

    this.query.refetch().then((result) => this.handleQuery(result));
  }

  filterTable = (event, tableID, searchID) => {
    let searchInput = event.target.value.toLowerCase();
    let entries = $(`#${tableID} tr`);
    for (let i = 0; i < entries.length; i++) {
      let entry = entries[i];
      let searchTarget = entry.children[searchID];
      if (searchTarget) {
        if (searchTarget.innerText.toLowerCase().indexOf(searchInput) > -1)
          entry.style.display = "";
        else
          entry.style.display = "none";
      }
    }
  }
}
