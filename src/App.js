import { useEffect, useState } from 'react'
import { ethers } from 'ethers'

// Components
import Navigation from './components/Navigation'
import Search from './components/Search'
import Domain from './components/Domain'

// ABIs
import ETHDaddy from './abis/ETHDaddy.json'

// Config
import config from './config.json';

function App() {
  const [provider, setProvider] = useState(null)
  const [account, setAccount] = useState(null)

  const [ethDaddy, setETHDaddy] = useState(null)
  const [domains, setDomains] = useState([])

  const loadBlockchainData = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask to use this app.")
      return;
    }

    const provider = new ethers.providers.Web3Provider(window.ethereum)
    setProvider(provider)

    // --- NETWORK AUTOMATION (Sepolia) ---
    const sepoliaHex = '0xaa36a7' // Hex for 11155111

    try {
      // Prompt user to switch to Sepolia
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: sepoliaHex }],
      });
    } catch (switchError) {
      // If Sepolia is not added to the wallet, add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: sepoliaHex,
              chainName: 'Sepolia Test Network',
              rpcUrls: ['https://rpc.ankr.com'],
              nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
              blockExplorerUrls: ['https://sepolia.etherscan.io']
            }],
          });
        } catch (addError) {
          console.error("User rejected network addition");
        }
      }
    }
    // --- END AUTOMATION ---

    const network = await provider.getNetwork()

    // Check if the current network exists in your config.json
    if (config[network.chainId]) {
      const ethDaddyContract = new ethers.Contract(
        config[network.chainId].ETHDaddy.address, 
        ETHDaddy.abi, 
        provider
      )
      setETHDaddy(ethDaddyContract)

      try {
        const maxSupply = await ethDaddyContract.maxSupply()
        const domainsArray = []

        for (var i = 1; i <= maxSupply; i++) {
          const domain = await ethDaddyContract.getDomain(i)
          domainsArray.push(domain)
        }
        setDomains(domainsArray)
      } catch (err) {
        console.error("Error fetching domains:", err)
      }
    } else {
      console.error("Network not found in config.json. Ensure you are on Sepolia (11155111).")
    }

    // Listener for account changes
    window.ethereum.on('accountsChanged', async (accounts) => {
      if (accounts.length > 0) {
        const account = ethers.utils.getAddress(accounts[0])
        setAccount(account)
      } else {
        setAccount(null)
      }
    })

    // Reload page on network change to stay in sync
    window.ethereum.on('chainChanged', () => {
      window.location.reload()
    })
  }

  useEffect(() => {
    loadBlockchainData()
  }, [])

  return (
    <div>
      <Navigation account={account} setAccount={setAccount} />

      <Search />

      <div className='cards__section'>
        <h2 className='cards__title'>Why you need a domain name.</h2>
        <p className='cards__description'>
          Own your custom username, use it across services, and
          be able to store an avatar and other profile data.
        </p>

        <hr />

        <div className='cards'>
          {domains.map((domain, index) => (
            <Domain 
              domain={domain} 
              ethDaddy={ethDaddy} 
              provider={provider} 
              id={index + 1} 
              key={index} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
