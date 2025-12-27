# Solana Crowdfunding dApp

A decentralized crowdfunding platform built on the Solana blockchain using the **Anchor Framework**. This project allows users to create fundraising campaigns with unique names, donate SOL to support causes, and enables campaign creators to withdraw funds securely.

## 🚀 Features

- **Decentralized Campaigns**: Create and manage campaigns directly on the blockchain.
- **PDA (Program Derived Address) Security**: Each campaign account is uniquely derived from the creator's wallet and the campaign name.
- **Real-time SOL Donations**: Integrated with the Solana System Program for secure SOL transfers.
- **Admin-only Withdrawals**: Built-in security checks ensure only the campaign creator can access funds.
- **Rent Exemption Protection**: Withdrawal logic automatically protects the minimum balance required to keep the account active on-chain.

## 🛠️ Tech Stack

- **Blockchain**: Solana
- **Smart Contract Framework**: Anchor (Rust)
- **Frontend**: React.js
- **Libraries**: `@coral-xyz/anchor`, `@solana/web3.js`

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- [Rust & Cargo](https://rustup.rs/)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- [Anchor CLI](https://www.anchor-lang.com/docs/installation)
- [Node.js (v16+)](https://nodejs.org/)
- [Phantom Wallet](https://phantom.app/) (set to **Devnet**)

---

## 🔧 Installation & Setup

### 1. Smart Contract (Program)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/hov1988/solana-crowdfunding.git
   cd solana-crowdfunding