import React from 'react';
import TaskPanel from './components/TaskPanel';

const App: React.FC = () => {
  return (
    <div className="relative w-full h-full min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 flex items-center justify-center p-8">
      
      {/* Background Decor to show transparency/glassmorphism better */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
      <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-1/2 w-64 h-64 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>

      <div className="z-10 flex flex-col items-center gap-6">
        <h1 className="text-2xl font-bold text-slate-700 tracking-tight drop-shadow-sm">
          Floating Task View
        </h1>
        
        {/* The Component requested by user */}
        <TaskPanel />

        <p className="text-sm text-slate-500 font-medium">
          Try hovering, adding tasks, and changing categories.
        </p>
      </div>
    </div>
  );
};

export default App;