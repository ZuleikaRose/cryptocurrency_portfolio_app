// Spanish dictionary, one file per area of the app. Keys are the English UI text.
import { account } from "./account.js";
import { coin } from "./coin.js";
import { help } from "./help.js";
import { market } from "./market.js";
import { portfolio } from "./portfolio.js";
import { research } from "./research.js";
import { settings } from "./settings.js";
import { shell } from "./shell.js";

export const es = { ...shell, ...market, ...coin, ...research, ...portfolio, ...settings, ...account, ...help };
