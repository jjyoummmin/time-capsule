import { Route, Routes, Link } from "react-router-dom";
import { CapsulePage } from "./pages/CapsulePage";
import { HomePage } from "./pages/HomePage";

export function App() {
  return (
    <div className="app">
      <header className="top">
        <div className="top-inner">
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden />
            온라인 타임캡슐
          </Link>
          <span className="tag">drand · tlock</span>
        </div>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/c/:id" element={<CapsulePage />} />
        </Routes>
      </main>
    </div>
  );
}
