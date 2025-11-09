
 import { exec } from "child_process";
 import { promisify } from "util";
 
 export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
 
 export const backoffDelayMs = (base, attempts) => Math.pow(base, attempts) * 1000;
 
 export const execAsync = promisify(exec);

