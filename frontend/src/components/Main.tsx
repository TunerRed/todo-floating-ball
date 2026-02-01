import { useEffect, useState } from 'react';
import { GetTodos, AddTodo, ToggleTodo, DeleteTodo, GetConfig, UpdateConfig, SelectFile } from '../../wailsjs/go/main/App';

export default function Main() {
    const [todos, setTodos] = useState<any[]>([]);
    const [filter, setFilter] = useState('all');
    const [newContent, setNewContent] = useState('');
    const [newDate, setNewDate] = useState('');
    const [newReminder, setNewReminder] = useState(1);
    
    // View state
    const [view, setView] = useState('tasks'); // 'tasks' or 'settings'
    const [config, setConfig] = useState<any>({});
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
            setConfig(cfg);
        } catch (e) {
            console.error(e);
        }
    }

    useEffect(() => {
        refresh();
        loadConfig();
        const interval = setInterval(refresh, 2000);
        return () => clearInterval(interval);
    }, []);

    const handleAdd = async () => {
        if (!newContent) return;
        // Default to tomorrow if no date? Or today?
        // User requested dropdown date picker.
        const dateStr = newDate ? new Date(newDate).toISOString() : new Date().toISOString();
        await AddTodo(newContent, dateStr, Number(newReminder));
        setNewContent('');
        refresh();
    };
    
    const handleSaveConfig = async () => {
        try {
            console.log("Saving config:", config);
            setSaveMsg('保存中...');
            await UpdateConfig(config);
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
                setConfig({...config, custom_icon_path: path});
            }
        } catch(e) {
            console.error(e);
        }
    };

    const filteredTodos = todos.filter(t => {
        if (filter === 'all') return true;
        const now = new Date();
        const due = new Date(t.due_date);
        const diff = due.getTime() - now.getTime();
        
        if (filter === 'completed') return t.completed;
        
        if (t.completed) return false; // Other filters exclude completed? Usually.
        
        const days = diff / (1000 * 3600 * 24);

        if (filter === 'expired') return diff < 0;
        if (filter === 'upcoming') return diff > 0 && days <= t.reminder_days;
        return true;
    });

    // Sort: Upcoming (Future) -> Expired (Past) -> Completed
    filteredTodos.sort((a, b) => {
        if (a.completed && !b.completed) return 1;
        if (!a.completed && b.completed) return -1;
        
        const now = new Date().getTime();
        const aDue = new Date(a.due_date).getTime();
        const bDue = new Date(b.due_date).getTime();
        
        const aExpired = aDue < now;
        const bExpired = bDue < now;
        
        // If one is expired and other is not, Upcoming (Not Expired) comes first
        if (aExpired !== bExpired) {
            return aExpired ? 1 : -1; 
        }
        
        // If both are same category (both upcoming or both expired)
        // Sort by date asc (soonest first for upcoming, oldest first for expired? or just time asc)
        // Time asc:
        // Upcoming: T+1h, T+2h... (Correct, soonest first)
        // Expired: T-2h, T-1h... (Oldest expired first? No, T-2h is smaller than T-1h. So T-2h comes first.)
        // Usually we want "Most recently expired" close to the "Now" line?
        // Or "Most overdue" at top of expired list?
        // Let's stick to simple time asc for now.
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
                        const due = new Date(t.due_date);
                        const isExpired = due < now && !t.completed;
                        
                        const diff = due.getTime() - now.getTime();
                        const days = diff / (1000 * 3600 * 24);
                        const isUpcoming = !isExpired && !t.completed && days <= t.reminder_days && days > 0;
                        
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
                                checked={config.start_on_boot || false}
                                onChange={e => setConfig({...config, start_on_boot: e.target.checked})}
                                style={{ transform: 'scale(1.2)' }}
                            />
                            <span style={{ fontWeight: 'bold' }}>开机自启动</span>
                        </label>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>主界面尺寸</label>
                        <select
                            value={`${config.window_width || 1080}x${config.window_height || 720}`}
                            onChange={e => {
                                const [w, h] = e.target.value.split('x').map(Number);
                                setConfig({...config, window_width: w, window_height: h});
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
                        </select>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                            悬浮球透明度 ({Math.round((config.floating_opacity || 0.8) * 100)}%)
                        </label>
                        <input 
                            type="range"
                            min="0.3"
                            max="1.0"
                            step="0.05"
                            value={config.floating_opacity || 0.8}
                            onChange={e => setConfig({...config, floating_opacity: parseFloat(e.target.value)})}
                            style={{ width: '100%' }}
                        />
                    </div>
                    
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>悬浮球自定义图片</label>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input 
                                type="text"
                                value={config.custom_icon_path || ''}
                                readOnly
                                placeholder="未选择图片 (默认显示文字)"
                                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ddd', background: '#f9f9f9', color: '#333' }}
                            />
                            <button onClick={handleSelectImage} style={{ padding: '8px 15px', background: '#ecf0f1', border: '1px solid #bdc3c7', borderRadius: '4px', cursor: 'pointer', color: '#333' }}>
                                选择...
                            </button>
                            {config.custom_icon_path && (
                                <button onClick={() => setConfig({...config, custom_icon_path: ''})} style={{ padding: '8px 15px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                    清除
                                </button>
                            )}
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>悬浮球颜色 (正常状态)</label>
                         <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input 
                                type="color"
                                value={config.edge_light_color || '#3498db'}
                                onChange={e => setConfig({...config, edge_light_color: e.target.value})}
                                style={{ width: '50px', height: '30px', padding: 0, border: 'none', background: 'none' }}
                            />
                            <span style={{ fontSize: '12px', color: '#7f8c8d' }}>设置悬浮球在正常状态下的背景颜色（自定义图片模式下为边框颜色）</span>
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>悬浮球边缘背光颜色 (提醒状态)</label>
                         <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input 
                                type="color"
                                value={config.reminder_color || '#e74c3c'}
                                onChange={e => setConfig({...config, reminder_color: e.target.value})}
                                style={{ width: '50px', height: '30px', padding: 0, border: 'none', background: 'none' }}
                            />
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px', marginTop: '30px', alignItems: 'center' }}>
                        <button onClick={handleSaveConfig} style={{ padding: '10px 30px', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}>
                            保存所有设置
                        </button>
                        {saveMsg && (
                            <span style={{ 
                                color: saveMsg.includes('失败') ? '#e74c3c' : '#2ecc71',
                                fontWeight: 'bold'
                            }}>
                                {saveMsg}
                            </span>
                        )}
                    </div>
                </div>
            )}
            </div>
        </div>
    );
}
