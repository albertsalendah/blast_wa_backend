import { WebSocketService } from "../../whatsapp_api/websocket.service";


// Pause message by setting its status to 'paused'
export function pauseMessage(id: string, messageStatus: Map<string, 'active' | 'paused' | 'canceled'>) {
    console.log('Current messages being tracked:', Array.from(messageStatus.keys()));

    if (messageStatus.has(id)) {
        messageStatus.set(id, 'paused');
        console.log(`⏸️ Message ${id} is paused.`);
    } else {
        console.log(`⚠️ Message ${id} not found.`);
    }
}

// Resume message by setting its status to 'active'
export function resumeMessage(id: string, messageStatus: Map<string, 'active' | 'paused' | 'canceled'>, messageQueues: Map<string, any[]>, processNextInQueue: (noWA: string) => void) {
    console.log('Current messages being tracked:', Array.from(messageStatus.keys()));

    if (messageStatus.has(id)) {
        if (messageStatus.get(id) === 'paused') { // Ensure it was actually paused
            messageStatus.set(id, 'active');
            console.log(`▶️ Message ${id} is resumed.`);

            // Find the `noWA` associated with this message
            for (const [noWA, queue] of messageQueues.entries()) {
                if (queue.some(req => req.id === id)) {
                    processNextInQueue(noWA);
                    break; // Ensure only the correct queue resumes
                }
            }
        } else {
            console.log(`⚠️ Message ${id} is not paused.`);
        }
    } else {
        console.log(`⚠️ Message ${id} not found.`);
    }
}

// Cancel message by setting its status to 'canceled'
export function cancelMessage(id: string, messageStatus: Map<string, 'active' | 'paused' | 'canceled'>) {
    console.log('Current messages being tracked:', Array.from(messageStatus.keys()));

    if (messageStatus.has(id)) {
        messageStatus.set(id, 'canceled');
    } else {
        console.log(`⚠️ Message ${id} not found.`);
    }
}

/**
* Tracks a paused message for a user
*/
export function trackPausedMessage(clientId: string, messageID: string, pausedMessages: Map<string, { messageID: string; timestamp: number }[]>) {
    if (!pausedMessages.has(clientId)) {
        pausedMessages.set(clientId, []);
    }
    pausedMessages.get(clientId)!.push({ messageID, timestamp: Date.now() });
    console.log(`[WebSocket] Message ${messageID} paused for client ${clientId}`);
}

/**
    * Removes a paused message when resumed or canceled
    */
export function removePausedMessage(clientId: string, messageID: string, pausedMessages: Map<string, { messageID: string; timestamp: number }[]>) {
    const messages = pausedMessages.get(clientId);
    if (messages) {
        pausedMessages.set(clientId, messages.filter((msg) => msg.messageID !== messageID));
    }
}

/**
 * Restores paused messages for a reconnected client
 */
export function restorePausedMessages(clientId: string, pausedMessages: Map<string, { messageID: string; timestamp: number }[]>, messagesProgress: Map<string, MessageProgress>, webSocketService: WebSocketService) {

    if (pausedMessages.has(clientId)) {
        const pausedMessage = pausedMessages.get(clientId)!;
        console.log(`[WebSocket] Restoring ${pausedMessage.length} paused messages for client ${clientId}`);
        pausedMessage.forEach(element => {
            const message = messagesProgress.get(element.messageID)
            if (message) {
                message.isPause = true;
                webSocketService.sendToClient(clientId, message);
            }
        });
    }
}

/**
    * Cleans up messages that exceeded the reconnection timeout
    */
export function cleanupExpiredMessages(pausedMessages: Map<string, { messageID: string; timestamp: number }[]>, reconnectTimeout: number, messagesProgress: Map<string, MessageProgress>,) {
    const now = Date.now();
    pausedMessages.forEach((messages, clientId) => {
        const validMessages = messages.filter((msg) => now - msg.timestamp < reconnectTimeout);
        if (validMessages.length === 0) {
            pausedMessages.delete(clientId);
            messages.forEach(element => {
                messagesProgress.delete(element.messageID)
            });
            console.log(`[WebSocket] Removed expired paused messages for client ${clientId}`, Array.from(messages.keys()));
        } else {
            pausedMessages.set(clientId, validMessages);
        }
    });
}