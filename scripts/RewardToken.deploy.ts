import { deploy } from "./deployUtils";

deploy("ERC20Mock", ["RewardToken", "RTK"]).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
