/// <reference types="vite/client" />

import SOCKET from './src/paulsn/ws_client';

declare global {
    interface Window {
        SOCKET: typeof SOCKET | undefined,
    }
}
