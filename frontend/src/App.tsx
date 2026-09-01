import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NewGrading from './pages/NewGrading';
import GradingReview from './pages/GradingReview';
import History from './pages/History';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<NewGrading />} />
        <Route path="/review/:id" element={<GradingReview />} />
        <Route path="/review" element={<GradingReview />} />
        <Route path="/history" element={<History />} />
        {/* Fallback route */}
        <Route path="*" element={<NewGrading />} />
      </Routes>
    </Router>
  );
}
