'use client';

export default function OfflinePage() {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '100dvh',
            background: '#0a0a0f',
            color: '#f1f5f9',
            fontFamily: 'Inter, sans-serif',
            padding: 24, textAlign: 'center',
        }}>
            {/* Background orb */}
            <div style={{
                position: 'fixed', borderRadius: '50%', pointerEvents: 'none',
                filter: 'blur(80px)', opacity: 0.15,
                width: 300, height: 300, top: '20%', left: '50%', transform: 'translateX(-50%)',
                background: 'radial-gradient(circle, #7c3aed, transparent)',
            }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{
                    width: 80, height: 80, borderRadius: 20, margin: '0 auto 24px',
                    background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 38, boxShadow: '0 0 32px rgba(124,58,237,0.4)',
                }}>
                    🏎️
                </div>

                <div style={{ fontSize: 42, marginBottom: 16 }}>📡</div>

                <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                    You&apos;re Offline
                </h1>
                <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, marginBottom: 32, maxWidth: 280 }}>
                    RacePass Scanner needs an internet connection to check in attendees and verify tickets.
                    Please connect to WiFi or mobile data.
                </p>

                <div style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 16, padding: '16px 20px',
                    marginBottom: 24, textAlign: 'left',
                    maxWidth: 300, width: '100%',
                }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 12 }}>
                        What you can do offline
                    </p>
                    {[
                        { icon: '🕐', text: 'View your scan history' },
                        { icon: '📋', text: 'See already-loaded events' },
                        { icon: '📷', text: 'Open & test the camera' },
                    ].map((item) => (
                        <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 13 }}>
                            <span>{item.icon}</span>
                            <span style={{ color: '#cbd5e1' }}>{item.text}</span>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => window.location.reload()}
                    style={{
                        padding: '14px 32px',
                        background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
                        border: 'none', borderRadius: 14, color: '#fff',
                        fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 600,
                        cursor: 'pointer', boxShadow: '0 4px 24px rgba(124,58,237,0.35)',
                    }}
                >
                    🔄 Try Again
                </button>
            </div>
        </div>
    );
}
