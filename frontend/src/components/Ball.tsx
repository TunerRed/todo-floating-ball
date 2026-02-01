import { useEffect, useState, useRef } from 'react';
import { GetTodos, OpenMain, GetConfig, CheckDocking, Dock, Undock, GetImageBase64, SetBallMenuState, FullQuit } from '../../wailsjs/go/main/App';
import { EventsOn } from '../../wailsjs/runtime/runtime';

export default function Ball() {
    const [style, setStyle] = useState({
        background: '#2ecc71',
        boxShadow: '0 0 5px rgba(0,0,0,0.5)',
        image: '',
        opacity: 1,
        border: '2px solid rgba(255,255,255,0.2)'
    });
    const [count, setCount] = useState(0);
    const [docked, setDocked] = useState<'none'|'left'|'right'>('none');
    const [showMenu, setShowMenu] = useState(false);
    const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
    
    // Cache for base64 image to avoid re-fetching constantly
    const imageCache = useRef<{[key: string]: string}>({});
    
    // Clean up unnecessary drag listeners as we moved docking logic to backend
    useEffect(() => {
        const cleanupDockEvent = EventsOn("dock_state_change", (status: string) => {
             if (status === 'none' || status === 'left' || status === 'right') {
                 setDocked(status as any);
             }
        });

        return () => {
            if (cleanupDockEvent) cleanupDockEvent();
        };
    }, []);

    // Removed polling for CheckDocking - now handled by backend
    // Removed isDragging refs and listeners

    useEffect(() => {
        const check = async () => {
            try {
                const todos = await GetTodos();
                const config = await GetConfig();
                
                const now = new Date();
                let isExpired = false;
                let isUpcoming = false;
                let pendingCount = 0;
                
                for (const t of todos) {
                    if (t.completed) continue;
                    pendingCount++;

                    // Go time.Time is string in JS
                    const due = new Date(t.due_date);
                    if (isNaN(due.getTime())) continue;

                    const diff = due.getTime() - now.getTime();
                    const days = diff / (1000 * 3600 * 24);
                    
                    if (days < 0) {
                        isExpired = true;
                    } else if (days <= t.reminder_days) {
                        isUpcoming = true;
                    }
                }
                
                setCount(pendingCount);
                
                const baseColor = config.edge_light_color || '#2ecc71';
                const urgentColor = config.reminder_color || '#e74c3c'; 
                
                const opacity = config.floating_opacity || 1;
                
                let customIconUrl = '';
                const customIconPath = config.custom_icon_path || '';
                
                if (customIconPath) {
                     if (imageCache.current[customIconPath]) {
                         customIconUrl = imageCache.current[customIconPath];
                     } else {
                         // Fetch base64
                         try {
                             const b64 = await GetImageBase64(customIconPath);
                             if (b64) {
                                 // Guess mime type.
                                 const ext = customIconPath.split('.').pop()?.toLowerCase();
                                 let mime = 'image/png';
                                 if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
                                 
                                 const dataUrl = `data:${mime};base64,${b64}`;
                                 imageCache.current[customIconPath] = dataUrl;
                                 customIconUrl = dataUrl;
                             }
                         } catch (e) {
                             console.error("Failed to load image", e);
                         }
                     }
                }
                
                let targetColor = baseColor;
                let targetBorderColor = baseColor;
                let targetShadow = `0 0 5px ${baseColor}`;

                if (isExpired || isUpcoming) {
                    targetColor = urgentColor;
                    targetBorderColor = urgentColor;
                    targetShadow = `0 0 15px ${urgentColor}`;
                }

                setStyle({
                    background: targetColor,
                    boxShadow: targetShadow,
                    image: customIconUrl,
                    opacity: opacity,
                    border: `2px solid ${targetBorderColor}`
                });

            } catch (e) {
                console.error(e);
            }
        };

        check();
        
        // Listen for updates from backend (triggered by Main window or other events)
        const cleanupEvents = EventsOn("todos_updated", () => {
            console.log("Received update signal");
            check();
        });
        
        // Fallback polling (every 5s instead of 60s) to reduce lag if IPC fails
        const interval = setInterval(check, 5000); 
        
        const focusHandler = () => check();
        
        window.addEventListener('focus', focusHandler);
        window.addEventListener('mouseenter', focusHandler);

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', focusHandler);
            window.removeEventListener('mouseenter', focusHandler);
            if (cleanupEvents) cleanupEvents();
        };
    }, []); 

    useEffect(() => {
        const handleBlur = () => {
            if (showMenu) {
                setShowMenu(false);
                SetBallMenuState(false);
            }
        };
        window.addEventListener('blur', handleBlur);
        return () => window.removeEventListener('blur', handleBlur);
    }, [showMenu]);

    const handleClick = () => {
        if (showMenu) {
            setShowMenu(false);
            SetBallMenuState(false);
            return;
        }
        OpenMain();
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent triggering the window click handler immediately
        
        // Expand window first
        SetBallMenuState(true).then(() => {
             // Position menu below the ball (which is centered)
             // Window is now 300x300. Ball is 80x80 in center.
             // Center is 150, 150.
             // Ball bottom is 150 + 40 = 190.
             // Let's place menu at center-x, and y=195.
             
             setMenuPos({x: 0, y: 0}); // Not using mouse pos anymore, centering relative to ball
             setShowMenu(true);
        });
    };

    if (docked !== 'none') {
        return (
            <div 
                style={{
                    width: '100%', 
                    height: '100%', 
                    // Use background color (which is either blue or red depending on urgency)
                    background: style.background, 
                    cursor: 'pointer',
                    borderRadius: docked === 'left' ? '0 5px 5px 0' : '5px 0 0 5px',
                    boxShadow: '0 0 5px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ['--wails-draggable' as any]: 'no-drag' // Disable drag when docked to ensure click works
                }}
                onClick={async () => {
                    await Undock(docked);
                    setDocked('none');
                }}
            >
                {/* Optional: Add a small arrow or indicator */}
                <div style={{ width: '2px', height: '20px', background: 'rgba(255,255,255,0.5)', borderRadius: '1px' }}></div>
            </div>
        );
    }

    return (
        <div 
            style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                background: 'transparent',
            }}
            onContextMenu={handleContextMenu}
        >
            <div
                style={{
                    position: 'absolute',
                    top: '0px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: style.image ? `url("${style.image}") center/cover no-repeat` : style.background,
                    boxShadow: style.boxShadow,
                    opacity: style.opacity,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    // Wails drag property
                    ['--wails-draggable' as any]: 'drag',
                    border: style.border,
                    transition: 'none'
                }}
                onDoubleClick={handleClick}
                onClick={handleClick}
            >
                {/* 360 style: Show count of tasks if no custom image, or overlay if desired */}
                {!style.image && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ color: 'white', fontWeight: 'bold', fontSize: '18px' }}>{count}</span>
                        <span style={{ color: 'white', fontSize: '12px' }}>待办</span>
                    </div>
                )}
                {style.image && count > 0 && (
                    <div style={{ 
                        position: 'absolute', 
                        bottom: '0', 
                        right: '0', 
                        background: 'red', 
                        color: 'white', 
                        borderRadius: '50%', 
                        width: '24px', 
                        height: '24px', 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold'
                    }}>
                        {count}
                    </div>
                )}
                {/* Custom Context Menu */}
                {showMenu && (
                    <div 
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside menu
                        style={{
                        position: 'absolute',
                        // When menu is open, ball is at 0,0. Center X is 40. Bottom Y is 80.
                        // Menu top should be ~80px.
                        // Window height is 140px.
                        // Ball is 80x80.
                        // Menu is 70px wide.
                        top: '82px', // Slight gap from ball
                        left: '50%', 
                        transform: 'translateX(-50%)', 
                        width: '70px', // Smaller than ball diameter (80px)
                        background: 'white',
                        borderRadius: '4px',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                        zIndex: 1000,
                        padding: '2px 0',
                        overflow: 'hidden'
                    }}>
                        <div 
                            onClick={() => { OpenMain(); setShowMenu(false); SetBallMenuState(false); }}
                            style={{
                                padding: '5px 10px',
                                cursor: 'pointer',
                                color: '#333',
                                fontSize: '10px', // Smaller font
                                textAlign: 'center',
                                borderBottom: '1px solid #eee'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                            onMouseLeave={e => e.currentTarget.style.background = 'white'}
                        >
                            显示主界面
                        </div>
                        <div 
                            onClick={() => FullQuit()}
                            style={{
                                padding: '8px 15px',
                                cursor: 'pointer',
                                color: '#e74c3c',
                                fontSize: '14px'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                            onMouseLeave={e => e.currentTarget.style.background = 'white'}
                        >
                            退出
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
