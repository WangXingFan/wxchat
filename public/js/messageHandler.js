const MessageHandler = {
    init() {},
    async clearAllMessages() {
        return { success: false, error: 'MessageHandler unavailable' };
    }
};

if (typeof window !== 'undefined') {
    window.MessageHandler = MessageHandler;
}
