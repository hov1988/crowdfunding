import { useEffect, useState, useMemo } from "react";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { Program, AnchorProvider, web3, utils, BN } from "@coral-xyz/anchor";
import { Buffer } from "buffer";
import idl from "./idl.json";
import "./App.css";

window.Buffer = Buffer;

const programID = new PublicKey("53VNkdZZAGPEHRVmx9Hpvm4XcDMiqzGfZquaUQqhwv66");
const network = clusterApiUrl("devnet");
const opts = { preflightCommitment: "processed" };

const App = () => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [campaigns, setCampaigns] = useState([]);

  const connection = useMemo(() => new Connection(network, opts.preflightCommitment), []);

  const getProvider = () => {
    if (!window.solana) return null;
    return new AnchorProvider(connection, window.solana, opts);
  };

  const getProgram = () => {
    const provider = getProvider();
    if (!provider) return null;
    return new Program(idl, provider);
  };

  const getCampaignPDA = (userPublicKey, name) => {
    return PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode("campaign"),
        userPublicKey.toBuffer(),
        utils.bytes.utf8.encode(name),
      ],
      programID
    )[0];
  };

  // Новая функция для расчета PDA вклада
  const getContributorPDA = (campaignPubKey, userPublicKey) => {
    return PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode("contribution"),
        campaignPubKey.toBuffer(),
        userPublicKey.toBuffer(),
      ],
      programID
    )[0];
  };

  const createCampaign = async (name, description, targetAmountSol, durationSeconds) => {
    try {
      const program = getProgram();
      const provider = getProvider();
      const campaignPDA = getCampaignPDA(provider.publicKey, name);

      const targetAmount = new BN(targetAmountSol * web3.LAMPORTS_PER_SOL);
      const duration = new BN(durationSeconds);

      await program.methods
        .create(name, description, targetAmount, duration)
        .accounts({
          campaign: campaignPDA,
          user: provider.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      alert("Campaign created!");
      await getCampaigns();
    } catch (err) {
      console.error("Error creating campaign:", err);
    }
  };

  const getCampaigns = async () => {
    const program = getProgram();
    if (!program) return;
    try {
      const accounts = await program.account.campaign.all();
      setCampaigns(accounts);
    } catch (err) {
      console.error("Error fetching campaigns:", err);
    }
  };

  const donate = async (campaignPubKey, amount) => {
    try {
      const program = getProgram();
      const provider = getProvider();
      const amountBN = new BN(amount * web3.LAMPORTS_PER_SOL);
      
      // Находим PDA записи о вкладе
      const contributorPDA = getContributorPDA(campaignPubKey, provider.publicKey);

      await program.methods
        .donate(amountBN)
        .accounts({
          campaign: campaignPubKey,
          contributorRecord: contributorPDA,
          user: provider.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      alert("Donated!");
      await getCampaigns();
    } catch (err) {
      console.error("Error donating:", err);
    }
  };

  const refund = async (campaignPubKey) => {
    try {
      const program = getProgram();
      const provider = getProvider();
      const contributorPDA = getContributorPDA(campaignPubKey, provider.publicKey);

      await program.methods
        .refund()
        .accounts({
          campaign: campaignPubKey,
          contributorRecord: contributorPDA,
          user: provider.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      alert("Refund success!");
      await getCampaigns();
    } catch (err) {
      console.error("Error refunding:", err);
      alert("Refund failed: Check if campaign ended and target wasn't reached.");
    }
  };

  const withdraw = async (campaignPubKey, amount) => {
    try {
      const program = getProgram();
      const amountBN = new BN(amount * web3.LAMPORTS_PER_SOL);

      await program.methods
        .withdraw(amountBN)
        .accounts({
          campaign: campaignPubKey,
          admin: program.provider.publicKey,
        })
        .rpc();

      alert("Withdraw success!");
      await getCampaigns();
    } catch (err) {
      console.error("Error withdrawing:", err);
      alert("Withdraw failed: Maybe target not reached?");
    }
  };

  const connectWallet = async () => {
    const { solana } = window;
    if (solana) {
      try {
        const response = await solana.connect();
        setWalletAddress(response.publicKey.toString());
      } catch (err) {
        console.error("Wallet connection failed", err);
      }
    } else {
      alert("Solana object not found! Get a Phantom Wallet 👻");
    }
  };

  useEffect(() => {
    const onLoad = async () => {
      if (window.solana?.isPhantom) {
        const response = await window.solana.connect({ onlyIfTrusted: true });
        setWalletAddress(response.publicKey.toString());
      }
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  useEffect(() => {
    if (walletAddress) {
      getCampaigns();
    }
  }, [walletAddress]);

  return (
    <div className="App">
      {!walletAddress ? (
        <button onClick={connectWallet}>Connect Wallet</button>
      ) : (
        <div>
          <p>Wallet: {walletAddress}</p>
          {/* Пример: цель 5 SOL, длительность 1 час (3600 сек) */}
          <button onClick={() => createCampaign("Help for Cats", "Buy food", 5, 3600)}>
            Create Campaign (Goal 5 SOL)
          </button>
          
          <div style={{ marginTop: "20px" }}>
            {campaigns.map((c) => {
              const isFinished = c.account.deadline.toNumber() < Math.floor(Date.now() / 1000);
              const targetReached = c.account.amountDonated.gte(c.account.targetAmount);

              return (
                <div key={c.publicKey.toString()} style={{ border: "1px solid gray", padding: "10px", margin: "10px" }}>
                  <h4>Name: {c.account.name}</h4>
                  <p>Desc: {c.account.description}</p>
                  <p>Target: {(c.account.targetAmount.toNumber() / web3.LAMPORTS_PER_SOL).toFixed(2)} SOL</p>
                  <p>Donated: {(c.account.amountDonated.toNumber() / web3.LAMPORTS_PER_SOL).toFixed(4)} SOL</p>
                  <p>Deadline: {new Date(c.account.deadline.toNumber() * 1000).toLocaleString()}</p>
                  
                  {!isFinished && (
                    <button onClick={() => donate(c.publicKey, 0.1)}>Donate 0.1 SOL</button>
                  )}

                  {isFinished && !targetReached && (
                    <button onClick={() => refund(c.publicKey)} style={{ backgroundColor: "orange" }}>
                      Get Refund
                    </button>
                  )}

                  {walletAddress === c.account.admin.toString() && targetReached && (
                    <button onClick={() => withdraw(c.publicKey, 0.05)} style={{ backgroundColor: "green", color: "white" }}>
                      Withdraw 0.05 SOL
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;