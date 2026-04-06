'use client';

interface ToastProps {
    message: string;
    visible: boolean;
}

export default function Toast({ message, visible }: ToastProps) {
    return (
        <div style={{
            position: 'fixed',
            bottom: 'calc(var(--nav-h) + var(--safe-bottom) + 14px)',
            left: '50%',
            transform: `translateX(-50%) translateY(${visible ? '0' : '10px'})`,
            background: 'var(--foreground)',
            color: '#fff',
            borderRadius: 10,
            padding: '9px 18px',
            fontSize: 13, fontWeight: 500,
            whiteSpace: 'nowrap',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.22s, transform 0.22s',
            zIndex: 300,
            pointerEvents: 'none',
            boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
        }}>
            {message}
        </div>
    );
}
