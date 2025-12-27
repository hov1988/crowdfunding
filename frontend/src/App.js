import { useEffect, useState } from "react";
import "./App.css";

const App = () => {
  const [walletAddress, setWalletAddress] = useState(null);

  const checkIfWalletConnected = async () => {
    try {
      const { solana } = window;

      if (solana && solana.isPhantom) {
        console.log("Phantom wallet found");

        const response = await solana.connect({ onlyIfTrusted: true });
        console.log("Connected with public key:", response.publicKey.toString());

        setWalletAddress(response.publicKey.toString());
      } else {
        alert("Phantom Wallet not found! Install it from phantom.app");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const connectWallet = async () => {
    const { solana } = window;
    if (solana) {
      const response = await solana.connect();
      setWalletAddress(response.publicKey.toString());
    }
  };

  useEffect(() => {
    checkIfWalletConnected();
  }, []);

  return (
    <div className="App">
      {!walletAddress ? (
        <button onClick={connectWallet}>
          Connect Phantom Wallet
        </button>
      ) : (
        <p>Connected wallet: {walletAddress}</p>
      )}
    </div>
  );
};

export default App;
