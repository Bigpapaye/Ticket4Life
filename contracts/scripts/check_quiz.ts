import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const quizAddr = process.env.NEXT_PUBLIC_QUIZ_ADDRESS || process.env.QUIZ_ADDRESS;
  if (!quizAddr) throw new Error("Missing QUIZ_ADDRESS");
  const Quiz = await ethers.getContractFactory("QuizManager");
  const quiz = Quiz.attach(quizAddr);

  console.log("Quiz:", quizAddr);
  const has = await quiz.hasQuiz();
  console.log("hasQuiz:", has);
  const [title, question, options, active] = await quiz.get();
  console.log("active:", active);
  console.log("title:", title);
  console.log("options:", options);
  const eligibleCount = await quiz.eligibleCount();
  console.log("eligibleCount:", eligibleCount.toString());
  const [participants, correct] = await quiz.getStats();
  console.log("stats participants:", participants.toString(), "correct:", correct.toString());
}

main().catch((e)=>{console.error(e); process.exit(1)});
