import cluster from 'node:cluster';
import os from 'node:os';
import process from 'node:process';

// Elysia documentation "Deploy to production"
// @see https://elysiajs.com/patterns/deploy.html#cluster-mode
const multiThreads = async () => {
	if (cluster.isPrimary) {
		for (let i = 0; i < os.availableParallelism(); i++) {
			cluster.fork();
		}
	} else {
		await import('./server');
		console.log(`Worker ${process.pid} started`);
	}
};

const singleThread = async () => {
	await import('./server');
};

const serve = Bun.env.NODE_ENV === 'development' ? singleThread : multiThreads;

await serve();
