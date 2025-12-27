import { useEffect, useState } from "react";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { Program, AnchorProvider, web3, BN } from "@coral-xyz/anchor"; // Импортируем BN и web3
import { Buffer } from "buffer";
import idl from "./idl.json";
import "./App.css";

// Фикс для работы Buffer в браузере
window.Buffer = Buffer;

const { SystemProgram, LAMPORTS_PER_SOL } = web3; // Вытаскиваем нужные константы
const programID = new PublicKey(idl.address);
const network = clusterApiUrl("devnet");
const opts = { preflightCommitment: "processed" };

const App = () => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [campaigns, setCampaigns] = useState([]);

  const checkIfWalletConnected = async () => {
    try {
      const { solana } = window;
      if (solana && solana.isPhantom) {
        const response = await solana.connect({ onlyIfTrusted: true });
        setWalletAddress(response.publicKey.toString());
        await getCampaigns();
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

  const getProgram = () => {
    const connection = new Connection(network, opts.preflightCommitment);
    const provider = new AnchorProvider(connection, window.solana, opts);
    return new Program(idl, provider);
  };

  // 1. Создание кампании
  const createCampaign = async (name, description) => {
    try {
      const program = getProgram();
      const campaignKeypair = web3.Keypair.generate();

      await program.methods
        .create(name, description)
        .accounts({
          campaign: campaignKeypair.publicKey,
          user: program.provider.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([campaignKeypair])
        .rpc();

      alert("Campaign created!");
      getCampaigns();
    } catch (err) {
      console.error("Error creating campaign:", err);
    }
  };

  // 2. Получение списка кампаний
  const getCampaigns = async () => {
    try {
      const program = getProgram();
      const accounts = await program.account.campaign.all();
      setCampaigns(accounts);
    } catch (err) {
      console.error("Error fetching campaigns:", err);
    }
  };

  // 3. Донат
  const donate = async (campaignPubKey, amount) => {
    try {
      const program = getProgram();
      // Испольуем BN напрямую, как импортировали выше
      const amountBN = new BN(amount * LAMPORTS_PER_SOL);

      await program.methods
        .donate(amountBN)
        .accounts({
          campaign: campaignPubKey,
          user: program.provider.publicKey,
        })
        .rpc();

      alert("Donated!");
      getCampaigns();
    } catch (err) {
      console.error("Error donating:", err);
    }
  };

  // 4. Вывод средств
  const withdraw = async (campaignPubKey, amount) => {
    try {
      const program = getProgram();
      const amountBN = new BN(amount * LAMPORTS_PER_SOL);

      await program.methods
        .withdraw(amountBN)
        .accounts({
          campaign: campaignPubKey,
          user: program.provider.publicKey,
        })
        .rpc();

      alert("Withdraw success!");
      getCampaigns();
    } catch (err) {
      console.error("Error withdrawing:", err);
    }
  };

  useEffect(() => {
    checkIfWalletConnected();
  }, []);

  return (
    <div className="App">
      {!walletAddress ? (
        <button onClick={connectWallet}>Connect Phantom Wallet</button>
      ) : (
        <div>
          <p>Connected: {walletAddress}</p>
          <div style={{ marginBottom: "20px" }}>
            <button onClick={() => createCampaign("My Campaign", "Please help!")}>
              Create New Campaign
            </button>
            <button onClick={getCampaigns}>Refresh List</button>
          </div>

          <div className="list">
            {campaigns.map((c) => (
              <div key={c.publicKey.toString()} style={{ border: "1px solid #ccc", padding: "10px", margin: "10px" }}>
                <h3>{c.account.name}</h3>
                <p>{c.account.description}</p>
                <p>Raised: {(c.account.amountDonated.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL</p>
                
                <button onClick={() => donate(c.publicKey, 0.01)}>Donate 0.01 SOL</button>
                
                {walletAddress === c.account.admin.toString() && (
                  <button onClick={() => withdraw(c.publicKey, 0.01)} style={{ marginLeft: "10px", color: "red" }}>
                    Withdraw 0.01 SOL
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;