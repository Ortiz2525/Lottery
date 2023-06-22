<a name="readme-top"></a>
[![LinkedIn][linkedin-shield]][linkedin-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">

<h3 align="center">Hardhat Smartcontract Lottery</h3>

  <p align="center">
    A tamper proof autonomous verifiably random lottery
    <br />
    <a href="https://github.com/guillaumedebavelaere/hardhat-smartcontract-lottery"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/guillaumedebavelaere/hardhat-smartcontract-lottery">View Demo</a>
    ·
    <a href="https://github.com/guillaumedebavelaere/hardhat-smartcontract-lottery/issues">Report Bug</a>
    ·
    <a href="https://github.com/guillaumedebavelaere/hardhat-smartcontract-lottery/issues">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#quickstart">Quickstart</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#testing">Testing</a>
        <ul>
            <li><a href="#coverage">Coverage</a></li>
        </ul>
    </li>
    <li><a href="#deployment-to-a-testnet-or-mainnet">Deployment to a testnet or mainnet</a>
    <ul>
            <li><a href="#estimate-gas-cost-in-usd">Estimate gas cost in USD</a></li>
            <li><a href="#verify-on-etherscan">Verify on etherscan</a></li>
        </ul>
    </li>
    <li><a href="#linting">Linting</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->

## About The Project

This is a decentralized automated lottery using Chainlink Automation and Chainlink VRF, hardhat, solidity, typescript.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

-   [![Hardhat][HArdhat]][Hardhat-url]
-   [![Solidity][Solidity]][Solidity-url]
-   [![TypeScript][Typescript]][Typescript-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->

## Getting Started

### Prerequisites

-   [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
    -   You'll know you did it right if you can run `git --version` and you see a response like `git version x.x.x`
-   [Nodejs](https://nodejs.org/en/)
    -   You'll know you've installed nodejs right if you can run:
        -   `node --version` and get an ouput like: `vx.x.x`
-   [Yarn](https://yarnpkg.com/getting-started/install) instead of `npm`
    -   You'll know you've installed yarn right if you can run:
        -   `yarn --version` and get an output like: `x.x.x`
        -   You might need to [install it with `npm`](https://classic.yarnpkg.com/lang/en/docs/install/) or `corepack`

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Quickstart

```
git clone https://github.com/guillaumedebavelaere/hardhat-smartcontract-lottery
cd hardhat-smartcontract-lottery
yarn
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE EXAMPLES -->

## Usage

```
yarn hardhat deploy
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- TESTS -->

## Testing

```
yarn hardhat test
```

<!-- COVERAGE -->

### Coverage

```
yarn hardhat coverage
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- DEPLOYMENT -->

## Deployment to a testnet or mainnet

1. Setup environment variabltes

You'll want to set your `GOERLI_RPC_URL` and `PRIVATE_KEY` as environment variables. You can add them to a `.env` file.

-   `PRIVATE_KEY`: The private key of your account (like from [metamask](https://metamask.io/)).
-   `GOERLI_RPC_URL`: This is url of the goerli testnet node you're working with. You can get setup with one for free from [Alchemy](https://alchemy.com/?r=30fb9501aa7fc438)

1. Get testnet ETH

Head over to [faucets.chain.link](https://faucets.chain.link/) and get some tesnet ETH & LINK.

1. Setup a Chainlink VRF Subscription ID

Head over to [vrf.chain.link](https://vrf.chain.link/) and setup a new subscription, and get a subscriptionId. You can reuse an old subscription if you already have one.

[You can follow the instructions](https://docs.chain.link/docs/get-a-random-number/) if you get lost. You should leave this step with:

1. A subscription ID
2. Your subscription should be funded with LINK

3. Deploy

In your `.env` add a variable `GOERLI_SUBSCRIPTION_ID` filled with the subscription id.

Then run:

```
yarn hardhat deploy --network goerli
```

And copy / remember the contract address.

1. Add your contract address as a Chainlink VRF Consumer

Go back to [vrf.chain.link](https://vrf.chain.link) and under your subscription add `Add consumer` and add your contract address. You should also fund the contract with a minimum of 1 LINK.

5. Register a Chainlink Keepers Upkeep

[You can follow the documentation if you get lost.](https://docs.chain.link/docs/chainlink-keepers/compatible-contracts/)

Go to [automation.chain.link](https://automation.chain.link/new) and register a new upkeep. Choose `Custom logic` as your trigger mechanism for automation.

1. Enter your lottery!

You're contract is now setup to be a tamper proof autonomous verifiably random lottery. Enter the lottery by running:

```
yarn hardhat run scripts/enter.ts --network goerli
```

<!-- ESTIMATION GAS COST-->

### Estimate gas cost in USD

To get a USD estimation of gas cost, you'll need a `COINMARKETCAP_API_KEY` environment variable. You can get one for free from [CoinMarketCap](https://pro.coinmarketcap.com/signup).

Then, uncomment the line `coinmarketcap: COINMARKETCAP_API_KEY,` in `hardhat.config.js` to get the USD estimation. Just note, everytime you run your tests it will use an API call, so it might make sense to have using coinmarketcap disabled until you need it. You can disable it by just commenting the line back out.

<!-- VERIFY -->

### Verify on etherscan

If you deploy to a testnet or mainnet, you can verify it if you get an [API Key](https://etherscan.io/myapikey) from Etherscan and set it as an environemnt variable named `ETHERSCAN_API_KEY`. You can pop it into your `.env` file as seen in the `.env.example`.

In it's current state, if you have your api key set, it will auto verify goerli contracts!

However, you can manual verify with:

```
yarn hardhat verify --constructor-args arguments.js DEPLOYED_CONTRACT_ADDRESS
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LINTING -->

## Linting

To check linting / code formatting:

```
yarn lint
```

or, to fix:

```
yarn lint:fix
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://linkedin.com/in/gdebavelaere
[product-screenshot]: images/screenshot.png
[Hardhat]: https://img.shields.io/badge/-Hardhat-white.svg?style=for-the-badge&logo=hardhat&colorB=EFF77E
[Hardhat-url]: https://hardhat.org/
[Solidity]: https://img.shields.io/badge/-Solidity-black.svg?style=for-the-badge&logo=solidity&colorB=555
[Solidity-url]: https://docs.soliditylang.org/en/develop/
[Typescript]: https://img.shields.io/badge/-Typescript-black.svg?style=for-the-badge&logo=typescript&colorB=35495E
[Typescript-url]: https://www.typescriptlang.org/
