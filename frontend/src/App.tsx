import { useEffect, useState } from 'react';
import { GetMode } from '../wailsjs/go/main/App';
import Ball from './components/Ball';
import Main from './components/Main';
import './App.css';

function App() {
    const [mode, setMode] = useState<string>('');

    useEffect(() => {
        // Check mode on mount
        GetMode().then(m => {
            console.log("Mode:", m);
            setMode(m);
        }).catch(err => {
            console.error("Failed to get mode:", err);
            // Default to main if fails? Or ball?
            // If we are developing in browser, GetMode might fail or return undefined.
            setMode('main'); 
        });
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
