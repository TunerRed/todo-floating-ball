import { useEffect, useState } from 'react';
import { GetTodos, AddTodo, ToggleTodo, DeleteTodo, GetConfig, UpdateConfig, SelectFile } from '../services/api';
import { TodoItem, AppConfig } from '../types';

export default function Main() {
    const [todos, setTodos] = useState<TodoItem[]>([]);
    const [filter, setFilter] = useState('all');
    const [newContent, setNewContent] = useState('');
    const [newDate, setNewDate] = useState('');
    const [newReminder, setNewReminder] = useState(1);
    
    // View state
    const [view, setView] = useState('tasks'); // 'tasks' or 'settings'
    const [config, setConfig] = useState<AppConfig>({} as AppConfig);
    const [saveMsg, setSaveMsg] = useState('');

    const refresh = async () => {
        try {
            const items = await GetTodos();
            setTodos(items || []);
        } catch (e) {
            console.error(e);
        }
    };

    const loadConfig = async () => {
        try {
            const cfg = await GetConfig();
            setConfig(cfg || {});
        } catch (e) {
            console.error(e);
        }
    }

    useEffect(() => {
        console.log("Main component mounted");
        refresh();
        loadConfig();

        const handleConfigUpdate = () => {
            console.log("Config updated event received in Main");
            loadConfig();
        };
        window.ipcRenderer.on('config-updated', handleConfigUpdate);
        
        // Listen for todos updates from other sources (e.g. if we had multiple windows)
        const handleTodosUpdate = () => {
            refresh();
        };
        window.ipcRenderer.on('todos-updated', handleTodosUpdate);

        return () => {
            window.ipcRenderer.off('config-updated', handleConfigUpdate);
            window.ipcRenderer.off('todos-updated', handleTodosUpdate);
        };
    }, []);

    // Separate effect for interval to handle dynamic changes
    useEffect(() => {
        const intervalMs = config.refreshInterval || 60000;
        console.log(`Setting Main refresh interval to ${intervalMs}ms`);
        
        const interval = setInterval(refresh, intervalMs);
        return () => clearInterval(interval);
    }, [config.refreshInterval]);

    const handleAdd = async () => {
        if (!newContent) return;
        const dateStr = newDate ? new Date(newDate).toISOString() : new Date().toISOString();
        await AddTodo(newContent, dateStr, Number(newReminder));
        setNewContent('');
        refresh();
    };
    
    const handleSaveConfig = async () => {
        try {
            console.log("Saving config:", config);
            setSaveMsg('保存中...');
            // Ensure we sync customIconPath to mainWindowIcon/ballWindowIcon if needed
            const newConfig = { ...config };
            if (newConfig.customIconPath) {
                newConfig.mainWindowIcon = newConfig.customIconPath;
                newConfig.ballWindowIcon = newConfig.customIconPath;
            }
            await UpdateConfig(newConfig);
            setSaveMsg('设置已保存');
            setTimeout(() => setSaveMsg(''), 2000);
        } catch(e) {
            console.error("Save config error:", e);
            setSaveMsg('保存失败: ' + e);
        }
    };
    
    const handleSelectImage = async () => {
        try {
            const path = await SelectFile();
            if (path) {
                setConfig({...config, customIconPath: path});
            }
        } catch(e) {
            console.error(e);
        }
    };

    const filteredTodos = todos.filter(t => {
        if (filter === 'all') return true;
        const now = new Date();
        const due = new Date(t.dueDate);
        const diff = due.getTime() - now.getTime();
        
        if (filter === 'completed') return t.completed;
        
        if (t.completed) return false; 
        
        const days = diff / (1000 * 3600 * 24);

        if (filter === 'expired') return diff < 0;
        if (filter === 'upcoming') return diff > 0 && days <= t.reminderDays;
        return true;
    });

    filteredTodos.sort((a, b) => {
        if (a.completed && !b.completed) return 1;
        if (!a.completed && b.completed) return -1;
        
        const now = new Date().getTime();
        const aDue = new Date(a.dueDate).getTime();
        const bDue = new Date(b.dueDate).getTime();
        
        const aExpired = aDue < now;
        const bExpired = bDue < now;
        
        if (aExpired !== bExpired) {
            return aExpired ? 1 : -1; 
        }
        
        return aDue - bDue;
    });

    const menuStyle = (f: string) => ({
        padding: '10px 15px',
        cursor: 'pointer',
        background: (view === 'tasks' && filter === f) ? 'rgba(255,255,255,0.1)' : 'transparent',
        borderRadius: '4px'
    });
    
    const settingsStyle = () => ({
        padding: '10px 15px',
        cursor: 'pointer',
        background: view === 'settings' ? 'rgba(255,255,255,0.1)' : 'transparent',
        borderRadius: '4px',
        marginTop: '20px'
    });

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#f5f5f5', fontFamily: 'Microsoft YaHei, SimHei, sans-serif' }}>
            {/* Sidebar */}
            <div style={{ width: '200px', background: '#2c3e50', color: 'white', padding: '20px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <h2 style={{ marginBottom: '20px', textAlign: 'center' }}>待办事项</h2>
                <div style={menuStyle('all')} onClick={() => { setFilter('all'); setView('tasks'); }}>全部任务</div>
                <div style={menuStyle('upcoming')} onClick={() => { setFilter('upcoming'); setView('tasks'); }}>即将到期</div>
                <div style={menuStyle('expired')} onClick={() => { setFilter('expired'); setView('tasks'); }}>已过期</div>
                <div style={menuStyle('completed')} onClick={() => { setFilter('completed'); setView('tasks'); }}>已完成</div>
                
                <div style={settingsStyle()} onClick={() => setView('settings')}>⚙ 设置</div>
            </div>
            
            {/* Content */}
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {view === 'tasks' ? (
                    <>
                        {/* Input Area */}
                        <div style={{ marginBottom: '20px', background: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input 
                        value={newContent} 
                        onChange={e => setNewContent(e.target.value)} 
                        placeholder="添加新任务..." 
                        style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ddd', minWidth: '200px' }}
                    />
                    <input 
                        type="datetime-local" 
                        value={newDate} 
                        onChange={e => setNewDate(e.target.value)}
                        style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                    <select 
                        value={newReminder} 
                        onChange={e => setNewReminder(Number(e.target.value))}
                        style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
                    >
                        <option value={0}>不提醒</option>
                        <option value={1}>1天前提醒</option>
                        <option value={3}>3天前提醒</option>
                        <option value={7}>7天前提醒</option>
                        <option value={14}>14天前提醒</option>
                        <option value={30}>30天前提醒</option>
                    </select>
                    <button onClick={handleAdd} style={{ padding: '10px 20px', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        添加
                    </button>
                </div>

                {/* List */}
                <div className="list" style={{ flex: 1 }}>
                    {filteredTodos.map(t => {
                        const now = new Date();
                        const due = new Date(t.dueDate);
                        const isExpired = due < now && !t.completed;
                        
                        const diff = due.getTime() - now.getTime();
                        const days = diff / (1000 * 3600 * 24);
                        const isUpcoming = !isExpired && !t.completed && days <= t.reminderDays && days > 0;
                        
                        let borderColor = '#3498db'; // Default blue
                        if (t.completed) borderColor = '#2ecc71'; // Green
                        else if (isExpired) borderColor = '#e74c3c'; // Red
                        else if (isUpcoming) borderColor = '#f39c12'; // Orange for upcoming

                        return (
                            <div key={t.id} style={{ 
                                background: 'white', 
                                padding: '15px', 
                                marginBottom: '10px', 
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                borderLeft: `5px solid ${borderColor}`
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={t.completed} 
                                        onChange={async () => { await ToggleTodo(t.id); refresh(); }} 
                                        style={{ transform: 'scale(1.5)', cursor: 'pointer' }}
                                    />
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
                                        <span style={{ 
                                            textDecoration: t.completed ? 'line-through' : 'none', 
                                            color: t.completed ? '#95a5a6' : '#2c3e50',
                                            fontSize: '16px',
                                            fontWeight: isExpired || isUpcoming ? 'bold' : 'normal',
                                            textAlign: 'left'
                                        }}>
                                            {t.title}
                                        </span>
                                        <span style={{ fontSize: '12px', color: isExpired ? '#e74c3c' : (isUpcoming ? '#e67e22' : '#7f8c8d'), marginTop: '4px', textAlign: 'left' }}>
                                            截止: {due.toLocaleString()}
                                            {isExpired && " (已过期)"}
                                            {isUpcoming && " (即将到期)"}
                                        </span>
                                    </div>
                                </div>
                                <button onClick={async () => { await DeleteTodo(t.id); refresh(); }} style={{ color: '#e74c3c', background: 'none', border: 'none', cursor: 'pointer', padding: '5px' }}>
                                    删除
                                </button>
                            </div>
                        );
                    })}
                    {filteredTodos.length === 0 && <div style={{ textAlign: 'center', color: '#95a5a6', marginTop: '50px' }}>暂无任务</div>}
                </div>
                </>
            ) : (
                <div style={{ background: 'white', color: '#333', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', overflowY: 'auto', textAlign: 'left' }}>
                    <h2 style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px', color: '#333', textAlign: 'left' }}>设置</h2>
                    
                    <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: '#333' }}>
                            <input 
                                type="checkbox"
                                checked={config.startOnBoot || false}
                                onChange={e => setConfig({...config, startOnBoot: e.target.checked})}
                                style={{ transform: 'scale(1.2)' }}
                            />
                            <span style={{ fontWeight: 'bold' }}>开机自启动</span>
                        </label>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>主界面尺寸</label>
                        <select
                            value={`${config.windowWidth || 1080}x${config.windowHeight || 720}`}
                            onChange={e => {
                                const [w, h] = e.target.value.split('x').map(Number);
                                setConfig({...config, windowWidth: w, windowHeight: h});
                            }}
                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', width: '200px', color: '#333', background: 'white' }}
                        >
                            <option value="800x600">800 x 600</option>
                            <option value="1024x768">1024 x 768</option>
                            <option value="1080x720">1080 x 720 (默认)</option>
                            <option value="1280x720">1280 x 720</option>
                            <option value="1280x800">1280 x 800</option>
                            <option value="1440x900">1440 x 900</option>
                            <option value="1600x900">1600 x 900</option>
                            <option value="1920x1080">1920 x 1080</option>
                            <option value="2560x1440">2560 x 1440</option>
                        </select>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>到期检测频率</label>
                        <select
                            value={config.refreshInterval || 60000}
                            onChange={e => setConfig({...config, refreshInterval: Number(e.target.value)})}
                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', width: '200px', color: '#333', background: 'white' }}
                        >
                            <option value={60000}>1 分钟</option>
                            <option value={600000}>10 分钟</option>
                            <option value={3600000}>1 小时</option>
                            <option value={86400000}>1 天</option>
                        </select>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                             * 设置检测待办事项是否到期的频率。
                         </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>悬浮球普通状态颜色</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {[
                                '#2ecc71', // Green (Default)
                                '#3498db', // Blue
                                '#f1c40f', // Yellow
                                '#9b59b6', // Purple
                                '#34495e', // Dark Blue
                                '#e67e22', // Orange
                                '#1abc9c', // Turquoise
                                'linear-gradient(135deg, #6e8efb, #a777e3)', // Gradient 1
                                'linear-gradient(135deg, #f093fb, #f5576c)', // Gradient 2
                                'linear-gradient(135deg, #84fab0, #8fd3f4)', // Gradient 3
                            ].map((color, idx) => (
                                <div 
                                    key={idx}
                                    onClick={() => setConfig({...config, ballColor: color})}
                                    style={{
                                        width: '30px',
                                        height: '30px',
                                        borderRadius: '50%',
                                        background: color,
                                        cursor: 'pointer',
                                        border: (config.ballColor || '#2ecc71') === color ? '3px solid #333' : '1px solid #ddd',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                    title={`Color ${idx + 1}`}
                                />
                            ))}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                            * 普通状态：无待办或待办未到期时的颜色。
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>悬浮球提醒状态颜色</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {[
                                '#e74c3c', // Red (Default)
                                '#c0392b', // Dark Red
                                '#d35400', // Pumpkin
                                '#f39c12', // Orange
                                '#8e44ad', // Purple
                                '#2c3e50', // Midnight Blue
                                '#16a085', // Green Sea
                                'linear-gradient(135deg, #ff9a9e, #fecfef)', // Gradient 1
                                'linear-gradient(135deg, #fbc2eb, #a6c1ee)', // Gradient 2
                                'linear-gradient(135deg, #fdcbf1, #e6dee9)', // Gradient 3
                            ].map((color, idx) => (
                                <div 
                                    key={idx}
                                    onClick={() => setConfig({...config, ballReminderColor: color})}
                                    style={{
                                        width: '30px',
                                        height: '30px',
                                        borderRadius: '50%',
                                        background: color,
                                        cursor: 'pointer',
                                        border: (config.ballReminderColor || '#e74c3c') === color ? '3px solid #333' : '1px solid #ddd',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                    title={`Color ${idx + 1}`}
                                />
                            ))}
                        </div>
                         <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                             * 提醒状态：当有待办事项即将到期或已过期时的颜色。
                         </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                            悬浮球透明度 ({Math.round((config.floatingOpacity || 0.8) * 100)}%)
                        </label>
                        <input 
                            type="range"
                            min="0.3"
                            max="1.0"
                            step="0.05"
                            value={config.floatingOpacity || 0.8}
                            onChange={e => setConfig({...config, floatingOpacity: parseFloat(e.target.value)})}
                            style={{ width: '100%' }}
                        />
                    </div>
                    
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>悬浮球自定义图片</label>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input 
                                type="text" 
                                value={config.customIconPath || ''}
                                readOnly
                                placeholder="未选择图片..."
                                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ddd', background: '#f9f9f9', color: '#555' }}
                            />
                            {config.customIconPath && (
                                <img 
                                    src={`file://${config.customIconPath}`} 
                                    alt="Preview" 
                                    style={{ 
                                        width: '34px', 
                                        height: '34px', 
                                        objectFit: 'cover', 
                                        border: '1px solid #ddd', 
                                        borderRadius: '50%',
                                        flexShrink: 0
                                    }} 
                                />
                            )}
                            <button onClick={handleSelectImage} style={{ padding: '8px 15px', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                选择...
                            </button>
                            <button onClick={() => setConfig({...config, customIconPath: ''})} style={{ padding: '8px 15px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                清除
                            </button>
                        </div>
                    </div>

                    <div style={{ marginTop: '30px', textAlign: 'right' }}>
                        <span style={{ marginRight: '15px', color: '#27ae60', fontWeight: 'bold' }}>{saveMsg}</span>
                        <button onClick={handleSaveConfig} style={{ padding: '10px 30px', background: '#2c3e50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}>
                            保存设置
                        </button>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
}
