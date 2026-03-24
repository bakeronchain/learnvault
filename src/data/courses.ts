export interface Course {
  title: string;
  track: string;
  duration: string;
  level: "Beginner" | "Intermediate" | "Advanced";
}

export const courses: Course[] = [
  { title: "Web3 Fundamentals", track: "Web3", duration: "4 weeks", level: "Beginner" },
  { title: "Smart Contract Engineering", track: "Solidity", duration: "6 weeks", level: "Intermediate" },
  { title: "DeFi Protocols", track: "DeFi", duration: "5 weeks", level: "Intermediate" },
  { title: "Stellar & Soroban Basics", track: "Stellar", duration: "3 weeks", level: "Beginner" },
]
