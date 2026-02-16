import { ZenCanvas } from './components/ZenCanvas';

function App() {
  return (
    <div className="w-full h-screen bg-slate-900 overflow-hidden relative">
      <ZenCanvas />

      <div className="absolute top-4 left-4 z-10 p-4 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 select-none pointer-events-none">
        <h1 className="text-2xl font-bold text-white mb-1 drop-shadow-md">Zen-Pop</h1>
        <p className="text-white/80 text-sm drop-shadow-sm">Pop bubbles with your index finger</p>
      </div>
    </div>
  )
}

export default App
