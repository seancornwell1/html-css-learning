import { parentPort, workerData } from 'node:worker_threads';
import { runOne, type RunJob } from './run';

const jobs = workerData as RunJob[];
for (const job of jobs) parentPort?.postMessage(runOne(job));
