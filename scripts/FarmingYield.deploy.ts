import { deploy } from "./deployUtils";

deploy("FarmingYield", ["10", "100" ,"3600"]).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
