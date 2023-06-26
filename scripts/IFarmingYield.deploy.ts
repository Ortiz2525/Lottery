import { deploy } from "./deployUtils";

deploy("IFarmingYield", [""]).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
