Vue.prototype.$http = axios;
Vue.prototype.$apiRoute = "https://api.bscscan.com/api?";
Vue.prototype.$apiKey = "WRS8IF8SBV2Q6MHN3U4Y5W7HFZS3K91XVV";

// token contracts
Vue.prototype.$bnbContractAddress = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
Vue.prototype.$sfundContractAddress = "0x477bc8d23c634c154061869478bce96be6045d12";

// Lp informations
Vue.prototype.$lpList = {
  // Pancake swap Lp address
  "0x74fA517715C4ec65EF01d55ad5335f90dce7CC87": 
  {
    farmAddress: "0x0EF7Bd72eca5e2562b87FDf7E83dD30f81A6670B", 
    lpFound: 0
  },
  // Bakery swap Lp address
  "0x782f3f0d2b321D5aB7F15cd1665B95EC479Dcfa5": 
  {
    farmAddress: "0x8186aC36402645cC0B8e913CE4912fB0790bC9e6", 
    lpFound: 0
  },
  // Jul swap Lp address
  "0xF94FD45b0c7F2b305040CeA4958A9Ab8Ee73e1F4": 
  {
    farmAddress: "0x212a6497CFC9d41B0acdacc340D9993e619829C1",
    lpFound: 0
  }
}
// topic known as harvest action
Vue.prototype.$harvestTopic = "0x933735aa8de6d7547d0126171b2f31b9c34dd00f3ecd4be85a0ba047db4fafef";
Vue.prototype.$onlyHarvest = "0x0000000000000000000000000000000000000000000000000000000000000000";

// staking contracts
Vue.prototype.$tosdisSfundStakingAddress = "0xF17C06eb029F6Ab934E09CA4766eC373A78081B3";
Vue.prototype.$startBlock = 6000000;
// Ids of token in coingecko api
Vue.prototype.$sfundId = "seedify-fund";
Vue.prototype.$bnbId = "binancecoin";

// square price component
Vue.component("coin-info", {
        props: ["name", "infos", "currency", "currencylist"],
        template: '<div><h3>{{ name }}</h3><span>{{ infos[currency].toFixed(4) }} {{ currencylist.find(c => c.value == currency).displayed }} <span class="chgmt"><span v-if="infos[currency+\'_24h_change\'] > 0">+</span>{{ infos[currency+"_24h_change"].toFixed(4) }}%</span></span><span>24h Vol : {{ infos[currency+"_24h_vol"].toFixed(0) }} {{currencylist.find(c => c.value == currency).displayed}}</span></div>'
});

// Main vue
new Vue({
    el: "#coin-infos",
    data: {
        apiCalls: [],
        infos: null,
        lptotalsupply: null,
        sfundamount: null,
        bnbamount: null,
        loadingLpInfos: true,
        loadingPrice: true,
        loadingWalletInfos: false,
        errored: false,
        error: null,
        sfundprice: null,
        bnbprice: null,
        lpnumber: 1,
        walletaddress: null,
        lpfound: 0,
        farmingTotalSfund: 0,
        farmingTotalBnb: 0,
        walletsfundsupply: 0,
        stakedsfundamount: 0,
        currencyList: [ 
          { value: 'eur', displayed: '€'},
          { value: 'usd', displayed: '$'}
       ],
        selectedCurrency: 'eur',
        selected: "0x74fA517715C4ec65EF01d55ad5335f90dce7CC87",
        options: [
          { text: 'PancakeSwap', value: "0x74fA517715C4ec65EF01d55ad5335f90dce7CC87", src: './assets/pancakeswap.svg' },
          { text: 'BakerySwap', value: "0x782f3f0d2b321D5aB7F15cd1665B95EC479Dcfa5", src: './assets/bakeryswap.svg' },
          { text: 'JulSwap', value: "0xF94FD45b0c7F2b305040CeA4958A9Ab8Ee73e1F4", src: './assets/julswap.svg' }
        ]
    },
    filters: {
      amountdecimal (value) {
        return parseFloat((value / 1000000000000000000).toFixed(2));
      }
    },
    mounted() {
      if (localStorage.walletaddress) {
        this.walletaddress = localStorage.walletaddress;
      }
      if (localStorage.selected) {
        this.selected = localStorage.selected;
      }
      this.fetchLpInfos(this.selected);
    },
    created () {
        if (localStorage.selectedCurrency) {
          this.selectedCurrency = localStorage.selectedCurrency;
        }
        this.fetchTokensPrices();
    },
    // used to stock some info in user local storage
    watch: {
      walletaddress(walletaddress) {
        localStorage.walletaddress = walletaddress;
      },
      selected(selected)
      {
        localStorage.selected = selected;
      },
      selectedCurrency(selectedCurrency)
      {
        localStorage.selectedCurrency = selectedCurrency;
      }
    },
    methods: {
        getTokenInLp(lpNumber, tokenTotalAmount, lpTotalSupply) {
          return lpNumber * (tokenTotalAmount / lpTotalSupply);
        },

        async getWalletInfos() {
          this.loadingWalletInfos = true;
          this.farmingTotalSfund = 0;
          this.farmingTotalBnb = 0;
          tokenTxList = await this.getTokenTxList();
          tokenTxList.reverse();
          for(const [lpContractAddress, farmInfos] of Object.entries(this.$lpList)) {
            farmInfos["lpFound"] = this.threatTokenTx(tokenTxList, lpContractAddress, farmInfos["farmAddress"]);
            if(farmInfos["lpFound"] > 0)
            {
              await this.fetchLpInfos(lpContractAddress);
              this.farmingTotalSfund += this.getTokenInLp(farmInfos["lpFound"], this.sfundamount, this.lptotalsupply);
              this.farmingTotalBnb += this.getTokenInLp(farmInfos["lpFound"], this.bnbamount, this.lptotalsupply);
              this.selected = lpContractAddress;
            }
          }
          const trxToIgnore = await this.getHarvestTrx().then(trxToIgnore => trxToIgnore.filter(trx => trx.data.substring(0, 66) == this.$onlyHarvest).map(trx => trx.transactionHash));
          this.stakedsfundamount = this.threatTokenTx(tokenTxList, this.$sfundContractAddress, this.$tosdisSfundStakingAddress, trxToIgnore);
          this.walletsfundsupply = this.$options.filters.amountdecimal(await this.getContractBalance(this.$sfundContractAddress, this.walletaddress));
          this.loadingWalletInfos = false;
        },

        async getEndBlock () {
          await this.canCallApi();
          return this.$http
          .get(this.$apiRoute+'module=block&action=getblocknobytime&timestamp='+Math.floor(new Date().getTime() / 1000)+'&closest=before&apikey='+this.$apiKey)
          .then(function(response){
            return response.data.result;
          })
          .catch(error => {
            console.log(error)
            this.errored = true
          })
        },

        async getTokenTxList () {
          if(this.errored = !this.isValidAddress(this.walletaddress))
          {
            this.error = "Invalid address";
            return;
          }
          this.loading = true;
          endBlock = await this.getEndBlock();
          await this.canCallApi();
          return this.$http
              .get(this.$apiRoute+'module=account&action=tokentx&address='+this.walletaddress+'&startblock='+this.$startBlock+'&endblock='+endBlock+'&sort=asc&apikey='+this.$apiKey)
              .then(function(response) {return response.data.result;})
              .catch(error => {
                console.log(error)
                this.errored = true
                this.error = "No transaction found"
              })
              .finally(() => this.loading = false);
        },
        // used to compute all transactions about one contract, simply + when trx "to" and - when trx "from"
        threatTokenTx (tokenTxList, tokenContractAddress, stakingContractAddress, trxToIgnore = [])
        {
          let lpfound = 0;
          let lastHash = "";
          let ignore = false;
          tokenTxList = tokenTxList.filter(
            tokenTx => (
              // we want to ignore the second transaction in the same hash (1st = unstake/stake, 2nd = auto harvest)
              ignore = lastHash == tokenTx.hash || trxToIgnore.includes(tokenTx.hash),
              lastHash = tokenTx.hash,
              !ignore && 
              this.compareIgnoreCase(tokenTx.contractAddress, tokenContractAddress) 
              && (this.compareIgnoreCase(tokenTx.to, stakingContractAddress) || this.compareIgnoreCase(tokenTx.from, stakingContractAddress))
              ));
            tokenTxList.forEach(
              tokenTx => (
                this.compareIgnoreCase(tokenTx.to, stakingContractAddress) ? lpfound+=parseInt(tokenTx.value) : lpfound-=parseInt(tokenTx.value)
              )
            );
            return this.$options.filters.amountdecimal(lpfound);
        },

        isValidAddress (address) {
          if(/^(0x)?[0-9a-f]{40}$/i.test(address))
          {
            return true;
          }
          return false;
        },

        compareIgnoreCase (s1, s2) {
          return s1.toUpperCase() == s2.toUpperCase();
        },

        fetchTokensPrices () {
          this.loadingPrice = true;
          this.$http
          .get("https://api.coingecko.com/api/v3/simple/price?ids="+this.$sfundId+"%2C"+this.$bnbId+"&vs_currencies="+this.selectedCurrency+"&include_24hr_vol=true&include_24hr_change=true")
          .then(response => (this.infos = response.data, this.sfundprice = response.data[this.$sfundId][this.selectedCurrency], this.bnbprice = response.data[this.$bnbId][this.selectedCurrency]))
          .catch(error => {
            console.log(error)
            this.errored = true
          })
          .finally(() => this.loadingPrice = false, setTimeout(() => {this.fetchTokensPrices()}, 300000));
        },

        async fetchLpInfos (selected) {
          this.loadingLpInfos = true;
          const selectedLp = selected === undefined ? this.selected : selected;
          this.lptotalsupply = await this.getTokenSupply(selectedLp);
          this.bnbamount = await this.getContractBalance(this.$bnbContractAddress, selectedLp);
          this.sfundamount = await this.getContractBalance(this.$sfundContractAddress, selectedLp);
          this.lpnumber = this.$lpList[selectedLp]["lpFound"];
          this.loadingLpInfos = false;
        },

        async getTokenSupply(contract)
        {
          await this.canCallApi();
          return this.$http
          .get(this.$apiRoute+'module=stats&action=tokensupply&contractaddress='+contract+'&apikey='+this.$apiKey)
          .then(function(response) {return response.data.result;})
          .catch(error => {
            console.log(error)
            this.errored = true
          });
        },

        async getContractBalance (contract, addr)
        {
          await this.canCallApi();
          return this.$http
          .get(this.$apiRoute+'module=account&action=tokenbalance&contractaddress='+contract+'&address='+addr+'&tag=latest&apikey='+this.$apiKey)
          .then(function(response) {return response.data.result;})
          .catch(error => {
            console.log(error)
            this.errored = true
          })
        },
        // We need to identify harvest trx to ignore it (only usefull for staking pool)
        async getHarvestTrx ()
        {
          await this.canCallApi();
          return this.$http
          .get(this.$apiRoute+'module=logs&action=getLogs&fromBlock='+this.$startBlock+'&toBlock=latest&address='
          + this.$tosdisSfundStakingAddress+'&topic0='+this.$harvestTopic+'&topic1=0x000000000000000000000000'
          + this.walletaddress.substring(2)+'&apikey='+this.$apiKey)
          .then(function(response) {return response.data.result;})
          .catch(error => {
            console.log(error)
            this.errored = true
          })
        },

        // little bridle for api call (limited to 5 calls / sec / IP)
        async canCallApi ()
        {
          this.apiCalls.push(new Date());
          if(this.apiCalls.length > 5)
          {
            this.apiCalls.shift();
          }
          return new Promise((resolve) => {
            if(this.apiCalls.length == 5)
            {
              if((this.apiCalls[this.apiCalls.length-1] - this.apiCalls[0]) <= 1000)
              {
                setTimeout(() => {
                  resolve(true);
                }, 1000 - (this.apiCalls[this.apiCalls.length-1] - this.apiCalls[0]));
              }
              else
              {
                resolve(true);              
              }
            }
            else{
              resolve(true);
            }
          });
        }
    }
});