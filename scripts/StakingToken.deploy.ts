import { deploy } from "./deployUtils";

deploy("ERC20Mock", ["StakingToken", "STK"]).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});