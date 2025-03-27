import app from './app';
import { config } from './core/config/config';
import http from 'http';
import { WebSocketService } from './whatsapp_api/websocket.service';
import { container } from './core/di/di.container';
import cron from 'node-cron';
import { AuthMySQLDataSource } from './data/data_source/mysql/auth.mysql.data-source';

const server = http.createServer(app);

const webSocketService = container.get(WebSocketService);

webSocketService.attachToServer(server);

const authMySQLDataSource = new AuthMySQLDataSource;
cron.schedule('0 0 * * *', async () => {
    console.log("Running daily refresh token check...");
    await authMySQLDataSource.checkRefreshTokens();

});

server.listen(config.port, () => {
    console.log(`Server listening on port ${config.port}`);
});

const gracefulShutdown = () => {
    console.log('Shutting down server...');
    webSocketService.shutdown();
    server.close(() => {
        console.log('Server shut down gracefully');
        process.exit(0);
    });
};

// Handle termination signals
process.on('SIGINT', gracefulShutdown);  // CTRL + C
process.on('SIGTERM', gracefulShutdown); // Used by Docker, PM2, Kubernetes
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    gracefulShutdown();
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown();
});