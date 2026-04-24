CREATE TABLE IF NOT EXISTS wiki_pages (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial wiki content
INSERT INTO wiki_pages (slug, title, content, category) VALUES
(
    'stellar-basics',
    'Stellar Basics',
    '# Stellar Basics\n\nStellar is a decentralized, fast, and energy-efficient network for currencies and payments. It allows you to create, send, and trade digital representations of all forms of money.\n\n## Key Concepts\n\n### Accounts\nEvery account on Stellar is identified by a public key (starting with G) and controlled by a secret key (starting with S).\n\n### Assets\nStellar can handle any type of asset, from XLM (Lumens) to stablecoins like USDC.\n\n### Transactions\nTransactions are atomic and take 3-5 seconds to confirm. Fees are extremely low (0.00001 XLM default).',
    'Stellar'
),
(
    'soroban-intro',
    'Introduction to Soroban',
    '# Introduction to Soroban\n\nSoroban is the smart contract platform for the Stellar network. It is designed to be batteries-included, high-performance, and developer-friendly.\n\n## Why Soroban?\n\n- **Rust-based**: Use the power and safety of Rust.\n- **WASM**: Contracts compile to WebAssembly.\n- **Batteries-included**: Built-in support for events, multi-auth, and more.\n- **Scalable**: Designed to handle high throughput with predictable costs.',
    'Soroban'
),
(
    'learnvault-how-to',
    'How to use LearnVault',
    '# How to use LearnVault\n\nLearnVault is a decentralized learning platform where your progress is your proof of work.\n\n## Getting Started\n\n1. **Connect Wallet**: Use a Stellar wallet like Freighter.\n2. **Enroll in Courses**: Browse our catalog and start a track.\n3. **Complete Milestones**: Finish lessons and quizzes to earn LRN tokens.\n4. **Governance**: Use your LRN tokens to vote on DAO proposals.',
    'Platform'
)
ON CONFLICT (slug) DO NOTHING;
