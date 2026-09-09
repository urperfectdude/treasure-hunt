import { HashRouter, Route, Routes } from "react-router-dom";
import Landing from "./routes/Landing";
import Join from "./routes/Join";
import PlayerShell from "./routes/player/PlayerShell";
import PropertyPicker from "./routes/host/PropertyPicker";
import PropertyDetail from "./routes/host/PropertyDetail";
import CreateGame from "./routes/host/CreateGame";
import HostLobby from "./routes/host/HostLobby";
import LiveDashboard from "./routes/host/LiveDashboard";
import Summary from "./routes/host/Summary";

// HashRouter (not BrowserRouter) because GitHub Pages serves a static site
// with no server-side rewrite rule — a deep link like /play/abc123 would
// 404 on refresh with path-based routing. Hash routing needs no server
// config at all.
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/join" element={<Join />} />
        <Route path="/join/:code" element={<Join />} />
        <Route path="/play/:gameId" element={<PlayerShell />} />

        <Route path="/host" element={<PropertyPicker />} />
        <Route path="/host/property/:propertyId" element={<PropertyDetail />} />
        <Route path="/host/property/:propertyId/new-game" element={<CreateGame />} />
        <Route path="/host/:gameId/lobby" element={<HostLobby />} />
        <Route path="/host/:gameId/live" element={<LiveDashboard />} />
        <Route path="/host/:gameId/summary" element={<Summary />} />
      </Routes>
    </HashRouter>
  );
}
