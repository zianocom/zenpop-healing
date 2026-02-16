import { ZenCanvas } from './components/ZenCanvas';

function App() {
  return (
    <div className="w-full h-[100dvh] bg-slate-900 overflow-hidden relative touch-none select-none">
      <ZenCanvas />

      <div className="absolute bottom-6 left-6 z-10 p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 select-none pointer-events-none shadow-xl">
        <h1 className="text-4xl font-black text-white drop-shadow-lg tracking-tighter" style={{ fontFamily: "'Gowun Dodum', sans-serif" }}>
          젠팝
        </h1>
        <p className="text-white/90 text-lg font-bold tracking-wide mt-1">
          검지로 거품을 터뜨려보세요
        </p>
      </div>
    </div>
  )
}

export default App
