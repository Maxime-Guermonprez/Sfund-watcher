Vue.prototype.$http = axios;

// Lp informations
Vue.prototype.$lpList = {
  // Pancake swap Lp address
  "0x74fA517715C4ec65EF01d55ad5335f90dce7CC87":
  {
    lpFound: 0
  },
  // Bakery swap Lp address
  "0x782f3f0d2b321D5aB7F15cd1665B95EC479Dcfa5":
  {
    lpFound: 0
  },
  // Jul swap Lp address
  "0xF94FD45b0c7F2b305040CeA4958A9Ab8Ee73e1F4":
  {
    lpFound: 0
  }
}

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
    farmingTotalSfund: 0,
    farmingTotalBnb: 0,
    farmingTotalSfundStaked: 0,
    farmingTotalSfundToHarvest: 0,
    walletsfundsupply: 0,
    stakedSfundAmount: 0,
    stakedSfundToHarvest: 0,
    reward: { staking: { amount: 0, duration: 0 }, farming: { amount: 0, duration: 0 } },
    currencyList: [
      { value: 'eur', displayed: '€' },
      { value: 'usd', displayed: '$' }
    ],
    selectedCurrency: 'eur',
    selected: "0x74fA517715C4ec65EF01d55ad5335f90dce7CC87",
    options: [
      { text: 'PancakeSwap', symbol: "cake-lp", value: "0x74fA517715C4ec65EF01d55ad5335f90dce7CC87", src: './assets/pancakeswap.svg' },
      { text: 'BakerySwap', symbol: "blp", value: "0x782f3f0d2b321D5aB7F15cd1665B95EC479Dcfa5", src: './assets/bakeryswap.svg' },
      { text: 'JulSwap', symbol: "slp", value: "0xF94FD45b0c7F2b305040CeA4958A9Ab8Ee73e1F4", src: './assets/julswap.svg' }
    ]
  },
  filters: {
    amountdecimal(value) {
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
  created() {
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
    selected(selected) {
      localStorage.selected = selected;
    },
    selectedCurrency(selectedCurrency) {
      localStorage.selectedCurrency = selectedCurrency;
    }
  },
  methods: {
    getTokenInLp(lpNumber, tokenTotalAmount, lpTotalSupply) {
      return lpNumber * (tokenTotalAmount / lpTotalSupply);
    },

    async getWalletInfos() {
      this.loadingWalletInfos = true;
      this.$http
        .get("https://sfundwatcher.herokuapp.com/wallet/" + this.walletaddress)
        .then(response => {
          console.log(response)
          this.farmingTotalBnb = response.data.farming.total.wbnb
          this.farmingTotalSfund = response.data.farming.total.sfund
          this.stakedSfundAmount = response.data.staking.details[0].tokens.sfund
          this.stakedSfundToHarvest = response.data.staking.details[0].pendingReward.sfund
          this.reward.staking.amount = response.data.staking.details[0].rewardPerSec
          this.reward.staking.duration = response.data.staking.details[0].duration
          this.walletsfundsupply = response.data.wallet.sfund
          for (const farm of response.data.farming.details) {
            const contractAddr = this.options.find((option) => option.symbol == farm.symbol).value
            this.$lpList[contractAddr]["lpFound"] = farm.lp
            this.$lpList[contractAddr]["duration"] = farm.duration
            this.$lpList[contractAddr]["rewardPerSec"] = farm.rewardPerSec
            this.reward.farming.amount += farm.rewardPerSec
            this.reward.farming.duration = farm.duration
            this.farmingTotalSfundStaked += farm.tokens.sfund
            this.farmingTotalSfundToHarvest += farm.pendingReward.sfund
            if (farm.lp > 0) {
              this.selected = contractAddr
            }
          }
          this.fetchLpInfos(this.selected)
          this.loadingWalletInfos = false;
        })
    },

    isValidAddress(address) {
      if (/^(0x)?[0-9a-f]{40}$/i.test(address)) {
        return true;
      }
      return false;
    },

    compareIgnoreCase(s1, s2) {
      return s1.toUpperCase() == s2.toUpperCase();
    },

    fetchTokensPrices() {
      this.loadingPrice = true;
      this.$http
        .get("https://api.coingecko.com/api/v3/simple/price?ids=" + this.$sfundId + "%2C" + this.$bnbId + "&vs_currencies=" + this.selectedCurrency + "&include_24hr_vol=true&include_24hr_change=true")
        .then(response => (this.infos = response.data, this.sfundprice = response.data[this.$sfundId][this.selectedCurrency], this.bnbprice = response.data[this.$bnbId][this.selectedCurrency]))
        .catch(error => {
          console.log(error)
          this.errored = true
        })
        .finally(() => this.loadingPrice = false, setTimeout(() => { this.fetchTokensPrices() }, 300000));
    },

    async fetchLpInfos(selected) {
      this.loadingLpInfos = true;
      const selectedLp = selected === undefined ? this.selected : selected;
      this.$http
        .get("https://sfundwatcher.herokuapp.com/lp/" + selectedLp).then(response => {
          console.log(response.data.totalSupply);
          var data = response.data
          this.lptotalsupply = data.totalSupply
          this.bnbamount = data.tokens.find((token) => token.symbol == "wbnb").amount
          this.sfundamount = data.tokens.find((token) => token.symbol == "sfund").amount
          this.lpnumber = this.$lpList[selectedLp]["lpFound"];
          this.loadingLpInfos = false;
        })
    }
  }
});