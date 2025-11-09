
 import mongoose from "mongoose";
 import { DEFAULTS } from "./constants.js";
 
 const configSchema = new mongoose.Schema({
   key: { type: String, unique: true },
   value: { type: mongoose.Schema.Types.Mixed },
 }, { timestamps: true });
 
 const workerSchema = new mongoose.Schema({
   worker_id: { type: String, unique: true },
   last_heartbeat: { type: Date, default: Date.now },
 }, { timestamps: true });
 
 const controlSchema = new mongoose.Schema({
   key: { type: String, unique: true },
   value: { type: mongoose.Schema.Types.Mixed },
 }, { timestamps: true });
 
 const Config = mongoose.model("Config", configSchema);
 const Worker = mongoose.model("Worker", workerSchema);
 const Control = mongoose.model("Control", controlSchema);
 
 export const setConfig = async (key, value) => {
   await Config.updateOne({ key }, { $set: { value } }, { upsert: true });
 };
 
 export const getConfig = async (key, fallback = null) => {
   const doc = await Config.findOne({ key });
   return doc ? doc.value : fallback;
 };
 
 export const getMaxRetries = async () => {
   const v = await getConfig("max_retries", DEFAULTS.max_retries);
   return Number(v);
 };
 
 export const getBackoffBase = async () => {
   const v = await getConfig("backoff_base", DEFAULTS.backoff_base);
   return Number(v);
 };
 
 export const setStopFlag = async (stop) => {
   await Control.updateOne({ key: "stop" }, { $set: { value: !!stop } }, { upsert: true });
 };
 
 export const getStopFlag = async () => {
   const doc = await Control.findOne({ key: "stop" });
   return doc ? !!doc.value : false;
 };
 
 export const registerWorker = async (worker_id) => {
   await Worker.updateOne(
     { worker_id },
     { $setOnInsert: { worker_id }, $set: { last_heartbeat: new Date() } },
     { upsert: true }
   );
 };
 
 export const heartbeat = async (worker_id) => {
   await Worker.updateOne({ worker_id }, { $set: { last_heartbeat: new Date() } }, { upsert: true });
 };
 
 export const listWorkers = async () => {
   return Worker.find({}).sort({ last_heartbeat: -1 });
 };
 
