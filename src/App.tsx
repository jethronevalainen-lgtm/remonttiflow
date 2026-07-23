import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import {
  Dashboard,
  Tyonjohto,
  Projektit,
  Aikataulutus,
  Paivakirjat,
  Laskenta,
  Maaralaskenta,
  Jatehuolto,
  Tyomaaraykset,
  Tyovuorokalenteri,
  Tuntikirjaukset,
  Matkakulut,
  Tyoturvallisuus,
  CRM,
  Asiakkaat,
  AIPage,
  Viestinta,
  Kalusto,
  Henkilosto,
  Lomakkeet,
  Raportit,
} from './pages';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tyonjohto" element={<Tyonjohto />} />
        <Route path="/projektit" element={<Projektit />} />
        <Route path="/aikataulutus" element={<Aikataulutus />} />
        <Route path="/paivakirjat" element={<Paivakirjat />} />
        <Route path="/laskenta" element={<Laskenta />} />
        <Route path="/maaralaskenta" element={<Maaralaskenta />} />
        <Route path="/jatehuolto" element={<Jatehuolto />} />
        <Route path="/tyomaaraykset" element={<Tyomaaraykset />} />
        <Route path="/tyovuorokalenteri" element={<Tyovuorokalenteri />} />
        <Route path="/tuntikirjaukset" element={<Tuntikirjaukset />} />
        <Route path="/matkakulut" element={<Matkakulut />} />
        <Route path="/tyoturvallisuus" element={<Tyoturvallisuus />} />
        <Route path="/crm" element={<CRM />} />
        <Route path="/asiakkaat" element={<Asiakkaat />} />
        <Route path="/ai" element={<AIPage />} />
        <Route path="/viestinta" element={<Viestinta />} />
        <Route path="/kalusto" element={<Kalusto />} />
        <Route path="/henkilosto" element={<Henkilosto />} />
        <Route path="/lomakkeet" element={<Lomakkeet />} />
        <Route path="/raportit" element={<Raportit />} />
      </Route>
    </Routes>
  );
}
