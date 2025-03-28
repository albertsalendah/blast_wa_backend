interface MessageProgress {
    type: 'message_progress';
    id: string;
    email: string;
    sender: string;
    totalData: number;
    targetName: string;
    targetNumber: string;
    onWA: boolean;
    message: string;
    messageStatus: boolean;
    status: 'sending';
    progressCount: number;
    isPause: boolean;
    isCancel: boolean;
    imageUrl: string[];
    pathExcel: string;
    createAt: string;
}

interface MessageGroupedResult {
    messageID: string;
    sender: string;
    message: string;
    imageUrl: string[];
    createAt: string;
    successCount: number;
    failedCount: number;
}

interface Messages {
    id: number;
    messageID: string;
    email: string;
    sender: string;
    totalData: number;
    targetName: string;
    targetNumber: string;
    onWA: boolean;
    message: string;
    messageStatus: boolean;
    imageUrl: string[];
    createAt: string;
}