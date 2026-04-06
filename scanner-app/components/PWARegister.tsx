'use client';

import { useEffect } from 'react';

export default function PWARegister() {
    useEffect(() => {
        if (
            typeof window !== 'undefined' &&
            'serviceWorker' in navigator &&
            window.serwist !== undefined
        ) {
            window.serwist.register();
        }
        // Fallback: register manually if not using serwist auto-register
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/sw.js', { scope: '/' })
                .then((reg) => {
                    console.log('[PWA] Service worker registered:', reg.scope);

                    // Auto-update: when a new SW is waiting, activate it
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    // New content available — post SKIP_WAITING
                                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                                }
                            });
                        }
                    });
                })
                .catch((err) => console.warn('[PWA] SW registration failed:', err));

            // Reload when a new SW takes control
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload();
            });
        }
    }, []);

    return null;
}

// Augment window type for serwist
declare global {
    interface Window {
        serwist?: { register: () => void };
    }
}
