import { Pool } from "pg";
import { z } from "zod";

const dbEnvSchema = z.object({
  DATABASE_URL: z.string().optional()
});

const env = dbEnvSchema.parse(process.env);

// Mock implementation for when Postgres is not available
class MockPool {
  private data: any[] = [];
  private votes: any[] = [];

  async connect() {
    return {
      query: (text: string, params: any[]) => this.query(text, params),
      release: () => {}
    };
  }

  async query(text: string, params: any[] = []) {
    console.log("Mock DB Query:", text, params);
    
    if (text.includes("CREATE TABLE")) return { rows: [] };
    
    if (text.includes("SELECT * FROM comments")) {
      const pid = params[0];
      return { rows: this.data.filter(c => c.proposal_id === pid).sort((a,b) => b.is_pinned - a.is_pinned || b.created_at - a.created_at) };
    }

    if (text.includes("INSERT INTO comments")) {
      const newComment = {
        id: this.data.length + 1,
        proposal_id: params[0],
        author_address: params[1],
        content: params[2],
        parent_id: params[3],
        upvotes: 0,
        downvotes: 0,
        is_pinned: false,
        created_at: new Date().toISOString()
      };
      this.data.push(newComment);
      return { rows: [newComment] };
    }

    if (text.includes("SELECT COUNT(*) FROM comments")) {
        // Simple spam check mock
        return { rows: [{ count: "0" }] };
    }

    if (text.includes("UPDATE comments SET")) {
        const id = params[0];
        const comment = this.data.find(c => c.id == id);
        if (comment) {
            if (text.includes("upvotes = upvotes + 1")) comment.upvotes++;
            if (text.includes("downvotes = downvotes + 1")) comment.downvotes++;
            if (text.includes("is_pinned = TRUE")) {
                this.data.forEach(c => { if(c.proposal_id === comment.proposal_id) c.is_pinned = false; });
                comment.is_pinned = true;
            }
        }
        return { rows: [comment] };
    }

    if (text.includes("DELETE FROM comments")) {
        const id = params[0];
        this.data = this.data.filter(c => c.id != id);
        return { rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }
}

let activePool: any;

try {
  if (env.DATABASE_URL) {
    activePool = new Pool({ connectionString: env.DATABASE_URL });
    console.log("Using Postgres at", env.DATABASE_URL);
  } else {
    throw new Error("No DATABASE_URL provided");
  }
} catch (e) {
  console.warn("Fastify/Express: Database connection failed or not configured. Falling back to in-memory mock.");
  activePool = new MockPool();
}

export const pool = activePool;

export const initDb = async () => {
    try {
        if (activePool instanceof Pool) {
            const client = await activePool.connect();
            await client.query(`
                CREATE TABLE IF NOT EXISTS comments (
                    id SERIAL PRIMARY KEY,
                    proposal_id TEXT NOT NULL,
                    author_address TEXT NOT NULL,
                    parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
                    content TEXT NOT NULL,
                    upvotes INTEGER DEFAULT 0,
                    downvotes INTEGER DEFAULT 0,
                    is_pinned BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS comment_votes (
                    id SERIAL PRIMARY KEY,
                    comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
                    voter_address TEXT NOT NULL,
                    vote_type TEXT CHECK (vote_type IN ('upvote', 'downvote')),
                    UNIQUE(comment_id, voter_address)
                );
                CREATE TABLE IF NOT EXISTS milestone_reports (
                    id SERIAL PRIMARY KEY,
                    scholar_address TEXT NOT NULL,
                    course_id TEXT NOT NULL,
                    milestone_id INTEGER NOT NULL,
                    evidence_github TEXT,
                    evidence_ipfs_cid TEXT,
                    evidence_description TEXT,
                    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
                    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(scholar_address, course_id, milestone_id)
                );
                CREATE TABLE IF NOT EXISTS milestone_audit_log (
                    id SERIAL PRIMARY KEY,
                    report_id INTEGER NOT NULL REFERENCES milestone_reports(id) ON DELETE CASCADE,
                    validator_address TEXT NOT NULL,
                    decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
                    rejection_reason TEXT,
                    contract_tx_hash TEXT,
                    decided_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            `);
            client.release();
            console.log("Postgres database initialized");
        } else {
            console.log("In-memory mock database initialized");
        }
    } catch (err) {
        console.error("Database initialization failed, falling back to mock");
        activePool = new MockPool();
    }
};

export const db = {
  query: (text: string, params?: any[]) => activePool.query(text, params),
  connected: true
};
