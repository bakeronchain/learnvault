-- ============================================================
-- Seed data: 2 sample courses with lessons, milestones & quizzes
-- ============================================================

-- Courses
INSERT INTO courses (slug, title, description, difficulty, track, cover_image_url, lrn_reward, published_at)
VALUES
  (
    'intro-to-stellar',
    'Introduction to Stellar',
    'Learn the fundamentals of the Stellar network: accounts, assets, transactions, and the Stellar Consensus Protocol.',
    'beginner',
    'stellar',
    '/assets/brand/covers/cover-intro-stellar.svg',
    50.0000000,
    NOW()
  ),
  (
    'soroban-smart-contracts',
    'Soroban Smart Contracts',
    'Build and deploy smart contracts on Stellar using Soroban. Covers Rust basics, contract storage, and cross-contract calls.',
    'intermediate',
    'soroban',
    '/assets/brand/covers/cover-soroban.svg',
    120.0000000,
    NOW()
  ),
  (
    'defi-fundamentals',
    'DeFi Fundamentals',
    'Understand the core concepts of decentralized finance: swaps, liquidity pools, yield farming, and protocol risks.',
    'beginner',
    'defi',
    '/assets/brand/covers/cover-defi.svg',
    75.0000000,
    NOW()
  )
ON CONFLICT (slug) DO NOTHING;

-- Lessons for course 1 (intro-to-stellar)
INSERT INTO lessons (course_id, order_index, title, content_markdown, estimated_minutes)
SELECT c.id, 1, 'What is Stellar?',
  E'## What is Stellar?\n\nStellar is an open-source, decentralized payment protocol that enables fast, low-cost cross-border transactions.\n\n### Key Concepts\n- **Lumens (XLM)**: The native asset used to pay transaction fees.\n- **Accounts**: Identified by a public key; must hold a minimum XLM balance.\n- **Anchors**: Entities that bridge fiat and crypto on the network.',
  15
FROM courses c WHERE c.slug = 'intro-to-stellar'
ON CONFLICT (course_id, order_index) DO NOTHING;

INSERT INTO lessons (course_id, order_index, title, content_markdown, estimated_minutes)
SELECT c.id, 2, 'Accounts and Keypairs',
  E'## Accounts and Keypairs\n\nEvery Stellar account is identified by a **public key** (G...) and controlled by a **secret key** (S...).\n\n```bash\n# Generate a keypair with the Stellar CLI\nstellar keys generate --global alice\n```\n\nAccounts must be **funded** with at least 1 XLM (the base reserve) before they can transact.',
  20
FROM courses c WHERE c.slug = 'intro-to-stellar'
ON CONFLICT (course_id, order_index) DO NOTHING;

INSERT INTO lessons (course_id, order_index, title, content_markdown, estimated_minutes)
SELECT c.id, 3, 'Sending Your First Transaction',
  E'## Sending Your First Transaction\n\nTransactions on Stellar are atomic bundles of **operations**. The most common operation is `Payment`.\n\n### Steps\n1. Build the transaction with the SDK.\n2. Sign it with your secret key.\n3. Submit to Horizon.\n\nFees are tiny — typically 100 stroops (0.00001 XLM).',
  25
FROM courses c WHERE c.slug = 'intro-to-stellar'
ON CONFLICT (course_id, order_index) DO NOTHING;

-- Lessons for course 2 (soroban-smart-contracts)
INSERT INTO lessons (course_id, order_index, title, content_markdown, estimated_minutes)
SELECT c.id, 1, 'Soroban Overview',
  E'## Soroban Overview\n\nSoroban is Stellar''s smart contract platform, built with Rust and WebAssembly.\n\n### Why Soroban?\n- Predictable, metered execution costs.\n- First-class support for Stellar assets.\n- Designed for real-world financial use cases.',
  20
FROM courses c WHERE c.slug = 'soroban-smart-contracts'
ON CONFLICT (course_id, order_index) DO NOTHING;

INSERT INTO lessons (course_id, order_index, title, content_markdown, estimated_minutes)
SELECT c.id, 2, 'Writing Your First Contract',
  E'## Writing Your First Contract\n\n```rust\n#![no_std]\nuse soroban_sdk::{contract, contractimpl, Env, Symbol, symbol_short};\n\n#[contract]\npub struct HelloContract;\n\n#[contractimpl]\nimpl HelloContract {\n    pub fn hello(env: Env, to: Symbol) -> Symbol {\n        symbol_short!("Hello")\n    }\n}\n```\n\nCompile with `stellar contract build` and deploy to testnet.',
  30
FROM courses c WHERE c.slug = 'soroban-smart-contracts'
ON CONFLICT (course_id, order_index) DO NOTHING;

INSERT INTO lessons (course_id, order_index, title, content_markdown, estimated_minutes)
SELECT c.id, 3, 'Contract Storage',
  E'## Contract Storage\n\nSoroban provides three storage tiers:\n\n| Tier | TTL | Use case |\n|------|-----|----------|\n| **Persistent** | Long-lived | User balances, config |\n| **Temporary** | Short-lived | Nonces, session data |\n| **Instance** | Contract lifetime | Contract metadata |\n\nAlways choose the cheapest tier that meets your durability needs.',
  25
FROM courses c WHERE c.slug = 'soroban-smart-contracts'
ON CONFLICT (course_id, order_index) DO NOTHING;

-- Lessons for course 3 (defi-fundamentals)
INSERT INTO lessons (course_id, order_index, title, content_markdown, estimated_minutes)
SELECT c.id, 1, 'What is DeFi?',
  E'## What is DeFi?\n\nDecentralized Finance (DeFi) refers to financial services built on blockchain networks without intermediaries.\n\n### Key Characteristics\n- **Transparent**: All transactions are visible on-chain.\n- **Permissionless**: Anyone can participate without KYC.\n- **Composable**: Protocols can interact with each other (money legos).\n- **Non-custodial**: Users control their own assets.',
  18
FROM courses c WHERE c.slug = 'defi-fundamentals'
ON CONFLICT (course_id, order_index) DO NOTHING;

INSERT INTO lessons (course_id, order_index, title, content_markdown, estimated_minutes)
SELECT c.id, 2, 'Automated Market Makers (AMMs)',
  E'## Automated Market Makers (AMMs)\n\nAMMs are smart contracts that enable peer-to-peer trading without order books.\n\n### How They Work\n- Users deposit token pairs into liquidity pools.\n- Traders swap tokens against the pool using the formula: x * y = k.\n- Liquidity providers earn a portion of trading fees.\n\n### Popular AMMs\n- Uniswap (Ethereum)\n- Curve (Stablecoins)\n- Stellar Swap (Stellar)',
  22
FROM courses c WHERE c.slug = 'defi-fundamentals'
ON CONFLICT (course_id, order_index) DO NOTHING;

INSERT INTO lessons (course_id, order_index, title, content_markdown, estimated_minutes)
SELECT c.id, 3, 'Yield Farming and Risk',
  E'## Yield Farming and Risk\n\nYield farming involves depositing assets into DeFi protocols to earn returns.\n\n### Common Risks\n- **Impermanent Loss**: Price divergence between pooled assets.\n- **Smart Contract Risk**: Bugs or exploits in protocol code.\n- **Liquidation Risk**: Collateral value drops below loan threshold.\n- **Regulatory Risk**: Changing legal landscape.\n\nAlways do your own research (DYOR) before participating.',
  25
FROM courses c WHERE c.slug = 'defi-fundamentals'
ON CONFLICT (course_id, order_index) DO NOTHING;

-- Milestones for course 1
INSERT INTO milestones (course_id, lesson_id, on_chain_milestone_id, lrn_amount)
SELECT c.id, l.id, 1, 15.0000000
FROM courses c
JOIN lessons l ON l.course_id = c.id AND l.order_index = 1
WHERE c.slug = 'intro-to-stellar'
ON CONFLICT (course_id, on_chain_milestone_id) DO NOTHING;

INSERT INTO milestones (course_id, lesson_id, on_chain_milestone_id, lrn_amount)
SELECT c.id, l.id, 2, 15.0000000
FROM courses c
JOIN lessons l ON l.course_id = c.id AND l.order_index = 2
WHERE c.slug = 'intro-to-stellar'
ON CONFLICT (course_id, on_chain_milestone_id) DO NOTHING;

INSERT INTO milestones (course_id, lesson_id, on_chain_milestone_id, lrn_amount)
SELECT c.id, l.id, 3, 20.0000000
FROM courses c
JOIN lessons l ON l.course_id = c.id AND l.order_index = 3
WHERE c.slug = 'intro-to-stellar'
ON CONFLICT (course_id, on_chain_milestone_id) DO NOTHING;

-- Milestones for course 2
INSERT INTO milestones (course_id, lesson_id, on_chain_milestone_id, lrn_amount)
SELECT c.id, l.id, 1, 30.0000000
FROM courses c
JOIN lessons l ON l.course_id = c.id AND l.order_index = 1
WHERE c.slug = 'soroban-smart-contracts'
ON CONFLICT (course_id, on_chain_milestone_id) DO NOTHING;

INSERT INTO milestones (course_id, lesson_id, on_chain_milestone_id, lrn_amount)
SELECT c.id, l.id, 2, 45.0000000
FROM courses c
JOIN lessons l ON l.course_id = c.id AND l.order_index = 2
WHERE c.slug = 'soroban-smart-contracts'
ON CONFLICT (course_id, on_chain_milestone_id) DO NOTHING;

INSERT INTO milestones (course_id, lesson_id, on_chain_milestone_id, lrn_amount)
SELECT c.id, l.id, 3, 45.0000000
FROM courses c
JOIN lessons l ON l.course_id = c.id AND l.order_index = 3
WHERE c.slug = 'soroban-smart-contracts'
ON CONFLICT (course_id, on_chain_milestone_id) DO NOTHING;

-- Milestones for course 3 (defi-fundamentals)
INSERT INTO milestones (course_id, lesson_id, on_chain_milestone_id, lrn_amount)
SELECT c.id, l.id, 1, 20.0000000
FROM courses c
JOIN lessons l ON l.course_id = c.id AND l.order_index = 1
WHERE c.slug = 'defi-fundamentals'
ON CONFLICT (course_id, on_chain_milestone_id) DO NOTHING;

INSERT INTO milestones (course_id, lesson_id, on_chain_milestone_id, lrn_amount)
SELECT c.id, l.id, 2, 25.0000000
FROM courses c
JOIN lessons l ON l.course_id = c.id AND l.order_index = 2
WHERE c.slug = 'defi-fundamentals'
ON CONFLICT (course_id, on_chain_milestone_id) DO NOTHING;

INSERT INTO milestones (course_id, lesson_id, on_chain_milestone_id, lrn_amount)
SELECT c.id, l.id, 3, 30.0000000
FROM courses c
JOIN lessons l ON l.course_id = c.id AND l.order_index = 3
WHERE c.slug = 'defi-fundamentals'
ON CONFLICT (course_id, on_chain_milestone_id) DO NOTHING;

-- Quizzes
INSERT INTO quizzes (lesson_id, passing_score)
SELECT l.id, 70
FROM lessons l
JOIN courses c ON c.id = l.course_id
WHERE c.slug = 'intro-to-stellar' AND l.order_index = 1
ON CONFLICT (lesson_id) DO NOTHING;

INSERT INTO quizzes (lesson_id, passing_score)
SELECT l.id, 70
FROM lessons l
JOIN courses c ON c.id = l.course_id
WHERE c.slug = 'intro-to-stellar' AND l.order_index = 2
ON CONFLICT (lesson_id) DO NOTHING;

INSERT INTO quizzes (lesson_id, passing_score)
SELECT l.id, 70
FROM lessons l
JOIN courses c ON c.id = l.course_id
WHERE c.slug = 'soroban-smart-contracts' AND l.order_index = 1
ON CONFLICT (lesson_id) DO NOTHING;

INSERT INTO quizzes (lesson_id, passing_score)
SELECT l.id, 80
FROM lessons l
JOIN courses c ON c.id = l.course_id
WHERE c.slug = 'soroban-smart-contracts' AND l.order_index = 2
ON CONFLICT (lesson_id) DO NOTHING;

INSERT INTO quizzes (lesson_id, passing_score)
SELECT l.id, 70
FROM lessons l
JOIN courses c ON c.id = l.course_id
WHERE c.slug = 'defi-fundamentals' AND l.order_index = 1
ON CONFLICT (lesson_id) DO NOTHING;

INSERT INTO quizzes (lesson_id, passing_score)
SELECT l.id, 75
FROM lessons l
JOIN courses c ON c.id = l.course_id
WHERE c.slug = 'defi-fundamentals' AND l.order_index = 2
ON CONFLICT (lesson_id) DO NOTHING;

INSERT INTO quizzes (lesson_id, passing_score)
SELECT l.id, 75
FROM lessons l
JOIN courses c ON c.id = l.course_id
WHERE c.slug = 'defi-fundamentals' AND l.order_index = 3
ON CONFLICT (lesson_id) DO NOTHING;

-- Quiz questions: intro-to-stellar lesson 1
INSERT INTO quiz_questions (quiz_id, question_text, options, correct_index, explanation)
SELECT q.id,
  'What is the native asset of the Stellar network?',
  '["Bitcoin (BTC)", "Ether (ETH)", "Lumens (XLM)", "USDC"]'::jsonb,
  2,
  'Lumens (XLM) is the native asset of Stellar, used to pay transaction fees and maintain minimum account balances.'
FROM quizzes q
JOIN lessons l ON l.id = q.lesson_id
JOIN courses c ON c.id = l.course_id
WHERE c.slug = 'intro-to-stellar' AND l.order_index = 1;

INSERT INTO quiz_questions (quiz_id, question_text, options, correct_index, explanation)
SELECT q.id,
  'What role do Anchors play on the Stellar network?',
  '["They validate transactions", "They bridge fiat currency and crypto assets", "They store private keys", "They mine new XLM"]'::jsonb,
  1,
  'Anchors are trusted entities that issue assets on Stellar and allow users to deposit/withdraw fiat or other off-chain assets.'
FROM quizzes q
JOIN lessons l ON l.id = q.lesson_id
JOIN courses c ON c.id = l.course_id
WHERE c.slug = 'intro-to-stellar' AND l.order_index = 1;

-- Quiz questions: intro-to-stellar lesson 2
INSERT INTO quiz_questions (quiz_id, question_text, options, correct_index, explanation)
SELECT q.id,
  'What prefix does a Stellar public key start with?',
  '["S", "G", "0x", "pk_"]'::jsonb,
  1,
  'Stellar public keys (account IDs) always start with "G". Secret keys start with "S".'
FROM quizzes q
JOIN lessons l ON l.id = q.lesson_id
JOIN courses c ON c.id = l.course_id
WHERE c.slug = 'intro-to-stellar' AND l.order_index = 2;

-- Quiz questions: soroban lesson 1
INSERT INTO quiz_questions (quiz_id, question_text, options, correct_index, explanation)
SELECT q.id,
  'What language is used to write Soroban smart contracts?',
  '["Solidity", "Go", "Rust", "TypeScript"]'::jsonb,
  2,
  'Soroban contracts are written in Rust and compiled to WebAssembly (WASM).'
FROM quizzes q
JOIN lessons l ON l.id = q.lesson_id
JOIN courses c ON c.id = l.course_id
WHERE c.slug = 'soroban-smart-contracts' AND l.order_index = 1;

INSERT INTO quiz_questions (quiz_id, question_text, options, correct_index, explanation)
SELECT q.id,
  'What runtime format does Soroban use to execute contracts?',
  '["EVM bytecode", "JVM bytecode", "WebAssembly (WASM)", "LLVM IR"]'::jsonb,
  2,
  'Soroban compiles Rust contracts to WebAssembly, which runs in a sandboxed, metered environment on the Stellar network.'
FROM quizzes q
JOIN lessons l ON l.id = q.lesson_id
JOIN courses c ON c.id = l.course_id
WHERE c.slug = 'soroban-smart-contracts' AND l.order_index = 1;

-- Quiz questions: soroban lesson 2
INSERT INTO quiz_questions (quiz_id, question_text, options, correct_index, explanation)
SELECT q.id,
  'Which macro marks a Soroban struct as a deployable contract?',
  '["#[contractimpl]", "#[contract]", "#[soroban_contract]", "#[deploy]"]'::jsonb,
  1,
  'The #[contract] attribute macro marks a struct as a Soroban contract entry point. #[contractimpl] is used on the impl block.'
FROM quizzes q
JOIN lessons l ON l.id = q.lesson_id
JOIN courses c ON c.id = l.course_id
WHERE c.slug = 'soroban-smart-contracts' AND l.order_index = 2;

-- Quiz questions: defi-fundamentals lesson 1
INSERT INTO quiz_questions (quiz_id, question_text, options, correct_index, explanation)
SELECT q.id,
  'What does DeFi stand for?',
  '["Decentralized Finance", "Digital Finance", "Distributed Financial Services", "Decentralized Funding"]'::jsonb,
  0,
  'DeFi stands for Decentralized Finance, referring to financial services built on blockchain without intermediaries.'
FROM quizzes q
JOIN lessons l ON l.id = q.lesson_id
JOIN courses c ON c.id = l.course_id
WHERE c.slug = 'defi-fundamentals' AND l.order_index = 1;

INSERT INTO quiz_questions (quiz_id, question_text, options, correct_index, explanation)
SELECT q.id,
  'Which of the following is NOT a key characteristic of DeFi?',
  '["Transparent", "Permissionless", "Centralized governance", "Non-custodial"]'::jsonb,
  2,
  'DeFi is decentralized and permissionless. Centralized governance is contrary to DeFi principles.'
FROM quizzes q
JOIN lessons l ON l.id = q.lesson_id
JOIN courses c ON c.id = l.course_id
WHERE c.slug = 'defi-fundamentals' AND l.order_index = 1;

-- Quiz questions: defi-fundamentals lesson 2
INSERT INTO quiz_questions (quiz_id, question_text, options, correct_index, explanation)
SELECT q.id,
  'What is the core formula used by AMMs?',
  '["x + y = k", "x * y = k", "x / y = k", "x - y = k"]'::jsonb,
  1,
  'The constant product formula x * y = k is the foundation of most AMMs like Uniswap.'
FROM quizzes q
JOIN lessons l ON l.id = q.lesson_id
JOIN courses c ON c.id = l.course_id
WHERE c.slug = 'defi-fundamentals' AND l.order_index = 2;

INSERT INTO quiz_questions (quiz_id, question_text, options, correct_index, explanation)
SELECT q.id,
  'Who earns fees in an AMM?',
  '["Traders", "Liquidity providers", "Protocol developers", "Validators"]'::jsonb,
  1,
  'Liquidity providers earn a portion of trading fees proportional to their share of the pool.'
FROM quizzes q
JOIN lessons l ON l.id = q.lesson_id
JOIN courses c ON c.id = l.course_id
WHERE c.slug = 'defi-fundamentals' AND l.order_index = 2;

-- Quiz questions: defi-fundamentals lesson 3
INSERT INTO quiz_questions (quiz_id, question_text, options, correct_index, explanation)
SELECT q.id,
  'What is impermanent loss?',
  '["Loss from trading fees", "Price divergence between pooled assets", "Loss from smart contract bugs", "Loss from liquidation"]'::jsonb,
  1,
  'Impermanent loss occurs when the price ratio of pooled assets diverges, resulting in lower returns than holding the assets separately.'
FROM quizzes q
JOIN lessons l ON l.id = q.lesson_id
JOIN courses c ON c.id = l.course_id
WHERE c.slug = 'defi-fundamentals' AND l.order_index = 3;

INSERT INTO quiz_questions (quiz_id, question_text, options, correct_index, explanation)
SELECT q.id,
  'Which risk is specific to lending protocols?',
  '["Impermanent loss", "Liquidation risk", "Slippage", "Front-running"]'::jsonb,
  1,
  'Liquidation risk occurs when collateral value drops below the loan threshold, triggering forced asset sales.'
FROM quizzes q
JOIN lessons l ON l.id = q.lesson_id
JOIN courses c ON c.id = l.course_id
WHERE c.slug = 'defi-fundamentals' AND l.order_index = 3;
