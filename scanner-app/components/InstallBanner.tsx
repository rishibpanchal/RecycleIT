'use client';

import { useEffect, useState } from 'react';

const AppIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--foreground)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
);
const DownloadIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);
const CloseIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

export default function InstallBanner() {
    const [prompt, setPrompt] = useState<Event | null>(null);
    const [visible, setVisible] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        if (sessionStorage.getItem('pwa-dismissed')) return;
        if (window.matchMedia('(display-mode: standalone)').matches) return;
        const handler = (e: Event) => { e.preventDefault(); setPrompt(e); setVisible(true); };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    async function handleInstall() {
        if (!prompt) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (prompt as any).prompt();
        if (result?.outcome === 'accepted') setVisible(false);
    }

    function dismiss() {
        setVisible(false);
        setIsDismissed(true);
        sessionStorage.setItem('pwa-dismissed', '1');
    }

    if (!visible || isDismissed) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: 'calc(64px + env(safe-area-inset-bottom) + 10px)',
            left: 12, right: 12, zIndex: 150,
            background: 'var(--background)',
            border: '1px solid var(--border)',
            borderRadius: 18, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            animation: 'fadeUp 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        }}>
            {/* Icon */}
            <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(245,197,24,0.35)',
            }}>
                <AppIcon />
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
                    Install RacePass Scanner
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    Add to home screen for quick access
                </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button id="install-banner-dismiss" onClick={dismiss} style={{
                    width: 30, height: 30,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 8, color: 'var(--muted)',
                    fontFamily: 'inherit', cursor: 'pointer',
                }}><CloseIcon /></button>
                <button id="install-banner-install" onClick={handleInstall} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '7px 13px',
                    background: 'var(--accent)',
                    border: 'none', borderRadius: 8, color: 'var(--foreground)',
                    fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(245,197,24,0.35)',
                }}><DownloadIcon /> Install</button>
            </div>
        </div>
    );
}
