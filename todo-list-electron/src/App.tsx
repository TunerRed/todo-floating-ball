import { useEffect, useState } from 'react';
import Ball from './components/Ball';
import Main from './components/Main';
import './App.css';

function App() {
    const [mode, setMode] = useState<string>('loading');

    useEffect(() => {
        const updateMode = () => {
            const hash = window.location.hash.replace('#', '');
            console.log("Current hash:", hash);
            if (hash === 'ball') {
                setMode('ball');
                document.body.classList.add('ball-mode');
            } else {
                setMode('main');
                document.body.classList.remove('ball-mode');
            }
        };

        updateMode();
        window.addEventListener('hashchange', updateMode);
        return () => window.removeEventListener('hashchange', updateMode);
    }, []);

    if (mode === 'ball') {
        return <Ball />;
    } else if (mode === 'main') {
        return <Main />;
    } else {
        return <div style={{color: 'white'}}>Loading...</div>;
    }
}

export default App;
