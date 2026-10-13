const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const MYSQL_PORT = 3307;
const MYSQL_EXE = 'c:\\wamp\\bin\\mysql\\mysql5.1.36\\bin\\mysqld.exe';
const MYSQL_INI = 'c:\\wamp\\bin\\mysql\\mysql5.1.36\\my.ini';

function checkPort(port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(800);
        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        socket.on('error', () => {
            socket.destroy();
            resolve(false);
        });
        socket.connect(port, '127.0.0.1');
    });
}

async function waitForPort(port, maxAttempts = 15) {
    for (let i = 0; i < maxAttempts; i++) {
        const isOpen = await checkPort(port);
        if (isOpen) return true;
        await new Promise(r => setTimeout(r, 1000));
    }
    return false;
}

async function main() {
    console.log('--- Starting Smart City System Services ---');

    let mysqlProcess = null;
    const isMysqlRunning = await checkPort(MYSQL_PORT);

    if (isMysqlRunning) {
        console.log(`✅ MySQL is already running on port ${MYSQL_PORT}.`);
    } else {
        console.log(`⏳ Starting MySQL Server on port ${MYSQL_PORT}...`);
        mysqlProcess = spawn(MYSQL_EXE, [
            `--defaults-file=${MYSQL_INI}`,
            '--console'
        ], {
            stdio: ['ignore', 'pipe', 'pipe']
        });

        mysqlProcess.on('error', (err) => {
            console.error('Failed to start MySQL child process:', err.message);
        });

        const ready = await waitForPort(MYSQL_PORT);
        if (ready) {
            console.log(`✅ MySQL started and ready on port ${MYSQL_PORT}.`);
        } else {
            console.warn(`⚠️ MySQL port ${MYSQL_PORT} did not respond within timeout.`);
        }
    }

    // Now start the Express server
    console.log('⏳ Starting Express Application...');
    require('../server');

    // Handle clean shutdown
    const cleanup = () => {
        if (mysqlProcess) {
            console.log('\nStopping MySQL background process...');
            mysqlProcess.kill();
        }
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}

main().catch(console.error);

