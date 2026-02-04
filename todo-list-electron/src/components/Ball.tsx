import React, { useEffect, useState, useRef } from 'react';
import { GetTodos, OnTodosUpdated, OpenMain, GetConfig } from '../services/api';

export default function Ball() {
    const [count, setCount] = useState(0);
    const [style, setStyle] = useState<any>({
        background: '#2ecc71',
        border: '2px solid white',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        image: ''
    });

    const [refreshInterval, setRefreshInterval] = useState(60000);
    const nextRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const refresh = async () => {
        try {
            // Clear any pending smart refresh to avoid duplicates
            if (nextRefreshTimeoutRef.current) {
                clearTimeout(nextRefreshTimeoutRef.current);
                nextRefreshTimeoutRef.current = null;
            }

            const todos = await GetTodos();
            const config = await GetConfig();

            // Update refresh interval if changed
            if (config?.refreshInterval && config.refreshInterval !== refreshInterval) {
                setRefreshInterval(config.refreshInterval);
            }

            // Count uncompleted tasks that are either expired or upcoming within reminder days
            const now = new Date();
            const nowTime = now.getTime();
            let nextWakeupTime = Infinity;

            const activeCount = todos.filter(t => {
                if (t.completed) return false;
                const due = new Date(t.dueDate).getTime();
                const diff = due - nowTime;
                const days = diff / (1000 * 3600 * 24);
                
                // Calculate next potential wakeup time for this task
                const reminderTime = due - (t.reminderDays * 24 * 3600 * 1000);
                
                // If task is not yet active (not expired and not in reminder period)
                // Schedule wake up at reminder start
                if (reminderTime > nowTime) {
                    if (reminderTime < nextWakeupTime) nextWakeupTime = reminderTime;
                }
                
                // If task is in reminder period but not expired
                // Schedule wake up at due time (in case we want to distinguish later)
                if (diff > 0 && diff < nextWakeupTime) {
                    if (diff < nextWakeupTime) nextWakeupTime = due;
                }

                return diff < 0 || days <= t.reminderDays;
            }).length;
            
            // Smart Scheduling: If next interesting event is sooner than standard interval, schedule it
            if (nextWakeupTime !== Infinity) {
                const delay = nextWakeupTime - nowTime;
                // Add a small buffer (500ms) to ensure time comparison passes
                const smartDelay = delay + 500;
                
                // Only schedule if it's sooner than the configured interval
                // and reasonable (e.g. > 1 second, otherwise we might loop tight if logic is off)
                if (smartDelay < refreshInterval && smartDelay > 1000) {
                    console.log(`Smart scheduling refresh in ${smartDelay}ms`);
                    nextRefreshTimeoutRef.current = setTimeout(refresh, smartDelay);
                }
            }

            setCount(activeCount);
            
            // Determine background
            // Default Normal: Green (#2ecc71) or configured
            // Default Alert: Red (#e74c3c) or configured
            
            let bg = config?.ballColor || '#2ecc71'; 
            let reminderBg = config?.ballReminderColor || '#e74c3c';
            
            // Determine padding (to act as border space for gradient)
            let padding = '0';
            let containerBg = bg;
            let containerBorder = '2px solid white';
            let containerBoxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            let contentBg = 'transparent';
            let contentBorder = 'none';
            let contentBoxShadow = 'none';

            if (activeCount > 0) {
                // Alert State
                bg = reminderBg; 
                containerBg = reminderBg;
                
                // Pure Color Alert Mode: Ring + White Gap + Inner Ball
                // Use padding for outer ring, inner div for gap + ball
                padding = '5px';
                containerBorder = 'none';
                containerBoxShadow = '0 0 10px rgba(0,0,0,0.3)';
                
                contentBg = reminderBg;
                contentBorder = '2px solid white'; // The gap
                contentBoxShadow = 'none';
            } else {
                // Normal State Pure Color
                containerBorder = '2px solid white';
                containerBoxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            }
            
            // Determine image
            // Only show image if configured and valid
            let image = '';
            
            if (config && config.customIconPath) {
                // Ensure proper URL formatting for Windows paths
                image = `file://${config.customIconPath.replace(/\\/g, '/')}`;
                
                // Custom Image Mode:
                // Container acts as the gradient ring (via background + padding)
                // Inner Content holds the image
                containerBg = bg; // The state color (gradient/solid)
                padding = '5px'; // The ring thickness
                containerBorder = 'none';
                
                // Flat Ring Effect (Just a shadow)
                containerBoxShadow = '0 0 10px rgba(0,0,0,0.2)';
                
                contentBg = `url(${image}) center/cover no-repeat`;
                contentBorder = 'none';
                contentBoxShadow = 'none';
            }

            setStyle({
                containerBg,
                containerBorder,
                containerBoxShadow,
                padding,
                contentBg,
                contentBorder,
                contentBoxShadow,
                image: image,
                opacity: config?.floatingOpacity || 0.8
            });

        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        refresh();
        const cleanup = OnTodosUpdated(refresh);
        
        // Listen for config updates immediately
        const handleConfigUpdate = () => {
            console.log("Config updated event received");
            refresh();
        };
        window.ipcRenderer.on('config-updated', handleConfigUpdate);

        // Handle Docking
        const handleDocked = (_event: any, side: 'left' | 'right') => {
            setIsDocked(side);
        };
        const handleRestored = () => {
            setIsDocked(null);
        };
        window.ipcRenderer.on('ball-docked', handleDocked);
        window.ipcRenderer.on('ball-restored', handleRestored);

        // Also poll for config changes via periodic refresh as backup
        const interval = setInterval(refresh, refreshInterval); 
        return () => {
            cleanup();
            window.ipcRenderer.off('config-updated', handleConfigUpdate);
            window.ipcRenderer.off('ball-docked', handleDocked);
            window.ipcRenderer.off('ball-restored', handleRestored);
            clearInterval(interval);
            if (nextRefreshTimeoutRef.current) {
                clearTimeout(nextRefreshTimeoutRef.current);
            }
        };
    }, [refreshInterval]);

    const [isDragging, setIsDragging] = useState(false);
    const [isDocked, setIsDocked] = useState<'left' | 'right' | null>(null);
    
    // JS-based Drag Implementation to support Context Menu
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                window.ipcRenderer.send('window-move', { x: e.screenX, y: e.screenY });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            window.ipcRenderer.send('window-move-end');
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (isDocked) return; // Disable drag when docked
        // Only left click triggers drag
        if (e.button === 0) {
            setIsDragging(true);
            window.ipcRenderer.send('window-move-start', { x: e.screenX, y: e.screenY });
        }
    };

    const handleDoubleClick = () => {
        if (isDocked) return;
        OpenMain();
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        window.ipcRenderer.send('show-ball-context-menu');
    };

    const handleDockClick = () => {
        window.ipcRenderer.send('undock-ball');
    };

    if (isDocked) {
        return (
            <div 
                onClick={handleDockClick}
                style={{
                    width: '100%',
                    height: '100%',
                    background: style.containerBg,
                    borderTopRightRadius: isDocked === 'left' ? '10px' : '0',
                    borderBottomRightRadius: isDocked === 'left' ? '10px' : '0',
                    borderTopLeftRadius: isDocked === 'right' ? '10px' : '0',
                    borderBottomLeftRadius: isDocked === 'right' ? '10px' : '0',
                    cursor: 'pointer',
                    opacity: style.opacity,
                    boxShadow: '0 0 5px rgba(0,0,0,0.2)'
                }}
            />
        );
    }

    return (
        <div style={{
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            borderRadius: '50%',
            background: style.containerBg,
            padding: style.padding,
            border: style.containerBorder,
            boxShadow: style.containerBoxShadow,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            position: 'relative',
            overflow: 'visible',
            opacity: style.opacity,
            transition: 'background 0.3s ease'
        } as React.CSSProperties}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        title="双击打开主界面"
        >
            <div style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: style.contentBg,
                border: style.contentBorder,
                boxShadow: style.contentBoxShadow,
                boxSizing: 'border-box'
            }} />

            {count > 0 && !style.image && (
                 <span style={{
                     position: 'absolute',
                     color: 'white',
                     fontWeight: 'bold',
                     fontSize: '28px',
                     textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                     userSelect: 'none',
                     zIndex: 5
                 }}>
                     {count > 99 ? '99+' : count}
                 </span>
            )}

            {count > 0 && style.image && (
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
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    zIndex: 10
                }}>
                    {count > 99 ? '99+' : count}
                </div>
            )}
        </div>
    );
}
