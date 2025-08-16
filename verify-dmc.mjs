#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const data = JSON.parse(await readFile("./dmc.json", "utf8"));
console.log("Total:", data.length);
const find = (code) => data.find((d) => String(d.code).toLowerCase() === String(code).toLowerCase());
console.log("Ecru:", find("Ecru"));
console.log("B5200:", find("B5200"));
console.log("310:", find("310"));
